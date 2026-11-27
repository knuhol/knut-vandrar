'use client'

import { useState } from 'react'
import { Alert, Button, FormControlLabel, Stack, Switch, TextField } from '@mui/material'

import { api } from '@/admin/client'
import messages from '@/admin/messages/en.json'
import { record, text } from '@/admin/resources'

const maxIntervalMinutes = 2_147_483_647

export function MapShareSettings() {
  const [password, setPassword] = useState<string>()
  const [intervalInput, setIntervalInput] = useState('')
  const intervalMinutes = Number(intervalInput)
  const validInterval =
    Number.isInteger(intervalMinutes) &&
    intervalMinutes > 0 &&
    intervalMinutes <= maxIntervalMinutes
  const [active, setActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<'error' | 'success'>()

  async function load() {
    setBusy(true)
    setFeedback(undefined)
    try {
      const settings = record(await api('settings/mapshare'))
      setPassword(text(settings.password))
      const savedInterval = settings.tracking_interval_minutes
      setIntervalInput(typeof savedInterval === 'number' ? String(savedInterval) : '')
      setActive(settings.active === true)
    } catch {
      setFeedback('error')
    } finally {
      setBusy(false)
    }
  }

  async function save(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password === undefined || !validInterval || (active && !password.trim())) {
      return
    }
    setBusy(true)
    setFeedback(undefined)
    try {
      await api('settings/mapshare', 'PUT', {
        password,
        active,
        tracking_interval_minutes: intervalMinutes,
      })
      setFeedback('success')
    } catch {
      setFeedback('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={2} alignItems="flex-start">
      {password === undefined ? (
        <Button
          disabled={busy}
          onClick={() => {
            void load()
          }}
        >
          {messages.mapshareSettings}
        </Button>
      ) : (
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event: React.SyntheticEvent<HTMLFormElement>) => {
            void save(event)
          }}
        >
          <FormControlLabel
            label={messages.mapshareActive}
            control={
              <Switch
                checked={active}
                disabled={busy}
                onChange={(_, checked) => {
                  setActive(checked)
                }}
              />
            }
          />
          <TextField
            disabled={busy}
            label={messages.mapsharePassword}
            helperText={messages.mapsharePasswordHelp}
            value={password}
            slotProps={{ htmlInput: { maxLength: 256 } }}
            onChange={(event) => {
              setPassword(event.target.value)
            }}
          />
          <TextField
            required
            disabled={busy}
            type="number"
            label={messages.mapshareTrackingInterval}
            value={intervalInput}
            slotProps={{ htmlInput: { min: 1, max: maxIntervalMinutes, step: 1 } }}
            onChange={(event) => {
              setIntervalInput(event.target.value)
            }}
          />
          <Stack direction="row" spacing={1}>
            <Button
              type="submit"
              variant="contained"
              disabled={busy || !validInterval || (active && !password.trim())}
            >
              {messages.save}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                setPassword(undefined)
                setFeedback(undefined)
              }}
            >
              {messages.cancel}
            </Button>
          </Stack>
        </Stack>
      )}
      {feedback && (
        <Alert severity={feedback}>
          {feedback === 'success' ? messages.mapsharePasswordSaved : messages.mapsharePasswordError}
        </Alert>
      )}
    </Stack>
  )
}
