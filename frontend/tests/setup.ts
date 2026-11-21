import '@testing-library/jest-dom'

beforeEach(() => {
  if (typeof window === 'undefined') {
    return
  }

  const getComputedStyle = window.getComputedStyle.bind(window)
  const ignoreStyleValidation = (event: Event) => {
    event.stopImmediatePropagation()
  }

  // JSDOM's nwsapi selector engine evaluates :valid/:invalid with checkValidity(),
  // which incorrectly dispatches invalid events during CSS/accessibility queries.
  // Contain those events to style evaluation; explicit form validation still fires.
  jest.spyOn(window, 'getComputedStyle').mockImplementation((...args) => {
    window.addEventListener('invalid', ignoreStyleValidation, true)
    try {
      return getComputedStyle(...args)
    } finally {
      window.removeEventListener('invalid', ignoreStyleValidation, true)
    }
  })
})
