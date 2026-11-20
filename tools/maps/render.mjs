/** Private, one-shot Chromium adapter. Reads a validated job from stdin. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const job = JSON.parse(Buffer.concat(chunks));
const config = job.config;
const allowedOrigins = new Set([
  config.provider.tileOrigin,
  config.provider.assetOrigin,
  ...(job.topography ? [job.topography.settings.provider.tileOrigin] : []),
]);
const origin = "http://vandrar-render.local";
const vendor = path.join(root, "node_modules/maplibre-gl/dist");
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const context = await browser.newContext({
    deviceScaleFactor: config.render.pixelRatio,
    userAgent: config.provider.userAgent,
  });
  const errors = [];
  let active = 0;
  const waiting = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      const local = [
        "/style.mjs",
        "/illustration.mjs",
        "/detail.mjs",
        "/topography.mjs",
        "/attribution.mjs",
      ].includes(url.pathname)
        ? path.join(root, "maps", path.basename(url.pathname))
        : /^\/vendor\/[a-zA-Z0-9_.-]+\.(?:m?js|css)$/.test(url.pathname)
          ? path.join(vendor, path.basename(url.pathname))
          : null;
      if (/^\/contour\/[a-zA-Z0-9_.-]+\.(?:m?js)$/.test(url.pathname)) {
        return route.fulfill({
          contentType: "text/javascript",
          body: await readFile(
            path.join(
              root,
              "node_modules/maplibre-contour/dist",
              path.basename(url.pathname),
            ),
          ),
        });
      }
      if (url.pathname === "/data/norway.json")
        return route.fulfill({
          contentType: "application/json",
          body: await readFile(path.join(root, "maps/data/norway.json")),
        });
      if (url.pathname === "/")
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html><head><link rel="stylesheet" href="/vendor/maplibre-gl.css"></head><body><div id="map"></div><div id="attribution"></div></body></html>',
        });
      if (local)
        return route.fulfill({
          contentType: local.endsWith(".css") ? "text/css" : "text/javascript",
          body: await readFile(local),
        });
    }
    if (!allowedOrigins.has(url.origin)) {
      errors.push(`Unexpected map asset origin: ${url.origin}`);
      return route.abort();
    }
    // Bound external concurrency, including worker requests, without storing tile archives.
    if (active >= 4) await new Promise((resolve) => waiting.push(resolve));
    else active += 1;
    try {
      const response = await route.fetch({
        timeout: config.render.timeoutMs,
        maxRetries: 2,
        maxRedirects: 0,
      });
      if (!response.ok())
        errors.push(`Map asset HTTP ${response.status()}: ${url.pathname}`);
      await route.fulfill({ response });
    } catch {
      errors.push(`Map asset request failed: ${url.pathname}`);
      await route.abort();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active -= 1;
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(config.render.timeoutMs);
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [name, dimensions] of Object.entries(config.variants)) {
    errors.length = 0;
    await page.setViewportSize({
      width: dimensions.width / config.render.pixelRatio,
      height: dimensions.height / config.render.pixelRatio,
    });
    await page.goto(origin);
    await page.evaluate(
      async ({ job }) => {
        const maplibre = await import("/vendor/maplibre-gl.mjs");
        const { Map, setWorkerUrl } = maplibre;
        const { prepareStyle, addRoute, routeForDisplay } =
          await import("/style.mjs");
        setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
        const { config, route, tokens } = job;
        const sheet = document.createElement("style");
        sheet.textContent = `html,body,#map{margin:0;width:100%;height:100%;overflow:hidden}#attribution{position:absolute;bottom:0;right:0;max-width:100%;box-sizing:border-box;padding:4px 8px;display:flex;flex-wrap:wrap;justify-content:flex-end;column-gap:4px;font:12px/1.4 sans-serif;color:${tokens.ink};background:${tokens.paper};z-index:2}`;
        document.head.append(sheet);
        document.getElementById("attribution").textContent = config.attribution;
        const illustration = job.illustration
          ? await import("/illustration.mjs")
          : null;
        const topography = job.topography
          ? await import("/topography.mjs")
          : null;
        const terrain = topography
          ? topography.terrainMode(job.topography.settings, job.topography.mode)
          : null;
        const { terrainAttribution, layoutAttribution } =
          await import("/attribution.mjs");
        let terrainRuntime = null;
        if (terrain) {
          const contour = await import("/contour/index.mjs");
          terrainRuntime = topography.createTopography(
            maplibre,
            contour.default,
            terrain,
            config.render.timeoutMs,
          );
          document.getElementById("attribution").textContent =
            config.attribution + " · " + terrainAttribution(terrain.provider);
        }
        function setAttribution(terrainCredit = "") {
          layoutAttribution(
            document.getElementById("attribution"),
            config.attribution,
            terrainCredit,
          );
        }
        setAttribution(terrain ? terrainAttribution(terrain.provider) : "");
        await document.fonts.ready;
        if (illustration && job.illustration.profile === "auto") {
          job.illustration.profile = illustration.labelProfile(
            job.illustration,
          );
        }
        const styled = illustration
          ? illustration.illustrationStyle(
              job.style,
              tokens,
              job.illustration.profile,
              job.illustration,
            )
          : job.style;
        if (terrain) topography.preparePeakLabels(styled, terrain);
        const map = new Map({
          container: "map",
          style: prepareStyle(styled, tokens),
          interactive: false,
          attributionControl: false,
          renderWorldCopies: true,
          fadeDuration: 0,
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
        window.renderErrors = [];
        map.on("error", (event) =>
          window.renderErrors.push(String(event.error?.message ?? event.error)),
        );
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Map style load timeout")),
            config.render.timeoutMs,
          );
          map.once("load", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        addRoute(map, route, config, tokens);
        await document.fonts.ready;
        const markerExtent = Math.max(
          config.overlay.markerRadius +
            config.overlay.markerStrokeWidth * (route.circular ? 2 : 1),
          route.stop ? (job.illustration?.stopSize ?? 12) + 2 : 0,
        );
        let viewportPadding = illustration
          ? illustration.attributionPadding(
              config.render.padding,
              document.getElementById("attribution").getBoundingClientRect()
                .height,
              job.illustration.attributionGap ?? 16,
              markerExtent,
            )
          : config.render.padding;
        map.fitBounds(route.bounds, {
          padding: viewportPadding,
          maxZoom: config.render.maxZoom,
          duration: 0,
        });
        if (terrain) {
          // Refit after shorter credits, then recheck expanded geography conservatively.
          for (let attempt = 0; attempt < 2; attempt++) {
            const bounds = map.getBounds();
            setAttribution(
              terrainAttribution(terrain.provider, [
                [bounds.getWest(), bounds.getSouth()],
                [bounds.getEast(), bounds.getNorth()],
              ]),
            );
            if (illustration)
              viewportPadding = illustration.attributionPadding(
                config.render.padding,
                document.getElementById("attribution").getBoundingClientRect()
                  .height,
                job.illustration.attributionGap ?? 16,
                markerExtent,
              );
            map.fitBounds(route.bounds, {
              padding: viewportPadding,
              maxZoom: config.render.maxZoom,
              duration: 0,
            });
          }
        }
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Map assets idle timeout")),
            config.render.timeoutMs,
          );
          map.once("idle", () => {
            clearTimeout(timeout);
            resolve();
          });
          map.triggerRepaint();
        });
        if (terrainRuntime) {
          topography.addTopography(map, terrainRuntime, terrain, tokens);
          await new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Terrain rendering timed out")),
              config.render.timeoutMs * 2,
            );
            map.once("idle", () => {
              clearTimeout(timer);
              resolve();
            });
            map.triggerRepaint();
          });
        }
        if (job.illustration?.profile === "detail") {
          const { loadDetailContext } = await import("/detail.mjs");
          const detailReport = await loadDetailContext(Map, map, job);
          await new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Detail label rendering timed out")),
              config.render.timeoutMs,
            );
            map.once("idle", () => {
              clearTimeout(timer);
              resolve();
            });
            map.triggerRepaint();
          });
          window.detailReport = detailReport;
        }
        await document.fonts.ready;
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        if (!map.areTilesLoaded() || !map.isStyleLoaded())
          throw new Error("Map assets are incomplete");
        const attribution = document
          .getElementById("attribution")
          .getBoundingClientRect();
        if (
          !attribution.width ||
          !attribution.height ||
          attribution.left < 0 ||
          attribution.top < 0
        ) {
          throw new Error("Attribution is not fully visible");
        }
        for (const item of document.getElementById("attribution").children) {
          const box = item.getBoundingClientRect();
          if (
            box.left < 0 ||
            box.right > innerWidth ||
            box.bottom > innerHeight
          )
            throw new Error("An attribution credit is clipped");
        }
        const display = routeForDisplay(route);
        const { width, height } = map.getContainer().getBoundingClientRect();
        for (const feature of display.geojson.features) {
          for (const segment of feature.geometry.coordinates) {
            for (const coordinate of segment) {
              const point = map.project(coordinate);
              const padding = config.render.padding - 1;
              if (
                point.x < padding ||
                point.y < padding ||
                point.x > width - padding ||
                point.y > height - padding
              ) {
                throw new Error("Route is outside the padded image frame");
              }
            }
          }
        }
        if (illustration)
          illustration.addIllustration(
            map,
            display,
            tokens,
            {
              ...job.illustration,
              startColorToken: config.overlay.startColorToken,
              finishColorToken: config.overlay.finishColorToken,
            },
            job.country,
          );
        if (terrainRuntime) {
          if (
            terrainRuntime.activity.pending ||
            terrainRuntime.activity.errors.length ||
            !terrainRuntime.activity.completed
          )
            throw new Error(
              "Elevation/contour work is incomplete: " +
                terrainRuntime.activity.errors.join("; "),
            );
          window.terrainReport = {
            mode: job.topography.mode,
            zoom: map.getZoom(),
            ...terrainRuntime.activity,
          };
          if (
            terrain.contours.enabled &&
            map.getZoom() >= terrain.contours.minZoom
          ) {
            const features = map.querySourceFeatures("vandrar-contours", {
              sourceLayer: "contours",
            });
            window.terrainReport.contourFeatures = features.length;
            window.terrainReport.majorContourFeatures = features.filter(
              (feature) => feature.properties.level > 0,
            ).length;
            window.terrainReport.renderedMajorContours = map
              .queryRenderedFeatures({ layers: ["vandrar-contour-lines"] })
              .filter((feature) => feature.properties.level > 0).length;
            window.terrainReport.contourGeometryTypes = [
              ...new Set(features.map((feature) => feature.geometry.type)),
            ];
            window.terrainReport.majorElevations = [
              ...new Set(
                features
                  .filter((feature) => feature.properties.level > 0)
                  .map((feature) => feature.properties.ele),
              ),
            ];
            window.terrainReport.renderedContourLabels =
              map.queryRenderedFeatures({
                layers: ["vandrar-contour-labels"],
              }).length;
            // Collision placement can legitimately hide every major contour label.
            // Readiness is established by idle, loaded tiles and protocol activity.
            // Flat areas and regional views can legitimately contain no contours.
          }
        }
        if (job.illustration) {
          const creditBox = document
            .getElementById("attribution")
            .getBoundingClientRect();
          const requiredGap = job.illustration.attributionGap ?? 16;
          const labels = [
            ...document.querySelectorAll("[data-vandrar-endpoint]"),
          ];
          const gaps = labels.map((label) => ({
            name: label.textContent,
            gap: creditBox.top - label.getBoundingClientRect().bottom,
          }));
          if (gaps.some((item) => item.gap < requiredGap - 0.5))
            throw new Error("Endpoint label is too close to attribution");
          const markerPoints = [
            { kind: "start", coordinates: display.start },
            { kind: "finish", coordinates: display.finish },
            ...(display.stop
              ? [{ kind: "stop", coordinates: display.stop.coordinates }]
              : []),
          ];
          const markerGaps = markerPoints.map((marker) => ({
            kind: marker.kind,
            gap:
              creditBox.top -
              (map.project(marker.coordinates).y + markerExtent),
          }));
          if (markerGaps.some((marker) => marker.gap < requiredGap - 0.5))
            throw new Error("Route marker is too close to attribution");
          window.layoutReport = {
            attribution: Array.from(
              document.getElementById("attribution").children,
              (row) => row.textContent,
            ).join("\n"),
            labelProfile: job.illustration.profile,
            requiredAttributionGap: requiredGap,
            attributionHeight: creditBox.height,
            endpoints: gaps,
            markers: markerGaps,
            viewportPadding,
          };
        }
        window.terrainRuntime = terrainRuntime;
        window.renderMap = map;
      },
      { job },
    );
    const layoutReport = await page.evaluate(() => window.layoutReport);
    if (layoutReport)
      await writeFile(
        path.join(job.output, `${name}-layout.json`),
        JSON.stringify(layoutReport, null, 2) + "\n",
      );
    const terrainReport = await page.evaluate(() => window.terrainReport);
    if (terrainReport) {
      console.error(`Terrain: ${JSON.stringify(terrainReport)}`);
      await writeFile(
        path.join(job.output, `${name}-terrain.json`),
        JSON.stringify(terrainReport, null, 2) + "\n",
      );
    }
    const mapErrors = await page.evaluate(() => window.renderErrors);
    const detailReport = await page.evaluate(() => window.detailReport);
    if (detailReport)
      console.error(`Detail context: ${JSON.stringify(detailReport)}`);
    if (errors.length || mapErrors.length)
      throw new Error([...errors, ...mapErrors].join("; "));
    const png = await page.screenshot({
      type: "png",
      animations: "disabled",
      timeout: config.render.timeoutMs,
    });
    await writeFile(path.join(job.output, `${name}.png`), png);
    console.error(
      `Rendered ${name}: ${dimensions.width} × ${dimensions.height}`,
    );
    await page.evaluate(() => {
      window.renderMap.remove();
      window.terrainRuntime?.dispose();
    });
  }
} finally {
  await browser.close();
}
