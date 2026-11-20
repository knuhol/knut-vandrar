const outdoorTypes = new Set([
  "alpine_hut",
  "wilderness_hut",
  "shelter",
  "viewpoint",
  "waterfall",
  "camp_site",
  "campsite",
  "trailhead",
  "visitor_centre",
  "visitor_center",
  "bridge",
]);

function anchor(geometry) {
  if (geometry.type === "Point") return geometry.coordinates;
  if (geometry.type === "LineString")
    return geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];
  if (geometry.type === "MultiLineString") {
    const longest = geometry.coordinates.reduce(
      (a, b) => (a.length >= b.length ? a : b),
      [],
    );
    return longest[Math.floor(longest.length / 2)] ?? null;
  }
  const points = [];
  const walk = (coordinates) => {
    if (typeof coordinates[0] === "number") points.push(coordinates);
    else coordinates.forEach(walk);
  };
  walk(geometry.coordinates);
  if (!points.length) return null;
  let west = Infinity,
    east = -Infinity,
    south = Infinity,
    north = -Infinity;
  for (const [longitude, latitude] of points) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  return [(west + east) / 2, (south + north) / 2];
}

function routeDistance(point, lines) {
  let nearest = Infinity;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1],
        b = line[i];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * dx + (point.y - a.y) * dy) /
            (dx * dx + dy * dy || 1),
        ),
      );
      nearest = Math.min(
        nearest,
        Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy),
      );
    }
  }
  return nearest;
}

/** Bound context labels by relevance, deduplicated name, viewport and screen spacing. */
export function selectContext(
  features,
  { kind, limit, project, lines, width, height, radius, spacing = 100 },
) {
  if (!limit) return [];
  const candidates = [];
  for (const feature of features) {
    const name = feature.properties.name || feature.properties["name:latin"];
    if (!name) continue;
    if (
      kind === "pois" &&
      ![feature.properties.class, feature.properties.subclass].some((type) =>
        outdoorTypes.has(type),
      )
    )
      continue;
    if (
      kind === "rivers" &&
      (!["LineString", "MultiLineString"].includes(feature.geometry.type) ||
        ![feature.properties.class, feature.properties.subclass].some((type) =>
          ["river", "stream"].includes(type),
        ))
    )
      continue;
    const coordinate = anchor(feature.geometry);
    if (!coordinate) continue;
    const point = project(coordinate);
    if (
      point.x < 35 ||
      point.y < 35 ||
      point.x > width - 35 ||
      point.y > height - 35
    )
      continue;
    const distance = routeDistance(point, lines);
    if (kind === "pois" && distance > radius) continue;
    const centerDistance = Math.hypot(
      point.x - width / 2,
      point.y - height / 2,
    );
    candidates.push({
      feature,
      name,
      point,
      coordinate,
      score:
        kind === "pois"
          ? distance
          : kind === "peaks"
            ? -Number(feature.properties.ele || 0)
            : centerDistance,
    });
  }
  candidates.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  const selected = [],
    names = new Set(),
    positions = [];
  for (const candidate of candidates) {
    const key = candidate.name.trim().toLowerCase();
    if (
      names.has(key) ||
      positions.some(
        (p) =>
          Math.hypot(p.x - candidate.point.x, p.y - candidate.point.y) <
          spacing,
      )
    )
      continue;
    names.add(key);
    positions.push(candidate.point);
    selected.push(
      kind === "areas"
        ? {
            ...candidate.feature,
            geometry: { type: "Point", coordinates: candidate.coordinate },
          }
        : candidate.feature,
    );
    if (selected.length === limit) break;
  }
  return selected;
}

/** Load available high-zoom context at its real tile coordinates for an overview image. */
export async function loadDetailContext(MapRenderer, map, job) {
  let zoom = job.illustration.detailTileZoom;
  const bounds = map.getBounds();
  let world = 512 * 2 ** zoom;
  const y = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  let width = Math.ceil(((bounds.getEast() - bounds.getWest()) / 360) * world);
  let height = Math.ceil(
    ((y(bounds.getNorth()) - y(bounds.getSouth())) / (2 * Math.PI)) * world,
  );
  while ((width > 8192 || height > 8192) && zoom > 0) {
    zoom -= 1;
    world /= 2;
    width = Math.ceil(width / 2);
    height = Math.ceil(height / 2);
  }
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "absolute",
    left: "-20000px",
    top: "0",
    width: `${width}px`,
    height: `${height}px`,
  });
  document.body.append(container);
  const sampler = new MapRenderer({
    container,
    center: map.getCenter(),
    zoom,
    pixelRatio: 1,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    style: {
      version: 8,
      sources: { context: structuredClone(job.style.sources.openmaptiles) },
      layers: [
        {
          id: "load-context",
          type: "circle",
          source: "context",
          "source-layer": "mountain_peak",
          paint: { "circle-radius": 1, "circle-opacity": 0 },
        },
      ],
    },
  });
  const errors = [];
  sampler.on("error", (event) =>
    errors.push(String(event.error?.message ?? event.error)),
  );
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Detailed context tile loading timed out")),
        job.config.render.timeoutMs,
      );
      sampler.once("idle", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    if (errors.length) throw new Error(errors.join("; "));
    const report = { zoom };
    const settings = job.illustration;
    const limits = settings.labelLevels[String(settings.labelLevel)];
    const canvas = map.getContainer();
    const project = (coordinate) => map.project(coordinate);
    const rawLines = job.route.geojson.features.flatMap(
      (feature) => feature.geometry.coordinates,
    );
    const pointCount = rawLines.reduce((sum, line) => sum + line.length, 0);
    const stride = Math.max(1, Math.ceil(pointCount / 2000));
    const lines = rawLines.map((line) =>
      line
        .filter((_, i) => i % stride === 0 || i === line.length - 1)
        .map(project),
    );
    const center = map.getCenter();
    const origin = project([center.lng, center.lat]);
    const edge = project([
      center.lng,
      Math.min(85, center.lat + settings.landmarkRadiusMetres / 111320),
    ]);
    const radius = Math.min(64, Math.abs(edge.y - origin.y));
    for (const [layer, target] of [
      ["mountain_peak", "peaks"],
      ["water_name", "waters"],
      ["poi", "pois"],
      ["place", "places"],
      ["park", "areas"],
      ["waterway", "rivers"],
    ]) {
      const unique = new Map();
      for (const feature of sampler.querySourceFeatures("context", {
        sourceLayer: layer,
      })) {
        const value = JSON.parse(JSON.stringify(feature.toJSON()));
        if (
          target === "peaks" &&
          Number(value.properties.ele || 0) <
            (job.topography?.settings?.peakLabels?.minimumElevation ?? 0)
        )
          continue;
        if (!value.properties.name && !value.properties["name:latin"]) continue;
        const key = JSON.stringify([
          feature.id,
          value.properties.name,
          value.geometry,
        ]);
        unique.set(key, {
          type: "Feature",
          properties: value.properties,
          geometry: value.geometry,
        });
      }
      const budget = limits[target === "pois" ? "landmarks" : target];
      const features = selectContext([...unique.values()], {
        kind: target,
        limit: budget,
        project,
        lines,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        radius,
        spacing: settings.contextSpacingPixels,
      });
      map
        .getSource(`illustration-${target}`)
        .setData({ type: "FeatureCollection", features });
      report[layer] = features.length;
    }
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Sampled context render timed out")),
        job.config.render.timeoutMs,
      );
      map.once("idle", () => {
        clearTimeout(timer);
        resolve();
      });
      map.triggerRepaint();
    });
    return report;
  } finally {
    sampler.remove();
    container.remove();
  }
}
