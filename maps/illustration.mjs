import { endpointColors } from "./style.mjs";

/** Unknown, coastal and lowland classifications use the quieter label profile. */
export function labelProfile(settings) {
  if (settings.profile !== "auto") return settings.profile;
  return settings.terrainTypes?.includes("mountains") ? "detail" : "overview";
}

/** Fit the entire route and marker strokes above the measured attribution panel. */
export function attributionPadding(
  padding,
  attributionHeight,
  gap,
  markerExtent,
) {
  return {
    top: padding,
    left: padding,
    right: padding,
    bottom: Math.max(padding, attributionHeight + gap + markerExtent),
  };
}

/** Reusable illustration styling; country geometry and route metadata are supplied as data. */
export function illustrationStyle(base, tokens, profile, settings) {
  const style = structuredClone(base);
  delete style.metadata["vandrar:tokens"];
  const mix = (a, b, t) =>
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * (1 - t) +
            parseInt(b.slice(i, i + 2), 16) * t,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const water = mix(tokens.sage, tokens.paper, 0.52);
  for (const layer of style.layers) {
    const id = layer.id;
    const source = layer["source-layer"];
    const paint = (layer.paint ??= {});
    if (layer.type === "background") paint["background-color"] = tokens.cream;
    if (layer.type === "raster")
      layer.layout = { ...layer.layout, visibility: "none" };
    if (layer.type === "fill") {
      if (source === "water") paint["fill-color"] = water;
      else if (source === "landcover" || source === "park") {
        const shade = id.includes("wood")
          ? 0.73
          : id.includes("ice")
            ? 0.96
            : 0.86;
        paint["fill-color"] = mix(tokens.sage, tokens.cream, shade);
        paint["fill-opacity"] = 1;
        if (profile === "detail") layer.minzoom = 0;
      } else if (source === "landuse")
        paint["fill-color"] = mix(tokens.beige, tokens.cream, 0.6);
    }
    if (layer.type === "line") {
      if (source === "waterway")
        paint["line-color"] = mix(tokens.sage, tokens.paper, 0.35);
      else if (source === "boundary") {
        paint["line-color"] = tokens.sage;
        paint["line-opacity"] = 0.35;
      } else if (source === "transportation") {
        paint["line-color"] = id.includes("casing")
          ? tokens.cream
          : tokens.beige;
        paint["line-opacity"] = 0.65;
      } else if (source === "park")
        paint["line-color"] = mix(tokens.sage, tokens.cream, 0.65);
    }
    if (layer.type === "symbol") {
      layer.layout = { ...layer.layout };
      if (source === "place") {
        paint["text-color"] = tokens.forest;
        paint["text-halo-color"] = tokens.cream;
        layer.layout["text-padding"] = settings.detailPlacePadding ?? 32;
        if (
          profile === "detail" &&
          !["label_city", "label_city_capital", "label_town"].includes(id)
        )
          layer.layout.visibility = "none";
        if (profile === "overview") {
          if (!["label_city", "label_city_capital", "label_town"].includes(id))
            layer.layout.visibility = "none";
          else {
            layer.layout["text-size"] = id === "label_town" ? 11 : 13;
            layer.layout["text-padding"] = 28;
          }
        }
      } else if (source === "water_name" || source === "waterway") {
        layer.layout.visibility = "visible";
        paint["text-color"] = tokens.forest;
        paint["text-halo-color"] = tokens.cream;
        layer.layout["text-size"] = profile === "detail" ? 11 : 10;
        layer.layout["text-padding"] =
          profile === "detail" ? (settings.detailLabelPadding ?? 18) : 25;
        if (profile === "overview") layer.layout.visibility = "none";
        else layer.layout.visibility = "none";
      } else if (source === "poi") {
        layer.layout.visibility = "none";
      } else if (
        source === "transportation_name" ||
        source === "aerodrome_label"
      )
        layer.layout.visibility = "none";
    }
  }
  if (profile === "detail") {
    for (const name of ["peaks", "waters", "pois", "places"]) {
      style.sources[`illustration-${name}`] = {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      };
    }
    const font = ["Noto Sans Regular"];
    const local = ["coalesce", ["get", "name"], ["get", "name:latin"]];
    style.layers.push({
      id: "vandrar-mountain-context",
      type: "symbol",
      source: "illustration-peaks",
      minzoom: 0,
      layout: {
        "text-field": [
          "concat",
          "△ ",
          local,
          [
            "case",
            ["has", "ele"],
            ["concat", " · ", ["to-string", ["get", "ele"]]],
            "",
          ],
        ],
        "text-font": font,
        "text-size": 11,
        "text-padding": settings.detailLabelPadding ?? 18,
        "text-max-width": 10,
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": tokens.forest,
        "text-halo-color": tokens.cream,
        "text-halo-width": 1.5,
      },
    });
    for (const [name, source] of [
      ["water", "waters"],
      ["locality", "places"],
    ]) {
      style.layers.push({
        id: `vandrar-${name}-context`,
        type: "symbol",
        source: `illustration-${source}`,
        layout: {
          "text-field": local,
          "text-font": font,
          "text-size": 11,
          "text-padding": settings.detailLabelPadding ?? 18,
          "text-max-width": 11,
        },
        paint: {
          "text-color": tokens.forest,
          "text-halo-color": tokens.cream,
          "text-halo-width": 1.5,
        },
      });
    }
    style.layers.push({
      id: "vandrar-outdoor-context",
      type: "symbol",
      source: "illustration-pois",
      minzoom: 0,
      filter: ["has", "name"],
      layout: {
        "text-field": local,
        "text-font": font,
        "text-size": 10,
        "text-padding": settings.detailPlacePadding ?? 32,
        "text-max-width": 10,
      },
      paint: {
        "text-color": tokens.forest,
        "text-halo-color": tokens.cream,
        "text-halo-width": 1.2,
      },
    });
  }
  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    if (profile === "detail" && layer.id === "vandrar-locality-context") {
      layer.filter = ["in", ["get", "class"], ["literal", ["city", "town"]]];
      layer.layout["text-padding"] = settings.detailPlacePadding ?? 32;
    }
    const source = layer["source-layer"];
    if (
      (settings.peakLabels === false &&
        (source === "mountain_peak" ||
          layer.source === "illustration-peaks")) ||
      (settings.lakeLabels === false &&
        (source === "water_name" || layer.source === "illustration-waters"))
    ) {
      layer.layout = { ...layer.layout, visibility: "none" };
    }
  }
  return style;
}

