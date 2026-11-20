# Future project: hike maps and live tracking

**Status:** static MapLibre/WebP generation is implemented; provider-backed validation
and generation are complete for the five current local hikes. See [static maps](static-maps.md).
Interactive maps and live tracking remain deferred.

## Goals

Build a shared geographic-data foundation for hike maps, custom waypoints, and optional Garmin inReach live tracking. Support two independent presentations of the same data:

- **Interactive hike maps:** MapLibre GL JS with OpenFreeMap as the initial basemap provider, showing planned routes, recorded tracks, waypoints, stages and (eventually) live progress.
- **Static overview maps:** Generate responsive WebP images with MapLibre and headless Chromium using the shared style and GPX geometry. Public display remains deferred. The separate SVG concept below is optional and superseded for this initial implementation.

Keep geographic data and basemap choice independent so the provider can be replaced or supplemented (e.g. a Swedish topographic layer) without changing hikes or GPX tracks. Avoid self-hosting map tiles initially.

## Current prototype (already implemented)

- Store start and finish as optional latitude/longitude pairs associated with a hike.
- Keep readable place names and link them to coordinate-based Google Maps searches.
- Start and finish coordinates are persisted optional hike fields, validated by the API and database.
- Place names link to Google Maps when coordinates are available.
- GPX processing and the static generation pipeline are implemented; see [static maps](static-maps.md). Interactive maps and live tracking remain deferred.

## Shared geographic data model

- Accept GPX uploads and normalize geometry to GeoJSON in WGS84 (EPSG:4326). GeoJSON coordinates are **longitude, latitude**; Google Maps search URLs use **latitude, longitude**.
- Retain original GPX uploads or storage references for reprocessing.
- Keep **planned routes** and **recorded tracks** distinct and associated with a hike. A hike's route may cover part of an established trail or be self-planned.
- Support `LineString` and `MultiLineString` geometry. JSONB is sufficient initially; consider PostGIS only when spatial querying or scale justifies it.
- Precompute route distance, cumulative distance along the route, bounding box, and optionally simplified geometry for overview maps; preserve the original-resolution data for download and accurate calculations.
- Separate stages and waypoints from raw GPX geometry. Model stage start/finish coordinates and optional links to a segment of the planned route.
- Support **custom waypoints** with coordinates, type/icon, localized name and description, optional image, and optional stage association. Provide click-to-place/edit functionality in admin when waypoint management is implemented.
- Support routes or highlighted hiking areas with no fixed GPX line.
- Avoid coupling the route representation to any specific rendering library or tile service.

## Interactive maps — MapLibre + OpenFreeMap

Initial choice: **MapLibre GL JS** for map rendering, **OpenFreeMap** for vector basemap tiles. Use OpenStreetMap-derived background data through OpenFreeMap; this is separate from the site's own GPX overlays. Verify current provider terms, attribution, reliability, and fallback options at implementation time.

Interactive map capabilities:

- Show the whole planned hike route with automatically fitted bounds; handle short routes, long routes, and MultiLineStrings.
- Style route layers fully: color, thickness, opacity, outline, dashed/solid patterns and zoom-dependent appearance.
- Distinguish planned, completed, remaining and actually recorded routes without relying on color alone. Keep a simple, readable legend.
- Show start/finish, stage boundaries and custom waypoints with optional labels and popups; use consistent icons and localization.
- Highlight an individual stage/chapter while keeping the rest of the route visible and subdued.
- Use a clean, restrained map style that fits the site, with intuitive mobile interactions and a fullscreen option.
- Lazy-load map code/tiles to avoid slowing down page loads; simplify geometry for overview maps and retain full detail for the hike view.
- Keep basemap configuration independent so alternate providers/topographic styles can be added later.
- Consider an elevation profile linked bidirectionally with map position as a later enhancement.
- Eventually support an overview map showing multiple hikes, with filtering by hike status and links to hike pages.

### Suggested route appearance

- **Planned route / remaining route:** muted, optionally dashed, contrasting against the basemap.
- **Completed planned route:** stronger accent color, representing *progress along the plan*.
- **Actual Garmin recorded track:** a separate thinner line, visually distinct from completed planned sections, so detours remain visible.
- **Latest location:** prominent marker with timestamp; never imply that a stale coordinate is a current position.

Final colors and stroke styles should reuse site design tokens and be tested on real hikes and mobile screens.

## Static SVG overview concept (optional separate renderer)

- Generate static SVG on the Python backend using the site's shared design values.
- Draw country outlines, route, start/finish markers, selected labels and explicit hike distance.
- Use route-focused framing with a country inset for shorter hikes; optionally a whole-country overview for longer journeys.
- Support highlighting a hiking area without a fixed route.
- Country boundaries are a shared, versioned dataset (e.g. Natural Earth), not per-hike records.
- Generate/cache SVG assets when inputs change, not at each page view.
- Invalidation must account for geometry, displayed distance, locale, labels, rendering/style version and boundary-data version.
- Reuse the normalized route data shared with MapLibre. Static overview maps are not a prerequisite for interactive maps.

## Future Garmin inReach MapShare live tracking

**Status: deferred; maintain the current live-position information cards until this work is explicitly scoped and implemented.**

The intended position source is the user's **Garmin inReach MapShare** KML tracking feed, subject to confirming feed access, authentication requirements, rate limits, and Garmin's current terms at implementation time. Fetch the feed **server-side**, never from visitors' browsers. Never disclose the private MapShare feed URL or credentials.

