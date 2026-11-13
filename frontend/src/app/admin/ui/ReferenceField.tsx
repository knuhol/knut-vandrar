'use client'

import { useState } from 'react'
import { Autocomplete, Button, Stack, TextField } from '@mui/material'
import { AdminMessage } from './AdminMessage'
import messages from '@/admin/messages/en.json'

import { api } from '@/admin/client'
import { record, text, title, type Json } from '@/admin/resources'

export function ReferenceField({
  resource,
  value,
  onChange,
  required,
  label,
}: {
  resource: string
  value: Json
  onChange: (value: Json) => void
  required: boolean
  label: string
}) {
  const [options, setOptions] = useState<{ id: string; label: string }[]>([])
  const [total, setTotal] = useState<number>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function load() {
    setBusy(true)
    try {
      const page = record(
        await api(`${resource}?locale=en&limit=20&offset=${text(options.length)}`),
      )
      const entries = Array.isArray(page.items) ? page.items : []
      setOptions((previous) => [
        ...previous,
        ...entries.map((item) => ({ id: text(record(item).id), label: title(item) })),
      ])
      setTotal(typeof page.total === 'number' ? page.total : 0)
    } catch (error) {
      setError(error instanceof Error ? error.message : messages.unableToLoadOptions)
    } finally {
      setBusy(false)
    }
  }
  const selected =
    options.find((option) => option.id === value) ||
    (typeof value === 'string' ? { id: value, label: value } : null)
  return (
    <Stack spacing={1}>
      <Autocomplete
        options={options}
        value={selected}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        loading={busy}
        onOpen={() => {
          if (options.length === 0 && !busy) {
            void load()
          }
        }}
        onChange={(_, option) => {
          onChange(option?.id || null)
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label.replaceAll('_', ' ')}
            required={required}
            helperText={messages.searchLoadedRecordsLoadMoreTo}
          />
        )}
      />
      {(total === undefined || options.length < total) && (
        <Button
          disabled={busy}
          variant="outlined"
          onClick={() => {
            void load()
          }}
        >
          {messages.loadMoreRecords}
        </Button>
      )}
      {error && <AdminMessage message={error} severity="error" />}
    </Stack>
  )
}
