import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { addRoute, prepareStyle, routeForDisplay } from "../../maps/style.mjs";

const config = JSON.parse(
  await readFile(new URL("../../maps/config.json", import.meta.url)),
);
const tokens = {
  orange: "#f39200",
  paper: "#fefcf9",
  forest: "#2f4f3e",
  ink: "#222222",
};
const route = {
  geojson: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiLineString",
          coordinates: [
            [
              [179, 60],
              [-179, 61],
            ],
            [
              [179.5, 62],
              [-179.5, 63],
            ],
          ],
        },
      },
    ],
  },
  start: [179, 60],
  finish: [-179.5, 63],
  circular: false,
  bounds: [
    [179, 60],
    [181, 63],
  ],
};

test("display geometry unwraps the antimeridian without changing source or segment boundaries", () => {
  const original = structuredClone(route);
  const display = routeForDisplay(route);
  assert.deepEqual(route, original);
  assert.deepEqual(display.geojson.features[0].geometry.coordinates, [
    [
      [179, 60],
      [181, 61],
    ],
    [
      [179.5, 62],
      [180.5, 63],
    ],
  ]);
  assert.deepEqual(display.finish, [180.5, 63]);
});

test("shared overlays retain separate stages and combine circular endpoint markers", () => {
  const sources = new Map();
  const layers = new Map();
  const map = {
    addSource: (id, source) => sources.set(id, source),
    addLayer: (layer) => layers.set(layer.id, layer),
  };
  addRoute(map, route, config, tokens);
  assert.equal(
    sources.get("vandrar-route").data.features[0].geometry.coordinates.length,
    2,
  );
  assert.equal(sources.get("vandrar-endpoints").data.features.length, 2);
  addRoute(map, { ...route, circular: true }, config, tokens);
  assert.equal(sources.get("vandrar-endpoints").data.features.length, 1);
  assert.ok(layers.has("vandrar-combined-finish"));
});

test("style preparation uses shared tokens and does not mutate the Maputnik document", async () => {
  const base = JSON.parse(
    await readFile(new URL("../../maps/vandrar.json", import.meta.url)),
  );
  const original = structuredClone(base);
  const prepared = prepareStyle(base, { ...tokens, sage: "#6b8f71" });
  assert.deepEqual(base, original);
  assert.equal(
    prepared.layers.find((layer) => layer.id === "background").paint[
      "background-color"
    ],
    tokens.paper,
  );
  assert.equal(prepared.version, 8);
});

test("unfinished route uses a separate dashed remaining layer", () => {
  const layers = new Map();
  const map = {
    addSource() {},
    addLayer: (layer) => layers.set(layer.id, layer),
  };
  addRoute(map, { ...route, stop: { coordinates: [179.5, 61] } }, config, {
    ...tokens,
    sage: "#6b8f71",
  });
  assert.deepEqual(layers.get("vandrar-route-remaining").filter, [
    "==",
    ["get", "progress"],
    "remaining",
  ]);
  assert.ok(layers.get("vandrar-route-remaining").paint["line-dasharray"]);
});

test("detail illustration uses sampled lake labels without native duplicates", async () => {
  const { illustrationStyle } = await import("../../maps/illustration.mjs");
  const base = JSON.parse(
    await readFile(new URL("../../maps/vandrar.json", import.meta.url)),
  );
  const brand = {
    ...tokens,
    sage: "#6b8f71",
    beige: "#e8dec4",
    cream: "#faf4e5",
  };
  const detail = illustrationStyle(base, brand, "detail", {
    detailTileZoom: 11,
  });
  assert.equal(
    detail.layers.find((layer) => layer.id === "water_name_point_label").layout
      .visibility,
    "none",
  );
  assert.ok(detail.sources["illustration-peaks"]);
  assert.equal(
    detail.layers.find((layer) => layer.id === "vandrar-mountain-context")
      .source,
    "illustration-peaks",
  );
  assert.equal(
    detail.sources.openmaptiles.minzoom,
    base.sources.openmaptiles.minzoom,
  );
  const overview = illustrationStyle(base, brand, "overview", {});
  assert.equal(
    overview.layers.find((layer) => layer.id === "label_village").layout
      .visibility,
    "none",
  );
});

