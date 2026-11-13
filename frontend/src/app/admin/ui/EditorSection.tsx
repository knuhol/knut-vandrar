'use client'

import { useId, useRef } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Chip, Typography } from '@mui/material'

import { useEditorSections } from './EditorSections'
import messages from '@/admin/messages/en.json'

export function EditorSection({
  title,
  children,
  dirty = false,
}: {
  title: string
  children: React.ReactNode
  dirty?: boolean
}) {
  const sections = useEditorSections()
  const pendingFocus = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(
    null,
  )
  const id = useId()
  const expanded = sections.expandedId === id
  return (
    <Accordion
      expanded={expanded}
      data-unsaved={dirty || undefined}
      onChange={(_, next) => {
        sections.toggle(id, next)
      }}
      onInvalidCapture={(event) => {
        const input = event.target
        if (
          input instanceof HTMLInputElement ||
          input instanceof HTMLSelectElement ||
          input instanceof HTMLTextAreaElement
        ) {
          const firstInvalid = input.form?.querySelector(
            'input:invalid, select:invalid, textarea:invalid',
          )
          if (firstInvalid && firstInvalid !== input) {
            event.preventDefault()
            return
          }
        }
        const accepted = sections.claimInvalid(id)
        if (!accepted || !expanded) {
          event.preventDefault()
        }
        if (!accepted) {
          return
        }
        if (expanded) {
          queueMicrotask(() => {
            sections.finishValidation(id)
          })
          return
        }
        if (
          (input instanceof HTMLInputElement ||
            input instanceof HTMLSelectElement ||
            input instanceof HTMLTextAreaElement) &&
          !pendingFocus.current
        ) {
          pendingFocus.current = input
        }
      }}
      slotProps={{
        transition: {
          unmountOnExit: false,
          onEntered: () => {
            const input = pendingFocus.current
            pendingFocus.current = null
            sections.finishValidation(id)
            input?.focus()
            input?.reportValidity()
          },
        },
      }}
      sx={(theme) => ({
        minWidth: 0,
        '&::before': { display: 'none' },
        bgcolor: dirty ? theme.alpha(theme.palette.warning.main, 0.14) : undefined,
        ...(dirty
          ? {
              '& .MuiButton-outlined.MuiButton-colorError, & .MuiFormLabel-root.Mui-error, & .MuiFormHelperText-root.Mui-error':
                {
                  color: theme.lighten(theme.palette.error.light, 0.3),
                },
            }
          : {}),
      })}
    >
      <AccordionSummary
        sx={{
          '& .MuiAccordionSummary-content': { gap: 1, flexWrap: 'wrap', alignItems: 'center' },
        }}
        id={`${id}-heading`}
        aria-controls={`${id}-content`}
        expandIcon={<span aria-hidden="true">⌄</span>}
      >
        <Typography variant="h6" component="span">
          {title}
        </Typography>
        {dirty && <Chip size="small" color="warning" label={messages.unsavedChanges} />}
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  )
}
