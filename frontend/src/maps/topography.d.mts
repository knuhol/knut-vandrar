import type * as MapLibre from 'maplibre-gl'
import type contour from 'maplibre-contour'
import type terrain from './topography.json'

type Terrain = typeof terrain
type Runtime = { dispose(): void }

export function preparePeakLabels(style: MapLibre.StyleSpecification, settings: Terrain): void
export function createTopography(
  maplibre: typeof MapLibre,
  plugin: typeof contour,
  settings: Terrain,
  timeoutMs: number,
): Runtime | null
export function addTopography(
  map: MapLibre.Map,
  runtime: Runtime | null,
  settings: Terrain,
  tokens: Record<string, string>,
): void