### Tracking flow

1. Before a hike, upload/assign a **planned GPX route** and explicitly associate a MapShare tracking session with that hike.
2. While enabled, the backend periodically polls the KML feed, validates and deduplicates new position fixes, and stores original timestamps and source identifiers where available. Poll cadence is configurable and should respect provider constraints; it does not control the device's satellite transmission interval.
3. Expose only authorized, intentionally published position/track data through the site's own API.
4. On the interactive map, draw a latest-known position marker, the growing **actual inReach track**, and the planned route divided into completed and remaining sections.
5. When tracking ends, retain the historical session for that hike. Optionally replace or supplement the sparse inReach track with a higher-resolution GPX recording after the hike without losing the original satellite fixes.

### Suggested entities

- `HikeRoute`: planned/recorded geometry, source GPX reference, total distance, cumulative distances and bounds.
- `TrackingSession`: hike association, Garmin source/configuration reference, explicit start/end, publishing status, timestamps and polling state.
- `TrackingPoint`: position, source timestamp, received timestamp, optional Garmin metadata and deduplication identity.
- `RouteProgress`: derived or cached output of matching the tracking history to a particular planned-route version; include matched distance along route, percentage, remaining distance and confidence/uncertainty.

Exact database schema is undecided. Avoid storing sensitive credentials in public hike data.

### Automatic progress along planned route

Calculate progress using **distance along the planned GPX route**, **not** straight-line distance from the start and **not** cumulative straight segments between sparse inReach fixes. This allows a meaningful display such as “52% complete” even when Garmin positions are 10+ minutes apart and cut corners.

- Precompute cumulative distance over planned route geometry.
- Map-match successive Garmin positions to plausible route segments, using tracking history/direction and continuity to disambiguate crossings, switchbacks and close parallel paths.
- Derive `percent = matched_distance_along_route / total_planned_route_distance * 100`, plus remaining planned-route distance.
- Track both **current position along route** and **furthest confidently confirmed progress**, since backtracking and detours can make them differ.
- Optionally compute overall hike and **current-stage progress**, using known stage boundaries along the route.
- Distinguish **distance progressed along the plan** from **actual distance walked**; sparse satellite points generally underestimate walked distance.
- When the position is far off route, a route crossing is ambiguous, or data becomes stale, retain the last confident progress and display an uncertainty/stale indication rather than confidently showing an incorrect percentage.
- Avoid false jumps forward or backward at route crossings, loops, detours and retraced sections. Support planned-route changes/versioning and recalculation if the hike deviates substantially.
- Freeze the visible progress when there is no new fix; always show the timestamp/age of the last reported position.
- Treat 100% completion as something to verify against an appropriate endpoint/tolerance or explicit finish state, not merely a nearest-segment accident.

### Privacy, security and reliability

- Explicitly enable/disable publication per tracking session; never automatically publish locations between hikes.
- Support existing password/access control if applicable, and consider delayed publishing, location suppression around sensitive places, and publication of last-known positions only when allowed.
- Keep private feed credentials on the server; validate fetched content, handle network failures/timeouts, cap history sizes and avoid leaking secrets in logs/errors.
- Handle timezone differences, duplicate fixes, delayed/out-of-order messages and tracking feed retention limits.
- Use clear status labels such as active, stale, inactive and finished; do not infer a person's safety or precise real-time position from a delayed satellite feed.
- Decide polling frequency, Garmin authentication, session lifecycle, publication rules and retention during implementation planning.

## Implementation order (future; no work authorized yet)

1. **Geographic data foundation:** GPX upload/validation, original-file retention, normalized GeoJSON, planned vs recorded routes, route bounds/distances and stage associations.
2. **Interactive map:** MapLibre + OpenFreeMap on individual hike pages; planned route, start/finish and stage markers, mobile UX.
3. **Custom waypoints:** backend/admin editing, map-based placement, localized descriptions, icons and photos.
4. **Garmin data ingestion:** MapShare KML polling, tracking sessions/history, privacy settings and public API.
5. **Live visualization and progress:** distinct planned/completed/remaining/actual lines, latest position, overall and stage progress, route matching and uncertainty handling.
6. **Static SVG renderer:** branded geographic overviews using the shared data model; schedule independently of live tracking.
7. **Optional enhancements:** linked elevation profile, all-hikes overview, historical playback, alternate topographic basemaps and finer-resolution post-hike track replacement.

## Open decisions

- Exact MapShare KML feed variant, credentials, polling limits and retention behavior.
- How tracking starts/stops and relates to planned vs recorded routes and hike statuses.
- Publication/access policy, time delay, sensitive-place masking, and stale thresholds.
- Route matching algorithm/tolerances, stage mapping, route versioning and off-route behavior.
- Whether actual inReach tracks are public during a hike or only afterward.
- Basemap fallback, tile-provider terms and attribution.
- Placement and visual prominence of the interactive map on hike and chapter pages.
- Whether/when the separate static SVG generator is needed.

## References

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [OpenFreeMap](https://openfreemap.org/)
- [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright)
- [Garmin Explore / MapShare](https://explore.garmin.com/)
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
- [GeoJSON specification (RFC 7946)](https://datatracker.ietf.org/doc/html/rfc7946)
- [Natural Earth boundary data and terms](https://www.naturalearthdata.com/about/terms-of-use/)
- [Viktor Zenk's website — inspiration for tracking visualization](https://www.viktorzenk.se/)
