import norway from "./data/norway.json" with { type: "json" };

/** Conservative intersection: include a 25 km margin for outline and DEM edge uncertainty. */
export function includesNorwegianTerrain(bounds) {
  if (!bounds) return true;
  const [[west, south], [east, north]] = bounds;
  if (
    ![west, south, east, north].every(Number.isFinite) ||
    east < west ||
    east - west >= 180
  )
    return true;
  const latMargin = 25 / 111;
  const lonMargin =
    latMargin /
    Math.max(
      0.01,
      Math.cos((Math.max(Math.abs(south), Math.abs(north)) * Math.PI) / 180),
    );
  const box = [
    west - lonMargin,
    south - latMargin,
    east + lonMargin,
    north + latMargin,
  ];
  const insideBox = ([x, y]) =>
    x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
  const insideRing = ([x, y], ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i],
        [bx, by] = ring[j];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
        inside = !inside;
    }
    return inside;
  };
  const crossesBox = (a, b) => {
    let low = 0,
      high = 1;
    for (const [p, q] of [
      [a[0] - b[0], a[0] - box[0]],
      [b[0] - a[0], box[2] - a[0]],
      [a[1] - b[1], a[1] - box[1]],
      [b[1] - a[1], box[3] - a[1]],
    ]) {
      if (p === 0) {
        if (q < 0) return false;
      } else if (p < 0) low = Math.max(low, q / p);
      else high = Math.min(high, q / p);
      if (low > high) return false;
    }
    return true;
  };
  return norway.geometry.coordinates.some(([ring]) => {
    if (ring.some(insideBox)) return true;
    if (
      [
        [box[0], box[1]],
        [box[0], box[3]],
        [box[2], box[1]],
        [box[2], box[3]],
      ].some((p) => insideRing(p, ring))
    )
      return true;
    return ring.some((p, i) => i > 0 && crossesBox(ring[i - 1], p));
  });
}

export function terrainAttribution(provider, bounds) {
  return [
    provider.attribution,
    ...(includesNorwegianTerrain(bounds) ? [provider.norwayAttribution] : []),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Wrap only at the basemap/terrain boundary; separators belong inside each row. */
export function layoutAttribution(element, basemap, terrain = "") {
  const rows = terrain ? [basemap, terrain] : [basemap];
  Object.assign(element.style, {
    display: "block",
    textAlign: "right",
    width: "max-content",
    fontSize: "12px",
  });
  function setRows(values) {
    element.replaceChildren(
      ...values.map((value) => {
        const row = document.createElement("span");
        row.textContent = value;
        Object.assign(row.style, {
          display: "block",
          width: "max-content",
          whiteSpace: "nowrap",
          marginLeft: "auto",
        });
        return row;
      }),
    );
  }
  setRows([rows.join(" · ")]);
  const css = getComputedStyle(element);
  const available =
    element.clientWidth -
    parseFloat(css.paddingLeft) -
    parseFloat(css.paddingRight);
  if (
    terrain &&
    element.firstElementChild.getBoundingClientRect().width > available
  )
    setRows(rows);
  const widest = Math.max(
    ...Array.from(element.children, (row) => row.getBoundingClientRect().width),
  );
  if (widest > available)
    element.style.fontSize = `${Math.floor((1200 * available) / widest) / 100}px`;
}
