import {
  nonNull,
  record,
  resolve,
  schemaFor,
  writeValue,
  type Json,
  type Schema,
} from './resources'
import { staticPages, type PageKey } from '@/content/staticPages'

export interface FieldContext {
  schema: string
  value: Json
}

interface Condition {
  applies: (value: Record<string, Json>, root: Record<string, Json>) => boolean
  clearWhenHidden?: boolean
  clearWhenInvalid?: (value: Record<string, Json>, root: Record<string, Json>) => boolean
}

const activeHike = (root: Record<string, Json>) =>
  root.status === 'planned' || root.status === 'ongoing'
const hasStoppingCoordinates = (value: Record<string, Json>) =>
  value.stop_latitude != null && value.stop_longitude != null
const known = (field: string): Condition => ({
  applies: (value) => value[field] === 'known',
  clearWhenHidden: true,
})
const namedRoute: Condition = { applies: (value) => value.route_scope === 'named_hiking_route' }
const trailStages: Condition = {
  applies: (value) => value.route_scope === 'full_trail' || value.route_scope === 'trail_section',
}
const actualStart: Condition = { applies: (value) => value.status !== 'planned' }
const actualEnd: Condition = {
  applies: (value) => value.status === 'completed' || value.status === 'aborted',
}
const stopping: Condition = { applies: (value) => value.status === 'aborted' }
const recordedNights: Condition = {
  applies: (value) => value.overnights_recorded_at != null,
  clearWhenHidden: true,
}
// Rules describe applicability, not field layout. Unlisted fields remain available.
const conditions: Partial<Record<string, Partial<Record<string, Condition>>>> = {
  PageWrite: { content: { applies: (value) => Boolean(value.page_key) } },
  HikeWrite: {
    planned_start_at: { applies: (value) => value.status === 'planned' },
    planned_end_at: { applies: (value) => activeHike(value) },
    actual_start_at: actualStart,
    actual_end_at: actualEnd,
    stop_latitude: stopping,
    stop_longitude: stopping,
    stop_stage: {
      applies: (value) => value.status === 'aborted' && hasStoppingCoordinates(value),
      // Keep historic stopping data; clear the stage only if its coordinates were removed.
      clearWhenInvalid: (value) => !hasStoppingCoordinates(value),
    },
    named_route_name: namedRoute,
    named_route_url: namedRoute,
    start_stage: trailStages,
    end_stage: trailStages,
    overnights: recordedNights,
  },
  LocationWrite: {
    is_loop: { applies: (value) => value.kind === 'trail', clearWhenHidden: true },
    water_sources: known('water_sources_status'),
    overnight_options: known('overnight_options_status'),
    overnight_restrictions: known('overnight_restrictions_status'),
  },
  RatingWrite: {
    assessed_at: {
      applies: (value) =>
        ['facilities', 'maintenance', 'resupplies', 'public_transport', 'difficulty'].some(
          (key) => value[key] != null,
        ),
    },
  },
}

export function fieldApplies(schema: Schema, key: string, value: Json, context: FieldContext) {
  const condition = conditions[resolve(schema).title || '']?.[key]
  return condition?.applies(record(value), record(context.value)) ?? true
}

export function variantApplies(schema: Schema, context: FieldContext) {
  const field = resolve(schema)
  const template = pageTemplate(context)
  if (template && ['AboutPageContent', 'StandardPageContent'].includes(field.title || '')) {
    return resolve(field.properties?.type || {}).const === template
  }
  return true
}

function pageTemplate(context: FieldContext) {
  const key = record(context.value).page_key
  return context.schema === 'PageWrite' && typeof key === 'string' && key in staticPages
    ? staticPages[key as PageKey].template
    : undefined
}

// Match the page's registered template while retaining common content on a key change.
export function prepareDraft(schema: Schema, value: Json): Json {
  const template = pageTemplate({ schema: resolve(schema).title || '', value })
  if (!template) {
    return value
  }
  const current = record(value)
  const content = record(current.content)
  if (content.type === template) {
    return value
  }
  const contentSchema = schemaFor(template === 'about' ? 'AboutPageContent' : 'StandardPageContent')
  return { ...current, content: { ...record(writeValue(contentSchema, content)), type: template } }
}

// Keep hidden values in the draft. Clear only invalid dependencies in the submitted copy.
export function prepareWrite(schema: Schema, value: Json, context?: FieldContext): Json {
  const field = nonNull(schema)
  const root = context ?? { schema: field.title || '', value }
  if (value == null) {
    return value
  }
  if (field.oneOf) {
    const selected = field.oneOf.find(
      (option) => resolve(resolve(option).properties?.type || {}).const === record(value).type,
    )
    return selected ? prepareWrite(selected, value, root) : value
  }
  if (field.properties) {
    const current = record(value)
    return Object.fromEntries(
      Object.entries(current).map(([key, entry]) => {
        const child = field.properties?.[key]
        const rule = conditions[field.title || '']?.[key]
        const clear =
          rule?.clearWhenInvalid?.(current, record(root.value)) ||
          (rule?.clearWhenHidden && !fieldApplies(field, key, value, root))
        if (child && clear) {
          return [key, nonNull(child).type === 'array' ? [] : null]
        }
        return [key, child ? prepareWrite(child, entry, root) : entry]
      }),
    )
  }
  if (Array.isArray(value) && field.items) {
    const items = field.items
    return value.map((item) => prepareWrite(items, item, root))
  }
  return value
}
