# Future project: hike maps and live tracking

Status: deferred. Do not implement until explicitly requested.

## Current prototype

Store start and finish as optional latitude/longitude pairs associated with a hike.
Keep readable place names and link them to coordinate-based Google Maps searches.
Prototype coordinates live in `frontend/src/mocks/hike-endpoints.json`; they are
illustrative locations, not verified trailhead positions. No API or database changes
have been made. Existing API hikes without coordinates continue showing plain names.

When backend work is authorized, add optional, independently nullable start and end
coordinate pairs to hike storage and API contracts. Validate latitude in [-90, 90]
and longitude in [-180, 180], and require both numbers for each provided pair.
Preserve the existing names. Regenerate and verify the checked-in API schema.

## Static map concept

- Render a static SVG on the Python backend using the site's shared design values.
- Draw country outlines, the hike route, start/finish markers and selected labels.
- Use route-focused framing with a country inset for shorter hikes, and optionally
  a whole-country view for longer journeys. Show the hike distance explicitly.
- Support highlighting a hiking area when there is no fixed route.
- Country boundaries are a shared, versioned dataset, not per-hike records.
- Accept GPX uploads and normalize geometry to GeoJSON in WGS84. GeoJSON positions
  use longitude first, latitude second; Google Maps search URLs use latitude first.
- Keep planned routes and recorded tracks distinct and associated with the hike.
  A hike's route may cover only part of an established trail or be self-planned.
- Initial route storage can use JSONB with LineString/MultiLineString geometry;
  evaluate PostGIS if spatial queries become necessary.
- Retain original uploads or storage references for reprocessing.
- Generate/cache SVG assets when inputs change rather than on every page view.
  Include geometry, displayed distance, locale, labels, rendering/style version and
  boundary-data version in cache invalidation.

## Live tracking

Explore live tracking as a separate feature alongside static route maps. The
provider, refresh frequency, relationship between planned and recorded routes,
and handling of inactive/stale tracking remain undecided. Existing live-position
info cards remain the current presentation until that project is scoped.

## References

- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
- [GeoJSON specification](https://datatracker.ietf.org/doc/html/rfc7946)
- [Natural Earth boundary data](https://www.naturalearthdata.com/about/terms-of-use/)
