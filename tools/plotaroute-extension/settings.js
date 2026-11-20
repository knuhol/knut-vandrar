export const DOWNLOAD_OPTIONS = Object.freeze({
  format: ["GPX", "KML", "TCX", "FIT"],
  type: ["Track", "Route"],
  waypoints: ["None", "POI's", "Directions"],
});

export const DEFAULT_SETTINGS = Object.freeze({
  format: "GPX",
  type: "Track",
  waypoints: "POI's",
});

export function downloadSettings(value = {}) {
  const result = { ...DEFAULT_SETTINGS, ...value };
  for (const [key, choices] of Object.entries(DOWNLOAD_OPTIONS)) {
    if (!choices.includes(result[key])) throw new Error("settingsUnavailable");
  }
  return Object.fromEntries(
    Object.keys(DEFAULT_SETTINGS).map((key) => [key, result[key]]),
  );
}
