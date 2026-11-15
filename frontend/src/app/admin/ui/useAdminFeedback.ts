'use client'

import { useCallback, useState } from 'react'
import type { AlertColor } from '@mui/material'

export function useAdminFeedback() {
  const [feedback, setFeedback] = useState({
    message: '',
    severity: 'error' as AlertColor,
    target: '',
  })

  const show = useCallback((message: string, target = '', severity: AlertColor = 'error') => {
    setFeedback({ message, target, severity })
  }, [])

  return { feedback, show }
}
