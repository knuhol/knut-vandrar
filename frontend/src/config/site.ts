// Public identity, independent of the backend address and deployment environment.
export const siteIdentity = Object.freeze({
  name: 'Knut vandrar',
  alternateName: 'knutvandrar',
  productionUrl: 'https://knut.vandrar.se',
  author: 'Knut Holm',
  authorBirthDate: '1990-01-18',
  authorSwedenMoveDate: '2018-01-03',
  timeZone: 'Europe/Stockholm',
  profiles: {
    instagram: 'https://www.instagram.com/knutvandrar/',
    youtube: 'https://www.youtube.com/@knutvandrar',
    plotaroute: 'https://www.plotaroute.com/userprofile/596708',
  },
  sharingImage: { width: 1200, height: 630 },
})

export function headerLogoVariant(host: string | null) {
  const hostname = host ? new URL(`http://${host}`).hostname : ''
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    return 'monochromaticForest'
  }
  return hostname === 'dev.vandrar.se' ? 'monochromaticOrange' : 'standard'
}
