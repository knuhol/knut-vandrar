type MarkdownNode = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: MarkdownNode[]
}

// Group parsed headings, so fenced code, setext headings, and inline formatting
// keep their Markdown meaning. Each section ends at the next level-one heading.
export function collapsibleSections() {
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
              children: [{ ...node, tagName: 'h2' }],
            },
          ],
        }
        children.push(section)
      } else if (section) {
        section.children?.push(node)
      } else {
        children.push(node)
      }
    }

    tree.children = children
  }

  return transform
}
