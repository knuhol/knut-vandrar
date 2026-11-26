import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PbfWriter } from "pbf";
import { addDetailLabelLayer, addOutdoorFacilities, loadDetailLabels, routeProximity, prepareOutdoorFacilities, selectOverviewLabels } from "../../frontend/src/maps/detailLabels.ts";
import { illustrationPaint } from "../../frontend/src/maps/illustrationPaint.mjs";
import {
  addTopography,
  createTopography,
  preparePeakLabels,
} from "../../frontend/src/maps/topography.mjs";
const settings = JSON.parse(
  await readFile(new URL("../../frontend/src/maps/topography.json", import.meta.url)),
);
const tokens = {
  "orange-dark": "#d97a00",
  forest: "#2f4f3e",
  cream: "#faf4e5",
  beige: "#e8dec4",
  muted: "#6b6b6b",
};

test("terrain is skipped when both effects are disabled", () => {
  const disabled = {
    ...settings,
    hillshade: { ...settings.hillshade, enabled: false },
    contours: { ...settings.contours, enabled: false },
  };
  assert.equal(createTopography({}, null, disabled, 1000), null);
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

test("interactive maps add peak and reserve labels alongside denser lake labels", async () => {
  const base = JSON.parse(
    await readFile(new URL("../../maps/vandrar.json", import.meta.url)),
  );
  const style = illustrationPaint(base, { ...tokens, sage: "#abc0ac", paper: "#fffdf8" });
  preparePeakLabels(style, settings);
  const peak = style.layers.find((layer) => layer.id === "vandrar-mountain-context");
  const reserve = style.layers.find((layer) => layer.id === "vandrar-area-context");
  assert.equal(peak["source-layer"], "mountain_peak");
  assert.equal(reserve["source-layer"], "park");
  assert.equal(
    style.layers.find((layer) => layer.id === "landcover_wetland").paint["fill-pattern"],
    "wetland_bg_11",
  );
  assert.equal(style.layers.find((layer) => layer.id === "water_name_point_label").layout["text-padding"], 6);
  assert.equal(
    peak.layout["text-padding"],
    settings.peakLabels.padding,
  );
  assert.deepEqual(peak.layout["symbol-sort-key"], [
    "-",
    0,
    ["to-number", ["get", "ele"], 0],
  ]);
  assert.equal(settings.contours.thresholds["7"][0], 100);
});

test("DEM protocols propagate failures and are removed on disposal", async () => {
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
    setupMaplibre(map) {
      map.addProtocol(this.sharedDemProtocolId, this.sharedDemProtocol);
      map.addProtocol(this.contourProtocolId, this.contourProtocol);
    }
  }
  const runtime = createTopography(maplibre, { DemSource }, settings, 1000);
  await handlers.get("shared")({}, new AbortController());
  await assert.rejects(
    handlers.get("contours")({}, new AbortController()),
    /DEM unavailable/,
  );
  runtime.dispose();
  assert.equal(handlers.size, 0);
});

test("overview labels load a bounded set of detail tiles independently of the basemap zoom", async (t) => {
  const tile = new PbfWriter();
  tile.writeMessage(3, (_, layer) => {
    layer.writeVarintField(15, 2);
    layer.writeStringField(1, "park");
    layer.writeMessage(2, (_, feature) => {
      feature.writePackedVarint(2, [0, 0]);
      feature.writeVarintField(3, 1);
      feature.writePackedVarint(4, [9, 4096, 4096]);
    });
    layer.writeStringField(3, "name");
    layer.writeMessage(4, (_, value) => value.writeStringField(1, "Muddus"));
  });
  const bytes = tile.finish();
  const fetchTile = t.mock.method(globalThis, "fetch", () =>
    Promise.resolve(new Response(bytes)),
  );
  const controller = new AbortController();
  const labels = await loadDetailLabels(
    "https://tiles.example.test/{z}/{x}/{y}.pbf",
    [[19.7, 66.7], [20, 66.86]],
    14,
    controller.signal,
  );
  assert.ok(fetchTile.mock.callCount() > 0 && fetchTile.mock.callCount() <= 24);
  assert.match(fetchTile.mock.calls[0].arguments[0], /\/11\/-?\d+\/\d+\.pbf$/);
  assert.ok(labels.features.some((feature) => feature.properties.name === "Muddus"));
  controller.abort();
  const count = fetchTile.mock.callCount();
  await loadDetailLabels(
    "https://tiles.example.test/{z}/{x}/{y}.pbf",
    [[19.7, 66.7], [20, 66.86]],
    14,
    controller.signal,
  );
  assert.equal(fetchTile.mock.callCount(), count);
});

test("the named hiking area is available before detail tiles load", () => {
  const sources = new Map();
  const layers = [];
  const map = {
    addSource: (id, source) => sources.set(id, source),
    addLayer: (layer) => layers.push(layer),
    once() {},
    on() {},
  };
  addDetailLabelLayer(
    map,
    { bounds: [[19, 66], [21, 68]], lines: [], tokens },
    new AbortController().signal,
    "Muddus",
  );
  const layer = layers.find((item) => item.id === "hike-area-label");
  assert.deepEqual(sources.get(layer.source).data.features, [{
    type: "Feature",
    geometry: { type: "Point", coordinates: [20, 67] },
    properties: { kind: "hike-area", name: "Muddus" },
  }]);
});

test("outdoor facilities preload along the route before zooming in", async (t) => {
  const layers = [];
  const listeners = new Map();
  const basemap = { maxzoom: 14 };
  const tile = new PbfWriter();
  tile.writeMessage(3, (_, layer) => {
    layer.writeVarintField(15, 2);
    layer.writeStringField(1, "poi");
    const facilities = [
      ["Trail shelter", "shelter", "shelter"],
      ["Trail cabin", "chalet", "lodging"],
      ["Bird tower", "observation_tower", "viewpoint"],
      ["Bus stop", "shelter", "bus"],
      ["", "shelter", "shelter"],
      ["", "toilets", "toilets"],
      ["", "shelter", "shelter"],
      ["Supermarket", "supermarket", "grocery"],
      ["Trail apartments", "apartment", "lodging"],
      ["Outdoor shop", "outdoor", "shop"],
      ["Bakery", "bakery", "bakery"],
    ];
    for (const [index] of [...facilities, facilities[4]].entries()) {
      layer.writeMessage(2, (_, feature) => {
        const entry = index < facilities.length ? index : 4;
        feature.writePackedVarint(2, [0, entry * 3, 1, entry * 3 + 1, 2, entry * 3 + 2]);
        feature.writeVarintField(3, 1);
        feature.writePackedVarint(4, [9, entry === 3 || entry === 6 ? 4608 : 4096, 4096]);
      });
    }
    layer.writeStringField(3, "name");
    layer.writeStringField(3, "subclass");
    layer.writeStringField(3, "class");
    for (const value of facilities.flat()) {
      layer.writeMessage(4, (_, entry) => entry.writeStringField(1, value));
    }
  });
  const bytes = tile.finish();
  const fetchTile = t.mock.method(globalThis, "fetch", () =>
    Promise.resolve(new Response(bytes)),
  );
  let publish;
  const published = new Promise((resolve) => { publish = resolve; });
  const map = {
    getLayer: () => ({ minzoom: 12 }),
    getBounds: () => ({ toArray: () => [[19.8, 66.8], [19.81, 66.81]] }),
    getSource: (id) => id === "openmaptiles"
      ? basemap
      : { setData: publish },
    addSource() {},
    addLayer: (layer) => layers.push(layer),
    once: (event, callback) => listeners.set(event, callback),
    on: (event, callback) => listeners.set(event, callback),
    off: (event) => listeners.delete(event),
  };
  const cleanup = addOutdoorFacilities(map, {
    tokens,
    bounds: [[19.8, 66.8], [19.81, 66.81]],
    lines: [[[19.8, 66.805], [19.81, 66.805]]],
  });
  assert.equal(layers[0].minzoom, 11);
  assert.equal(layers[0].layout["icon-image"][0], "coalesce");
  assert.equal(layers[0].layout["icon-allow-overlap"], true);
  assert.equal(layers[0].layout["text-size"], 14);
  listeners.get("sourcedata")();
  assert.equal(fetchTile.mock.callCount(), 0);
  basemap.tiles = ["https://tiles.example.test/{z}/{x}/{y}.pbf"];
  listeners.get("sourcedata")();
  const labels = await published;
  assert.ok(labels.features.some((feature) => feature.properties.name === "Trail shelter" && feature.properties.subclass === "shelter"));
  assert.ok(labels.features.some((feature) => feature.properties.name === "Trail cabin"));
  assert.ok(labels.features.some((feature) => feature.properties.name === "Trail apartments" && !feature.properties.genericShelter));
  assert.ok(labels.features.some((feature) => feature.properties.name === "Trail shelter" && feature.properties.genericShelter));
  assert.ok(labels.features.some((feature) => feature.properties.name === "Supermarket"));
  assert.ok(!labels.features.some((feature) => feature.properties.name === "Bakery"));
  assert.ok(!labels.features.some((feature) => feature.properties.name === "Outdoor shop"));
  assert.ok(!labels.features.some((feature) => ["Bus stop", "Bird tower"].includes(feature.properties.name)));
  const unnamed = labels.features.filter((feature) => feature.properties.name === "");
  assert.deepEqual(unnamed.map((feature) => feature.properties.subclass), ["shelter"]);
  assert.match(fetchTile.mock.calls[0].arguments[0], /\/14\//);
  cleanup();
});

test("outdoor facilities are filtered by distance to GPX segments", () => {
  const nearRoute = routeProximity({
    bounds: [[179.9, 59], [180.1, 59]],
    lines: [
      [[179.9, 59], [-179.98, 59]],
      [[-179.92, 59], [-179.9, 59]],
    ],
  });
  assert.equal(nearRoute([-179.99, 59.004]), true);
  assert.equal(nearRoute([-179.99, 59.004], 100), false);
  assert.equal(nearRoute([-179.99, 59.0008], 100), true);
  assert.equal(nearRoute([-179.99, 59.005]), false);
  assert.equal(nearRoute([-179.95, 59]), false);
  const style = {
    layers: [
      { type: "symbol", "source-layer": "poi", filter: ["has", "name"] },
      { type: "symbol", "source-layer": "place" },
    ],
  };
  prepareOutdoorFacilities(style);
  assert.equal(style.layers[0].filter[0], "all");
  assert.equal(style.layers[0].filter[2][0], "!");
  assert.equal(style.layers[1].filter, undefined);
});

test("crowded route overviews favor useful nearby names while sparse views keep detail", () => {
  const label = (name, kind, x, y) => ({
    type: "Feature",
    properties: { name, kind },
    geometry: { type: "Point", coordinates: [x, y] },
  });
  const river = label("Tjallingån", "waterway", 50, 30);
  const park = label("Malingsbo-Klotens naturvårdsområde", "park", 55, 35);
  const lake = label("Nesjøen", "water_name", 200, 40);
  const duplicate = label("Malingsbo-Kloten", "park", 200, 150);
  const project = ([x, y]) => ({ x, y });
  const near = ([x]) => x < 100;
  assert.deepEqual(selectOverviewLabels([river, lake], 300, 220, project, near), [river, lake]);
  const crowded = [river, park, lake, duplicate, label("Storån", "waterway", 220, 50), label("Ån", "waterway", 70, 70)];
  assert.deepEqual(selectOverviewLabels(crowded, 300, 220, project, near), [park, lake]);
});
