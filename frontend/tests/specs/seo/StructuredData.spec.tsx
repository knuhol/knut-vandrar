import { render } from '@testing-library/react'

import { StructuredData } from '@/components/StructuredData'

test('keeps authored text inside JSON-LD without allowing script injection', () => {
  const data = { '@type': 'BlogPosting', headline: '</script><img src=x onerror=alert(1)>' }
  const { container } = render(<StructuredData data={data} />)
  const script = container.querySelector('script')
  expect(script?.type).toBe('application/ld+json')
  expect(script?.innerHTML).not.toContain('</script>')
  expect(container.querySelector('img')).toBeNull()
  expect(JSON.parse(script?.textContent || '{}')).toEqual(data)
})
