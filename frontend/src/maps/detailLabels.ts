import { VectorTile, type VectorTileLayer } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'
import type {
  GeoJSONSource,
  Map as MapInstance,
  SymbolLayerSpecification,
  StyleSpecification,
  FilterSpecification,
  VectorTileSource,
} from 'maplibre-gl'

import type { PlannedMap } from '@/api/tracking'

const detailZoom = 11
const tileBudget = 24
const requestBatchSize = 4
const peakBudget = 6
const picnicTypes = ['picnic_site', 'picnic_table']
const accommodationTypes = [
  'alpine_hut',
  'basic_hut',
  'cabin',
  'chalet',
  'wilderness_hut',
  'lodging',
  'hotel',
  'motel',
  'hostel',
  'guest_house',
  'bed_and_breakfast',
  'apartment',
  'holiday_apartment',
  'resort',
  'dormitory',
  'caravan_site',
]
const outdoorNames = [
  ...accommodationTypes,
  'shelter',
  'waterfall',
  'camp_site',
  'trailhead',
  'visitor_centre',
  'visitor_center',
  'campsite',
  ...picnicTypes,
  'drinking_water',
  'spring',
  'water_point',
  'grocery',
]
const busStopTypes = ['bus', 'bus_stop', 'bus_station']
const standardZoomOnly = [
  ...busStopTypes,
  'toilet',
  'viewpoint',
  'observation_tower',
  'lookout_tower',
  'birdwatching_tower',
  'bird_hide',
  'toilets',
]
const labelLayers = ['park', 'water_name', 'waterway', 'mountain_peak'] as const
type LabelLayer = (typeof labelLayers)[number] | 'poi'
const facilityTileZoom = 14
const facilityOverviewZoom = 11
const facilityDistanceMetres = 500
const immediateTrailDistanceMetres = 100
const busShelterDistanceMetres = 20
const metresPerDegree = 111_195
const routeIndexCellDegrees = 0.02

const detailLabelSource = 'hike-context'

function tileMetadata(map: MapInstance) {
  // A URL-based vector source exists before it has resolved its TileJSON.
  const source: { tiles?: string[]; maxzoom: number } | undefined =
    map.getSource<VectorTileSource>('openmaptiles')
  const template = source?.tiles?.[0]
  if (template) {
    return { template, maxZoom: source.maxzoom }
  }
}

type Tile = { x: number; y: number; z: number }
type Bounds = number[][]

function tileRange([[west, south], [east, north]]: Bounds, z: number, pad: boolean) {
  const world = 2 ** z
  const x = (lon: number) => ((lon + 180) / 360) * world
  const y = (lat: number) => {
    const radians = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180
    return ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * world
  }
  const xPadding = pad ? Math.max(0.2, (x(east) - x(west)) * 0.15) : 0
  const yPadding = pad ? Math.max(0.2, (y(south) - y(north)) * 0.15) : 0
  return {
    left: Math.floor(x(west) - xPadding),
    right: Math.floor(x(east) + xPadding),
    top: Math.max(0, Math.floor(y(north) - yPadding)),
    bottom: Math.min(world - 1, Math.floor(y(south) + yPadding)),
  }
}

function tilesInRange(
  { left, right, top, bottom }: ReturnType<typeof tileRange>,
  z: number,
  budget = tileBudget,
) {
  const world = 2 ** z
  const tiles: Tile[] = []
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      tiles.push({ x, y, z })
    }
  }
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2
  return tiles
    .sort(
      (a, b) => Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY),
    )
    .slice(0, budget)
    .map(({ x, y, z }) => ({ x: ((x % world) + world) % world, y, z }))
}

function contextTiles(bounds: Bounds, maxZoom: number) {
  for (let z = Math.min(maxZoom, detailZoom); z >= 8; z--) {
    const range = tileRange(bounds, z, true)
    if ((range.right - range.left + 1) * (range.bottom - range.top + 1) <= tileBudget) {
      return tilesInRange(range, z)
    }
  }
  return []
}

