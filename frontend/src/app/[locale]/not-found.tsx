import { getLocale, getTranslations } from 'next-intl/server'

import { MessagePage } from './components/MessagePage'

import { ButtonLink } from '@/components/Button'

export default async function NotFound() {
  const t = await getTranslations('Site')
  const locale = await getLocale()
  return (
    <MessagePage code="404" title={t('pageNotFound')} description={t('pageNotFoundMessage')}>
      <ButtonLink variant="accent" className="min-h-13" href={`/${locale}`}>
        {t('home')}
      </ButtonLink>
    </MessagePage>
  )
}
