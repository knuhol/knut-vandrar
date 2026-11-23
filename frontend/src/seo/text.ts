import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

type TextNode = { type: string; value?: string; alt?: string | null; children?: TextNode[] }
const parser = unified().use(remarkParse).use(remarkGfm)

function nodeText(node: TextNode): string {
  if (
    ['html', 'definition', 'yaml', 'footnoteReference', 'footnoteDefinition'].includes(node.type)
  ) {
    return ''
  }
  if (node.type === 'image' || node.type === 'imageReference') {
    return node.alt || ''
  }
  if (node.type === 'break') {
    return ' '
  }
  if (node.value !== undefined) {
    return node.type === 'code' ? `${node.value} ` : node.value
  }

  const text = (node.children || []).map((child) => nodeText(child)).join('')
  return ['paragraph', 'heading', 'listItem', 'tableCell', 'code'].includes(node.type)
    ? `${text} `
    : text
}

export function plainText(markdown: string) {
  return nodeText(parser.parse(markdown)).replace(/\s+/g, ' ').trim()
}

export function metadataDescription(markdown: string, fallback: string, context?: string | null) {
  const summary = plainText(markdown)
  const text =
    context && !summary.toLowerCase().includes(context.toLowerCase())
      ? [context, summary].filter(Boolean).join('. ')
      : summary || fallback

  if (text.length <= 160) {
    return text
  }
  const prefix = text.slice(0, 157)
  const boundary = prefix.lastIndexOf(' ')
  return `${boundary > 100 ? prefix.slice(0, boundary) : prefix}…`
}
