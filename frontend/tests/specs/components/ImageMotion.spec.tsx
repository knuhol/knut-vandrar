import { fireEvent, render } from '@testing-library/react'

import { ImageMotion } from '@/components/ImageMotion'

function imageFixture(reduced = false) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({ matches: reduced })),
  })
  const image = document.createElement('img')
  Object.defineProperty(image, 'naturalWidth', { value: 100 })
  image.style.setProperty('--duration-image-reveal', '0.15s')
  const animate = jest.fn()
  image.animate = animate
  document.body.append(image)
  return { image, animate }
}

test('fades dynamically loaded images using the shared duration token', () => {
  const { unmount } = render(<ImageMotion />)
  const { image, animate } = imageFixture()
  expect(animate).not.toHaveBeenCalled()
  fireEvent.load(image)
  expect(animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], {
    duration: 150,
    easing: 'ease-out',
  })
  unmount()
  fireEvent.load(image)
  expect(animate).toHaveBeenCalledTimes(1)
  image.remove()
})

test('keeps images immediately visible for reduced motion', () => {
  render(<ImageMotion />)
  const { image, animate } = imageFixture(true)
  fireEvent.load(image)
  expect(animate).not.toHaveBeenCalled()
  expect(image.style.opacity).toBe('')
  image.remove()
})
