# Interactive map terrain

The hike maps use worldwide Mapterhorn Terrarium tiles for hillshade and contours.
The map links to the [terrain data credits](https://mapterhorn.com/attribution/)
alongside OpenFreeMap's OpenMapTiles and OpenStreetMap credits.

Terrain settings live in [topography.json](../frontend/src/maps/topography.json).
Hillshade and contour lines can be enabled independently. The same elevation
source feeds both. MapLibre requests terrain on demand, and contour labels become
more detailed as visitors zoom in. The DEM source is capped at zoom 12.
