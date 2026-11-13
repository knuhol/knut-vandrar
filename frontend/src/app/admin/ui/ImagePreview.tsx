import Image from 'next/image'

export function ImagePreview({
  src,
  alt,
  width,
  height,
  onError,
}: {
  src: string
  alt: string
  width: number
  height: number
  onError?: () => void
}) {
  return (
    <div className="w-full max-w-media-preview">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        className="h-auto max-h-48 w-auto max-w-full object-contain"
        onError={onError}
      />
    </div>
  )
}
