'use client'

import { getContrastRatio, Typography } from '@mui/material'
import { green, red, yellow } from '@mui/material/colors'

import messages from '@/admin/messages/en.json'

const colors = { local: green[500], dev: yellow[500], prod: red[500] }

export function EnvironmentBanner({ environment }: { environment: keyof typeof colors }) {
  const background = colors[environment]

  return (
    <Typography
      component="aside"
      align="center"
      sx={(theme) => ({
        width: '100%',
        bgcolor: background,
        color:
          getContrastRatio(background, theme.palette.common.black) >= 4.5
            ? theme.palette.common.black
            : theme.palette.common.white,
        px: 2,
        py: 2,
        fontWeight: 'bold',
        fontSize: 'var(--text-lg)',
        textTransform: 'uppercase',
      })}
    >
      {messages.environmentLabels[environment]}
    </Typography>
  )
}
