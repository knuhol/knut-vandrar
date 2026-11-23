'use client'

import Image, { type ImageProps } from 'next/image'

import type { UIComponentProps } from './uiComponentProps'

const fitClasses = {
  cover: 'object-cover',
  contain: 'object-contain',
}

export function RevealImage({
  fit,
  onLoad,
  onError,
  ...props
}: UIComponentProps<ImageProps> & { fit: keyof typeof fitClasses }) {
  return (
    <Image
      {...props}
      className={`image-reveal ${fitClasses[fit]}`}
      onLoad={(event) => {
        event.currentTarget.dataset.imageReady = ''
        onLoad?.(event)
      }}
      onError={(event) => {
        event.currentTarget.dataset.imageReady = ''
        onError?.(event)
      }}
    />
  )
}
