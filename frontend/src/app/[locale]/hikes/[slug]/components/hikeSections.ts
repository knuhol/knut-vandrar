import {
  IconBook2,
  IconRoute,
  IconMap,
  IconExternalLink,
  IconPhoto,
  IconFootsteps,
} from '@tabler/icons-react'

// Keep section landmarks consistent between the menu and the page headings.
export const hikeSectionIcons = {
  story: IconBook2,
  journey: IconRoute,
  map: IconMap,
  trail: IconFootsteps,
  resources: IconExternalLink,
  photos: IconPhoto,
}

export type HikeSectionId = keyof typeof hikeSectionIcons
