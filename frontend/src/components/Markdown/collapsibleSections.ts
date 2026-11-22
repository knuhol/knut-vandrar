type MarkdownNode = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: MarkdownNode[]
}

// Group parsed headings, so fenced code, setext headings, and inline formatting
// keep their Markdown meaning. Each section ends at the next level-one heading.
export function collapsibleSections({ chapterLevel = 2 }: { chapterLevel?: 2 | 3 } = {}) {
  function shiftContentHeading(node: MarkdownNode): MarkdownNode {
    if (node.tagName === 'details') {
      return node
    }
    const match = /^h([2-6])$/.exec(node.tagName ?? '')
    return {
      ...node,
      ...(match ? { tagName: `h${String(Math.min(6, Number(match[1]) + chapterLevel - 1))}` } : {}),
      ...(node.children
        ? { children: node.children.map((child) => shiftContentHeading(child)) }
        : {}),
    }
  }
  function transform(tree: MarkdownNode) {
    if (!tree.children) {
      return
    }

    for (const child of tree.children) {
      transform(child)
    }

    const children: MarkdownNode[] = []
    let section: MarkdownNode | undefined

    for (const node of tree.children) {
      if (node.type === 'element' && node.tagName === 'h1') {
        section = {
          type: 'element',
          tagName: 'details',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'summary',
              properties: {},
              children: [{ ...node, tagName: `h${String(chapterLevel)}` }],
            },
          ],
        }
        children.push(section)
      } else if (section) {
        section.children?.push(shiftContentHeading(node))
      } else {
        children.push(node)
      }
    }

    tree.children = children
  }

  return transform
}
