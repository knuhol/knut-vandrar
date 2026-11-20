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
    for (const [layer, target] of [
      ["mountain_peak", "peaks"],
      ["water_name", "waters"],
      ["poi", "pois"],
      ["place", "places"],
    ]) {
      const unique = new Map();
      for (const feature of sampler.querySourceFeatures("context", {
        sourceLayer: layer,
      })) {
        const value = JSON.parse(JSON.stringify(feature.toJSON()));
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
      const features = [...unique.values()];
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
