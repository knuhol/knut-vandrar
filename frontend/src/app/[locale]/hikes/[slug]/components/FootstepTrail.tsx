import { useId } from 'react'

const tileHeight = 1920
const routeWidth = 176

// Give the route long traverses, short switchbacks, and stretches along one side.
const bends = [
  { y: 0, x: 128 },
  { y: 62, x: 126 },
  { y: 166, x: 14 },
  { y: 350, x: 161 },
  { y: 423, x: 156 },
  { y: 565, x: 92 },
  { y: 715, x: 84 },
  { y: 805, x: 119 },
  { y: 920, x: 150 },
  { y: 1125, x: 25 },
  { y: 1265, x: 75 },
  { y: 1385, x: 30 },
  { y: 1560, x: 150 },
  { y: 1755, x: 132 },
  { y: tileHeight, x: 128 },
]

function traceFootsteps(referenceWidth: number) {
  const marks: {
    x: number
    y: number
    shiftX: number
    shiftY: number
    turn: number
    side: number
  }[] = []
  let previousX = bends[0].x
  let distance = 20

  for (let index = 1; index < bends.length; index += 1) {
    const start = bends[index - 1]
    const end = bends[index]
    const rise = end.y - start.y
    const run = end.x - start.x

    for (let y = start.y + 1; y <= end.y; y += 1) {
      const progress = (y - start.y) / rise
      const eased = progress ** 2 * (3 - 2 * progress)
      const x = start.x + run * eased
      distance += Math.hypot(((x - previousX) / routeWidth) * referenceWidth, 1)
      previousX = x

      const step = marks.length
      const stride = 39 + 3 * Math.sin(step * 2.7)
      if (distance >= stride && y < tileHeight - 23) {
        const side = step % 2 === 0 ? 1 : -1
        const slope = (6 * progress * (1 - progress) * run * referenceWidth) / (rise * routeWidth)
        const angle = Math.atan(slope)
        const turn = (-angle * 180) / Math.PI + side * 6 + 3 * Math.sin(step * 1.4)
        marks.push({
          x: (x / routeWidth) * 100,
          y,
          shiftX: side * 11 * Math.cos(angle),
          shiftY: -side * 11 * Math.sin(angle),
          turn,
          side,
        })
        distance -= stride
      }
    }
  }

  return marks
}

const patterns = [
  {
    name: 'tight',
    className: '@footstep-narrow/footsteps:hidden',
    marks: traceFootsteps(95),
  },
  {
    name: 'narrow',
    className: 'hidden @footstep-narrow/footsteps:@max-footstep-full/footsteps:block',
    marks: traceFootsteps(215),
  },
  {
    name: 'wide',
    className: 'hidden @footstep-full/footsteps:block',
    marks: traceFootsteps(400),
  },
]

export function FootstepTrail() {
  const id = useId()
  const sole = `${id}-sole`
  const mask = `${id}-mask`

  return (
    <div
      aria-hidden="true"
      className="@container/footsteps pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-(--spacing-footstep-gutter) @footstep-story/hike-story:block"
    >
      <svg focusable="false" className="block h-full w-full">
        <defs>
          <path
            id={sole}
            fillRule="evenodd"
            d="M-6 4C-9 8-9 15-6 19C-2 23 5 22 7 17C9 12 6 8 5 4ZM-5 11H5V13H-5ZM-4 16H4V18H-4ZM-4 0C-5-4-7-8-5-11C-3-14 3-14 5-10C6-7 4-3 4 0ZM-3-8H3V-6H-3Z"
          />
          {patterns.map(({ name, marks }) => (
            <pattern
              key={name}
              id={`${id}-${name}`}
              width="100%"
              height={tileHeight}
              patternUnits="userSpaceOnUse"
            >
              {marks.map(({ x, y, shiftX, shiftY, turn, side }) => (
                <svg key={y} x={`${x.toFixed(2)}%`} y={y} width="1" height="1" overflow="visible">
                  <use
                    href={`#${sole}`}
                    fill="white"
                    transform={`translate(${shiftX.toFixed(1)} ${shiftY.toFixed(1)}) rotate(${turn.toFixed(1)}) scale(${String(side)} 1)`}
                  />
                </svg>
              ))}
            </pattern>
          ))}
          <mask id={mask} x="0" y="0" width="100%" height="100%">
            {patterns.map(({ name, className }) => (
              <rect
                key={name}
                width="100%"
                height="100%"
                className={className}
                fill={`url(#${id}-${name})`}
              />
            ))}
          </mask>
        </defs>
        <rect width="100%" height="100%" className="fill-forest-soft" mask={`url(#${mask})`} />
      </svg>
    </div>
  )
}