function routeLongitude(bounds: Bounds) {
  const center = (bounds[0][0] + bounds[1][0]) / 2
  return (lon: number) => center + ((((lon - center + 180) % 360) + 360) % 360) - 180
}

function facilityRouteTiles(route: PlannedMap, z: number, viewport: Bounds) {
  const normalizeLongitude = routeLongitude(route.bounds)
  const world = 2 ** z
  const tiles = new Map<string, Tile>()
  const latitudePadding = facilityDistanceMetres / metresPerDegree

  function addSegment(a: number[], b: number[]) {
    const west = Math.min(a[0], b[0])
    const east = Math.max(a[0], b[0])
    const south = Math.min(a[1], b[1])
    const north = Math.max(a[1], b[1])
    const span = tileRange(
      [
        [west, south],
        [east, north],
      ],
      z,
      false,
    )
    if (span.right - span.left > 1 || span.bottom - span.top > 1) {
      const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      addSegment(a, midpoint)
      addSegment(midpoint, b)
      return
    }
    const latitude = Math.min(85, Math.max(Math.abs(south), Math.abs(north)) + latitudePadding)
    const longitudePadding = latitudePadding / Math.cos((latitude * Math.PI) / 180)
    const { left, right, top, bottom } = tileRange(
      [
        [west - longitudePadding, south - latitudePadding],
        [east + longitudePadding, north + latitudePadding],
      ],
      z,
      false,
    )
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const wrapped = ((x % world) + world) % world
        tiles.set([wrapped, y].join(','), { x: wrapped, y, z })
      }
    }
  }

  for (const line of route.lines) {
    for (let index = 1; index < line.length; index++) {
      const a = line[index - 1]
      const b = line[index]
      addSegment([normalizeLongitude(a[0]), a[1]], [normalizeLongitude(b[0]), b[1]])
    }
  }

  const view = tileRange(viewport, z, false)
  const centerX = (view.left + view.right) / 2
  const centerY = (view.top + view.bottom) / 2
  function distanceFromView(tile: Tile) {
    const dx = (((tile.x - centerX) % world) + world) % world
    return Math.hypot(Math.min(dx, world - dx), tile.y - centerY)
  }
  return [...tiles.values()].sort((a, b) => distanceFromView(a) - distanceFromView(b))
}

async function readLabels(
  template: string,
  tile: Tile,
  signal: AbortSignal,
  kinds: readonly LabelLayer[],
) {
  const { x, y, z } = tile
  const url = template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
  const response = await fetch(url, { signal })
  if (!response.ok) {
    return []
  }
  const layers: Partial<Record<LabelLayer, VectorTileLayer>> = new VectorTile(
    new PbfReader(await response.arrayBuffer()),
  ).layers
  const labels: GeoJSON.Feature<GeoJSON.Point>[] = []
  const busStops: number[][] = []
  for (const kind of kinds) {
    const layer = layers[kind]
    for (let index = 0; layer && index < layer.length; index++) {
      const feature = layer.feature(index)
      const properties: Partial<typeof feature.properties> = feature.properties
      const { name, 'name:latin': latin, class: category, subclass, ele, rank } = properties
      if (
        kind === 'poi' &&
        [category, subclass].some((type) => typeof type === 'string' && busStopTypes.includes(type))
      ) {
        const { geometry } = feature.toGeoJSON(x, y, z)
        if (geometry.type === 'Point') {
          busStops.push(geometry.coordinates)
        } else if (geometry.type === 'MultiPoint') {
          busStops.push(...geometry.coordinates)
        }
        continue
      }
      const types = [category, subclass].filter((type): type is string => typeof type === 'string')
      const label = name ?? latin ?? ''
      if (
        typeof label !== 'string' ||
        (!label && kind !== 'poi') ||
        (kind === 'waterway' && category !== 'river') ||
        (kind === 'poi' &&
          (![category, subclass].some(
            (type) => typeof type === 'string' && outdoorNames.includes(type),
          ) ||
            [category, subclass].some(
              (type) => typeof type === 'string' && standardZoomOnly.includes(type),
            )))
      ) {
        continue
      }
      const { geometry } = feature.toGeoJSON(x, y, z)
      const coordinates =
        geometry.type === 'Point'
          ? geometry.coordinates
          : geometry.type === 'LineString'
            ? geometry.coordinates[Math.floor(geometry.coordinates.length / 2)]
            : undefined
      if (!coordinates) {
        continue
      }
      labels.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates },
        properties: {
          kind,
          class: category ?? '',
          subclass: subclass ?? '',
          name: label,
          ele: Number(ele) || 0,
          rank: Number(rank) || 99,
          genericShelter:
            types.includes('shelter') && !types.some((type) => accommodationTypes.includes(type)),
        },
      })
    }
  }
  return labels.filter(({ properties, geometry }) => {
    if (
      properties?.kind !== 'poi' ||
      properties.name ||
      (properties.class !== 'shelter' && properties.subclass !== 'shelter')
    ) {
      return true
    }
    const [lon, lat] = geometry.coordinates
    const longitudeScale = Math.cos((lat * Math.PI) / 180)
    return !busStops.some(([stopLon, stopLat]) => {
      const deltaLon = ((((stopLon - lon + 180) % 360) + 360) % 360) - 180
      return (
        Math.hypot(deltaLon * longitudeScale, stopLat - lat) * metresPerDegree <=
        busShelterDistanceMetres
      )
    })
  })
}

