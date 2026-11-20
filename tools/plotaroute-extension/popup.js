import { DOWNLOAD_OPTIONS, downloadSettings } from "./settings.js";
const message = (key) => chrome.i18n.getMessage(key) || key;
for (const element of document.querySelectorAll("[data-message]"))
  element.textContent = message(element.dataset.message);
const field = document.getElementById("collection");
const output = document.getElementById("status");
const details = document.getElementById("details");
const selectors = Object.fromEntries(
  Object.keys(DOWNLOAD_OPTIONS).map((key) => [
    key,
    document.getElementById(key),
  ]),
);
const storedSettings = downloadSettings(
  (await chrome.storage.local.get("downloadSettings")).downloadSettings,
);
for (const [key, choices] of Object.entries(DOWNLOAD_OPTIONS)) {
  for (const value of choices)
    selectors[key].add(new Option(value === "POI's" ? "POIs" : value, value));
  selectors[key].value = storedSettings[key];
  selectors[key].addEventListener("change", async () => {
    await chrome.storage.local.set({ downloadSettings: selectedSettings() });
    render((await chrome.storage.session.get("result")).result);
  });
}
function selectedSettings() {
  return downloadSettings(
    Object.fromEntries(
      Object.entries(selectors).map(([key, element]) => [key, element.value]),
    ),
  );
}
const controls = ["download", "start", "resume", "export"].map((id) =>
  document.getElementById(id),
);
let running = (await chrome.runtime.sendMessage({ type: "busy" })).busy;
function render(result) {
  const current = result || { phase: "ready" };
  for (const button of controls) button.disabled = running;
  document.getElementById("pause").disabled = !running;
  selectors.format.disabled = running;
  selectors.type.disabled = running || selectors.format.value !== "GPX";
  selectors.waypoints.disabled = running || selectors.format.value !== "GPX";
  output.textContent = message(current.phase);
  details.textContent = [
    current.progress,
    current.error ? message(current.error) : current.name,
    current.filename,
  ]
    .filter(Boolean)
    .join("\n");
}
const saved = (await chrome.storage.local.get("collectionJob")).collectionJob;
const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
field.value =
  /\/routecollection\/(\d+)/.exec(active?.url || "")?.[1] || saved?.id || "";
render((await chrome.storage.session.get("result")).result);
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "session" && changes.result) {
    // 'complete' can be published just before the worker releases its busy flag.
    running = ![
      "complete",
      "collectionComplete",
      "failed",
      "paused",
      "metadataExported",
    ].includes(changes.result.newValue.phase);
    render(changes.result.newValue);
  }
});
async function send(type) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const response = await chrome.runtime.sendMessage({
      type,
      tabId: tab.id,
      collection: field.value.trim(),
      settings: selectedSettings(),
    });
    if (response?.started) {
      running = true;
      render({ phase: "preparing" });
    }
    if (type === "pause") output.textContent = message("pauseRequested");
  } catch (error) {
    running = false;
    render({ phase: "failed", error: error.message });
  }
}
for (const [id, type] of [
  ["download", "download-route"],
  ["start", "download-collection"],
  ["resume", "resume-collection"],
  ["pause", "pause"],
  ["export", "export-manifest"],
])
  document.getElementById(id).addEventListener("click", () => send(type));
