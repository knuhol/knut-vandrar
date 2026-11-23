export function allowsPageShortcut(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    (event.shiftKey && event.key !== '?')
  ) {
    return false
  }

  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('input, textarea, select, audio, video, [role="slider"], [role="tablist"]'))
  ) {
    return false
  }

  return !document.querySelector(
    'dialog[open], [role="dialog"]:not(dialog), [aria-modal="true"], [role="menu"], [role="listbox"]',
  )
}
