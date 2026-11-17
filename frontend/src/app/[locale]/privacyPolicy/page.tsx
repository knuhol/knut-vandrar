import { notFound } from 'next/navigation'

import { StaticPage } from '@/components/StaticPage'
import { PageKey } from '@/content/staticPages'
import { resolvePage, staticPageMetadata, type PageProps } from '@/content/pages'

const key = PageKey.PrivacyPolicy

export async function generateMetadata({ params }: PageProps) {
  const { page } = await resolvePage(key, params)
  return staticPageMetadata(page)
}

export default async function PrivacyPolicyPage({ params }: PageProps) {
  const { page } = await resolvePage(key, params)
  if (page.content.type !== 'standard') {
    notFound()
  }
  return <StaticPage content={page.content} />
}
