import type messages from './messages/en.json'
import { openapi } from '@/generated/openapi'

export const resources = [
  {
    name: 'hikes',
    label: 'Hikes',
    kind: 'hike',
    write: 'HikeWrite',
    english: 'HikeEnglishContent',
    image: 'cover-image',
  },
  {
    name: 'locations',
    label: 'Locations',
    kind: 'location',
    write: 'LocationWrite',
    english: 'LocationEnglish',
    image: 'logo',
  },
  {
    name: 'regions',
    label: 'Regions',
    kind: 'region',
    write: 'RegionWrite',
    english: 'RegionEnglish',
  },
  {
    name: 'achievements',
    label: 'Achievements',
    kind: 'achievement',
    write: 'AchievementWrite',
    english: 'AchievementEnglish',
  },
]
export type Resource = (typeof resources)[number]
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export interface Schema {
  $ref?: string
  type?: string
  title?: string
  format?: string
  default?: Json
  const?: Json
  enum?: Json[]
  required?: string[]
  properties?: Record<string, Schema>
  items?: Schema
  anyOf?: Schema[]
  oneOf?: Schema[]
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
}
const schemas = openapi.components.schemas as unknown as Record<string, Schema>

export function schemaFor(name: string): Schema {
  return schemas[name]
}

export function resolve(schema: Schema): Schema {
  if (schema.$ref) {
    const { $ref, ...overrides } = schema
    return { ...resolve(schemaFor($ref.split('/').at(-1) || '')), ...overrides }
  }
  return schema.enum?.length === 1 ? { ...schema, const: schema.enum[0] } : schema
}

export function nonNull(schema: Schema): Schema {
  const resolved = resolve(schema)
  return resolve(resolved.anyOf?.find((item) => item.type !== 'null') || resolved)
}

export function initialValue(schema: Schema): Json {
  const declared = resolve(schema)
  if (declared.default !== undefined) {
    return declared.default
  }
  if (declared.anyOf?.some((option) => option.type === 'null')) {
    return null
  }
  const resolved = nonNull(schema)
  if (resolved.default !== undefined) {
    return resolved.default
  }
  if (resolved.const !== undefined) {
    return resolved.const
  }
  if (resolved.properties) {
    return Object.fromEntries(
      Object.entries(resolved.properties).map(([key, value]) => [key, initialValue(value)]),
    )
  }
  if (resolved.oneOf) {
    return initialValue(resolved.oneOf[0])
  }
  if (resolved.type === 'array') {
    return []
  }
  return null
}

export function record(value: Json | undefined): Record<string, Json> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function title(value: Json) {
  const row = record(value)
  const translated = record(row.translation)
  return text(row.name || row.title || translated.title || row.id)
}

export function writeValue(schema: Schema, value: Json): Json {
  const fields = nonNull(schema).properties
  if (!fields) {
    return value
  }
  const source = record(value)
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => {
      let current = source[key]
      if (key === 'english') {
        current =
          source.translation && record(source.translation).title ? source.translation : source
      }
      if (key === 'location_id') {
        current = record(source.location).id || null
      }
      if (key === 'region_ids' && Array.isArray(source.regions)) {
        current = source.regions.map((region) => record(region).id)
      }
      return [key, current == null ? initialValue(field) : writeValue(field, current)]
    }),
  )
}

export function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : ''
}

export const referenceResources: Record<string, string> = {
  location_id: 'locations',
  hike_id: 'hikes',
  region_ids: 'regions',
}

interface EditorGroup {
  title: keyof typeof messages.editorSections
  fields: string[]
}

const editorGroups: Partial<Record<string, EditorGroup[]>> = {
  HikeWrite: [
    { title: 'content', fields: ['english'] },
    {
      title: 'journey',
      fields: [
        'status',
        'location_id',
        'planned_start_at',
        'planned_end_at',
        'actual_start_at',
        'actual_end_at',
      ],
    },
    { title: 'statistics', fields: ['distance_km', 'ascent_m'] },
    {
      title: 'route',
      fields: [
        'start_point',
        'end_point',
        'start_latitude',
        'start_longitude',
        'end_latitude',
        'end_longitude',
        'direction',
        'route_scope',
        'start_stage',
        'end_stage',
      ],
    },
    { title: 'overnights', fields: ['overnights_recorded_at', 'overnights'] },
    { title: 'cards', fields: ['cards'] },
  ],
  LocationWrite: [
    { title: 'content', fields: ['english'] },
    {
      title: 'geography',
      fields: ['kind', 'country_codes', 'region_ids', 'arctic_circle_position'],
    },
    { title: 'trail', fields: ['official_url', 'waymarking', 'is_loop', 'terrains'] },
    { title: 'season', fields: ['hiking_months', 'information_checked_at'] },
    { title: 'water', fields: ['water_sources_status', 'water_sources'] },
    {
      title: 'overnights',
      fields: [
        'overnight_options_status',
        'overnight_options',
        'overnight_restrictions_status',
        'overnight_restrictions',
      ],
    },
    { title: 'ratings', fields: ['ratings'] },
  ],
  RegionWrite: [{ title: 'content', fields: ['english'] }],
  AchievementWrite: [
    { title: 'content', fields: ['english'] },
    { title: 'details', fields: ['hike_id', 'icon', 'sort_order'] },
  ],
}

export function fieldGroups(schema: Schema): EditorGroup[] {
  const groups = editorGroups[schema.title || '']
  if (!groups) {
    return []
  }
  const assigned = new Set(groups.flatMap((group) => group.fields))
  const remaining = Object.keys(schema.properties || {}).filter((key) => !assigned.has(key))
  if (remaining.length === 0) {
    return groups
  }
  return groups.some((group) => group.title === 'details')
    ? groups.map((group) =>
        group.title === 'details' ? { ...group, fields: [...group.fields, ...remaining] } : group,
      )
    : [...groups, { title: 'details', fields: remaining }]
}

export function orderedFields(schema: Schema) {
  return Object.entries(schema.properties || {})
}

export function valuesEqual(value: Json | undefined, baseline: Json | undefined): boolean {
  return value === baseline || JSON.stringify(value) === JSON.stringify(baseline)
}

export const fieldWidgets: Partial<Record<string, 'months'>> = { hiking_months: 'months' }
