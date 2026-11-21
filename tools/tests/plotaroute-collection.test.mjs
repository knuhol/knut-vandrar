import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const root = new URL("../plotaroute-extension/", import.meta.url);

test("Plotaroute collection export", async (t) => {
  const code = (
    await Promise.all(
      ["settings.js", "protocol.js", "background.js"].map(async (name) =>
        (await readFile(new URL(name, root), "utf8"))
          .replace(/^import .*\n/gm, "")
          .replace(/export /g, ""),
      ),
    )
  ).join("\n");
  function fixture({
    pauseAfterFirst = false,
    saved = null,
    rejectAfterFirst = false,
  } = {}) {
    const names = ["Trail 1 ←", "Trail 2 ←"];
    let current = 0;
    let tabUrl = "https://www.plotaroute.com/routecollection/20512";
    let nextId = 1;
    let job = saved;
    let pauseOnce = pauseAfterFirst;
    let rejectOnce = rejectAfterFirst;
    let rejectedNavigations = 0;
    const items = [];
    const fetched = [];
    const configuredSettings = [];
    const manifests = [];
    const messages = [];
    const copy = (value) =>
      value == null ? value : JSON.parse(JSON.stringify(value));
    const api = {
      tabs: {
        get: async () => ({ url: tabUrl, status: "complete" }),
        update: async (_, { url }) => {
          if (rejectOnce && fetched.length === 1) {
            rejectOnce = false;
            rejectedNavigations++;
            throw new Error("Navigation rejected.");
          }
          tabUrl = url;
        },
      },
      scripting: {
        executeScript: async ({ func, args, world }) => {
          const [mode, index] = args;
          if (func.name === "collectionPageTask") {
            assert.equal(
              world,
              "MAIN",
              "Collection controls use inline page handlers",
            );
            if (mode === "list")
              return [{ result: { names, title: "Trail (2 → 1)" } }];
            if (mode === "select") current = index;
            if (mode === "follow")
              tabUrl = `https://www.plotaroute.com/route/${100 + current}`;
            return [{ result: { ready: true } }];
          }
          if (func.name === "routePageTask") {
            if (mode === "configure") configuredSettings.push(copy(args[1]));
            const record = {
              name: `Trail ${current + 1}`,
              sourceUrl: tabUrl,
              metadata: {
                RouteName: names[current],
                About: `Start ${current + 1} - End ${current + 1}`,
              },
            };
            if (mode === "download") {
              fetched.push(current);
              items.push({
                id: nextId++,
                url: "https://download.plotaroute.com/route",
                filename: `/Downloads/${record.name}.${(args[1]?.format || "GPX").toLowerCase()}`,
                exists: true,
                state: "complete",
                // Simulate browser timestamps rounded down to whole seconds.
                startTime: new Date(
                  Math.floor(Date.now() / 1000) * 1000,
                ).toISOString(),
                finalUrl: "https://cdn.example.com/export.gpx",
              });
            }
            return [{ result: record }];
          }
          return [{ result: tabUrl === args[0] }];
        },
      },
      storage: {
        local: {
          get: async () => ({ collectionJob: copy(job) }),
          set: async ({ collectionJob }) => {
            job = copy(collectionJob);
            if (pauseOnce && job.routes.length === 1) {
              job.pause_requested = true;
              pauseOnce = false;
            }
          },
        },
        session: { set: async ({ result }) => messages.push(copy(result)) },
      },
      downloads: {
        search: async (query) =>
          query.id !== undefined
            ? items.filter((item) => item.id === query.id)
            : items
                .filter(
                  (item) =>
                    !query.startedAfter || item.startTime >= query.startedAfter,
                )
                .slice()
                .reverse(),
        download: async ({ url }) => {
          manifests.push(
            JSON.parse(decodeURIComponent(url.slice(url.indexOf(",") + 1))),
          );
          const id = nextId++;
          items.push({
            id,
            state: "complete",
            filename: "/Downloads/plotaroute-20512.json",
          });
          return id;
        },
      },
      runtime: { onMessage: { addListener() {} } },
    };
    const context = vm.createContext({
      chrome: api,
      URL,
      Date,
      setTimeout,
      routePageTask() {},
      collectionPageTask() {},
    });
    vm.runInContext(code, context);
    return {
      context,
      items,
      fetched,
      configuredSettings,
      manifests,
      messages,
      names,
      job: () => job,
      rejected: () => rejectedNavigations,
    };
  }
  await t.test(
    "waits for the route viewer before selecting a collection row",
    async () => {
      // The route table appears before the initial map request completes. A click
      // during that request is ignored by Plotaroute, leaving route 1 selected.
      let displayed = "";
      let selections = 0;
      const renderedRows = ["Trail 1 ←", "Trail 2 ←"].map((name) => ({
        cells: [{ textContent: name }],
        querySelector: () => ({
          click() {
            selections++;
            displayed = name;
          },
        }),
      }));
      const viewer = {
        getElementById: (id) =>
          id === "RoutesTab"
            ? {
                querySelectorAll: (selector) =>
                  selector === "thead th"
                    ? [{ textContent: "ROUTE" }]
                    : renderedRows,
              }
            : { textContent: displayed },
      };
      const pageContext = vm.createContext({
        document: {
          getElementById: () => ({ contentDocument: viewer }),
          querySelector: () => ({ textContent: "Trail" }),
        },
      });
      vm.runInContext(
        (await readFile(new URL("collection-page.js", root), "utf8")).replace(
          "export ",
          "",
        ),
        pageContext,
      );
      assert.equal(
        vm.runInContext("collectionPageTask('list')", pageContext).error,
        "routeNotReady",
      );
      assert.equal(selections, 0);
      displayed = "Trail 1 ←";
      assert.equal(
        vm.runInContext("collectionPageTask('list')", pageContext).names.length,
        2,
      );
      vm.runInContext(
        "collectionPageTask('select', 1, 'Trail 2 ←')",
        pageContext,
      );
      assert.equal(
        vm.runInContext(
          "collectionPageTask('details', 1, 'Trail 2 ←')",
          pageContext,
        ).ready,
        true,
      );
      assert.equal(selections, 1);
    },
  );

  await t.test(
    "downloads routes sequentially and preserves source order in manifests",
    async () => {
      const full = fixture();
      await vm.runInContext(
        "start(() => runCollection(1, '20512', false))",
        full.context,
      );
      assert.deepEqual(full.fetched, [0, 1]);
      assert.equal(full.job().phase, "collectionComplete");
      assert.equal(full.manifests[0].routes.length, 2);
      assert.equal(full.manifests[0].routes[1].filename, "Trail 2.gpx");
      assert.equal(
        full.manifests[0].routes[0].metadata.About,
        "Start 1 - End 1",
      );
      assert.equal(full.messages.at(-1).phase, "collectionComplete");

      // Repair/resume can checkpoint an earlier route last; exports still use site order.
      full.context.exportedJob = {
        ...full.job(),
        routes: [...full.job().routes].reverse(),
      };
      const repairedManifest = vm.runInContext(
        "manifestFor(exportedJob)",
        full.context,
      );
      assert.deepEqual(
        Array.from(repairedManifest.routes, (route) => route.source_order),
        [0, 1],
      );
      assert.deepEqual(
        Array.from(
          full.context.exportedJob.routes,
          (route) => route.source_order,
        ),
        [1, 0],
      );
    },
  );

  await t.test(
    "retries a rejected navigation without losing collection progress",
    async () => {
      const rejected = fixture({ rejectAfterFirst: true });
      await vm.runInContext(
        "start(() => runCollection(1, '20512', false))",
        rejected.context,
      );
      assert.equal(rejected.rejected(), 1);
      assert.deepEqual(rejected.fetched, [0, 1]);
      assert.equal(rejected.job().phase, "collectionComplete");
      assert.equal(rejected.manifests[0].routes.length, 2);
    },
  );

  await t.test("resumes using the saved download settings", async () => {
    const custom = fixture({ pauseAfterFirst: true });
    await vm.runInContext(
      "start(() => runCollection(1, '20512', false, {format:'KML',type:'Route',waypoints:'None'}))",
      custom.context,
    );
    assert.equal(custom.job().settings.format, "KML");
    await vm.runInContext(
      "start(() => runCollection(1, '20512', true, {format:'GPX',type:'Track',waypoints:'Directions'}))",
      custom.context,
    );
    assert.equal(custom.job().phase, "collectionComplete");
    assert.equal(custom.manifests[0].routes[1].filename, "Trail 2.kml");
    assert.deepEqual(
      custom.configuredSettings.map((x) => x.format),
      ["KML", "KML"],
    );
  });

  await t.test(
    "pauses and resumes without downloading completed routes again",
    async () => {
      const paused = fixture({ pauseAfterFirst: true });
      await vm.runInContext(
        "start(() => runCollection(1, '20512', false))",
        paused.context,
      );
      assert.deepEqual(paused.fetched, [0]);
      assert.equal(paused.job().phase, "paused");
      assert.equal(paused.job().next, 1);
      await vm.runInContext(
        "start(() => runCollection(1, '20512', true))",
        paused.context,
      );
      assert.deepEqual(paused.fetched, [0, 1]);
      assert.equal(paused.job().routes.length, 2);
      assert.equal(paused.job().phase, "collectionComplete");
    },
  );

  await t.test(
    "recovers interrupted checkpoints and rejects changed collections",
    async () => {
      // A browser restart after the file saves but before its checkpoint must not download it twice.
      const initial = {
        id: "20512",
        url: "https://www.plotaroute.com/routecollection/20512",
        title: "Trail",
        names: ["Trail 1 ←", "Trail 2 ←"],
        routes: [],
        next: 0,
        phase: "downloading",
        pending: {
          source_id: "100",
          source_order: 0,
          name: "Trail 1",
          metadata: { RouteName: "Trail 1 ←", About: "Start 1 - End 1" },
          started_after: "2000-01-01T00:00:00Z",
          excluded_downloads: [],
        },
      };
      const restarted = fixture({ saved: initial });
      restarted.items.push({
        id: 10,
        url: "https://download.plotaroute.com/route",
        filename: "/Downloads/Trail 1.gpx",
        exists: true,
        state: "complete",
        startTime: "2020-01-01T00:00:00Z",
      });
      await vm.runInContext(
        "start(() => runCollection(1, '20512', true))",
        restarted.context,
      );
      assert.deepEqual(restarted.fetched, [1]);
      assert.equal(restarted.job().routes.length, 2);

      const changed = fixture({ saved: { ...initial, pending: null } });
      changed.names[0] = "Changed route";
      await vm.runInContext(
        "start(() => runCollection(1, '20512', true))",
        changed.context,
      );
      assert.equal(changed.messages.at(-1).error, "collectionChanged");
      assert.equal(changed.fetched.length, 0);
      assert.equal(changed.job().names[0], "Trail 1 ←");
    },
  );
});