async function readTiles(
  template: string,
  tiles: Tile[],
  signal: AbortSignal,
  kinds: readonly LabelLayer[],
  onBatch?: (features: GeoJSON.Feature<GeoJSON.Point>[]) => void,
) {
  const labels = new Map<string, GeoJSON.Feature<GeoJSON.Point>>()
  for (let index = 0; index < tiles.length && !signal.aborted; index += requestBatchSize) {
    const batch = await Promise.allSettled(
      tiles
        .slice(index, index + requestBatchSize)
        .map((tile) => readLabels(template, tile, signal, kinds)),
    )
    const fresh: GeoJSON.Feature<GeoJSON.Point>[] = []
    for (const result of batch) {
      if (result.status === 'fulfilled') {
        for (const feature of result.value) {
          const { coordinates } = feature.geometry
          const { kind, name, class: category, subclass } = feature.properties ?? {}
          // Tile buffers repeat features. Keep separate facilities at the same trail stop.
          const key =
            kind === 'poi'
              ? JSON.stringify([kind, category, subclass, name, ...coordinates])
              : JSON.stringify([
                  kind,
                  name,
                  ...(kind === 'waterway' ? [] : coordinates.map((value) => value.toFixed(3))),
                ])
          if (!labels.has(key)) {
            labels.set(key, feature)
            fresh.push(feature)
          }
        }
      }
    }
    if (fresh.length > 0) {
      onBatch?.(fresh)
    }
  }
  return [...labels.values()]
}

export async function loadDetailLabels(
  template: string,
  bounds: Bounds,
  maxZoom: number,
  signal: AbortSignal,
): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
  const features = await readTiles(template, contextTiles(bounds, maxZoom), signal, labelLayers)
  const peaks = features
    .filter((feature) => feature.properties?.kind === 'mountain_peak')
    .sort((a, b) => Number(b.properties?.ele) - Number(a.properties?.ele))
    .slice(0, peakBudget)
  const context = features.filter((feature) => feature.properties?.kind !== 'mountain_peak')
  return { type: 'FeatureCollection', features: [...context, ...peaks] }
}

