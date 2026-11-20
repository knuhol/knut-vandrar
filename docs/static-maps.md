# Static hike maps

Static maps are manually generated assets. They are not displayed on public pages,
added to galleries, or substituted for cover photos. Each hike's selected GPX
collection produces four independently framed WebP images, each showing the whole
hike. The approved combined hillshade/contour treatment, brand palette, endpoint
labels and country inset are now the default. No persistent renderer service is required.

## Provider permission

The project owner confirmed permission for bulk static generation on 20 November
2026. The generator still requires the explicit environment acknowledgement below.

Provider terms reviewed 20 November 2026:

- <https://openfreemap.org/> advertises unrestricted map views and requests.
- <https://openfreemap.org/tos/> (updated 14 October 2026) prohibits automated data
  collection except specified offline downloads. Automated static screenshot
  generation is not explicitly addressed.

Permission has been confirmed by the project owner. To acknowledge it locally, set
`MAPS_OPENFREEMAP_PERMISSION_CONFIRMED=true` in the existing root `.env`.
This is an operational acknowledgement, not evidence of permission by itself.
`--check`, geometry tests, and offline renderer tests do not require it.
Requests identify Vandrar and external asset requests are limited to four in
parallel. Images are rendered sequentially; there is no tile prefetch/offline archive.

## Setup and commands

Use the Node version in `.nvmrc`, the Python environment prepared using
`.python-version` and `backend/constraints.txt`, and the root `.env`, as with the
existing GPX import script. Run from a repository checkout with installed root npm
dependencies and `backend/.venv`. Chromium is an optional workstation dependency;
it is not added to the public frontend or backend service images.

```sh
npm ci
npx playwright install chromium
# On a Linux workstation, system libraries may also be needed:
# npx playwright install --with-deps chromium
```

Apply migrations through `019_hike_stopping_point` using the normal migration/deployment workflow
before using the generator or the updated media tools. The migrations add map storage and nullable stopping fields. The stopping-point
migration also transfers the previously configured stopping fix, preserving other
hike data and existing image bytes.
The generator does not automatically migrate, start, or inspect containers.

```sh
./scripts/maps-generate.sh                         # guided selection and regeneration policy
./scripts/maps-generate.sh --hike Berg --output-dir /tmp/hike-maps  # partial title and review copies
./scripts/maps-generate.sh --all --check            # read-only GPX validation/freshness report
./scripts/maps-generate.sh --hike Berg --force       # regenerate even when current
./scripts/maps-generate.sh --all                    # generate missing/outdated maps
```

### Try it locally

```sh
# Guided selection: defaults to preview copies, without replacing stored maps.
./scripts/maps-generate.sh

# Preview one hike (partial title, accents and any supported language accepted).
./scripts/maps-generate.sh --hike Jämt --preview --output-dir backups/maps
./scripts/maps-generate.sh --hike Berg --preview --output-dir backups/maps

# Override automatic labels, or compare terrain treatments.
./scripts/maps-generate.sh --hike Jämt --preview --output-dir backups/maps --labels overview
./scripts/maps-generate.sh --hike Jämt --preview --output-dir backups/maps --terrain hillshade

# Store generated maps and also write review copies.
./scripts/maps-generate.sh --hike Jämt --output-dir backups/maps
```

`--preview` always renders all four variants and never publishes to the database.
Preview folders also contain framing/terrain diagnostics and `provenance.json`.
Without `--preview`, generation stores images in the existing map media records.
No frontend display is enabled. The guided flow asks for label detail, terrain,
preview/store and output directory; explicit command-line targets use defaults
without additional parameter prompts.

### Label detail and terrain

`--labels auto` is the default. Label detail comes from the hike's linked location
terrain classifications in the database (`location_terrains`): a location tagged
`mountains` receives detailed geographical labels. Lowlands, coastal areas,
locations without terrain tags, and hikes without a linked location all receive
the quieter overview profile. If several classifications are present, `mountains`
takes precedence. No hike IDs or names are used for styling, and no elevation
sampling is needed to classify a hike. Classification changes invalidate the
stored map's fingerprint. All four responsive formats use the same profile.

`--labels overview` and `--labels detail` are optional command-line overrides for
experimentation. They are not saved as per-hike styling configuration.
`peakLabels: false` and `lakeLabels: false` in shared illustration configuration
can independently hide those names in detail mode.

Detailed labels use wider collision spacing and avoid duplicate native/sampled
lake names. Start markers and labels are forest green; finish markers and labels
use the brand's dark orange for completed hikes. For unfinished hikes, the
planned endpoint and its label use the same forest green as the start; a stopping
cross remains distinct. Attribution uses one line when it fits; otherwise it splits into exactly two
rows, with the second starting at Terrain. Dots appear only between credits
within a row. Font size is fitted if a complete row exceeds the available width,
and capture checks reject clipping.
CLI choices always display English hike titles even when matching another language.

