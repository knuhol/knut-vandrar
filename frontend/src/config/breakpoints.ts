// Injected at build time from styles/tokens.css by next.config.mjs.
const values = JSON.parse(process.env.NEXT_PUBLIC_BREAKPOINTS || '{}') as Record<string, string>

function minimumWidth(name: string) {
  const width = values[name]
  if (!width || !/^\d+(?:\.\d+)?px$/.test(width)) {
    throw new Error(`Missing responsive design token: ${name}`)
  }
  return `(min-width: ${width})`
}

const tablet = minimumWidth('tablet')

export const responsiveMedia = {
  tablet,
  belowTablet: `not all and ${tablet}`,
  desktop: minimumWidth('desktop'),
  wide: minimumWidth('wide'),
}
