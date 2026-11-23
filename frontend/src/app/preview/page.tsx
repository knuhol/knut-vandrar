import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { Button } from '@/components/Button'
import { Heading } from '@/components/Heading'
import { Logo } from '@/components/Logo'
import { messages } from '@/i18n/messages'
import { localPreviewHost, previewConfig, previewDestination, previewHost } from '@/preview/config'

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>
}) {
  const host = (await headers()).get('host')
  const localPreview = localPreviewHost(host)
  if (!localPreview && !previewHost(host)) {
    notFound()
  }
  const t = messages.en.Site.previewAccess
  const query = await searchParams
  const error =
    (!localPreview && !previewConfig.passwordHash) || query.error === 'unavailable'
      ? t.unavailable
      : query.error === 'limited'
        ? t.limited
        : query.error
          ? t.invalid
          : undefined

  return (
    <main className="relative isolate grid min-h-svh place-items-center overflow-hidden bg-cream px-5 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-1 bg-[url('/brand/forest.svg')] bg-size-[100%_auto] bg-bottom bg-no-repeat"
      />
      <section
        className="content-enter w-full max-w-117.5 rounded-lg bg-paper p-6 shadow-lg tablet:p-10"
        aria-labelledby="preview-title"
      >
        <div className="mb-8">
          <Logo size="compact" />
        </div>
        <Heading className="text-3xl" id="preview-title" tone="brand" eyebrow={t.eyebrow}>
          {t.title}
        </Heading>
        <p className="mt-4 text-muted">{t.description}</p>
        <form
          action="/api/preview/login"
          method="post"
          className="mt-8 grid gap-4"
          inert={localPreview}
        >
          <input
            type="hidden"
            name="next"
            value={previewDestination(typeof query.next === 'string' ? query.next : null)}
          />
          <div>
            <label htmlFor="preview-password" className="mb-2 block text-sm font-semibold">
              {t.password}
            </label>
            <input
              id="preview-password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={256}
              required
              className="min-h-12 w-full rounded-sm border border-beige bg-paper px-3 text-base"
              aria-describedby={error ? 'preview-error' : undefined}
            />
          </div>
          {error && (
            <p id="preview-error" role="alert" className="text-sm text-forest">
              {error}
            </p>
          )}
          <div>
            <Button type="submit" disabled={!localPreview && !previewConfig.passwordHash}>
              {t.submit}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}
