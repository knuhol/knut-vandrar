import { IconMapOff } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

import { MapFrame } from './MapFrame'
import { Alert } from '@/components/Alert'
import { publicConfig } from '@/config/public'

export function MapUnavailable({
  hikeId,
  hasMapShareCard,
}: {
  hikeId?: string
  hasMapShareCard?: boolean
}) {
  const t = useTranslations('Site.map')

  return (
    <MapFrame>
      <div className="absolute inset-0 flex flex-col gap-4 overflow-auto bg-beige p-4 tablet:gap-6 tablet:p-6">
        <Alert tone="warning" title={t('mapLoadFailed')} announcement="polite">
          <p className="text-sm">{t('mapLoadRefresh')}</p>
          {hikeId && (
            <a
              className="w-fit text-sm font-semibold underline"
              href={`${publicConfig.apiBaseUrl}/api/hikes/${hikeId}/route.gpx`}
            >
              {t('downloadRoute')}
            </a>
          )}
          {hasMapShareCard && <p className="text-sm">{t('mapLoadGarmin')}</p>}
        </Alert>
        <div aria-hidden="true" className="grid min-h-20 flex-1 place-items-center text-forest">
          <IconMapOff className="size-10" stroke={1.5} />
        </div>
      </div>
    </MapFrame>
  )
}
