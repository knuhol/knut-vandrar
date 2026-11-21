# Topographic mapping foundation

OpenFreeMap remains the vector basemap. `maps/topography.json` centrally configures
Mapterhorn elevation, native MapLibre hillshade, contour generation and peak-label
selection. `maps/topography.mjs` owns the shared runtime protocols and layers for
both static generation and future interactive maps.

Use `scripts/maps-generate.sh --preview --output-dir backups/maps` to experiment
without modifying stored images. `--terrain combined|hillshade|contours|none`
selects treatment. Automatic label selection reads the location's existing
terrain tags from the database; missing classification uses fewer labels.

## Sources and usage conditions

Reviewed 20 November 2026:

- Public documented endpoint: `https://tiles.mapterhorn.com/{z}/{x}/{y}.webp`.
- TileJSON: `https://tiles.mapterhorn.com/tilejson.json`; Terrarium encoding,
  512-pixel tiles. No account, payment or API key is required.
- Mapterhorn's attribution catalogue lists Swedish Lantmäteriet source data at
  1 m under CC0, Norwegian Kartverket source data at 1 m under CC BY 4.0, and
  the global Copernicus GLO-30 fallback under the Copernicus full/free/open
  licence. These permit commercial derivative visualisations subject to the
  relevant attribution conditions; the project's code licence is not treated
  as the elevation-data licence.
- Sources and their original licence links are retained in
  `maps/data/terrain-sources.json`. The rendered credit includes Mapterhorn,
  Kartverket and the provider's complete attribution URL, in
  addition to the existing basemap credits. The provider URL lists the other
  contributing datasets, including Copernicus.
- The provider's published access documentation offers public tiles and area
  extracts. No separate static-image prohibition was found in those published
  access/licensing pages. This review is not a claim of a service-level agreement,
  unlimited capacity, or written approval from the operator.
- Public zoom-12 tiles were fetched and decoded successfully at 63.1° N,
  12.4° E (Sweden) and 63.1° N, 11.9° E (Norway). Both contain non-flat elevation
  data. Nominal source resolution is not rendered pixel resolution: zoom-12
  pixels are approximately 8.7 m at this latitude. The current overview cameras
  use lower zooms and thus coarser elevation pixels.

References:

- https://mapterhorn.com/data-access/
- https://mapterhorn.com/attribution/
- https://download.mapterhorn.com/attribution.json
- https://github.com/mapterhorn/mapterhorn/tree/main/distribution
- https://github.com/onthegomap/maplibre-contour

## Rendering details

`maplibre-contour` is pinned to stable version 0.1.1. One `DemSource` supplies
both its contour protocol and shared DEM protocol for native MapLibre hillshade.
The per-page DEM cache avoids downloading the same tile independently for each
effect. External requests, including worker requests, use the existing bounded
four-request queue. No new server or persistent terrain-tile archive is created.

The renderer caps DEM fetching at zoom 12, which has global coverage; this is
sufficient for the reference overview images and avoids assuming uniform high-zoom
coverage. The source maximum, cache and rendering timeouts are configurable.

Hillshade and contours can be toggled independently. Default thresholds are 100/500 m at zoom 7,
50/250 m at zoom 10, 20/100 m at zoom 12 and 10/100 m at zoom 14. Lower-zoom
requests do not generate contours. Configuration values are centrally maintained in `maps/topography.json`.

Contour strokes use muted-opacity brand orange-dark, with thicker major lines
and elevation labels in metres. Hillshade uses forest shadows, cream highlights
and beige accents. Both terrain effects and contour labels are inserted before
opaque water fills, and below geographical labels, the route and endpoint
annotations. This masks terrain over mapped bodies of water without another
hydrography provider. Tiny water features absent at a given vector-tile zoom
cannot be masked more accurately than the available basemap geometry.

Peak labels retain names/elevations, prioritise higher elevations and have larger
collision padding. The default threshold omits peaks below 1000 m; endpoint
labels are unaffected. This setting is shared by all detailed maps.

Capture waits for MapLibre idle, completed DEM/contour protocol work, style/tile
readiness, fonts and final paint. Terrain errors fail the render instead of saving
a flat or partially generated image. Each enabled image has a `*-terrain.json`
sidecar containing request completion counts, contour counts and camera zoom.

At the overview scale, major elevation text uses upright labels anchored at contour
centres rather than bending each glyph around the coarse isoline vertices. This
keeps the numerical labels legible. Labels hidden by collision placement are valid and are recorded in diagnostics.



## Regional attribution

Kartverket's terms require attribution where its data or extracts are used:
https://www.kartverket.no/en/api-and-data/terms-of-use

`maps/attribution.mjs` selects the Norwegian source credit using the complete
visible viewport, rather than the hike's route or database country tags. A
public-domain Norwegian outline intersected with the visible viewport keeps the
credit near borders. Missing or ambiguous bounds retain the credit. Clearly
Norway-free views omit Kartverket; Mapterhorn and the source catalogue URL remain.
The renderer rechecks geography after refitting around a shorter attribution row.
Actual per-variant credits are recorded in framing diagnostics and provenance.

Finland uses the National Land Survey of Finland 2025 2 m elevation model
through Mapterhorn. Finnish and Norwegian credits are selected independently
from intersection with the visible viewport, without a border margin. The locator
uses route coordinates and Natural Earth country outlines rather than Sweden
as a fixed default. Existing images must be regenerated to apply these changes.
