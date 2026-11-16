// Search/retrieval remains available independently of declared training crawlers.
export const searchCrawlers = [
  '*',
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
]
export const trainingCrawlers = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'CCBot',
  'Applebot-Extended',
  'meta-externalagent',
  'Bytespider',
  'cohere-ai',
]

export function robotsText(indexable: boolean, sitemapUrl: string) {
  if (!indexable) {
    return 'User-agent: *\nDisallow: /\n'
  }
  return [
    ...searchCrawlers.map((agent) => `User-agent: ${agent}`),
    'Allow: /',
    'Disallow: /api/admin',
    'Disallow: /api/language',
    '',
    ...trainingCrawlers.map((agent) => `User-agent: ${agent}`),
    'Disallow: /',
    '',
    `Sitemap: ${sitemapUrl}`,
    '',
  ].join('\n')
}
