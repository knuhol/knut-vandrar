import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import {
  IconArrowUpRight,
  IconBrandInstagram,
  IconBrandYoutube,
  IconViewfinder,
} from '@tabler/icons-react'

import { AboutTrailCallout } from './components/AboutTrailCallout/AboutTrailCallout'
import { Container } from '@/components/Container'
import { PageHeader } from '@/components/PageHeader'
import { Heading } from '@/components/Heading'
import { Markdown } from '@/components/Markdown/Markdown'
import { siteIdentity } from '@/config/site'
import { formatAuthorContent } from '@/content/author'
import { PageKey } from '@/content/staticPages'
import { resolvePage, staticPageMetadata, type PageProps } from '@/content/pages'
import { profileData } from '@/seo/structuredData'
import { StructuredData } from '@/components/StructuredData'

export async function generateMetadata({ params }: PageProps) {
  const { page } = await resolvePage(PageKey.About, params)
  return staticPageMetadata(page)
}

export default async function AboutPage({ params }: PageProps) {
  const { page, locale } = await resolvePage(PageKey.About, params)
  if (page.content.type !== 'about') {
    notFound()
  }
  const content = page.content
  const site = await getTranslations({ locale, namespace: 'Site' })

  // Calculate age for each request so a deployment never freezes it at build time.
  await connection()
  const biography = formatAuthorContent(content.body_markdown, new Date())
  const profiles = [
    { key: 'instagram', href: siteIdentity.profiles.instagram, Icon: IconBrandInstagram },
    { key: 'youtube', href: siteIdentity.profiles.youtube, Icon: IconBrandYoutube },
    { key: 'plotaroute', href: siteIdentity.profiles.plotaroute, Icon: IconViewfinder },
  ] as const

  return (
    <article>
      <StructuredData data={profileData(locale, content.title, content.introduction)} />
      <PageHeader
        entrance
        eyebrow={content.eyebrow}
        title={content.title}
        introduction={content.introduction}
        media={
          <figure className="mx-auto w-full max-w-100 desktop:max-w-none">
            <Image
              src="/knut.webp"
              width={1254}
              height={1254}
              sizes="(min-width: 1001px) 50vw, (min-width: 641px) 400px, 100vw"
              alt={content.portrait_alt}
              preload
              className="aspect-square w-full rounded-lg object-cover shadow-lg ring-2 ring-orange/50"
            />
            <figcaption className="mt-4 text-sm text-muted">{content.caption}</figcaption>
          </figure>
        }
      >
        <div className="mt-8 flex flex-wrap gap-5">
          {profiles.map(({ key, href, Icon }) => (
            <a key={key} href={href} className="inline-flex items-center gap-2 font-semibold">
              <Icon className="size-5" aria-hidden="true" />
              {site(`social.${key}`)}
              <IconArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          ))}
        </div>
      </PageHeader>
      <Container>
        <div className="grid items-start gap-10 py-12 tablet:py-16 desktop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] desktop:gap-20">
          <div className="min-w-0 max-w-reading">
            <Markdown>{biography}</Markdown>
          </div>
          <aside className="rounded-lg bg-cream p-6 tablet:p-8" aria-labelledby="author-follow">
            <Heading as="h2" className="text-xl" id="author-follow">
              {content.aside_title}
            </Heading>
            <p className="mt-4 text-muted">{content.aside_text}</p>
            <ul className="mt-6 space-y-4">
              {profiles.map(({ key, href, Icon }) => (
                <li key={key}>
                  <a href={href} className="flex items-center gap-3 font-semibold">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-soft text-forest">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    {site(`social.${key}`)}
                    <IconArrowUpRight className="ml-auto size-4 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        </div>
        <AboutTrailCallout
          title={content.cta_title}
          description={content.cta_text}
          action={content.cta}
        />
      </Container>
    </article>
  )
}
