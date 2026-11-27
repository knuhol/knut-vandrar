const markerClearance = 32
const infoPanelAllowance = 168

export function positionOffset(
  viewport: DOMRect,
  summary: DOMRect | undefined,
  controls: DOMRect | undefined,
): [number, number] {
  if (!summary) {
    return [0, 0]
  }

  const centerX = viewport.left + viewport.width / 2
  const centerY = viewport.top + viewport.height / 2
  const bottom = controls?.top ?? viewport.bottom
  const lowerAnchor = bottom - markerClearance
  const visibleCenterY = Math.min(centerY, lowerAnchor)

  // Center within the viewport after reserving space for the full info panel.
  // The allowance stays fixed when the panel gains or loses tracking rows.
  if (viewport.width <= viewport.height) {
    const preferredY = centerY + infoPanelAllowance / 2
    const targetY = Math.max(preferredY, summary.bottom + markerClearance)
    if (targetY <= lowerAnchor) {
      return [0, targetY - centerY]
    }
    if (lowerAnchor >= summary.bottom + markerClearance) {
      return [0, lowerAnchor - centerY]
    }
  }

  if (
    centerX > summary.right + markerClearance ||
    visibleCenterY > summary.bottom + markerClearance
  ) {
    return [0, visibleCenterY - centerY]
  }

  // Fall back to whichever side of the panel has space for the marker and its halo.
  const spaceBelow = bottom - summary.bottom
  const spaceBeside = viewport.right - summary.right
  if (spaceBelow >= 2 * markerClearance) {
    return [0, lowerAnchor - centerY]
  }
  if (spaceBelow >= spaceBeside) {
    return [0, (summary.bottom + bottom) / 2 - centerY]
  }
  return [(summary.right + viewport.right) / 2 - centerX, visibleCenterY - centerY]
}
