import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = new URL("../plotaroute-extension/", import.meta.url);

export async function runTests() {
  const pageCode = (await readFile(new URL("page.js", root), "utf8")).replace(
    "export ",
    "",
  );
  function fixture({
    missingSetting = false,
    choices = { format: "GPX", type: "Track", waypoints: "POI's" },
  } = {}) {
    let downloads = 0;
    const groups = new Map();
    for (const [id, labels] of [
      ["Download_Format", ["GPX", "KML", "TCX", "FIT"]],
      ["Download_GPXType", ["Track", "Route"]],
      ["Download_GPXWaypoints", ["None", "POI's", "Directions"]],
    ]) {
      const options = labels
        .filter((label) => !(missingSetting && label === "POI's"))
        .map((label) => {
          const element = {
            textContent: label,
            selected: false,
            classList: { contains: () => element.selected },
            click() {
              for (const other of options) other.selected = false;
              element.selected = true;
            },
          };
          return element;
        });
      groups.set(id, { querySelectorAll: () => options });
    }
    const nameInput = { value: "", dispatchEvent() {} };
    const viewer = {
      getElementById(id) {
        return (
          groups.get(id) ||
          {
            Info_RouteName: { textContent: "Bergslagsleden 1 ←" },
            DownloadOverlay: { getClientRects: () => [1] },
            Download_CourseName: nameInput,
            DownloadBut: { click: () => downloads++ },
          }[id]
        );
      },
      querySelectorAll: () => [
        { id: "Info_About", textContent: "Gillersklack - Kloten" },
      ],
    };
    const context = vm.createContext({
      document: {
        getElementById: (id) =>
          id === "RoutePlayer" ? { contentDocument: viewer } : { click() {} },
      },
      location: {
        href: "https://www.plotaroute.com/route/3435756",
        pathname: "/route/3435756",
      },
      Event: class Event {},
      choices,
    });
    vm.runInContext(pageCode, context);
    return { context, nameInput, groups, downloads: () => downloads };
  }
  const normal = fixture();
  const configured = vm.runInContext(
    "routePageTask('configure', choices)",
    normal.context,
  );
  assert.equal(configured.name, "Bergslagsleden 1");
  assert.equal(configured.metadata.About, "Gillersklack - Kloten");
  assert.equal(normal.nameInput.value, "Bergslagsleden 1");
  assert.equal(normal.downloads(), 0);
  vm.runInContext("routePageTask('download', choices)", normal.context);
  assert.equal(normal.downloads(), 1);
  for (const [id, label] of [
    ["Download_Format", "GPX"],
    ["Download_GPXType", "Track"],
    ["Download_GPXWaypoints", "POI's"],
  ]) {
    assert.equal(
      normal.groups
        .get(id)
        .querySelectorAll()
        .find((option) => option.selected).textContent,
      label,
    );
  }
  const missing = fixture({ missingSetting: true });
  assert.equal(
    vm.runInContext("routePageTask('download', choices)", missing.context)
      .error,
    "settingsUnavailable",
  );
  assert.equal(missing.downloads(), 0);

  const workerCode = (
    await Promise.all(
      ["settings.js", "protocol.js", "background.js"].map(async (name) =>
        (await readFile(new URL(name, root), "utf8"))
          .replace(/^import .*\n/gm, "")
          .replace(/export /g, ""),
      ),
    )
  ).join("\n");
  const states = [];
  let triggered = false;
  const worker = vm.createContext({
    URL,
    Date,
    setTimeout,
    routePageTask() {},
    collectionPageTask() {},
    chrome: {
      tabs: {
        get: async () => ({ url: "https://www.plotaroute.com/route/3435756" }),
      },
      scripting: {
        executeScript: async ({ args }) => {
          if (args[0] === "download") triggered = true;
          return [{ result: configured }];
        },
      },
      storage: {
        local: { get: async () => ({}) },
        session: { set: async ({ result }) => states.push(result) },
      },
      downloads: {
        search: async (query) =>
          triggered
            ? [
                {
                  id: 1,
                  url: "blob:https://www.plotaroute.com/123",
                  filename: "/Downloads/Bergslagsleden 1.gpx",
                  state: "complete",
                },
              ]
            : [],
      },
      runtime: { onMessage: { addListener() {} } },
    },
  });
  vm.runInContext(workerCode, worker);
  await vm.runInContext("start(() => run(1))", worker);
  assert.equal(states.at(-1).phase, "complete");
  assert.equal(
    vm.runInContext(
      "isPlotarouteDownload({url:'https://example.com/a',filename:'a.gpx'})",
      worker,
    ),
    false,
  );
  assert.equal(
    vm.runInContext(
      "isPlotarouteDownload({url:'https://www.plotaroute.com/a',filename:'a.html'})",
      worker,
    ),
    false,
  );

  assert.equal(
    vm.runInContext(
      "isPlotarouteDownload({url:'https://www.plotaroute.com/export',finalUrl:'https://cdn.example.com/a',filename:'a.gpx'})",
      worker,
    ),
    true,
  );
  assert.equal(
    vm.runInContext(
      "isPlotarouteDownload({url:'data:application/gpx+xml,test',referrer:'https://www.plotaroute.com/route/123',filename:'a.gpx'})",
      worker,
    ),
    true,
  );

  const settingsCode = (
    await readFile(new URL("settings.js", root), "utf8")
  ).replace(/export /g, "");
  const popupCode = (await readFile(new URL("popup.js", root), "utf8")).replace(
    /^import .*\n/gm,
    "",
  );
  async function popupFixture(preferences) {
    const elements = new Map();
    const sent = [];
    let saved = preferences;
    const document = {
      querySelectorAll: () => [],
      getElementById(id) {
        if (!elements.has(id))
          elements.set(id, {
            value: "",
            handlers: {},
            options: [],
            disabled: false,
            add(option) {
              this.options.push(option);
            },
            addEventListener(type, callback) {
              this.handlers[type] = callback;
            },
          });
        return elements.get(id);
      },
    };
    const context = vm.createContext({
      document,
      Option: class Option {
        constructor(text, value) {
          this.text = text;
          this.value = value;
        }
      },
      chrome: {
        i18n: { getMessage: (key) => key },
        tabs: {
          query: async () => [
            { id: 1, url: "https://www.plotaroute.com/route/3435756" },
          ],
        },
        runtime: {
          sendMessage: async (message) => {
            if (message.type === "busy") return { busy: false };
            sent.push(JSON.parse(JSON.stringify(message)));
            return {};
          },
        },
        storage: {
          local: {
            get: async () => ({ downloadSettings: saved }),
            set: async (value) => {
              saved = JSON.parse(JSON.stringify(value.downloadSettings));
            },
          },
          session: { get: async () => ({ result: { phase: "ready" } }) },
          onChanged: { addListener() {} },
        },
      },
    });
    vm.runInContext(settingsCode, context);
    await vm.runInContext(`(async () => {${popupCode}\n})()`, context);
    return { elements, sent, saved: () => saved };
  }
  const popup = await popupFixture();
  assert.equal(popup.elements.get("format").value, "GPX");
  assert.equal(popup.elements.get("type").value, "Track");
  assert.equal(popup.elements.get("waypoints").value, "POI's");
  popup.elements.get("type").value = "Route";
  popup.elements.get("waypoints").value = "Directions";
  await popup.elements.get("type").handlers.change();
  assert.deepEqual(popup.saved(), {
    format: "GPX",
    type: "Route",
    waypoints: "Directions",
  });
  popup.elements.get("format").value = "KML";
  await popup.elements.get("format").handlers.change();
  assert.equal(popup.elements.get("type").disabled, true);
  assert.equal(popup.elements.get("waypoints").disabled, true);
  await popup.elements.get("download").handlers.click();
  assert.deepEqual(popup.sent[0].settings, popup.saved());
  const reopened = await popupFixture(popup.saved());
  assert.equal(reopened.elements.get("format").value, "KML");
  assert.equal(reopened.elements.get("type").disabled, true);

  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", root), "utf8"),
  );
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.permissions, [
    "activeTab",
    "scripting",
    "downloads",
    "storage",
  ]);
  assert.deepEqual(await readdir(new URL("_locales/", root)), ["en"]);
  assert.equal(manifest.default_locale, "en");
  for (const [size, file] of Object.entries(manifest.icons)) {
    const png = await readFile(new URL(file, root));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), Number(size));
    assert.equal(png.readUInt32BE(20), Number(size));
    assert.equal(manifest.action.default_icon[size], file);
  }
  const custom = fixture({
    choices: { format: "GPX", type: "Route", waypoints: "Directions" },
  });
  const customResult = vm.runInContext(
    "routePageTask('download', choices)",
    custom.context,
  );
  assert.equal(customResult.type, "Route");
  assert.equal(customResult.waypoints, "Directions");
  assert.equal(custom.downloads(), 1);
  assert.equal(
    custom.groups
      .get("Download_GPXType")
      .querySelectorAll()
      .find((x) => x.selected).textContent,
    "Route",
  );
  assert.equal(
    custom.groups
      .get("Download_GPXWaypoints")
      .querySelectorAll()
      .find((x) => x.selected).textContent,
    "Directions",
  );
  for (const format of ["KML", "TCX", "FIT"]) {
    const alternative = fixture({
      missingSetting: true,
      choices: { format, type: "Track", waypoints: "POI's" },
    });
    assert.equal(
      vm.runInContext("routePageTask('download', choices)", alternative.context)
        .format,
      format,
    );
    assert.equal(alternative.downloads(), 1);
    assert.equal(
      alternative.groups
        .get("Download_Format")
        .querySelectorAll()
        .find((x) => x.selected).textContent,
      format,
    );
    assert.equal(
      vm.runInContext(
        `isPlotarouteDownload({url:'https://www.plotaroute.com/export',filename:'a.${format.toLowerCase()}'},'${format}')`,
        worker,
      ),
      true,
    );
  }
  assert.equal(
    vm.runInContext(
      "isPlotarouteDownload({url:'https://www.plotaroute.com/export',filename:'a.kml'},'GPX')",
      worker,
    ),
    false,
  );
  assert.throws(
    () => vm.runInContext("downloadSettings({format:'EXE'})", worker),
    /settingsUnavailable/,
  );
  return "Passed: exact GPX settings, arrow removal, metadata, missing-setting failure, completed-download detection, scope, configurable settings, and English-only UI.";
}

if (
  typeof process !== "undefined" &&
  process.argv[1] === fileURLToPath(import.meta.url)
)
  console.log(await runTests());
