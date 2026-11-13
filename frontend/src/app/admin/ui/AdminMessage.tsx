'use client'

import { Alert, Box, type AlertColor } from '@mui/material'

function formattedJson(message: string): string | undefined {
  try {
    const value: unknown = JSON.parse(message)
    if (value !== null && typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
  } catch {
    return undefined
  }
  return undefined
}

export function AdminMessage({
  message,
  severity = 'info',
}: {
  message: string
  severity?: AlertColor
}) {
  const json = formattedJson(message)
  return (
    <Alert
      severity={json ? 'error' : severity}
      sx={{
        minWidth: 0,
        overflowWrap: 'anywhere',
        '& .MuiAlert-message': { minWidth: 0, width: '100%' },
      }}
    >
      {json ? (
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 'var(--text-sm)',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            overflowX: 'auto',
          }}
        >
          <code>{json}</code>
        </Box>
      ) : (
        message
      )}
    </Alert>
  )
}
