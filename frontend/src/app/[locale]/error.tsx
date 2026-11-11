'use client'

import { useTranslations } from 'next-intl'

import { MessagePage } from './components/MessagePage/MessagePage'

import { Button } from '@/components/Button'

export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations('Site')

  return (
    <MessagePage code="500" title={t('unavailable')} description={t('error')} alert>
      <Button variant="primary" onClick={reset}>
        {t('retry')}
      </Button>
    </MessagePage>
  )
}
