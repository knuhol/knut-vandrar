import sharp from 'sharp'

import { siteIdentity } from '@/config/site'

export async function sharingImage(input: Uint8Array) {
  return sharp(input)
    .rotate()
    .resize(siteIdentity.sharingImage.width, siteIdentity.sharingImage.height, {
      fit: 'cover',
      position: 'centre',
    })
    .png()
    .toBuffer()
}
