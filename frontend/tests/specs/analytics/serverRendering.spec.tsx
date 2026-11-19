/** @jest-environment node */
import { renderToString } from 'react-dom/server'
import { Analytics } from '@/app/[locale]/components/Analytics/Analytics'

jest.mock('next/navigation', () => ({ usePathname: () => '/en' }))

test('disabled analytics produces no server HTML', () => {
  expect(renderToString(<Analytics config={null} />)).toBe('')
})

test('configured analytics renders without browser storage or consent controls', () => {
  const html = renderToString(
    <Analytics
      config={{
        websiteId: 'b5e90f9a-26ed-4dc7-a4eb-241b22c5ca5d',
        scriptUrl: 'https://umami.vandrar.se/script.js',
      }}
    />,
  )
  expect(html).not.toContain('<section')
  expect(html).not.toContain('Cookie settings')
  expect(html).not.toContain('analytics-consent')
})
