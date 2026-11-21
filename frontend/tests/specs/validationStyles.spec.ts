test('validity CSS queries do not dispatch validation events, but explicit validation does', () => {
  const style = document.createElement('style')
  style.textContent = 'input:invalid { color: red; }'
  const form = document.createElement('form')
  const input = document.createElement('input')
  input.required = true
  form.append(input)
  document.head.append(style)
  document.body.append(form)
  const invalid = jest.fn()
  input.addEventListener('invalid', invalid)

  try {
    expect(window.getComputedStyle(input).color).toBe('rgb(255, 0, 0)')
    expect(invalid).not.toHaveBeenCalled()
    expect(form.reportValidity()).toBe(false)
    expect(invalid).toHaveBeenCalledTimes(1)
  } finally {
    form.remove()
    style.remove()
  }
})

export {}
