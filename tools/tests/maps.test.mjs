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