test("framing reserves footer clearance for marker edges, including a wrapped footer", async () => {
  const { attributionPadding } = await import("../../maps/illustration.mjs");
  for (const footerHeight of [24.796875, 41.59375]) {
    for (const markerExtent of [10, 13, 14]) {
      const padding = attributionPadding(48, footerHeight, 16, markerExtent);
      const height = 640;
      const markerBottom = height - padding.bottom + markerExtent;
      const footerTop = height - footerHeight;
      assert.ok(footerTop - markerBottom >= 16 - 0.001);
      assert.equal(padding.top, 48);
      assert.equal(padding.left, 48);
      assert.equal(padding.right, 48);
    }
  }
});

test("automatic label detail follows database terrain and defaults to fewer labels", async () => {
  const { labelProfile, illustrationStyle } =
    await import("../../maps/illustration.mjs");
  assert.equal(
    labelProfile({ profile: "auto", terrainTypes: ["mountains"] }),
    "detail",
  );
  for (const terrainTypes of [[], ["lowlands"], ["coastal"]])
    assert.equal(labelProfile({ profile: "auto", terrainTypes }), "overview");
  assert.equal(labelProfile({ profile: "auto" }), "overview");
  assert.equal(
    labelProfile({ profile: "overview", terrainTypes: ["mountains"] }),
    "overview",
  );
  assert.equal(labelProfile({ profile: "detail", terrainTypes: [] }), "detail");
  const base = JSON.parse(
    await readFile(new URL("../../maps/vandrar.json", import.meta.url)),
  );
  const allTokens = {
    ...tokens,
    sage: "#aabbcc",
    cream: "#fafafa",
    beige: "#ddddaa",
  };
  const style = illustrationStyle(base, allTokens, "detail", {
    peakLabels: false,
    lakeLabels: false,
  });
  assert.equal(
    style.layers.find((l) => l.id === "vandrar-mountain-context").layout
      .visibility,
    "none",
  );
  assert.equal(
    style.layers.find((l) => l.id === "vandrar-water-context").layout
      .visibility,
    "none",
  );
});

test("unfinished endpoints share green while completed finishes use orange", async () => {
  const { endpointColors } = await import("../../maps/style.mjs");
  const palette = { forest: "#2f4f3e", "orange-dark": "#d97a00" };
  const overlay = {
    startColorToken: "forest",
    finishColorToken: "orange-dark",
  };
  for (const route of [
    { completed: false },
    { completed: true, stop: { coordinates: [15, 59] } },
  ]) {
    assert.deepEqual(endpointColors(route, overlay, palette), {
      start: palette.forest,
      finish: palette.forest,
    });
  }
  assert.deepEqual(endpointColors({ completed: true }, overlay, palette), {
    start: palette.forest,
    finish: palette["orange-dark"],
  });
});

test("numeric label levels increase detail without changing automatic defaults", async () => {
  const { labelLevel, labelProfile } =
    await import("../../maps/illustration.mjs");
  for (let n = 1; n <= 5; n++) {
    assert.equal(labelLevel({ profile: String(n) }), n);
    assert.equal(
      labelProfile({ profile: String(n) }),
      n < 3 ? "overview" : "detail",
    );
  }
  assert.equal(labelLevel({ profile: "auto", terrainTypes: ["lowlands"] }), 2);
  assert.equal(labelLevel({ profile: "auto", terrainTypes: ["mountains"] }), 3);
  assert.throws(() => labelLevel({ profile: "6" }));
});

test("landmarks are sparse, named, outdoors, near the route and inside the frame", async () => {
  const { selectContext } = await import("../../maps/detail.mjs");
  const poi = (name, x, y, subclass = "shelter") => ({
    type: "Feature",
    properties: { name, class: "lodging", subclass },
    geometry: { type: "Point", coordinates: [x, y] },
  });
  const options = {
    kind: "pois",
    limit: 2,
    project: ([x, y]) => ({ x, y }),
    lines: [
      [
        { x: 50, y: 150 },
        { x: 550, y: 150 },
      ],
    ],
    width: 600,
    height: 400,
    radius: 30,
    spacing: 100,
  };
  const features = [
    poi("Hut", 100, 155),
    poi("Hut", 300, 160),
    poi("Nearby duplicate", 120, 165),
    poi("Waterfall", 450, 170, "waterfall"),
    poi("Distant", 350, 300),
    poi("Shop", 250, 155, "supermarket"),
    poi("", 350, 155),
    poi("Clipped", 10, 150),
  ];
  assert.deepEqual(
    selectContext(features, options).map((f) => f.properties.name),
    ["Hut", "Waterfall"],
  );
  assert.equal(selectContext(features, { ...options, limit: 0 }).length, 0);
});

