/** Planned endpoints of unfinished hikes share the start treatment. */
export function endpointColors(route, overlay, tokens) {
  const start = tokens[overlay.startColorToken ?? "forest"];
  return {
    start,
    finish:
      route.completed === false || route.stop
        ? start
        : tokens[overlay.finishColorToken ?? "orange-dark"],
  };
}

/** Shared MapLibre style preparation and overlays for static and interactive maps. */
export function prepareStyle(base, tokens) {
  const style = structuredClone(base);
  for (const layer of style.layers) {
    const token = style.metadata?.["vandrar:tokens"]?.[layer.id];
    if (!token) continue;
    const property =
      layer.type === "background" ? "background-color" : "fill-color";
    layer.paint = { ...layer.paint, [property]: tokens[token] };
    if (layer.type === "fill") layer.paint["fill-opacity"] = 0.22;
  }
  return style;
}

export function routeForDisplay(route) {
  const display = structuredClone(route);
  const west = route.bounds[0][0];
  const longitude = (point) => {
    while (point[0] < west) point[0] += 360;
    while (point[0] > west + 360) point[0] -= 360;
  };
  for (const feature of display.geojson.features) {
    for (const segment of feature.geometry.coordinates) {
      for (const point of segment) longitude(point);
    }
  }
  longitude(display.start);
  longitude(display.finish);
  if (display.stop) longitude(display.stop.coordinates);
  return display;
}

export function addRoute(map, originalRoute, config, tokens) {
  const route = routeForDisplay(originalRoute);
  const overlay = config.overlay;
  map.addSource("vandrar-route", { type: "geojson", data: route.geojson });
  for (const [id, color, width] of [
    ["outline", tokens[overlay.outlineColorToken], overlay.outlineWidth],
    ["line", tokens[overlay.routeColorToken], overlay.routeWidth],
  ]) {
    map.addLayer({
      id: `vandrar-route-${id}`,
      type: "line",
      source: "vandrar-route",
      layout: { "line-join": "round", "line-cap": "round" },
      ...(id === "line"
        ? { filter: ["!=", ["get", "progress"], "remaining"] }
        : {}),
      paint: { "line-color": color, "line-width": width },
    });
  }
  if (route.stop)
    map.addLayer({
      id: "vandrar-route-remaining",
      type: "line",
      source: "vandrar-route",
      filter: ["==", ["get", "progress"], "remaining"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": tokens.sage,
        "line-width": overlay.routeWidth,
        "line-dasharray": [2, 1.5],
      },
    });
  const colors = endpointColors(route, overlay, tokens);
  const markers = route.circular
    ? [{ coordinates: route.start, kind: "combined" }]
    : [
        { coordinates: route.start, kind: "start" },
        { coordinates: route.finish, kind: "finish" },
      ];
  map.addSource("vandrar-endpoints", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: markers.map((marker) => ({
        type: "Feature",
        properties: { kind: marker.kind },
        geometry: { type: "Point", coordinates: marker.coordinates },
      })),
    },
  });
  map.addLayer({
    id: "vandrar-markers",
    type: "circle",
    source: "vandrar-endpoints",
    paint: {
      "circle-radius": [
        "case",
        ["==", ["get", "kind"], "finish"],
        overlay.markerRadius - 1,
        overlay.markerRadius,
      ],
      "circle-color": [
        "case",
        ["==", ["get", "kind"], "finish"],
        colors.finish,
        colors.start,
      ],
      "circle-stroke-width": overlay.markerStrokeWidth,
      "circle-stroke-color": tokens[overlay.outlineColorToken],
    },
  });
  // Concentric ring communicates a shared start/finish without displacing either coordinate.
  if (route.circular)
    map.addLayer({
      id: "vandrar-combined-finish",
      type: "circle",
      source: "vandrar-endpoints",
      paint: {
        "circle-radius": overlay.markerRadius + overlay.markerStrokeWidth,
        "circle-color": "transparent",
        "circle-stroke-width": overlay.markerStrokeWidth,
        "circle-stroke-color": colors.finish,
      },
    });
}
