// Uses only the site's rendered controls; no private API calls or copied cookies.
export function collectionPageTask(mode, index, expectedName) {
  let viewer = document;
  try {
    const iframe = document.getElementById("RoutePlayer");
    if (iframe) viewer = iframe.contentDocument;
  } catch {
    return { error: "viewerUnavailable" };
  }
  if (!viewer) return { error: "viewerUnavailable" };
  const table = viewer.getElementById("RoutesTab");
  const rows = Array.from(table?.querySelectorAll("tbody tr") ?? []);
  if (!rows.length) return { error: "routeNotReady" };
  // The table renders before the initial route finishes loading. Selecting a
  // different route during that load is ignored by the site's controls.
  if (!viewer.getElementById("Info_RouteName")?.textContent.trim())
    return { error: "routeNotReady" };
  const headers = Array.from(table.querySelectorAll("thead th"));
  const column = headers.findIndex(
    (cell) => cell.textContent.trim().toUpperCase() === "ROUTE",
  );
  if (column < 0) return { error: "collectionChanged" };
  const names = rows.map((row) => row.cells[column]?.textContent.trim());
  if (names.some((name) => !name)) return { error: "routeNotReady" };
  if (mode === "list")
    return {
      names,
      title: document.querySelector("h1")?.textContent.trim() || document.title,
    };
  const row = rows[index];
  if (!row || names[index] !== expectedName)
    return { error: "collectionChanged" };
  if (mode === "select") {
    const button = row.querySelector(
      '[title="View more information about this route"]',
    );
    if (!button) return { error: "viewerUnavailable" };
    button.click();
    return { selected: true };
  }
  const actualName = viewer
    .getElementById("Info_RouteName")
    ?.textContent.trim();
  if (actualName !== expectedName) {
    return { error: "routeNotReady" };
  }
  if (mode === "follow") {
    const link = viewer.querySelector("#Info_RouteLink .button");
    if (!link) return { error: "viewerUnavailable" };
    link.click();
  }
  return { ready: true };
}