test("area names deduplicate tile fragments and use a point anchor", async () => {
  const { selectContext } = await import("../../maps/detail.mjs");
  const park = {
    type: "Feature",
    properties: { name: "National park" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [100, 100],
          [400, 100],
          [400, 300],
          [100, 300],
          [100, 100],
        ],
      ],
    },
  };
  const selected = selectContext([park, park], {
    kind: "areas",
    limit: 1,
    project: ([x, y]) => ({ x, y }),
    lines: [],
    width: 600,
    height: 400,
    spacing: 100,
  });
  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0].geometry, {
    type: "Point",
    coordinates: [250, 200],
  });
});

test("all five densities produce valid map styles including sparse area and landmark layers", async () => {
  const { validateStyleMin } = await import("@maplibre/maplibre-gl-style-spec");
  const { illustrationStyle, labelProfile } =
    await import("../../maps/illustration.mjs");
  const base = JSON.parse(
    await readFile(new URL("../../maps/vandrar.json", import.meta.url)),
  );
  const brand = {
    ...tokens,
    sage: "#6b8f71",
    beige: "#e8dec4",
    cream: "#faf4e5",
  };
  for (let level = 1; level <= 5; level++) {
    const settings = {
      ...config.illustration,
      profile: String(level),
      labelLevel: level,
    };
    const style = illustrationStyle(
      base,
      brand,
      labelProfile(settings),
      settings,
    );
    assert.deepEqual(
      validateStyleMin(style).map((error) => error.message),
      [],
    );
    assert.equal(
      style.layers.find((layer) => layer.id === "vandrar-area-context").layout[
        "text-allow-overlap"
      ],
      false,
    );
  }
});

test("label density does not change terrain layers or expose wetland patterns", async () => {
  const { illustrationStyle, labelProfile } =
    await import("../../maps/illustration.mjs");
  const base = JSON.parse(
    await readFile(new URL("../../maps/vandrar.json", import.meta.url)),
  );
  const brand = {
    ...tokens,
    sage: "#6b8f71",
    beige: "#e8dec4",
    cream: "#faf4e5",
  };
  const terrain = (level) =>
    illustrationStyle(base, brand, labelProfile({ profile: String(level) }), {
      ...config.illustration,
      labelLevel: level,
    }).layers.filter((layer) => layer.type !== "symbol");
  assert.deepEqual(terrain(5), terrain(1));
  const wetland = terrain(5).find((layer) => layer.id === "landcover_wetland");
  assert.equal(wetland.minzoom, 12);
  assert.equal(wetland.paint["fill-pattern"], undefined);
  const style = illustrationStyle(base, brand, "detail", config.illustration);
  assert.equal(
    style.layers.find((layer) => layer.id === "vandrar-area-context").layout[
      "text-field"
    ][0],
    "upcase",
  );
  assert.equal(
    style.layers.find((layer) => layer.id === "vandrar-river-context").layout[
      "symbol-placement"
    ],
    "line",
  );
});

test("river context retains line geometry, excludes drains and deduplicates names", async () => {
  const { selectContext } = await import("../../maps/detail.mjs");
  const river = (name, type = "river") => ({
    type: "Feature",
    properties: { name, class: type },
    geometry: {
      type: "LineString",
      coordinates: [
        [50, 100],
        [250, 150],
        [450, 200],
      ],
    },
  });
  const selected = selectContext(
    [river("River"), river("River"), river("Drain", "drain")],
    {
      kind: "rivers",
      limit: 2,
      project: ([x, y]) => ({ x, y }),
      lines: [],
      width: 600,
      height: 400,
      spacing: 100,
    },
  );
  assert.equal(selected.length, 1);
  assert.equal(selected[0].geometry.type, "LineString");
});

test("locator selects Finland and Sweden from route coordinates without a default", async () => {
  const { routeCountry } = await import("../../maps/illustration.mjs");
  const locate = (points) => routeCountry({ geojson: { features: [{ geometry: {
    type: "MultiLineString", coordinates: [points],
  } }] } });
  const countries = JSON.parse(await readFile(new URL("../../maps/data/countries.json", import.meta.url)));
  for (const [name, point] of [["Finland", [25.9, 68.75]], ["Sweden", [15, 59]]]) {
    const feature = countries.features.find((f) => f.properties.name === name);
    const expected = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    assert.deepEqual(locate([point]).geometry.coordinates, expected);
  }
  assert.equal(locate([[0, 0]]), null);
  assert.equal(locate([[25.9, 68.75], [15, 59]]).geometry.coordinates.length, 2);
});
