'use client'

import { useEffect, useState } from 'react'
import { Refine, useList } from '@refinedev/core'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { GalleryEditor } from './GalleryEditor'
import { AdminMessage } from './AdminMessage'
import { ImagePreview } from './ImagePreview'
import { EditorSection } from './EditorSection'
import { EditorSections } from './EditorSections'
import { Fields } from './Fields'
import { TranslationEditor, TranslationRequest } from './Translations'
import messages from '@/admin/messages/en.json'
import { api, dataProvider } from '@/admin/client'
import {
  text,
  initialValue,
  record,
  resources,
  schemaFor,
  title,
  writeValue,
  valuesEqual,
  type Json,
  type Resource,
} from '@/admin/resources'

function Content() {
  const [resource, setResource] = useState(resources[0])
  const [section, setSection] = useState('content')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(false)
  const [id, setId] = useState('')
  const [value, setValue] = useState<Json>(null)
  const [savedValue, setSavedValue] = useState<Json>(null)
  const [galleryDirty, setGalleryDirty] = useState(false)
  const dirty = editing && (!valuesEqual(value, savedValue) || galleryDirty)
  const [imageVersion, setImageVersion] = useState(0)
  const [hasImage, setHasImage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const { result, query } = useList({
    resource: resource.name,
    pagination: { currentPage: page, pageSize: 10 },
  })
  const schema = schemaFor(resource.write)
  useEffect(() => {
    function prevent(event: BeforeUnloadEvent) {
      if (dirty) {
        event.preventDefault()
      }
    }
    window.addEventListener('beforeunload', prevent)
    return () => {
      window.removeEventListener('beforeunload', prevent)
    }
  }, [dirty])
  function canLeave() {
    return !dirty || window.confirm(messages.discardUnsavedChanges)
  }
  function switchResource(next: Resource) {
    setGalleryDirty(false)
    setResource(next)
    setEditing(false)
    setPage(1)
    setMessage('')
  }
  async function open(nextId: string) {
    setBusy(true)
    setMessage('')
    try {
      const loaded = nextId
        ? writeValue(schema, await api(`${resource.name}/${nextId}?locale=en`))
        : initialValue(schema)
      setGalleryDirty(false)
      setValue(loaded)
      setSavedValue(loaded)
      setHasImage(Boolean(nextId && resource.image))
      setImageVersion(Date.now())
      setId(nextId)
      setEditing(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : messages.loadFailed)
    } finally {
      setBusy(false)
    }
  }
  async function save(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitted = value
    setBusy(true)
    setMessage('')
    try {
      const saved = record(
        await api(`${resource.name}${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', submitted || {}),
      )
      setId(text(saved.id))
      setSavedValue(submitted)
      setMessage(messages.savedNoTranslationsWereQueued)
      await query.refetch()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : messages.saveFailed)
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!window.confirm(messages.permanentlyDeleteThisRecordRelatedContent)) {
      return
    }
    setBusy(true)
    try {
      await api(`${resource.name}/${id}`, 'DELETE')
      setEditing(false)
      await query.refetch()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : messages.deleteFailed)
    } finally {
      setBusy(false)
    }
  }
  async function image(file?: File) {
    if (file && file.size > (resource.imageMaxBytes || 0)) {
      setMessage(messages[resource.imageLimitMessage || 'fileTooLarge'])
      return
    }
    if (!file && !window.confirm(messages.removeThisImage)) {
      return
    }
    setBusy(true)
    try {
      await api(`${resource.name}/${id}/${resource.image || ''}`, file ? 'PUT' : 'DELETE', file)
      setHasImage(Boolean(file))
      setImageVersion(Date.now())
      setMessage(file ? messages.imageUploaded : messages.imageRemoved)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : messages.imageOperationFailed)
    } finally {
      setBusy(false)
    }
  }
  async function logout() {
    if (!canLeave()) {
      return
    }
    try {
      const response = await fetch('/api/admin/auth', { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(messages.couldNotSignOut)
      }
      window.location.assign('/admin')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : messages.couldNotSignOut)
    }
  }
  return (
    <Container maxWidth="lg">
      <Stack spacing={3} sx={{ py: { xs: 2, sm: 4 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Typography variant="h4" component="h1">
            {messages.knutVandrar}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              void logout()
            }}
          >
            {messages.signOut}
          </Button>
        </Stack>
        <Stack
          component="nav"
          aria-label={messages.adminSections}
          direction="row"
          spacing={1}
          sx={{ flexWrap: 'wrap', gap: 1 }}
        >
          {resources.map((item) => (
            <Button
              key={item.name}
              variant={
                section === 'content' && item.name === resource.name ? 'contained' : 'outlined'
              }
              onClick={() => {
                if (canLeave()) {
                  switchResource(item)
                  setSection('content')
                }
              }}
            >
              {item.label}
            </Button>
          ))}
          <Button
            variant={section === 'translations' ? 'contained' : 'outlined'}
            onClick={() => {
              if (canLeave()) {
                setSection('translations')
                setEditing(false)
              }
            }}
          >
            {messages.translationRequests}
          </Button>
        </Stack>
        {message && <AdminMessage message={message} />}
        {section === 'translations' ? (
          <TranslationRequest />
        ) : editing ? (
          <EditorSections key={`${resource.name}-${id}`}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="outlined"
                onClick={() => {
                  if (canLeave()) {
                    setEditing(false)
                  }
                }}
              >
                {messages.backToList}
              </Button>
              <Typography variant="h5" component="h2">
                {id ? messages.edit : messages.create} {resource.kind}
                {dirty ? messages.unsaved : ''}
              </Typography>
            </Stack>
            <Stack
              component="form"
              spacing={3}
              onSubmit={(event) => {
                void save(event)
              }}
            >
              <Fields
                key={`${resource.name}-${id}`}
                schema={schema}
                value={value}
                baseline={savedValue}
                label={resource.label}
                onChange={(next) => {
                  setValue(next)
                }}
              />
              <Button type="submit" disabled={busy}>
                {busy ? messages.working : messages.save}
              </Button>
            </Stack>
            {id && (
              <>
                {resource.gallery && (
                  <GalleryEditor key={id} hikeId={id} onDirtyChange={setGalleryDirty} />
                )}
                {resource.image && (
                  <EditorSection title={messages.image}>
                    <Stack spacing={2}>
                      {hasImage && (
                        <ImagePreview
                          src={`/api/admin/backend/${resource.name}/${id}/${resource.image}?v=${String(imageVersion)}`}
                          alt={messages.imagePreview}
                          width={1920}
                          height={1080}
                          onError={() => {
                            setHasImage(false)
                          }}
                        />
                      )}
                      <TextField
                        type="file"
                        slotProps={{ htmlInput: { accept: 'image/jpeg,image/png,image/webp' } }}
                        disabled={busy}
                        onChange={(event) => {
                          const input = event.target as HTMLInputElement
                          const file = input.files?.[0]
                          if (file) {
                            void image(file)
                            input.value = ''
                          }
                        }}
                      />
                      <Button
                        variant="outlined"
                        disabled={busy}
                        onClick={() => {
                          void image()
                        }}
                      >
                        {messages.removeImage}
                      </Button>
                    </Stack>
                  </EditorSection>
                )}
                {dirty ? (
                  <Alert severity="info">{messages.saveBeforeTranslations}</Alert>
                ) : (
                  <TranslationEditor
                    key={`${resource.name}-${id}`}
                    resource={resource}
                    id={id}
                    source={record(value).english || null}
                  />
                )}
                <EditorSection title={messages.editorSections.danger}>
                  <Button
                    color="error"
                    variant="outlined"
                    disabled={busy}
                    onClick={() => {
                      void remove()
                    }}
                  >
                    {messages.delete}
                    {resource.kind}
                  </Button>
                </EditorSection>
              </>
            )}
          </EditorSections>
        ) : (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5" component="h2">
                {resource.label}
              </Typography>
              <Button
                disabled={busy || Boolean(resource.uploadOnly)}
                onClick={() => {
                  void open('')
                }}
              >
                {messages.create}
              </Button>
            </Stack>
            {query.isLoading && <Typography>{messages.loading}</Typography>}
            {query.error && <AdminMessage message={query.error.message} severity="error" />}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              {result.data.map((row) => (
                <Card key={text(row.id)} variant="outlined">
                  <CardContent>
                    <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                      {title(row as Json)}
                    </Typography>
                    <Typography variant="body2">{text(row.status || resource.kind)}</Typography>
                    <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                      {text(row.id)}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      disabled={busy}
                      onClick={() => {
                        void open(text(row.id))
                      }}
                    >
                      {messages.edit}
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Box>
            {!query.isLoading && result.total === 0 && (
              <Typography>{messages.noRecordsYet}</Typography>
            )}
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }} alignItems="center">
              <Button
                variant="outlined"
                disabled={page === 1}
                onClick={() => {
                  setPage(page - 1)
                }}
              >
                {messages.previous}
              </Button>
              <Typography>
                {messages.page}
                {page}
                {messages.separator}
                {result.total}
                {messages.records}
              </Typography>
              <Button
                variant="outlined"
                disabled={page * 10 >= (result.total || 0)}
                onClick={() => {
                  setPage(page + 1)
                }}
              >
                {messages.next}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Container>
  )
}

export function AdminApp() {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={resources.map((item) => ({ name: item.name }))}
      options={{ disableTelemetry: true }}
    >
      <Content />
    </Refine>
  )
}
