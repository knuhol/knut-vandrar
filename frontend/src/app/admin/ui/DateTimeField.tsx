'use client'

import { useState, useSyncExternalStore } from 'react'
import { TextField } from '@mui/material'

import { localDateTime, utcDateTime } from '@/admin/dateTime'
import messages from '@/admin/messages/en.json'

const subscribe = () => () => undefined
const browserTimezone = () => new Intl.DateTimeFormat().resolvedOptions().timeZone
const serverTimezone = () => ''

function LocalInput({
  value,
  label,
  required,
  onChange,
  timezone,
}: {
  value: string | null
  label: string
  required: boolean
  onChange: (value: string | null) => void
  timezone: string
}) {
  const [draft, setDraft] = useState(value ? localDateTime(value) : '')
  const [invalid, setInvalid] = useState(false)

  return (
    <TextField
      label={label}
      type="datetime-local"
      value={draft}
      required={required}
      error={invalid}
      helperText={
        invalid
          ? messages.invalidLocalDateTime
          : messages.localDateTimeZone.replace('{timezone}', timezone)
      }
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: '0.001' } }}
      onChange={(event) => {
        const input = event.target
        const next = input.value
        setDraft(next)
        const timestamp = next ? utcDateTime(next) : undefined
        const bad = input.validity.badInput || (Boolean(next) && !timestamp)
        input.setCustomValidity(bad ? messages.invalidLocalDateTime : '')
        setInvalid(bad)
        if (!bad) {
          onChange(timestamp || null)
        }
      }}
    />
  )
}

export function DateTimeField({
  value,
  label,
  required,
  onChange,
}: {
  value: string | null
  label: string
  required: boolean
  onChange: (value: string | null) => void
}) {
  const timezone = useSyncExternalStore(subscribe, browserTimezone, serverTimezone)
  return timezone ? (
    <LocalInput
      timezone={timezone}
      value={value}
      label={label}
      required={required}
      onChange={onChange}
    />
  ) : (
    <TextField
      label={label}
      type="datetime-local"
      value=""
      disabled
      slotProps={{ inputLabel: { shrink: true } }}
    />
  )
}
