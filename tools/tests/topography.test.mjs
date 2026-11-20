import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  terrainMode,
  addTopography,
  createTopography,
  preparePeakLabels,
} from "../../maps/topography.mjs";
const settings = JSON.parse(
  await readFile(new URL("../../maps/topography.json", import.meta.url)),
);
const tokens = {
  "orange-dark": "#d97a00",
  forest: "#2f4f3e",
  cream: "#faf4e5",
  beige: "#e8dec4",
  muted: "#6b6b6b",
};

test("terrain effects are independently configurable and do not alter shared settings", () => {
  const original = structuredClone(settings);
  assert.equal(terrainMode(settings, "hillshade").contours.enabled, false);
  assert.equal(terrainMode(settings, "contours").hillshade.enabled, false);
  assert.equal(terrainMode(settings, "combined").hillshade.enabled, true);
  assert.equal(
    createTopography({}, null, terrainMode(settings, "none"), 1000),
    null,
  );
  assert.deepEqual(settings, original);
  assert.throws(() => terrainMode(settings, "invalid"));
});

test("water masks topographic layers while route and place labels remain above them", () => {
  const layers = [
    { id: "land", type: "fill" },
    { id: "water", type: "fill", "source-layer": "water" },
    { id: "place", type: "symbol" },
    { id: "route", type: "line" },
  ];
  const sources = {};
  const map = {
    getStyle: () => ({ layers }),
    addSource: (id, value) => (sources[id] = value),
    addLayer: (layer, before) =>
      layers.splice(
        layers.findIndex((l) => l.id === before),
        0,
        layer,
      ),
  };
  const runtime = {
    dem: {
      sharedDemProtocolUrl: "shared://{z}/{x}/{y}",
      contourProtocolUrl: (opts) => {
        assert.equal(opts.multiplier, 1);
        return "contours://{z}/{x}/{y}";
      },
    },
  };
  addTopography(map, runtime, settings, tokens);
  for (const id of [
    "vandrar-hillshade",
    "vandrar-contour-lines",
    "vandrar-contour-labels",
  ])
    assert.ok(
      layers.findIndex((l) => l.id === id) <
        layers.findIndex((l) => l.id === "water"),
    );
  assert.deepEqual(
    layers.find((l) => l.id === "vandrar-contour-labels").filter,
    [">", ["get", "level"], 0],
  );
  assert.equal(sources["vandrar-dem"].tileSize, 512);
  assert.equal(sources["vandrar-dem"].encoding, "terrarium");
  assert.equal(layers.at(-1).id, "route");
});

test("prominent peaks receive collision padding and elevation priority", () => {
  const style = { layers: [{ id: "vandrar-mountain-context", layout: {} }] };
  preparePeakLabels(style, settings);
  assert.equal(
    style.layers[0].layout["text-padding"],
    settings.peakLabels.padding,
  );
  assert.deepEqual(style.layers[0].layout["symbol-sort-key"], [
    "-",
    0,
    ["to-number", ["get", "ele"], 0],
  ]);
  assert.equal(settings.contours.thresholds["7"][0], 100);
});

test("DEM protocol errors remain observable for capture readiness", async () => {
  const handlers = new Map();
  const maplibre = {
    addProtocol: (id, fn) => handlers.set(id, fn),
    removeProtocol: (id) => handlers.delete(id),
  };
  class DemSource {
    sharedDemProtocolId = "shared";
    contourProtocolId = "contours";
    sharedDemProtocol = async () => ({ data: new ArrayBuffer(1) });
    contourProtocol = async () => {
      throw new Error("DEM unavailable");
    };
    setupMaplibre() {}
  }
  const runtime = createTopography(maplibre, { DemSource }, settings, 1000);
  await handlers.get("shared")({}, new AbortController());
  await assert.rejects(
    handlers.get("contours")({}, new AbortController()),
    /DEM unavailable/,
  );
  assert.equal(runtime.activity.completed, 1);
  assert.equal(runtime.activity.pending, 0);
  assert.deepEqual(runtime.activity.errors, ["DEM unavailable"]);
  runtime.dispose();
  assert.equal(handlers.size, 0);
});

test("Kartverket attribution follows the visible area rather than hike identity", async () => {
  const { terrainAttribution, includesNorwegianTerrain } =
    await import("../../maps/attribution.mjs");
  const provider = {
    attribution: "Terrain © Mapterhorn",
    norwayAttribution: "© Kartverket (CC BY 4.0)",
  };
  for (const bounds of [
    [
      [14, 58],
      [17, 60],
    ],
    [
      [15, 58.5],
      [19, 60.5],
    ],
  ]) {
    assert.equal(includesNorwegianTerrain(bounds), false);
    assert.equal(terrainAttribution(provider, bounds), provider.attribution);
  }
  for (const bounds of [
    [
      [11, 62.5],
      [13, 63.5],
    ],
    [
      [10, 60],
      [11, 61],
    ],
    [
      [12, 63],
      [12.1, 63.1],
    ],
  ])
    assert.match(terrainAttribution(provider, bounds), /Kartverket/);
  assert.match(terrainAttribution(provider), /Kartverket/);
});
