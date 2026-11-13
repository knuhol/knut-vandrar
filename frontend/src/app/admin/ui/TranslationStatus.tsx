'use client'

import { useEffect, useState } from 'react'
import { Alert, Chip, Stack } from '@mui/material'

import { api, ApiError } from '@/admin/client'
import messages from '@/admin/messages/en.json'
import { record, type Json, type Resource } from '@/admin/resources'

export function TranslationStatus({
  resource,
  id,
  locale,
}: {
  resource: Resource
  id: string
  locale: string
}) {
  const [metadata, setMetadata] = useState<Record<string, Json>>()
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    async function loadStatus() {
      try {
        const result = record(await api(`${resource.name}/${id}?locale=${locale}`))
        if (active) {
          setMetadata(record(result.translation))
        }
      } catch (error) {
        if (!active) {
          return
        }
        if (error instanceof ApiError && error.status === 404) {
          setMetadata({ review_status: 'missing' })
        } else {
          setError(true)
        }
      }
    }
    void loadStatus()
    return () => {
      active = false
    }
  }, [resource.name, id, locale])

  if (error) {
    return <Alert severity="error">{messages.translationStatusUnavailable}</Alert>
  }
  if (!metadata) {
    return <Alert severity="info">{messages.loadingTranslationStatus}</Alert>
  }

  const missing = metadata.review_status === 'missing' || metadata.locale !== locale
  const review =
    typeof metadata.review_status === 'string' &&
    metadata.review_status in messages.translationReviewLabels
      ? messages.translationReviewLabels[
          metadata.review_status as keyof typeof messages.translationReviewLabels
        ]
      : messages.translationStatusUnknown

  return (
    <Stack
      direction="row"
      sx={{ flexWrap: 'wrap', gap: 1 }}
      aria-label={messages.translationStatus}
    >
      {missing ? (
        <Chip label={messages.translationMissing} color="warning" />
      ) : (
        <>
          <Chip
            label={review}
            color={
              metadata.review_status === 'manual' || metadata.review_status === 'approved'
                ? 'success'
                : 'default'
            }
          />
          <Chip
            label={metadata.is_outdated ? messages.outdated : messages.current}
            color={metadata.is_outdated ? 'warning' : 'success'}
            variant="outlined"
          />
        </>
      )}
    </Stack>
  )
}
