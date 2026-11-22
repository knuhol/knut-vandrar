export const chapterExpansionEvent = 'chapter-expansion'

export function setChapterExpanded(element: HTMLDetailsElement, expanded: boolean) {
  element.dispatchEvent(new CustomEvent(chapterExpansionEvent, { detail: expanded }))
}
