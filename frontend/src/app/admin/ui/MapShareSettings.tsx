'use client'

import { useState } from 'react'
import { Alert, Button, FormControlLabel, Stack, Switch, TextField } from '@mui/material'

import { api } from '@/admin/client'
import messages from '@/admin/messages/en.json'
import { record, text } from '@/admin/resources'

export function MapShareSettings() {
  const [password, setPassword] = useState<string>()
  const [active, setActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<'error' | 'success'>()

  async function load() {
    setBusy(true)
    setFeedback(undefined)
    try {
      const settings = record(await api('settings/mapshare'))
      setPassword(text(settings.password))
      setActive(settings.active === true)
    } catch {
      setFeedback('error')
    } finally {
      setBusy(false)
    }
  }

  async function save(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password === undefined || (active && !password.trim())) {
      return
    }
    setBusy(true)
    setFeedback(undefined)
    try {
      await api('settings/mapshare', 'PUT', { password, active })
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
          <Stack direction="row" spacing={1}>
            <Button
              type="submit"
              variant="contained"
              disabled={busy || (active && !password.trim())}
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