Peak prominence here is an elevation threshold and collision priority, not a
computed topographic prominence measurement. `--labels overview` and
`--labels detail` force either profile. `peakLabels: false` and `lakeLabels: false`
in illustration configuration can independently hide those names in detail mode.

`--terrain combined` is the default; `hillshade`, `contours` and `none` are also
available. All modes preserve route styling. `maps/topography.json` centrally
controls provider, contour intervals/opacities, hillshade strength and peak
selection. Low-zoom or flat areas may have no visible contours or elevation labels;
that is valid after all source requests have completed. Collision-hidden labels
are not treated as missing assets.

## Stopping points

In the admin hike editor, under Route, edit **Stop latitude**, **Stop longitude**
and optionally **Stop stage**. Save the hike, then regenerate its maps. Both
coordinates must be supplied together; clear both coordinates and the optional
stage to remove the stop. Coordinates are WGS84 decimal degrees. The optional
stage is the imported GPX stage label (for example `11` or `11B`), useful where
routes cross. Without it, the closest point across all selected stages is used.
Fixes more than 1 km from the eligible route are rejected; existing images survive
that failure.

For an **aborted** hike with a stopping point, generation includes remaining trail
stages from the selected start boundary to the end of its collection. Hike-owned
collections already include all stages. The route is split in travel direction,
while retaining disconnected GPX segments. Walked portions are orange, remaining
portions are dashed sage, and a cross marks the projected stop. Planned endpoints
and labels remain green. Stops do not affect completed, planned or ongoing hikes.

Stopping points are normal hike fields in PostgreSQL: `stop_latitude`,
`stop_longitude`, `stop_stage`. Database backups preserve them. Image provenance
records the input and projected stopping fix; existing media transfers preserve
that image provenance, but do not edit hike fields on the destination.
Migration `019_hike_stopping_point` transfers the one factual stopping fix from
the retired configuration file. It contains no generation/styling exception.
No per-hike mapping configuration file remains.

Changes to settings, labels, endpoint metadata, stopping fixes, terrain source,
country outline and shared renderer code invalidate stored fingerprints. The first
run after this update reports existing v1 maps as outdated. No bulk regeneration
is performed automatically.

Ambiguous titles prompt for a numbered selection. A unique match and `--all` run
without prompts. `--output-dir` writes review copies to `<directory>/<hike-uuid>/<variant>.webp`,
including already-current maps. It has no effect with `--check`. Without `--force`, current maps are skipped. Each hike reports its
result; failures do not stop other hikes. Any failed/skipped hike gives exit status
1; cancellation gives 130. Missing collection selections are reported as skipped.
The output contains no credentials or GPX file contents.

Generation uses GPX bytes already stored locally, not Plotaroute downloads.
Selected trail collections are restricted to the hike's inclusive numerical stage
boundaries in collection order, including suffix stages such as 2A/2B. Official
stage numbers may have gaps along a valid trail itinerary. Descending ranges preserve the
collection's authoritative Plotaroute order; no file is reversed. Endpoint markers
use the outer ends of boundary stages when a shared join is within 50 m (or the
configured circular threshold). This handles reversed GPX boundary files without
changing route geometry. Hike start/end stage boundaries determine which outer
endpoint is the start, even when collection order differs from travel direction.
Circular routes retain their original shared endpoint. Missing stage
numbers, ambiguous/unparseable labels, incomplete collections, invalid coordinates,
missing files, and checksum failures prevent replacement. A trail-section hike
without a stage range must use a custom collection or first receive stage bounds.
Hike-owned custom collections always use all current routes. Retained routes marked
as removed from Plotaroute are excluded.

## Shared mapping foundation

- `backend/src/knut_vandrar_backend/maps/geometry.py`: validated GPX to per-stage
  GeoJSON MultiLineStrings, full-route bounds, endpoints, and circular detection.
  Segment boundaries and original WGS84 coordinates are preserved. Coordinates are
  longitude/latitude; no routes are snapped or simplified.
- `maps/config.json`: provider identity, attribution, dimensions, framing and overlay
  settings. Future browser maps can import the same public configuration.
- `maps/vandrar.json`: repository-owned Liberty-derived MapLibre style. It is a
  standard style JSON that can be opened directly in Maputnik. Local place names,
  reduced POI/building clutter, and subdued natural features are initial choices.
- `maps/style.mjs`: shared style preparation and route/endpoint layers. It has no
  Chromium, persistence or static-generation dependency. Future browser maps supply
  their resolved design tokens and call the same helpers.
- `tools/maps/render.mjs`: private one-shot Playwright/Chromium adapter. It serves
  only renderer resources through browser routing, waits for map idle, tile and style
  readiness, browser fonts and final paint, and rejects asset/render errors.
- `maps/cli.py` in the backend package: selection, orchestration, WebP conversion,
  freshness checks and database publication.

Orange routes have a paper outline. Start and finish have different colors and
slightly different sizes. Endpoints within the configured 50-metre threshold use
concentric start/finish rings at the start coordinate. This avoids shifting or
inventing route geometry. Attribution is always expanded, readable and captured
inside the image, including the OpenStreetMap copyright URL.

