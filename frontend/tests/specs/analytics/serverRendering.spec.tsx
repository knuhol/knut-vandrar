/** @jest-environment node */
import { renderToString } from 'react-dom/server'
import { Analytics } from '@/app/[locale]/components/Analytics/Analytics'

jest.mock('next/navigation', () => ({ usePathname: () => '/en' }))

test.each([
  { state: 'disabled', config: null },
  {
    state: 'configured',
    config: {
      websiteId: 'b5e90f9a-26ed-4dc7-a4eb-241b22c5ca5d',
      scriptUrl: 'https://umami.vandrar.se/script.js',
    },
  },
])('$state analytics server-renders without browser globals or visible markup', ({ config }) => {
  expect(renderToString(<Analytics config={config} />)).toBe('')
})