function overviewName(name: string) {
  return name
    .toLowerCase()
    .replace(/s?\s+(?:naturvårdsområde|naturreservat|nationalpark|kansallispuisto)$/u, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export function selectOverviewLabels(
  features: GeoJSON.Feature<GeoJSON.Point>[],
  width: number,
  height: number,
  project: (coordinates: number[]) => { x: number; y: number },
  nearTrail: (coordinates: number[]) => boolean,
  areaName = '',
) {
  const columns = Math.max(1, Math.floor(width / 145))
  const rows = Math.max(1, Math.floor(height / 105))
  const budget = columns * rows
  const areaKey = overviewName(areaName)
  const candidates = features.flatMap((feature) => {
    const { coordinates } = feature.geometry
    const { x, y } = project(coordinates)
    const name = overviewName(String(feature.properties?.name ?? ''))
    if (x < 0 || y < 0 || x > width || y > height || !name || name === areaKey) {
      return []
    }
    const kind = String(feature.properties?.kind ?? '')
    const priority = kind === 'park' || kind === 'water_name' ? 0 : kind === 'mountain_peak' ? 1 : 2
    return [{ feature, name, x, y, priority }]
  })
  const crowded = candidates.length > budget
  const ordered = crowded
    ? candidates
        .map((candidate) => ({
          ...candidate,
          score: candidate.priority + (nearTrail(candidate.feature.geometry.coordinates) ? 0 : 3),
        }))
        .sort((a, b) => a.score - b.score)
    : candidates
  const shown: GeoJSON.Feature<GeoJSON.Point>[] = []
  const names = new Set<string>()
  const usedCells = new Set<number>()
  for (const candidate of ordered) {
    const row = Math.min(rows - 1, Math.floor((candidate.y / height) * rows))
    const column = Math.min(columns - 1, Math.floor((candidate.x / width) * columns))
    const cell = row * columns + column
    if (!names.has(candidate.name) && (!crowded || !usedCells.has(cell))) {
      names.add(candidate.name)
      usedCells.add(cell)
      shown.push(candidate.feature)
    }
  }
  return shown
}

export function addDetailLabelLayer(
  map: MapInstance,
  route: PlannedMap,
  signal: AbortSignal,
  areaName?: string,
) {
  // The overview label identifies the hiking area. Its placement is based on the
  // trail's bounds, so it stays in view even when the park's tile anchor is far away.
  const [[west, south], [east, north]] = route.bounds
  const areaFeatures: GeoJSON.Feature<GeoJSON.Point>[] = areaName
    ? [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [(west + east) / 2, (south + north) / 2] },
          properties: { kind: 'hike-area', name: areaName },
        },
      ]
    : []

  map.addSource(detailLabelSource, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: areaFeatures },
  })
  map.addLayer({
    id: detailLabelSource,
    source: detailLabelSource,
    type: 'symbol',
    minzoom: 8,
    maxzoom: 12,
    filter: ['!=', ['get', 'kind'], 'hike-area'],
    layout: {
      'text-field': [
        'match',
        ['get', 'kind'],
        'park',
        ['upcase', ['get', 'name']],
        'mountain_peak',
        [
          'case',
          ['>', ['get', 'ele'], 0],
          ['concat', '△ ', ['get', 'name'], ' · ', ['to-string', ['get', 'ele']]],
          ['concat', '△ ', ['get', 'name']],
        ],
        ['get', 'name'],
      ],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['match', ['get', 'kind'], 'park', 12, 11],
      'text-padding': 6,
      'text-max-width': 14,
      'symbol-sort-key': [
        'match',
        ['get', 'kind'],
        'park',
        0,
        'water_name',
        2,
        ['+', 3, ['get', 'rank']],
      ],
      'text-variable-anchor': ['center', 'top', 'bottom'],
      'text-radial-offset': 0.3,
    },
    paint: {
      'text-color': route.tokens.forest,
      'text-halo-color': route.tokens.cream,
      'text-halo-width': 1.5,
    },
  })
  if (areaName) {
    map.addLayer({
      id: 'hike-area-label',
      source: detailLabelSource,
      type: 'symbol',
      minzoom: 5,
      maxzoom: 14,
      filter: ['==', ['get', 'kind'], 'hike-area'],
      layout: {
        'text-field': ['upcase', ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
        'text-letter-spacing': 0.08,
        'text-max-width': 16,
        'text-padding': 12,
        'text-variable-anchor': ['center', 'left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.8,
      },
      paint: {
        'text-color': route.tokens.forest,
        'text-halo-color': route.tokens.cream,
        'text-halo-width': 1.5,
      },
    })
  }

  let loaded: GeoJSON.Feature<GeoJSON.Point>[] | undefined
  const nearTrail = routeProximity(route)
  function updateLabels() {
    const { clientWidth, clientHeight } = map.getCanvas()
    if (!loaded || !clientWidth || !clientHeight) {
      return
    }
    const features = selectOverviewLabels(
      loaded,
      clientWidth,
      clientHeight,
      ([longitude, latitude]) => map.project([longitude, latitude]),
      (coordinates) => nearTrail(coordinates, 4000),
      areaName,
    )
    void map.getSource<GeoJSONSource>(detailLabelSource)?.setData({
      type: 'FeatureCollection',
      features: [...areaFeatures, ...features],
    })
  }
  async function publishLabels() {
    const tiles = tileMetadata(map)
    if (!tiles) {
      return
    }
    const labels = await loadDetailLabels(tiles.template, route.bounds, tiles.maxZoom, signal)
    if (!signal.aborted) {
      loaded = labels.features
      updateLabels()
    }
  }
  map.once('idle', () => {
    void publishLabels()
  })
  map.on('moveend', updateLabels)
  map.on('resize', updateLabels)
  signal.addEventListener(
    'abort',
    () => {
      map.off('moveend', updateLabels)
      map.off('resize', updateLabels)
    },
    { once: true },
  )
}

export function prepareOutdoorFacilities(style: StyleSpecification) {
  // The separate facility layer replaces these categories, with a distance filter.
  const facilityFilter: FilterSpecification = [
    'all',
    // Generic shelters beyond the early layer's tighter radius remain on the basemap.
    [
      'any',
      ['all', ['!=', ['get', 'class'], 'shelter'], ['!=', ['get', 'subclass'], 'shelter']],
      ['in', ['get', 'class'], ['literal', accommodationTypes]],
      ['in', ['get', 'subclass'], ['literal', accommodationTypes]],
    ],
    ['!', ['in', ['get', 'class'], ['literal', standardZoomOnly]]],
    ['!', ['in', ['get', 'subclass'], ['literal', standardZoomOnly]]],
    [
      'any',
      ['in', ['get', 'class'], ['literal', outdoorNames]],
      ['in', ['get', 'subclass'], ['literal', outdoorNames]],
    ],
  ]
  for (const layer of style.layers) {
    if (layer.type === 'symbol' && layer['source-layer'] === 'poi') {
      const exclude: FilterSpecification = ['!', facilityFilter]
      // The app's basemap uses expression filters for its POI layers.
      layer.filter = layer.filter
        ? (['all', layer.filter, exclude] as FilterSpecification)
        : exclude
    }
  }
}

export function routeProximity(route: Pick<PlannedMap, 'bounds' | 'lines'>) {
  type Segment = [number[], number[]]
  const normalizeLongitude = routeLongitude(route.bounds)
  const cell = (coordinate: number) => Math.floor(coordinate / routeIndexCellDegrees)
  const cells = new Map<string, Segment[]>()
  const longSegments: Segment[] = []

  for (const line of route.lines) {
    for (let index = 1; index < line.length; index++) {
      const [start, end] = [line[index - 1], line[index]]
      const a = [normalizeLongitude(start[0]), start[1]]
      const b = [normalizeLongitude(end[0]), end[1]]
      const segment: Segment = [a, b]
      const left = cell(Math.min(a[0], b[0]))
      const right = cell(Math.max(a[0], b[0]))
      const top = cell(Math.min(a[1], b[1]))
      const bottom = cell(Math.max(a[1], b[1]))
      if ((right - left + 1) * (bottom - top + 1) > 64) {
        longSegments.push(segment)
        continue
      }
      for (let x = left; x <= right; x++) {
        for (let y = top; y <= bottom; y++) {
          const key = [x, y].join(',')
          const segments = cells.get(key) ?? []
          segments.push(segment)
          cells.set(key, segments)
        }
      }
    }
  }

  return ([longitude, latitude]: number[], distanceMetres = facilityDistanceMetres) => {
    const lon = normalizeLongitude(longitude)
    const metresPerLongitude = metresPerDegree * Math.cos((latitude * Math.PI) / 180)
    const lonRadius = distanceMetres / metresPerLongitude
    const latRadius = distanceMetres / metresPerDegree
    function isNear([a, b]: Segment) {
      const ax = (a[0] - lon) * metresPerLongitude
      const ay = (a[1] - latitude) * metresPerDegree
      const dx = (b[0] - a[0]) * metresPerLongitude
      const dy = (b[1] - a[1]) * metresPerDegree
      const fraction = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)))
      return Math.hypot(ax + fraction * dx, ay + fraction * dy) <= distanceMetres
    }

    for (let x = cell(lon - lonRadius); x <= cell(lon + lonRadius); x++) {
      for (let y = cell(latitude - latRadius); y <= cell(latitude + latRadius); y++) {
        if (cells.get([x, y].join(','))?.some((segment) => isNear(segment))) {
          return true
        }
      }
    }
    return longSegments.some((segment) => isNear(segment))
  }
}

