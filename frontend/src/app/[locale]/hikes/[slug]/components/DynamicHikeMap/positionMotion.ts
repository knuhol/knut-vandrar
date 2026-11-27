export type RouteLocation = { line: number; edge: number; coordinates: number[] }

export function positionMotion(
  lines: number[][][],
  from: RouteLocation,
  to: RouteLocation,
): ((progress: number) => RouteLocation) | undefined {
  const reverse = from.line > to.line || (from.line === to.line && from.edge > to.edge)
  const [start, end] = reverse ? [to, from] : [from, to]
  const legs: {
    line: number
    edge: number
    a: number[]
    delta: [number, number]
    start: number
    end: number
  }[] = []
  let length = 0

  for (let line = start.line; line <= end.line; line += 1) {
    const points = lines[line]
    const firstEdge = line === start.line ? start.edge : 0
    const lastEdge = line === end.line ? end.edge : points.length - 2
    for (let edge = firstEdge; edge <= lastEdge; edge += 1) {
      const a = line === start.line && edge === start.edge ? start.coordinates : points[edge]
      const b = line === end.line && edge === end.edge ? end.coordinates : points[edge + 1]
      const longitude = b[0] - a[0]
      const delta: [number, number] = [longitude - Math.round(longitude / 360) * 360, b[1] - a[1]]
      const latitudeRadians = ((a[1] + b[1]) * Math.PI) / 360
      const next = length + Math.hypot(delta[0] * Math.cos(latitudeRadians), delta[1])
      if (next > length) {
        legs.push({ line, edge, a, delta, start: length, end: next })
        length = next
      }
    }
  }

  if (!length) {
    return undefined
  }

  return (progress) => {
    if (progress === 1) {
      return to
    }
    const distance = (reverse ? 1 - progress : progress) * length
    let low = 0
    let high = legs.length - 1
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (distance > legs[middle].end) {
        low = middle + 1
      } else {
        high = middle
      }
    }
    const leg = legs[low]
    const fraction = (distance - leg.start) / (leg.end - leg.start)
    return {
      line: leg.line,
      edge: leg.edge,
      coordinates: [leg.a[0] + leg.delta[0] * fraction, leg.a[1] + leg.delta[1] * fraction],
    }
  }
}