export function addIllustration(map, route, tokens, settings, country) {
  const colors = endpointColors(route, settings, tokens);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute(
    "viewBox",
    `0 0 ${settings.insetWidth} ${settings.insetHeight}`,
  );
  svg.setAttribute("width", settings.insetWidth);
  svg.setAttribute("height", settings.insetHeight);
  const mercator = ([lon, lat]) => [
    (lon * Math.PI) / 180,
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
  ];
  const polygons =
    country.geometry.type === "Polygon"
      ? [country.geometry.coordinates]
      : country.geometry.coordinates;
  const points = polygons.flat(2).map(mercator);
  const west = Math.min(...points.map((p) => p[0])),
    east = Math.max(...points.map((p) => p[0])),
    south = Math.min(...points.map((p) => p[1])),
    north = Math.max(...points.map((p) => p[1]));
  const insetPadding = 8;
  const scale = Math.min(
    (settings.insetWidth - insetPadding * 2) / (east - west),
    (settings.insetHeight - insetPadding * 2) / (north - south),
  );
  const x = (p) => settings.insetWidth / 2 + (p[0] - (east + west) / 2) * scale;
  const y = (p) =>
    settings.insetHeight / 2 - (p[1] - (north + south) / 2) * scale;
  const background = document.createElementNS(ns, "rect");
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  background.setAttribute("rx", "6");
  background.setAttribute("fill", tokens.paper);
  background.setAttribute("fill-opacity", "1");
  svg.append(background);
  const path = document.createElementNS(ns, "path");
  path.setAttribute(
    "d",
    polygons
      .map((poly) =>
        poly
          .map(
            (ring) =>
              ring
                .map((p, i) => {
                  const m = mercator(p);
                  return `${i ? "L" : "M"}${x(m).toFixed(2)},${y(m).toFixed(2)}`;
                })
                .join(" ") + "Z",
          )
          .join(" "),
      )
      .join(" "),
  );
  path.setAttribute("fill", tokens.beige);
  path.setAttribute("stroke", tokens.sage);
  path.setAttribute("stroke-width", ".7");
  svg.append(path);
  const rect = document.createElementNS(ns, "rect");
  const bounds = map.getBounds();
  const sw = mercator([bounds.getWest(), bounds.getSouth()]),
    ne = mercator([bounds.getEast(), bounds.getNorth()]);
  const w = Math.max(5, x(ne) - x(sw)),
    h = Math.max(5, y(sw) - y(ne));
  rect.setAttribute("x", (x(sw) + x(ne) - w) / 2);
  rect.setAttribute("y", (y(sw) + y(ne) - h) / 2);
  rect.setAttribute("width", w);
  rect.setAttribute("height", h);
  rect.setAttribute("fill", tokens.orange);
  rect.setAttribute("fill-opacity", ".15");
  rect.setAttribute("stroke", tokens.orange);
  rect.setAttribute("stroke-width", "1.8");
  svg.append(rect);
  const container = map.getContainer();
  const width = container.clientWidth,
    height = container.clientHeight,
    margin = settings.insetMargin;
  const containerBox = container.getBoundingClientRect();
  const attribution = document.getElementById("attribution");
  const attributionTop = attribution
    ? attribution.getBoundingClientRect().top - containerBox.top
    : height;
  const attributionGap = settings.attributionGap ?? 16;
  const annotationBottom = Math.min(
    height - 8,
    attributionTop - attributionGap,
  );
  const candidates = [
    { left: margin, top: margin },
    { left: width - settings.insetWidth - margin, top: margin },
    { left: margin, top: annotationBottom - settings.insetHeight - margin },
    {
      left: width - settings.insetWidth - margin,
      top: annotationBottom - settings.insetHeight - margin,
    },
  ];
  const routePixels = route.geojson.features.flatMap((f) =>
    f.geometry.coordinates.flat().map((p) => map.project(p)),
  );
  const corners = candidates.map((c) => ({
    ...c,
    score: routePixels.filter(
      (p) =>
        p.x > c.left - 15 &&
        p.x < c.left + settings.insetWidth + 15 &&
        p.y > c.top - 15 &&
        p.y < c.top + settings.insetHeight + 15,
    ).length,
  }));
  const corner = corners.reduce((a, b) => (a.score <= b.score ? a : b));
  const inset = document.createElement("div");
  Object.assign(inset.style, {
    position: "absolute",
    left: `${corner.left}px`,
    top: `${corner.top}px`,
    width: `${settings.insetWidth}px`,
    height: `${settings.insetHeight}px`,
    pointerEvents: "none",
  });
  inset.append(svg);
  container.append(inset);
  const obstacles = [
    {
      x: corner.left,
      y: corner.top,
      w: settings.insetWidth,
      h: settings.insetHeight,
    },
  ];
  const endpoints = route.circular
    ? [
        {
          coordinates: route.start,
          name: route.labels?.start || route.labels?.finish,
          kind: "start",
        },
      ]
    : [
        { coordinates: route.start, name: route.labels?.start, kind: "start" },
        {
          coordinates: route.finish,
          name: route.labels?.finish,
          kind: "finish",
        },
      ];
  for (const endpoint of [
    ...endpoints,
    ...(route.stop ? [{ coordinates: route.stop.coordinates }] : []),
  ]) {
    const point = map.project(endpoint.coordinates);
    obstacles.push({ x: point.x - 12, y: point.y - 12, w: 24, h: 24 });
  }
  for (const endpoint of endpoints) {
    if (!endpoint.name) continue;
    const pixel = map.project(endpoint.coordinates);
    const label = document.createElement("div");
    label.textContent = endpoint.name;
    label.dataset.vandrarEndpoint = "true";
    Object.assign(label.style, {
      position: "absolute",
      font: `600 ${settings.endpointFontSize}px/1.25 sans-serif`,
      color: endpoint.kind === "finish" ? colors.finish : colors.start,
      background: tokens.paper,
      padding: `${settings.labelPadding}px ${settings.labelPadding + 2}px`,
      borderRadius: "4px",
      maxWidth: `${width * 0.4}px`,
      boxSizing: "border-box",
      pointerEvents: "none",
    });
    container.append(label);
    const box = label.getBoundingClientRect();
    const options = [
      { x: pixel.x + 14, y: pixel.y - box.height / 2 },
      { x: pixel.x - box.width - 14, y: pixel.y - box.height / 2 },
      { x: pixel.x - box.width / 2, y: pixel.y + 16 },
      { x: pixel.x - box.width / 2, y: pixel.y - box.height - 16 },
    ];
    const scored = options.map((p) => {
      const clamped = {
        x: Math.max(8, Math.min(width - box.width - 8, p.x)),
        y: Math.max(8, Math.min(annotationBottom - box.height, p.y)),
      };
      return {
        ...clamped,
        score:
          obstacles.filter(
            (o) =>
              clamped.x < o.x + o.w &&
              clamped.x + box.width > o.x &&
              clamped.y < o.y + o.h &&
              clamped.y + box.height > o.y,
          ).length *
            10000 +
          routePixels.filter(
            (point) =>
              point.x > clamped.x &&
              point.x < clamped.x + box.width &&
              point.y > clamped.y &&
              point.y < clamped.y + box.height,
          ).length,
      };
    });
    const position = scored.reduce((a, b) => (a.score <= b.score ? a : b));
    label.style.left = `${position.x}px`;
    label.style.top = `${position.y}px`;
    obstacles.push({
      x: position.x,
      y: position.y,
      w: box.width,
      h: box.height,
    });
  }
  if (route.stop) {
    const p = map.project(route.stop.coordinates);
    const cross = document.createElement("div");
    cross.textContent = "×";
    Object.assign(cross.style, {
      position: "absolute",
      left: `${p.x}px`,
      top: `${p.y}px`,
      transform: "translate(-50%,-50%)",
      font: `700 ${settings.stopSize * 2}px/1 sans-serif`,
      color: tokens.forest,
      textShadow: `-2px -2px 0 ${tokens.paper},2px -2px 0 ${tokens.paper},-2px 2px 0 ${tokens.paper},2px 2px 0 ${tokens.paper}`,
    });
    container.append(cross);
  }
}
