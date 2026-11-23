import type { MouseEvent } from 'react'

import { scrollToElement } from './motion'

export function sectionForHash(hash: string) {
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)))
  } catch {
    return null
  }
}

function anchorSection(anchor: HTMLAnchorElement) {
  const destination = new URL(anchor.href)
  if (
    (anchor.target && anchor.target !== '_self') ||
    anchor.hasAttribute('download') ||
    destination.origin !== window.location.origin ||
    destination.pathname !== window.location.pathname ||
    destination.search !== window.location.search ||
    !destination.hash
  ) {
    return null
  }
  return sectionForHash(destination.hash)
}

export function navigateToSection(section: HTMLElement, hash: string) {
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash)
  }
  section.focus({ preventScroll: true })
  void scrollToElement(section, { anchor: true })
}

export function handleSectionPointerDown(
  event: MouseEvent | globalThis.MouseEvent,
  anchor: HTMLAnchorElement,
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !anchorSection(anchor)
  ) {
    return
  }
  // Native pointer focus can scroll the sticky menu's original layout position
  // into view before click runs. Focus it explicitly without that first jump.
  event.preventDefault()
  anchor.focus({ preventScroll: true })
}

export function handleSectionLinkClick(event: MouseEvent<HTMLAnchorElement>) {
  handleAnchorClick(event, event.currentTarget)
}

export function handleAnchorClick(
  event: Pick<
    MouseEvent,
    'defaultPrevented' | 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'preventDefault'
  >,
  anchor: HTMLAnchorElement,
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return
  }
  const section = anchorSection(anchor)
  if (!section) {
    return
  }
  event.preventDefault()
  navigateToSection(section, new URL(anchor.href).hash)
}