The baseline JSON includes resolved token colors for Maputnik. Runtime style
preparation refreshes those layer colors from the current frontend tokens, including
the existing paper color mix. If changing those tokens, update the corresponding
baseline style colors for matching Maputnik previews. Upstream notices are retained
in `maps/OPENFREEMAP-LICENSE.md` and `maps/LIBERTY-LICENSE.md`; the Vandrar style changes
are described above. No additional terrain or contour source is introduced; Liberty's
existing Natural Earth raster background is retained.

## Dimensions and freshness

| Screen range | Variant | Pixels | Ratio |
|---|---|---|---|
| Below 641 px | mobile | 1280 × 1280 | 1:1 |
| 641–1000 px | tablet | 1600 × 1200 | 4:3 |
| 1001–1499 px | desktop | 2400 × 1600 | 3:2 |
| 1500 px and above | wide | 2880 × 1620 | 16:9 |

These reflect the current site breakpoints. Images render at device pixel ratio 2,
with 48 CSS pixels of route padding and a maximum zoom of 14. Dimensions and padding
are centrally configurable. Never crop one variant to create another.

The fingerprint includes ordered selected GPX hashes and stage labels, collection
selection/range, style, provider/render configuration, shared styling, geometry and
renderer code, design tokens, npm lockfile and Python dependency constraints.
Basemap tiles/fonts are live provider assets: upstream changes do not automatically
invalidate existing maps, and byte-identical rerenders are not guaranteed. Use
`--force` to refresh them. Stored provenance records the generation time, input
identity, provider and attribution. Any input change during rendering aborts
publication; rerun after edits are complete.

## Storage, transfer and backups

A single `hike_map_images` table stores variants keyed by `(hike_id, variant)`, with
WebP bytes, checksum, dimensions, fingerprint and provenance. This reuses the
existing database-binary storage approach used by cover images and logos. All
variants are committed together under the hike row lock; existing maps survive any
render failure. Regeneration updates existing keys and removes obsolete variants,
without creating duplicate media records. Hike deletion cascades to its maps.

Media archive format 4 includes a `map` asset per hike with all its variants and
provenance. Existing owner filters, owner remapping, checksum/image validation,
dry-run, conflict handling and `--replace` apply. Formats 1–3 remain readable when
schema revisions match. New map bytes require `--replace` when destination maps
already differ. Database backups include all map bytes; normal media export/import
also transfers them. No extra volume or backup command is needed.

Generate locally, review images, then use the existing media transfer commands to
move them to dev/prod. Both environments must have migration 019 and this version
of the media tools. The public map read API is available, but public pages do not request or display
it. Generation remains manual; imports and page requests never start Chromium.

## Validation before bulk generation

Offline tests cover disconnected segments, source ordering, descending stage ranges
and suffix stages, circular routes, antimeridian bounds, corrupt/incomplete GPX,
idempotency, failed-generation retention, and map archive round trips/remapping.
Run `node --test tools/tests/maps.test.mjs` for shared browser-style tests.
Run `VANDRAR_RENDER_TESTS=1 node --test tools/tests/maps-render.test.mjs` for the
optional Chromium integration tests. These use a background-only style and local
GeoJSON, check all four dimensions and route framing, and make no provider requests.

After provider permission is established, generate and inspect representative real
long-distance, short, circular (if available), and multistage hikes. Check local
labels, route position, framing, start/finish, attribution and all four dimensions.
Check `--check`, `--force`, export/import and backup behavior, then run `--all`.
Provider-backed visual validation and bulk generation were completed for the five
local hikes on 20 November 2026. Each hike has four stored variants.


## Map API

- `GET /api/hikes/{hike_id}/maps` returns the available variants with dimensions,
  generated time, SHA-256 and image URLs. Existing hikes without images return
  an empty list; unknown hikes return 404. Metadata queries do not load image bytes.
- `GET /api/hikes/{hike_id}/maps/{variant}` returns `image/webp`, or 404 for a
  missing variant. Responses include an ETag, revalidation caching and
  `X-Content-Type-Options: nosniff`; matching `If-None-Match` returns 304.
- Both endpoints are public reads, consistent with existing cover images.
  There is no public upload or rendering endpoint. Normal authenticated hike
  create/update endpoints accept stopping fields and return them in hike detail.

These endpoints serve the last successfully stored images. Editing hike data does
not regenerate images: use `--check` and the generation command after edits.

## Shared geographical context

`maps/illustration.mjs` owns profile styling, endpoint labels and the country
inset. Country geometry comes from the public-domain Natural Earth outline in
`maps/data/`. Insets show the current map viewport. `maps/detail.mjs` samples named
features from OpenFreeMap tiles at up to zoom 11; the sampler reduces zoom when
needed to stay within an 8192px viewport. It does not introduce another basemap.
See `maps/TOPOGRAPHY.md` for shared elevation and contour runtime configuration.
