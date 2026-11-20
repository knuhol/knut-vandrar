/** Optional, provider-free Chromium integration checks. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../..", import.meta.url));
const config = JSON.parse(await readFile(path.join(root, "maps/config.json")));
const base = JSON.parse(await readFile(path.join(root, "maps/vandrar.json")));
const css = await readFile(
  path.join(root, "frontend/src/styles/tokens.css"),
  "utf8",
);
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6});/g)].map((match) => [
    match[1],
    match[2],
  ]),
);
tokens.paper = base.layers.find((layer) => layer.id === "background").paint[
  "background-color"
];
const style = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": tokens.paper },
    },
  ],
};
const fixtures = [
  {
    name: "long multistage route",
    lines: [
      [
        [15, 55],
        [18, 60],
      ],
      [
        [19, 61],
        [22, 68],
      ],
    ],
    bounds: [
      [15, 55],
      [22, 68],
    ],
    circular: false,
  },
  {
    name: "short route",
    lines: [
      [
        [15, 59],
        [15.01, 59.005],
      ],
    ],
    bounds: [
      [15, 59],
      [15.01, 59.005],
    ],
    circular: false,
  },
  {
    name: "circular route",
    lines: [
      [
        [15, 59],
        [15.1, 59.1],
        [15.2, 59],
        [15, 59],
      ],
    ],
    bounds: [
      [15, 59],
      [15.2, 59.1],
    ],
    circular: true,
  },
  {
    name: "antimeridian route",
    lines: [
      [
        [179, 59],
        [-179, 60],
      ],
    ],
    bounds: [
      [179, 59],
      [181, 60],
    ],
    circular: false,
  },
];

for (const fixture of fixtures) {
  test(
    `Chromium renders every variant with framing and attribution: ${fixture.name}`,
    {
      skip: process.env.VANDRAR_RENDER_TESTS !== "1",
      timeout: 120000,
    },
    async () => {
      const output = await mkdtemp(path.join(os.tmpdir(), "vandrar-map-test-"));
      try {
        const route = {
          geojson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "MultiLineString",
                  coordinates: fixture.lines,
                },
              },
            ],
          },
          bounds: fixture.bounds,
          start: fixture.lines[0][0],
          finish: fixture.lines.at(-1).at(-1),
          circular: fixture.circular,
        };
        const child = spawn(process.execPath, ["tools/maps/render.mjs"], {
          cwd: root,
          stdio: ["pipe", "ignore", "pipe"],
        });
        let error = "";
        child.stderr.on("data", (chunk) => {
          error += chunk;
        });
        child.stdin.end(
          JSON.stringify({ config, style, tokens, route, output }),
        );
        const code = await new Promise((resolve, reject) => {
          child.on("error", reject);
          child.on("close", resolve);
        });
        assert.equal(code, 0, error);
        for (const [name, dimensions] of Object.entries(config.variants)) {
          const png = await readFile(path.join(output, `${name}.png`));
          assert.equal(png.readUInt32BE(16), dimensions.width);
          assert.equal(png.readUInt32BE(20), dimensions.height);
        }
      } finally {
        await rm(output, { recursive: true, force: true });
      }
    },
  );
}

test(
  "attribution uses one row or splits precisely before Terrain",
  { skip: process.env.VANDRAR_RENDER_TESTS !== "1" },
  async () => {
    const { chromium } = await import("playwright");
    const { layoutAttribution } = await import("../../maps/attribution.mjs");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const basemap = config.attribution;
      const terrain =
        "Terrain © Mapterhorn · mapterhorn.com/attribution · © Kartverket (CC BY 4.0)";
      for (const width of [640, 800, 1200, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        await page.setContent(
          '<div id="credit" style="box-sizing:border-box;max-width:100%;padding:4px 8px;font:12px/1.4 sans-serif;position:absolute;bottom:0;right:0"></div>',
        );
        const result = await page.evaluate(
          ({ source, basemap, terrain }) => {
            const layout = (0, eval)(`(${source})`);
            const element = document.getElementById("credit");
            layout(element, basemap, terrain);
            return {
              rows: Array.from(element.children, (row) => row.textContent),
              clipped: Array.from(element.children).some(
                (row) =>
                  row.getBoundingClientRect().right > innerWidth ||
                  row.getBoundingClientRect().left < 0,
              ),
            };
          },
          { source: layoutAttribution.toString(), basemap, terrain },
        );
        assert.equal(result.clipped, false);
        assert.equal(result.rows.length, width < 1200 ? 2 : 1);
        if (result.rows.length === 2)
          assert.deepEqual(result.rows, [basemap, terrain]);
        assert.ok(result.rows.every((row) => !/^\s*·|·\s*$/.test(row)));
      }
    } finally {
      await browser.close();
    }
  },
);
