import { downloadSettings } from "./settings.js";
import { routePageTask } from "./page.js";
import { collectionPageTask } from "./collection-page.js";
import { collectionAddress, manifestFor, routeIdentifier } from "./protocol.js";

let busy = false;
let pauseRequested = false;
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const status = (value) => chrome.storage.session.set({ result: value });
async function saveJob(job, resetPause = false) {
  const saved = (await chrome.storage.local.get("collectionJob")).collectionJob;
  if (
    !resetPause &&
    (pauseRequested || (saved?.id === job.id && saved.pause_requested))
  )
    job.pause_requested = true;
  await chrome.storage.local.set({ collectionJob: job });
}

export function isPlotarouteDownload(item, format = "GPX") {
  if (item.filename?.split(".").at(-1)?.toUpperCase() !== format) return false;
  // A redirect may change finalUrl; the original URL/referrer still identifies
  // the site that created a blob, data URL, or redirected download.
  return [item.url, item.finalUrl, item.referrer].some((value) => {
    try {
      const address = new URL(value.replace(/^blob:/, ""));
      return [
        "www.plotaroute.com",
        "plotaroute.com",
        "download.plotaroute.com",
      ].includes(address.hostname);
    } catch {
      return false;
    }
  });
}

async function execute(tabId, mode, task = routePageTask, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    // Collection buttons use inline handlers in the iframe's page context.
    world: "MAIN",
    func: task,
    args: [mode, ...args],
  });
  const value = results[0]?.result;
  if (!value || value.error)
    throw new Error(value?.error || "viewerUnavailable");
  return value;
}

async function waitFor(operation) {
  const deadline = Date.now() + 45000;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (
        !["routeNotReady", "viewerUnavailable", "downloadUnavailable"].includes(
          error.message,
        )
      )
        throw error;
      if (Date.now() >= deadline) throw error;
      await sleep(300);
    }
  }
}

async function navigate(tabId, url) {
  // Chromium can reject a navigation while the previous route/download navigation
  // is still settling. Retry that transient rejection without restarting the job.
  const deadline = Date.now() + 45000;
  while (true) {
    try {
      await chrome.tabs.update(tabId, { url });
      break;
    } catch (error) {
      if (!/navigation rejected/i.test(error.message)) throw error;
      if (Date.now() >= deadline) throw new Error("navigationTimeout");
      await sleep(300);
    }
  }
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url === url) {
      try {
        const ready = await chrome.scripting.executeScript({
          target: { tabId },
          args: [url],
          func: (expected) =>
            location.href === expected && document.readyState !== "loading",
        });
        if (ready[0]?.result) return;
      } catch (error) {
        if (!/frame.*removed|context.*destroyed/i.test(error.message))
          throw error;
      }
    }
    await sleep(300);
  }
  throw new Error("navigationTimeout");
}

async function findDownload(startedAfter, excluded = [], format = "GPX") {
  // Some browser download timestamps have lower precision than Date.toISOString().
  // The baseline IDs exclude earlier files within this small overlap.
  const since = new Date(Date.parse(startedAfter) - 5000).toISOString();
  const items = await chrome.downloads.search({
    startedAfter: since,
    limit: 100,
    orderBy: ["-startTime"],
  });
  return items.find(
    (item) => !excluded.includes(item.id) && isPlotarouteDownload(item, format),
  );
}

async function finishDownload(startedAfter, excluded, format) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const item = await findDownload(startedAfter, excluded, format);
    if (item?.state === "interrupted") throw new Error("downloadInterrupted");
    if (item?.state === "complete") return item;
    await sleep(500);
  }
  throw new Error("downloadTimeout");
}

