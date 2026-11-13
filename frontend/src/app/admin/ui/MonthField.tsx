'use client'

import { Button, FormControl, FormHelperText, Stack, ToggleButton, Typography } from '@mui/material'

import messages from '@/admin/messages/en.json'
import type { Json } from '@/admin/resources'

export function MonthField({ value, onChange }: { value: Json; onChange: (value: Json) => void }) {
  const enabled = Array.isArray(value)
  const selected = enabled
    ? value.filter((month): month is number => typeof month === 'number')
    : []
  const empty = enabled && selected.length === 0

  return (
    <FormControl error={empty}>
      <Stack spacing={2}>
        <Typography component="h3">{messages.hikingMonthsLabel}</Typography>
        <Stack
          direction="row"
          sx={{ flexWrap: 'wrap', gap: 1 }}
          role="group"
          aria-label={messages.hikingMonthsLabel}
        >
          {messages.monthNames.map((month, index) => {
            const number = index + 1
            const active = selected.includes(number)
            return (
              <ToggleButton
                key={month.full}
                value={number}
                selected={active}
                disabled={!enabled}
                aria-label={month.full}
                color="primary"
                onChange={() => {
                  onChange(
                    active
                      ? selected.filter((item) => item !== number)
                      : [...selected, number].sort((a, b) => a - b),
                  )
                }}
              >
                {month.short}
              </ToggleButton>
            )
          })}
        </Stack>
        <FormHelperText>
          {!enabled
            ? messages.monthsNotSpecified
            : empty
              ? messages.selectHikingMonths
              : messages.hikingMonthsHelp}
        </FormHelperText>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            disabled={enabled}
            onClick={() => {
              onChange([])
            }}
          >
            {messages.add}
            {messages.hikingMonthsLabel}
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={!enabled}
            onClick={() => {
              onChange(null)
            }}
          >
            {messages.remove}
          </Button>
        </Stack>
      </Stack>
    </FormControl>
  )
}
