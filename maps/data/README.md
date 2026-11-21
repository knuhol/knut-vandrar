# Country outlines

`countries.json` contains the country geometries and names from Natural Earth's
public-domain 1:110m Admin 0 Countries dataset, retrieved 21 November 2026:

https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson

https://www.naturalearthdata.com/about/terms-of-use/

Route coordinates select the locator outline, including multiple countries for
cross-border routes. If no country contains route points, the locator is omitted.
These generalised outlines are illustrations, not navigation boundaries.
Terrain attribution uses intersection with the visible viewport. Proximity to a
neighbouring country alone does not add its credit.

Mapterhorn already incorporates Finland's National Land Survey 2 m elevation
model (2025, CC BY 4.0), recorded in `terrain-sources.json`. Contours and hillshade
use this shared terrain service; a separate Finnish API key is unnecessary.