async function downloadOne(tabId, choices, prepared = async () => {}) {
  await waitFor(() => execute(tabId, "ready"));
  await execute(tabId, "open");
  const checked = await waitFor(() =>
    execute(tabId, "configure", routePageTask, [choices]),
  );
  const startedAfter = new Date().toISOString();
  const baseline = (
    await chrome.downloads.search({ limit: 100, orderBy: ["-startTime"] })
  ).map((item) => item.id);
  await prepared(checked, startedAfter, baseline);
  await execute(tabId, "download", routePageTask, [choices]);
  const item = await finishDownload(startedAfter, baseline, choices.format);
  return { ...checked, filename: item.filename, download_id: item.id };
}

async function run(tabId, choices) {
  choices = downloadSettings(
    choices ||
      (await chrome.storage.local.get("downloadSettings")).downloadSettings,
  );
  await status({ phase: "preparing" });
  routeIdentifier((await chrome.tabs.get(tabId)).url);
  const downloaded = await downloadOne(tabId, choices, async (checked) => {
    await status({ phase: "downloading", ...checked });
  });
  await status({ phase: "complete", ...downloaded });
}

async function checkpointRoute(job, record) {
  job.routes = job.routes.filter(
    (route) => route.source_order !== record.source_order,
  );
  job.routes.push(record);
  job.pending = null;
  delete job.exported_at;
  job.next = record.source_order + 1;
  await saveJob(job);
}

async function runCollection(tabId, value, resume, choices) {
  const address = collectionAddress(value);
  // Navigation stays on the currently granted origin; activeTab alone is sufficient.
  const active = new URL((await chrome.tabs.get(tabId)).url);
  if (active.origin !== new URL(address.url).origin)
    throw new Error("openPlotaroute");
  let job = (await chrome.storage.local.get("collectionJob")).collectionJob;
  if (resume) {
    if (!job || job.id !== address.id) throw new Error("noSavedCollection");
  } else {
    // Don't silently replace an unfinished review/download job.
    if (job && job.phase !== "collectionComplete" && !job.exported_at)
      throw new Error("resumeFirst");
    job = {
      ...address,
      settings: downloadSettings(
        choices ||
          (await chrome.storage.local.get("downloadSettings")).downloadSettings,
      ),
      routes: [],
      next: 0,
      pending: null,
      names: null,
      title: "",
      phase: "preparing",
    };
  }
  job.settings = downloadSettings(job.settings);
  pauseRequested = false;
  job.pause_requested = false;
  await saveJob(job, true);
  await status({ phase: "readingCollection" });
  await navigate(tabId, address.url);
  const snapshot = await waitFor(() =>
    execute(tabId, "list", collectionPageTask),
  );
  if (job.names && JSON.stringify(job.names) !== JSON.stringify(snapshot.names))
    throw new Error("collectionChanged");
  job.names = snapshot.names;
  job.title = snapshot.title;
  // Reconcile a file completed just before the browser/worker was interrupted.
  if (job.pending) {
    const item = await findDownload(
      job.pending.started_after,
      job.pending.excluded_downloads || [],
      job.settings.format,
    );
    if (item?.state === "in_progress") throw new Error("pendingDownload");
    if (item?.state === "complete" && item.exists !== false) {
      const { started_after, excluded_downloads, ...record } = job.pending;
      await checkpointRoute(job, {
        ...record,
        filename: item.filename,
        download_id: item.id,
      });
    }
  }
  for (const record of job.routes) {
    const [item] = await chrome.downloads.search({ id: record.download_id });
    if (!item || item.exists === false || item.state !== "complete") {
      job.next = Math.min(job.next, record.source_order);
    }
  }
  await saveJob(job);
  while (job.next < job.names.length) {
    const saved = (await chrome.storage.local.get("collectionJob"))
      .collectionJob;
    if (saved.pause_requested) {
      job.phase = "paused";
      await saveJob(job);
      await status({
        phase: "paused",
        progress: `${job.routes.length}/${job.names.length}`,
      });
      return;
    }
    const index = job.next;
    const existing = job.routes.find((route) => route.source_order === index);
    if (existing) {
      const [item] = await chrome.downloads.search({
        id: existing.download_id,
      });
      if (item?.exists !== false && item?.state === "complete") {
        job.next++;
        continue;
      }
    }
    job.phase = "downloading";
    await saveJob(job);
    await status({
      phase: "selectingRoute",
      progress: `${index + 1}/${job.names.length}`,
      name: job.names[index],
    });
    await navigate(tabId, address.url);
    const current = await waitFor(() =>
      execute(tabId, "list", collectionPageTask),
    );
    if (JSON.stringify(current.names) !== JSON.stringify(job.names))
      throw new Error("collectionChanged");
    await execute(tabId, "select", collectionPageTask, [
      index,
      job.names[index],
    ]);
    await waitFor(() =>
      execute(tabId, "details", collectionPageTask, [index, job.names[index]]),
    );
    await execute(tabId, "follow", collectionPageTask, [
      index,
      job.names[index],
    ]);
    const deadline = Date.now() + 45000;
    let sourceId;
    while (Date.now() < deadline) {
      const tab = await chrome.tabs.get(tabId);
      try {
        sourceId = routeIdentifier(tab.url);
      } catch {
        sourceId = null;
      }
      if (sourceId) break;
      await sleep(300);
    }
    if (!sourceId) throw new Error("navigationTimeout");
    const downloaded = await downloadOne(
      tabId,
      job.settings,
      async (checked, startedAfter, baseline) => {
        await status({
          phase: "downloading",
          progress: `${index + 1}/${job.names.length}`,
          name: checked.name,
        });
        job.pending = {
          ...checked,
          source_id: sourceId,
          source_order: index,
          started_after: startedAfter,
          excluded_downloads: baseline,
        };
        await saveJob(job);
      },
    );
    await checkpointRoute(job, {
      ...downloaded,
      source_id: sourceId,
      source_order: index,
    });
  }
  job.phase = "collectionComplete";
  await saveJob(job);
  await exportManifest(job);
  await status({
    phase: "collectionComplete",
    progress: `${job.routes.length}/${job.names.length}`,
  });
}

