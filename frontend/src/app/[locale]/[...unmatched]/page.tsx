import { getTranslations } from 'next-intl/server'

import { MessagePage } from '../components/MessagePage/MessagePage'

import { ButtonLink } from '@/components/Button'

export default async function UnmatchedPage() {
  const t = await getTranslations('Site')
  return (
    <MessagePage code="404" title={t('pageNotFound')} description={t('pageNotFoundMessage')}>
      <ButtonLink variant="primary" href="/">
        {t('home')}
      </ButtonLink>
    </MessagePage>
  )
}
