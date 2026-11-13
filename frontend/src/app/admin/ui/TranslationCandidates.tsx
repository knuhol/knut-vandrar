'use client'

import { useEffect, useState } from 'react'
import { Alert, Button, Chip, Paper, Stack, Typography } from '@mui/material'

import { api } from '@/admin/client'
import messages from '@/admin/messages/en.json'
import { record, resources, text, type Json } from '@/admin/resources'

interface Selection {
  entityType: string
  entityId?: string
  locale: string
  includeOutdated: boolean
}

function CandidatePage({
  selection,
  page,
  onPage,
}: {
  selection: Selection
  page: number
  onPage: (page: number) => void
}) {
  const [data, setData] = useState<Record<string, Json>>()
  const [error, setError] = useState(false)
  const pageSize = 10
  useEffect(() => {
    let active = true
    async function load() {
      const params = new URLSearchParams({
        include_outdated: String(selection.includeOutdated),
        limit: String(pageSize),
        offset: String(page * pageSize),
      })
      if (selection.entityType) {
        params.set('entity_type', selection.entityType)
      }
      if (selection.entityId) {
        params.set('entity_id', selection.entityId)
      }
      if (selection.locale) {
        params.set('locale', selection.locale)
      }
      try {
        const result = record(await api(`translations/candidates?${params.toString()}`))
        if (active) {
          setData(result)
        }
      } catch {
        if (active) {
          setError(true)
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [selection.entityType, selection.entityId, selection.locale, selection.includeOutdated, page])

  if (error) {
    return <Alert severity="error">{messages.translationListUnavailable}</Alert>
  }
  if (!data) {
    return <Alert severity="info">{messages.loadingTranslationStatus}</Alert>
  }
  const items = Array.isArray(data.items) ? data.items : []
  const total = typeof data.total === 'number' ? data.total : 0
  return (
    <Stack spacing={2}>
      <Typography>{messages.matchingTranslations.replace('{count}', text(total))}</Typography>
      {items.length === 0 && <Alert severity="info">{messages.noMatchingTranslations}</Alert>}
      {items.map((item) => {
        const row = record(item)
        const review =
          typeof row.review_status === 'string' &&
          row.review_status in messages.translationReviewLabels
            ? messages.translationReviewLabels[
                row.review_status as keyof typeof messages.translationReviewLabels
              ]
            : messages.translationStatusUnknown
        return (
          <Paper
            key={`${text(row.entity_type)}-${text(row.entity_id)}-${text(row.locale)}`}
            variant="outlined"
            sx={{ p: 2 }}
          >
            <Stack spacing={1}>
              <Typography sx={{ overflowWrap: 'anywhere' }} fontWeight="bold">
                {text(row.title)}
              </Typography>
              <Typography variant="body2">
                {resources.find((resource) => resource.kind === row.entity_type)?.label} ·{' '}
                {row.locale === 'sv' ? messages.swedish : messages.czech}
              </Typography>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                {row.is_missing ? (
                  <Chip label={messages.translationMissing} color="warning" />
                ) : (
                  <>
                    <Chip label={review} />
                    <Chip
                      label={row.is_outdated ? messages.outdated : messages.current}
                      color={row.is_outdated ? 'warning' : 'success'}
                      variant="outlined"
                    />
                  </>
                )}
                {row.already_queued && (
                  <Chip label={messages.translationAlreadyQueued} color="info" />
                )}
              </Stack>
            </Stack>
          </Paper>
        )
      })}
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }} alignItems="center">
        <Button
          variant="outlined"
          disabled={page === 0}
          onClick={() => {
            onPage(page - 1)
          }}
        >
          {messages.previous}
        </Button>
        <Typography>
          {messages.page}
          {page + 1}
        </Typography>
        <Button
          variant="outlined"
          disabled={(page + 1) * pageSize >= total}
          onClick={() => {
            onPage(page + 1)
          }}
        >
          {messages.next}
        </Button>
      </Stack>
    </Stack>
  )
}

export function TranslationCandidates(selection: Selection) {
  const [page, setPage] = useState(0)
  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h3">
        {messages.translationsInScope}
      </Typography>
      <Typography variant="body2">{messages.translationPreviewExplanation}</Typography>
      <CandidatePage key={page} selection={selection} page={page} onPage={setPage} />
    </Stack>
  )
}
