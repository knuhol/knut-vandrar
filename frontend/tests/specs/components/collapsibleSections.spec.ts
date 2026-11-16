import { collapsibleSections } from '@/components/Markdown/collapsibleSections'

describe('collapsible Markdown sections', () => {
  test('starts every chapter closed and preserves its text and order', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'h1', children: [{ type: 'text', value: 'Chapter one' }] },
        { type: 'element', tagName: 'p', children: [{ type: 'text', value: 'Keep all text' }] },
        { type: 'element', tagName: 'h1', children: [{ type: 'text', value: 'Chapter two' }] },
      ],
    }
    const content = JSON.stringify(tree).match(/"value":"[^"]*"/g)

    collapsibleSections()(tree)

    expect(tree.children).toHaveLength(2)
    expect(tree.children).toMatchObject([
      {
        tagName: 'details',
        properties: {},
        children: [{ tagName: 'summary', children: [{ tagName: 'h2' }] }, { tagName: 'p' }],
      },
      {
        tagName: 'details',
        properties: {},
        children: [{ tagName: 'summary', children: [{ tagName: 'h2' }] }],
      },
    ])
    expect(JSON.stringify(tree)).not.toContain('"open"')
    expect(JSON.stringify(tree).match(/"value":"[^"]*"/g)).toEqual(content)
  })

  test('preserves content before the first chapter', () => {
    const introduction = { type: 'element', tagName: 'p', children: [] }
    const tree = {
      type: 'root',
      children: [introduction, { type: 'element', tagName: 'h1', children: [] }],
    }

    collapsibleSections()(tree)

    expect(tree.children[0]).toBe(introduction)
    expect(tree.children[1]).toMatchObject({ tagName: 'details' })
  })
})
