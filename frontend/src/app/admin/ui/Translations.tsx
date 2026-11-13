'use client'

import { useState } from 'react'
import {
  Alert,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { AdminMessage } from './AdminMessage'
import { EditorSection } from './EditorSection'
import { Fields } from './Fields'
import { TranslationStatus } from './TranslationStatus'
import { TranslationCandidates } from './TranslationCandidates'
import messages from '@/admin/messages/en.json'
import { api, ApiError } from '@/admin/client'
import {
  text,
  record,
  resources,
  schemaFor,
  writeValue,
  valuesEqual,
  type Json,
  type Resource,
} from '@/admin/resources'

export function TranslationRequest() {
  const [kind, setKind] = useState('')
  const [listRevision, setListRevision] = useState(0)
  const [locale, setLocale] = useState('')
  const [include, setInclude] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (
      !window.confirm(
        messages.queueConfirmation
          .replace('{scope}', include ? messages.flaggedMissingAndOutdated : messages.flagged)
          .replace('{entity}', kind || messages.allEntityTypes)
          .replace('{locale}', locale || messages.bothTargetLanguages),
      )
    ) {
      return
    }
    setBusy(true)
    try {
      const result = record(
        await api('translations/requeue', 'POST', {
          include_outdated: include,
          ...(kind ? { entity_type: kind } : {}),
          ...(locale ? { locale } : {}),
        }),
      )
      setListRevision((previous) => previous + 1)
      setMessage(
        messages.queueResult
          .replace('{queued}', text(result.queued))
          .replace('{skipped}', text(result.skipped)),
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : messages.requestFailed)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack spacing={2}>
      <Typography variant="h6">{messages.requestTranslations}</Typography>
      <Alert severity="info">{messages.onlyThisActionRequestsPaidTranslation}</Alert>
      <TextField
        select
        label={messages.entityType}
        value={kind}
        onChange={(event) => {
          setKind(event.target.value)
        }}
      >
        <MenuItem value="">{messages.allTypes}</MenuItem>
        {resources.map((item) => (
          <MenuItem key={item.kind} value={item.kind}>
            {item.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label={messages.targetLanguage}
        value={locale}
        onChange={(event) => {
          setLocale(event.target.value)
        }}
      >
        <MenuItem value="">{messages.swedishAndCzech}</MenuItem>
        <MenuItem value="sv">{messages.swedish}</MenuItem>
        <MenuItem value="cs">{messages.czech}</MenuItem>
      </TextField>
      <TextField
        select
        label={messages.scope}
        value={include ? 'broader' : 'flagged'}
        onChange={(event) => {
          setInclude(event.target.value === 'broader')
        }}
      >
        <MenuItem value="flagged">{messages.flaggedOnlyNeedsRetranslation}</MenuItem>
        <MenuItem value="broader">{messages.alsoIncludeMissingAndOutdated}</MenuItem>
      </TextField>
      <TranslationCandidates
        key={`${kind}-${locale}-${String(include)}-${String(listRevision)}`}
        entityType={kind}
        locale={locale}
        includeOutdated={include}
      />
      <Button
        disabled={busy}
        onClick={() => {
          void submit()
        }}
      >
        {messages.reviewAndRequestTranslations}
      </Button>
      {message && <AdminMessage message={message} />}
    </Stack>
  )
}

export function TranslationEditor({
  resource,
  id,
  source,
}: {
  resource: Resource
  id: string
  source: Json
}) {
  const [locale, setLocale] = useState('sv')
  const [statusRevision, setStatusRevision] = useState(0)
  const [value, setValue] = useState<Json>(null)
  const [savedValue, setSavedValue] = useState<Json>(null)
  const dirty = !valuesEqual(value, savedValue)
  const [metadata, setMetadata] = useState<Record<string, Json>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const schema = schemaFor(resource.english)
  async function load() {
    if (dirty && !window.confirm(messages.discardUnsavedChanges)) {
      return
    }
    setStatusRevision((previous) => previous + 1)
    setBusy(true)
    try {
      const result = record(await api(`${resource.name}/${id}?locale=${locale}`))
      setMetadata(record(result.translation))
      const loaded = writeValue(schema, resource.kind === 'hike' ? result.translation : result)
      setValue(loaded)
      setSavedValue(record(result.translation).locale === locale ? loaded : null)
      setMessage('')
    } catch (error) {
      setValue(error instanceof ApiError && error.status === 404 ? source : null)
      setSavedValue(null)
      setMetadata({ locale, review_status: 'missing' })
      setMessage(error instanceof Error ? error.message : messages.translationUnavailable)
    } finally {
      setBusy(false)
    }
  }
  async function save(review?: string) {
    const submitted = value
    if (
      metadata.review_status === 'manual' &&
      review &&
      review !== 'manual' &&
      !window.confirm(messages.removeManualProtection)
    ) {
      return
    }
    setBusy(true)
    try {
      await api(
        `${resource.name}/${id}/translations/${locale}${review ? '/review' : ''}`,
        'PUT',
        review ? { review_status: review } : submitted || {},
      )
      if (!review) {
        setSavedValue(submitted)
      }
      setMetadata((previous): Record<string, Json> =>
        review
          ? { ...previous, review_status: review }
          : { locale, review_status: 'manual', is_outdated: false },
      )
      setStatusRevision((previous) => previous + 1)
      setMessage(
        review
          ? messages.reviewStatusSavedNoWorkWas
          : messages.manualTranslationSavedAndProtectedFrom,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : messages.saveFailed)
    } finally {
      setBusy(false)
    }
  }
  return (
    <EditorSection title={messages.translations} dirty={dirty}>
      <Stack spacing={3}>
        <FormControl component="fieldset" disabled={busy}>
          <FormLabel component="legend">{messages.language}</FormLabel>
          <RadioGroup
            aria-label={messages.language}
            value={locale}
            onChange={(event) => {
              if (dirty && !window.confirm(messages.discardUnsavedChanges)) {
                return
              }
              setLocale(event.target.value)
              setValue(null)
              setSavedValue(null)
              setMetadata({})
              setMessage('')
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              {[
                { value: 'sv', label: messages.swedish },
                { value: 'cs', label: messages.czech },
              ].map((language) => (
                <Stack key={language.value} spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                  <FormControlLabel
                    value={language.value}
                    control={<Radio />}
                    label={language.label}
                  />
                  <TranslationStatus
                    key={`${resource.name}-${id}-${language.value}-${String(statusRevision)}`}
                    resource={resource}
                    id={id}
                    locale={language.value}
                  />
                </Stack>
              ))}
            </Stack>
          </RadioGroup>
        </FormControl>
        <Button
          disabled={busy}
          onClick={() => {
            void load()
          }}
        >
          {messages.loadTranslation}
        </Button>
        {value !== null && (
          <>
            {metadata.locale && metadata.locale !== locale && (
              <Alert severity="info">{messages.showingFallbackContentSaveToCreate}</Alert>
            )}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6">{messages.englishSource}</Typography>
                <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {JSON.stringify(source, null, 2)}
                </pre>
              </Stack>
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Fields
                  schema={schema}
                  value={value}
                  onChange={setValue}
                  label={messages.translation}
                />
              </Stack>
            </Stack>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button
                disabled={busy}
                onClick={() => {
                  void save()
                }}
              >
                {messages.saveManualTranslation}
              </Button>
              {['unreviewed', 'approved', 'needs_retranslation', 'manual'].map((status) => (
                <Button
                  key={status}
                  variant="outlined"
                  disabled={busy}
                  onClick={() => {
                    void save(status)
                  }}
                >
                  {status.replaceAll('_', ' ')}
                </Button>
              ))}
            </Stack>
          </>
        )}
        {message && <AdminMessage message={message} />}
      </Stack>
    </EditorSection>
  )
}
