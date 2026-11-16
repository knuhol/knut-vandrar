import { render, screen } from '@testing-library/react'

import { Heading } from '@/components/Heading'

describe('Heading', () => {
  test('defaults to a level-one heading', () => {
    render(<Heading>Trail overview</Heading>)

    expect(screen.getByRole('heading', { level: 1, name: 'Trail overview' })).toBeInTheDocument()
  })

  test('preserves semantic level when its visual size changes', () => {
    render(
      <Heading as="h2" className="text-4xl" id="ratings">
        My ratings
      </Heading>,
    )

    expect(screen.getByRole('heading', { level: 2, name: 'My ratings' })).toHaveAttribute(
      'id',
      'ratings',
    )
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })
})
