// Executed only after the operator clicks the extension on a Plotaroute route.
// Self-contained: Chrome serializes this function into the tab's page context.
export function routePageTask(mode, choices) {
  if (!/^\/route\/\d+\/?$/.test(location.pathname))
    return { error: "routeNotReady" };
  const frame = document.getElementById("RoutePlayer");
  let viewer = document;
  try {
    if (frame) viewer = frame.contentDocument;
  } catch {
    return { error: "viewerUnavailable" };
  }
  if (!viewer) return { error: "viewerUnavailable" };
  const title = viewer.getElementById("Info_RouteName")?.textContent?.trim();
  const cleanName = title?.replace(/\s*[←→]\s*$/, "").trim();
  if (!cleanName) return { error: "routeNotReady" };

  if (mode === "ready") return { name: cleanName };

  if (mode === "open") {
    const button = document.getElementById("ActionBut_Download");
    if (!button) return { error: "downloadUnavailable" };
    button.click();
    return { name: cleanName };
  }

  const overlay = viewer.getElementById("DownloadOverlay");
  if (!overlay?.getClientRects().length)
    return { error: "downloadUnavailable" };
  if (!choices) return { error: "settingsUnavailable" };
  const settings = [["Download_Format", choices.format]];
  if (choices.format === "GPX")
    settings.push(
      ["Download_GPXType", choices.type],
      ["Download_GPXWaypoints", choices.waypoints],
    );
  for (const [id, label] of settings) {
    const group = viewer.getElementById(id);
    const option = Array.from(group?.querySelectorAll(".tickfield") ?? []).find(
      (element) => element.textContent.trim() === label,
    );
    if (!option) return { error: "settingsUnavailable" };
    if (!option.classList.contains("ticked")) option.click();
    if (!option.classList.contains("ticked"))
      return { error: "settingsUnavailable" };
  }
  const nameInput = viewer.getElementById("Download_CourseName");
  if (!nameInput) return { error: "settingsUnavailable" };
  nameInput.value = cleanName;
  nameInput.dispatchEvent(new Event("input", { bubbles: true }));
  nameInput.dispatchEvent(new Event("change", { bubbles: true }));
  const metadata = Object.fromEntries(
    Array.from(viewer.querySelectorAll('#InfoTab [id^="Info_"]')).map(
      (element) => [element.id.slice(5), element.textContent.trim()],
    ),
  );
  const result = {
    name: cleanName,
    sourceUrl: location.href,
    ...choices,
    metadata,
  };
  if (mode === "download") {
    const button = viewer.getElementById("DownloadBut");
    if (!button) return { error: "downloadUnavailable" };
    button.click();
  }
  return result;
}