async function exportManifest(job) {
  if (!job?.names || !job.routes.length) throw new Error("noSavedCollection");
  const url =
    "data:application/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(manifestFor(job), null, 2));
  const id = await chrome.downloads.download({
    url,
    filename: `plotaroute-${job.id}.json`,
    saveAs: false,
    conflictAction: "uniquify",
  });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const [item] = await chrome.downloads.search({ id });
    if (item?.state === "interrupted") throw new Error("downloadInterrupted");
    if (item?.state === "complete") {
      job.exported_at = new Date().toISOString();
      await saveJob(job);
      return;
    }
    await sleep(500);
  }
  throw new Error("downloadTimeout");
}

async function start(operation) {
  if (busy) return;
  busy = true;
  try {
    await operation();
  } catch (error) {
    await status({ phase: "failed", error: error.message });
  } finally {
    busy = false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type === "busy") {
    reply({ busy });
    return;
  }
  if (message.type === "pause") {
    pauseRequested = true;
    void chrome.storage.local
      .get("collectionJob")
      .then(async ({ collectionJob: job }) => {
        if (job) {
          job.pause_requested = true;
          await saveJob(job);
        }
      });
    reply({ requested: true });
    return;
  }
  if (message.type === "export-manifest") {
    if (busy) {
      reply({ busy: true });
      return;
    }
    void start(async () => {
      await exportManifest(
        (await chrome.storage.local.get("collectionJob")).collectionJob,
      );
      await status({ phase: "metadataExported" });
    });
    reply({ started: true });
    return;
  }
  if (
    !["download-route", "download-collection", "resume-collection"].includes(
      message.type,
    )
  )
    return;
  if (!Number.isInteger(message.tabId)) return;
  if (busy) {
    reply({ busy: true });
    return;
  }
  void start(() =>
    message.type === "download-route"
      ? run(message.tabId, message.settings)
      : runCollection(
          message.tabId,
          message.collection,
          message.type === "resume-collection",
          message.settings,
        ),
  );
  reply({ started: true });
});
