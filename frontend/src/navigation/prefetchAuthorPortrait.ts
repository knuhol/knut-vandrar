import { getImageProps } from 'next/image'
import { preload } from 'react-dom'

import { authorPortrait } from '@/config/authorPortrait'

export function prefetchAuthorPortrait() {
  const {
    props: { src, srcSet, sizes },
  } = getImageProps({ ...authorPortrait, alt: '' })

  preload(src, { as: 'image', fetchPriority: 'low', imageSrcSet: srcSet, imageSizes: sizes })
}