export function addOutdoorFacilities(map: MapInstance, route: PlannedMap) {
  const source = 'hike-outdoor-facilities'
  const nearRoute = routeProximity(route)
  const layout: SymbolLayerSpecification['layout'] = {
    'icon-image': [
      'coalesce',
      [
        'image',
        [
          'case',
          ['==', ['get', 'class'], 'grocery'],
          'grocery',
          ['coalesce', ['get', 'subclass'], ''],
        ],
      ],
      ['image', ['coalesce', ['get', 'class'], '']],
      [
        'image',
        [
          'match',
          ['coalesce', ['get', 'subclass'], ['get', 'class'], ''],
          accommodationTypes,
          'lodging',
          'information',
        ],
      ],
    ],
    'icon-size': 1.15,
    'icon-padding': 3,
    'icon-allow-overlap': true,
    'icon-optional': true,
    'text-optional': true,
    'text-field': ['coalesce', ['get', 'name'], ['get', 'name:latin'], ''],
    'text-font': ['Noto Sans Bold'],
    'text-size': 14,
    'text-padding': 5,
    'text-max-width': 12,
    'text-anchor': 'top',
    'text-offset': [0, 1],
  }
  const paint = {
    'text-color': route.tokens.forest,
    'text-halo-color': route.tokens.cream,
    'text-halo-width': 2,
  }
  map.addSource(source, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: source,
    source,
    type: 'symbol',
    minzoom: facilityOverviewZoom,
    layout,
    paint,
  })
  const request = new AbortController()
  let started = false
  function preload() {
    const basemap = tileMetadata(map)
    if (started || !basemap) {
      return
    }
    started = true
    map.off('sourcedata', preload)
    const z = Math.min(facilityTileZoom, basemap.maxZoom)
    const tiles = facilityRouteTiles(route, z, map.getBounds().toArray())
    const facilities: GeoJSON.Feature<GeoJSON.Point>[] = []
    void readTiles(basemap.template, tiles, request.signal, ['poi'], (features) => {
      const nearby = features.filter(({ geometry, properties }) => {
        const types = [properties?.class, properties?.subclass].filter(
          (type): type is string => typeof type === 'string',
        )
        const isPicnic = types.some((type) => picnicTypes.includes(type))
        return nearRoute(
          geometry.coordinates,
          isPicnic || properties?.genericShelter === true
            ? immediateTrailDistanceMetres
            : facilityDistanceMetres,
        )
      })
      if (!request.signal.aborted && nearby.length > 0) {
        facilities.push(...nearby)
        void map.getSource<GeoJSONSource>(source)?.setData({
          type: 'FeatureCollection',
          features: [...facilities],
        })
      }
    })
  }
  map.on('sourcedata', preload)
  preload()
  return () => {
    map.off('sourcedata', preload)
    request.abort()
  }
}
