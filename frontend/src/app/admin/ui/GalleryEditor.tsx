'use client'

import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { ImagePreview } from './ImagePreview'
import { EditorSection } from './EditorSection'

import { uploadLimits } from '@/admin/uploads'
import { api } from '@/admin/client'
import messages from '@/admin/messages/en.json'
import { photoText, photoTextChanged, type GalleryText } from '@/admin/galleryText'
import { routing, type Locale } from '@/i18n/routing'
import { galleryTextFields, gallerySection } from '@/admin/resources'
import type { getPhotos } from '@/api/hikes'

type PhotoPage = Awaited<ReturnType<typeof getPhotos>>
type Photo = PhotoPage['items'][number]
const locales: Locale[] = ['en', ...routing.locales.filter((locale) => locale !== 'en')]
type LocalizedPage = { locale: Locale; page: PhotoPage }

async function fetchPages(hikeId: string, offset: number, limit: number): Promise<LocalizedPage[]> {
  return Promise.all(
    locales.map(async (locale) => ({
      locale,
      page: (await api(
        `hikes/${hikeId}/photos?locale=${locale}&limit=${String(limit)}&offset=${String(offset)}`,
      )) as unknown as PhotoPage,
    })),
  )
}

function mergePages(previous: Partial<Record<string, Photo>>, pages: LocalizedPage[]) {
  const next = { ...previous }
  for (const { locale, page } of pages) {
    for (const photo of page.items) {
      next[`${photo.id}:${locale}`] = photo
    }
  }
  return next
}

