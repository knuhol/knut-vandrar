export const disclosureExpansionEvent = 'disclosure-expansion'

export function setDisclosureExpanded(element: HTMLDetailsElement, expanded: boolean) {
  element.dispatchEvent(new CustomEvent(disclosureExpansionEvent, { detail: expanded }))
}
