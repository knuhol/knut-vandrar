'use client'

import { useCallback, useEffect, useState } from 'react'
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

import { EditorSection } from './EditorSection'
import { AdminMessage } from './AdminMessage'
import { useAdminFeedback } from './useAdminFeedback'
import { api } from '@/admin/client'
import messages from '@/admin/messages/en.json'
import { achievementSection, achievementTextFields, schemaFor, text } from '@/admin/resources'
import { routing, type Locale } from '@/i18n/routing'
import type { Hike } from '@/api/hikes'

type Achievement = Hike['achievements'][number]
type Content = { title: string; description: string }
type Localized = Partial<Record<Locale, Achievement>>
const locales: Locale[] = ['en', ...routing.locales.filter((locale) => locale !== 'en')]
const icons = schemaFor('AchievementIcon').enum || []
const emptyText = (): Content => ({ title: '', description: '' })

function content(item: Achievement | undefined, locale: Locale): Content {
  return item?.translation.locale === locale
    ? { title: item.title, description: item.description || '' }
    : emptyText()
}

function AchievementEditor({
  hikeId,
  rowKey,
  initial,
  allowReorder,
  field,
  onSaved,
  onDeleted,
  onDirtyChange,
}: {
  hikeId: string
  rowKey: string
  initial?: Localized
  allowReorder: boolean
  field: keyof Content
  onSaved: (key: string, value: Localized) => void
  onDeleted: (key: string) => void
  onDirtyChange: (key: string, dirty: boolean) => void
}) {
  const [saved, setSaved] = useState<Localized>(initial || {})
  const [drafts, setDrafts] = useState(
    () =>
      Object.fromEntries(
        locales.map((locale) => [locale, content(initial?.[locale], locale)]),
      ) as Record<Locale, Content>,
  )
  const [icon, setIcon] = useState(initial?.en?.icon || 'backpack')
  const [order, setOrder] = useState(initial?.en?.sort_order ?? 0)
  const [busy, setBusy] = useState(false)
  const { feedback, show } = useAdminFeedback()
  const changedLocales = locales.filter(
    (locale) => JSON.stringify(drafts[locale]) !== JSON.stringify(content(saved[locale], locale)),
  )
  const dirty =
    !saved.en ||
    changedLocales.length > 0 ||
    icon !== saved.en.icon ||
    order !== saved.en.sort_order

  useEffect(() => {
    onDirtyChange(rowKey, dirty || busy)
    return () => {
      onDirtyChange(rowKey, false)
    }
  }, [rowKey, dirty, busy, onDirtyChange])

  async function save(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    show('')
    try {
      if (
        !drafts.en.title.trim() ||
        changedLocales.some((locale) => !drafts[locale].title.trim())
      ) {
        throw new Error(messages.achievementTitleRequired)
      }
      if (!Number.isInteger(order) || order < 0) {
        throw new Error(messages.achievementOrderInvalid)
      }
      const next = { ...saved }
      let entity = saved.en
      if (
        !entity ||
        changedLocales.includes('en') ||
        icon !== entity.icon ||
        order !== entity.sort_order
      ) {
        entity = (await api(
          `achievements${entity ? `/${entity.id}` : ''}`,
          entity ? 'PUT' : 'POST',
          {
            hike_id: hikeId,
            icon,
            sort_order: order,
            english: { title: drafts.en.title, description: drafts.en.description || null },
          },
        )) as unknown as Achievement
        next.en = entity
        setSaved({ ...next })
      }
      for (const locale of changedLocales.filter((locale) => locale !== 'en')) {
        next[locale] = (await api(`achievements/${entity.id}/translations/${locale}`, 'PUT', {
          title: drafts[locale].title,
          description: drafts[locale].description || null,
        })) as unknown as Achievement
        setSaved({ ...next })
      }
      onSaved(rowKey, next)
      show(messages.savedNoTranslationsWereQueued, '', 'success')
    } catch (error) {
      show(error instanceof Error ? error.message : messages.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (saved.en && !window.confirm(messages.achievementDeleteConfirmation)) {
      return
    }
    setBusy(true)
    show('')
    try {
      if (saved.en) {
        await api(`achievements/${saved.en.id}`, 'DELETE')
      }
      onDeleted(rowKey)
    } catch (error) {
      show(error instanceof Error ? error.message : messages.deleteFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event) => {
            void save(event)
          }}
        >
          <Typography variant="h6">{saved.en?.title || messages.newAchievement}</Typography>
          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            <TextField
              select
              label={messages.achievementIcon}
              value={icon}
              disabled={busy}
              onChange={(event) => {
                setIcon(event.target.value as Achievement['icon'])
              }}
            >
              {icons.map((value) => (
                <MenuItem key={text(value)} value={text(value)}>
                  {text(value).replaceAll('_', ' ')}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={messages.achievementOrder}
              type="number"
              value={order}
              disabled={busy || !allowReorder}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              onChange={(event) => {
                setOrder(Number(event.target.value))
              }}
            />
          </Stack>
          {locales.map((locale) => {
            const modified = changedLocales.includes(locale)
            const metadata = saved[locale]?.translation
            const status =
              modified && locale !== 'en'
                ? messages.galleryManualOnSave
                : metadata?.locale === locale
                  ? messages.translationReviewLabels[metadata.review_status] ||
                    messages.translationStatusUnknown
                  : messages.galleryTranslationMissing
            return (
              <TextField
                key={locale}
                label={messages.galleryLanguages[locale]}
                value={drafts[locale][field]}
                disabled={busy}
                multiline
                required={field === 'title' && (locale === 'en' || modified)}
                helperText={status}
                slotProps={{ htmlInput: { maxLength: achievementTextFields[field].maxLength } }}
                onChange={(event) => {
                  setDrafts((current) => ({
                    ...current,
                    [locale]: { ...current[locale], [field]: event.target.value },
                  }))
                }}
              />
            )
          })}
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button type="submit" disabled={busy || !dirty}>
              {messages.save}
            </Button>
            <Button
              color="error"
              variant="outlined"
              disabled={busy}
              onClick={() => {
                void remove()
              }}
            >
              {saved.en ? messages.delete : messages.remove}
            </Button>
          </Stack>
          {feedback.message && (
            <AdminMessage message={feedback.message} severity={feedback.severity} />
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

export function AchievementsEditor({
  hikeId,
  onDirtyChange,
}: {
  hikeId: string
  onDirtyChange: (dirty: boolean) => void
}) {
  const [items, setItems] = useState<Record<string, Localized>>({})
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(true)
  const [field, setField] = useState<keyof Content>('title')
  const [dirtyRows, setDirtyRows] = useState<Record<string, boolean>>({})
  const { feedback, show } = useAdminFeedback()
  const dirty = creating || Object.values(dirtyRows).some(Boolean)
  const trackDirty = useCallback((key: string, changed: boolean) => {
    setDirtyRows((current) => (current[key] === changed ? current : { ...current, [key]: changed }))
  }, [])
  useEffect(() => {
    onDirtyChange(dirty || busy)
  }, [dirty, busy, onDirtyChange])

  const load = useCallback(
    async (offset: number) => {
      const pages = await Promise.all(
        locales.map(async (locale) => ({
          locale,
          page: (await api(
            `achievements?hike_id=${hikeId}&locale=${locale}&limit=24&offset=${String(offset)}`,
          )) as unknown as { items: Achievement[]; total: number },
        })),
      )
      const next: Record<string, Localized> = {}
      for (const { locale, page } of pages) {
        for (const item of page.items) {
          ;(next[item.id] ??= {})[locale] = item
        }
      }
      return { next, total: pages[0].page.total, count: pages[0].page.items.length }
    },
    [hikeId],
  )

  useEffect(() => {
    let active = true
    void load(0)
      .then((result) => {
        if (active) {
          setItems(result.next)
          setTotal(result.total)
          setLoaded(result.count)
        }
        return undefined
      })
      .catch((error: unknown) => {
        if (active) {
          show(error instanceof Error ? error.message : messages.loadFailed)
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false)
        }
      })
    return () => {
      active = false
    }
  }, [load, show])

  function saved(key: string, value: Localized) {
    const id = value.en?.id
    if (!id) {
      return
    }
    setItems((current) => ({ ...current, [id]: value }))
    if (key === 'new') {
      show(messages.savedNoTranslationsWereQueued, '', 'success')
      setCreating(false)
      setTotal((current) => current + 1)
      setLoaded((current) => current + 1)
    }
  }
  function deleted(key: string) {
    if (key === 'new') {
      setCreating(false)
    } else {
      setItems((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => id !== key)),
      )
      setTotal((current) => current - 1)
      setLoaded((current) => current - 1)
    }
  }

  return (
    <EditorSection title={messages[achievementSection.title]} dirty={dirty}>
      <Stack spacing={2}>
        <Alert severity="info">{messages.achievementsHelp}</Alert>
        <TextField
          select
          label={messages.achievementTextField}
          value={field}
          onChange={(event) => {
            setField(event.target.value as keyof Content)
          }}
        >
          {Object.entries(achievementTextFields).map(([key, config]) => (
            <MenuItem key={key} value={key}>
              {messages[config.label]}
            </MenuItem>
          ))}
        </TextField>
        {Object.entries(items)
          .sort(([, a], [, b]) => (a.en?.sort_order ?? 0) - (b.en?.sort_order ?? 0))
          .map(([key, initial]) => (
            <AchievementEditor
              key={key}
              hikeId={hikeId}
              rowKey={key}
              initial={initial}
              allowReorder={loaded === total}
              field={field}
              onSaved={saved}
              onDeleted={deleted}
              onDirtyChange={trackDirty}
            />
          ))}
        {creating && (
          <AchievementEditor
            key="new"
            hikeId={hikeId}
            rowKey="new"
            allowReorder={loaded === total}
            field={field}
            onSaved={saved}
            onDeleted={deleted}
            onDirtyChange={trackDirty}
          />
        )}
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Button
            disabled={busy || creating || loaded < total}
            onClick={() => {
              setCreating(true)
              setField('title')
            }}
          >
            {messages.addAchievement}
          </Button>
          {loaded < total && (
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true)
                show('')
                void load(loaded)
                  .then((result) => {
                    setItems((current) => ({ ...current, ...result.next }))
                    setLoaded((current) => current + result.count)
                    setTotal(result.total)
                    return undefined
                  })
                  .catch((error: unknown) => {
                    show(error instanceof Error ? error.message : messages.loadFailed)
                  })
                  .finally(() => {
                    setBusy(false)
                  })
              }}
            >
              {messages.loadMoreAchievements}
            </Button>
          )}
        </Stack>
        {feedback.message && (
          <AdminMessage message={feedback.message} severity={feedback.severity} />
        )}
      </Stack>
    </EditorSection>
  )
}