export function GalleryEditor({
  hikeId,
  onDirtyChange,
}: {
  hikeId: string
  onDirtyChange: (dirty: boolean) => void
}) {
  const [items, setItems] = useState<Photo[]>([])
  const [total, setTotal] = useState(0)
  const [drafts, setDrafts] = useState<Partial<Record<string, GalleryText>>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [field, setField] = useState<keyof GalleryText>('alt')
  const [localized, setLocalized] = useState<Partial<Record<string, Photo>>>({})
  const fieldConfig = galleryTextFields[field]

  function baseline(photo: Photo, locale: Locale) {
    return photoText(locale === 'en' ? photo : localized[`${photo.id}:${locale}`], locale)
  }

  function changedLocales(photo: Photo) {
    return locales.filter((locale) => {
      const draft = drafts[`${photo.id}:${locale}`]
      return draft !== undefined && photoTextChanged(draft, baseline(photo, locale))
    })
  }

  const dirty = items.some((photo) => changedLocales(photo).length > 0)

  useEffect(() => {
    onDirtyChange(dirty || busy)
  }, [dirty, busy, onDirtyChange])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const pages = await fetchPages(hikeId, 0, 24)
        const page = pages[0].page
        if (active) {
          setLocalized(mergePages({}, pages))
          setItems(page.items)
          setTotal(page.total)
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : messages.loadFailed)
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [hikeId])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setMessage('')
    try {
      await action()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : messages.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  async function refresh() {
    // Keep unsaved caption drafts while refreshing after batch uploads or deletion.
    const loaded: Photo[] = []
    let count: number
    do {
      const pages = await fetchPages(hikeId, loaded.length, 100)
      const page = pages[0].page
      setLocalized((current) => mergePages(current, pages))
      loaded.push(...page.items)
      count = page.total
      if (page.items.length === 0) {
        break
      }
    } while (loaded.length < Math.min(count, Math.max(items.length, 24)))
    setItems(loaded)
    setTotal(count)
  }

  async function move(index: number, direction: number) {
    const ordered = [...items]
    const current = ordered[index]
    ordered[index] = ordered[index + direction]
    ordered[index + direction] = current
    await api(`hikes/${hikeId}/photos/order`, 'PUT', { ids: ordered.map((photo) => photo.id) })
    setItems(ordered)
  }

  return (
    <EditorSection title={messages[gallerySection.title]} dirty={dirty}>
      <Stack spacing={2}>
        <Alert severity="info">{messages.galleryHelp}</Alert>
        <TextField
          type="file"
          label={messages.galleryUpload}
          disabled={busy}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              multiple: true,
              accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif',
            },
          }}
          onChange={(event) => {
            const input = event.target as HTMLInputElement
            const files = [...(input.files || [])]
            input.value = ''
            void run(async () => {
              const errors: string[] = []
              for (const file of files) {
                try {
                  if (file.size > uploadLimits.photo) {
                    throw new Error(messages.galleryFileTooLarge)
                  }
                  await api(`hikes/${hikeId}/photos`, 'POST', file)
                } catch (error) {
                  errors.push(
                    `${file.name}: ${error instanceof Error ? error.message : messages.saveFailed}`,
                  )
                }
              }
              await refresh()
              setMessage(errors.length > 0 ? errors.join('\n') : messages.galleryUploaded)
            })
          }}
        />
        {message && (
          <Alert severity="info" sx={{ whiteSpace: 'pre-line' }}>
            {message}
          </Alert>
        )}
        <TextField
          select
          label={messages.galleryTextField}
          value={field}
          onChange={(event) => {
            const selected = event.target.value
            if (selected === 'alt' || selected === 'caption') {
              setField(selected)
            }
          }}
        >
          {Object.entries(galleryTextFields).map(([value, config]) => (
            <MenuItem key={value} value={value}>
              {messages[config.label]}
            </MenuItem>
          ))}
        </TextField>
        {items.map((photo, index) => {
          const changed = changedLocales(photo).length > 0
          return (
            <Card
              key={photo.id}
              variant="outlined"
              sx={
                changed
                  ? (theme) => ({ bgcolor: theme.alpha(theme.palette.warning.main, 0.14) })
                  : undefined
              }
            >
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {photo.id}
                    {changed ? messages.unsaved : ''}
                  </Typography>
                  <ImagePreview
                    src={`/api/admin/backend${photo.thumbnail_url.slice(4)}`}
                    alt={photo.alt}
                    width={photo.width}
                    height={photo.height}
                  />
                  {locales.map((locale) => {
                    const key = `${photo.id}:${locale}`
                    const saved = baseline(photo, locale)
                    const draft = drafts[key] || saved
                    const modified = photoTextChanged(draft, saved)
                    const text = locale === 'en' ? photo : localized[key]
                    const status =
                      modified && locale !== 'en'
                        ? messages.galleryManualOnSave
                        : text?.translation.locale === locale
                          ? messages.translationReviewLabels[
                              String(
                                text.translation.review_status,
                              ) as keyof typeof messages.translationReviewLabels
                            ] || messages.translationStatusUnknown
                          : messages.galleryTranslationMissing
                    return (
                      <TextField
                        key={locale}
                        label={messages.galleryLanguages[locale]}
                        value={draft[field]}
                        disabled={busy}
                        multiline
                        helperText={status}
                        slotProps={{ htmlInput: { maxLength: fieldConfig.maxLength } }}
                        onChange={(event) => {
                          setDrafts((current) => ({
                            ...current,
                            [key]: { ...draft, [field]: event.target.value },
                          }))
                        }}
                      />
                    )
                  })}
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Button
                      disabled={busy || !changed}
                      onClick={() => {
                        void run(async () => {
                          for (const locale of changedLocales(photo)) {
                            const draft = drafts[`${photo.id}:${locale}`] || baseline(photo, locale)
                            const fields = { alt: draft.alt, caption: draft.caption || null }
                            const saved = (await api(
                              locale === 'en'
                                ? `photos/${photo.id}`
                                : `photos/${photo.id}/translations/${locale}`,
                              'PUT',
                              locale === 'en' ? { english: fields } : fields,
                            )) as unknown as Photo
                            if (locale === 'en') {
                              setItems((current) =>
                                current.map((item) => (item.id === photo.id ? saved : item)),
                              )
                            } else {
                              setLocalized((current) => ({
                                ...current,
                                [`${photo.id}:${locale}`]: saved,
                              }))
                            }
                          }
                          setMessage(messages.savedNoTranslationsWereQueued)
                        })
                      }}
                    >
                      {messages.save}
                    </Button>
                    <Button
                      disabled={busy || index === 0 || items.length !== total}
                      onClick={() => {
                        void run(async () => {
                          await move(index, -1)
                        })
                      }}
                    >
                      {messages.galleryEarlier}
                    </Button>
                    <Button
                      disabled={busy || index === items.length - 1 || items.length !== total}
                      onClick={() => {
                        void run(async () => {
                          await move(index, 1)
                        })
                      }}
                    >
                      {messages.galleryLater}
                    </Button>
                    <Button
                      component="a"
                      href={`/api/admin/backend/photos/${photo.id}/original`}
                      download
                    >
                      {messages.galleryOriginal}
                    </Button>
                    <Button
                      color="error"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(messages.galleryDeleteConfirmation)) {
                          void run(async () => {
                            await api(`photos/${photo.id}`, 'DELETE')
                            await refresh()
                          })
                        }
                      }}
                    >
                      {messages.delete}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )
        })}
        {items.length < total && (
          <Button
            disabled={busy}
            onClick={() => {
              void run(async () => {
                const pages = await fetchPages(hikeId, items.length, 100)
                const page = pages[0].page
                setLocalized((current) => mergePages(current, pages))
                setItems((current) => [...current, ...page.items])
                setTotal(page.total)
              })
            }}
          >
            {messages.galleryLoadMore}
          </Button>
        )}
      </Stack>
    </EditorSection>
  )
}
