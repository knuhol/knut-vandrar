import { prefetchHikeCover } from '@/hiking/prefetchCovers'

jest.mock('@/config/breakpoints', () => ({
  responsiveMedia: {
    fullHikeCover: '(min-width: 2560px)',
    desktopHikeCover: '(min-width: 1500px)',
  },
}))

function sources(id: string) {
  const base = `https://api.example.test/${id}`
  return {
    full: `${base}?v=full`,
    wide: `${base}?v=avif`,
    desktop: `${base}?v=desktop`,
    mobile: `${base}?v=mobile`,
    card: `${base}?v=card`,
  }
}

function captureImages() {
  const ImageConstructor = window.Image
  const images: HTMLImageElement[] = []
  jest.spyOn(window, 'Image').mockImplementation(() => {
    const image = new ImageConstructor()
    images.push(image)
    return image
  })
  return images
}

test('limits background downloads and shares requested covers across navigation', async () => {
  const images = captureImages()
  window.matchMedia = jest.fn().mockReturnValue({ matches: false })
  const covers = [sources('one'), sources('two'), sources('three')]

  await Promise.all([...covers, covers[0]].map((cover) => prefetchHikeCover(cover)))
  expect(images.map((image) => image.src)).toEqual([covers[0].mobile, covers[1].mobile])

  images[0].dispatchEvent(new Event('load'))
  expect(images[2].src).toBe(covers[2].mobile)
  images[1].dispatchEvent(new Event('load'))
  images[2].dispatchEvent(new Event('load'))
  await prefetchHikeCover(covers[0])
  expect(images).toHaveLength(3)
})

test('warms the AVIF version on very wide screens where it can be decoded', async () => {
  const images = captureImages()
  window.matchMedia = jest.fn().mockReturnValue({ matches: true })
  const cover = sources('wide')

  const warming = prefetchHikeCover(cover)
  expect(images[0].src).toMatch(/^data:image\/avif/)
  images[0].dispatchEvent(new Event('load'))

  await warming
  expect(images[1].src).toBe(cover.wide)
  images[1].dispatchEvent(new Event('load'))
})

test('starts the selected cover ahead of queued homepage downloads', async () => {
  const images = captureImages()
  window.matchMedia = jest.fn().mockReturnValue({ matches: false })
  const covers = [sources('first'), sources('second'), sources('third'), sources('selected')]

  await Promise.all(covers.map((cover) => prefetchHikeCover(cover)))
  expect(images).toHaveLength(2)
  await prefetchHikeCover(covers[3], 'high')
  expect(images[2].src).toBe(covers[3].mobile)
  expect(images[2].fetchPriority).toBe('high')

  images[2].dispatchEvent(new Event('load'))
  images[0].dispatchEvent(new Event('load'))
  expect(images[3].src).toBe(covers[2].mobile)
  images[1].dispatchEvent(new Event('load'))
  images[3].dispatchEvent(new Event('load'))
  expect(images.map((image) => image.src)).toHaveLength(4)
})
