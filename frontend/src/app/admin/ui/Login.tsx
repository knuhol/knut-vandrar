'use client'

import { useState } from 'react'
import { Box, Button, Container, Stack, TextField, Typography } from '@mui/material'
import { AdminMessage } from './AdminMessage'
import messages from '@/admin/messages/en.json'

export function Login() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function login(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = new FormData(event.currentTarget).get('password')
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(result.error || messages.unableToSignIn)
      }
      window.location.assign('/admin')
    } catch (error) {
      setError(error instanceof Error ? error.message : messages.unableToSignIn)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack
          component="form"
          onSubmit={(event) => {
            void login(event)
          }}
          spacing={3}
        >
          <Typography variant="h4" component="h1">
            {messages.knutVandrarAdmin}
          </Typography>
          <Typography>{messages.signInToManageYourHiking}</Typography>
          {error && <AdminMessage message={error} severity="error" />}
          <TextField
            name="password"
            label={messages.password}
            type="password"
            autoComplete="current-password"
            required
          />
          <Button type="submit" disabled={busy}>
            {busy ? messages.signingIn : messages.signIn}
          </Button>
        </Stack>
      </Box>
    </Container>
  )
}
