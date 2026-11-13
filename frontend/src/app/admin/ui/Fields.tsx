'use client'

import { useState } from 'react'
import { Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { EditorSection } from './EditorSection'
import { MonthField } from './MonthField'
import { DateTimeField } from './DateTimeField'
import { ReferenceField } from './ReferenceField'
import messages from '@/admin/messages/en.json'

import {
  orderedFields,
  fieldGroups,
  fieldWidgets,
  valuesEqual,
  referenceResources,
  text,
  initialValue,
  nonNull,
  record,
  resolve,
  type Json,
  type Schema,
} from '@/admin/resources'

interface FieldProps {
  schema: Schema
  bare?: boolean
  reference?: string
  value: Json
  baseline?: Json
  onChange: (value: Json) => void
  label: string
  required?: boolean
}

export function Fields({
  schema,
  value,
  baseline,
  onChange,
  label,
  reference,
  required = false,
  bare = false,
}: FieldProps) {
  const field = nonNull(schema)
  const [preview, setPreview] = useState(false)
  const labelText = label.replaceAll('_', ' ')
  const relation = reference || referenceResources[label]
  if (fieldWidgets[label] === 'months') {
    return <MonthField value={value} onChange={onChange} />
  }
  if (relation && field.type !== 'array') {
    return (
      <ReferenceField
        resource={relation}
        value={value}
        onChange={onChange}
        required={required}
        label={label}
      />
    )
  }
  if (field.oneOf) {
    const options = field.oneOf.map((option) => {
      const resolved = resolve(option)
      return {
        ...resolved,
        properties: Object.fromEntries(
          Object.entries(resolved.properties || {}).map(([key, child]) => [key, resolve(child)]),
        ),
      }
    })
    const current = record(value)
    const selected =
      options.find((option) => option.properties.type.const === current.type) || options[0]
    return (
      <Stack spacing={2}>
        <TextField
          select
          label={`${labelText} type`}
          value={text(current.type || selected.properties.type.const || '')}
          onChange={(event) => {
            const next = options.find(
              (option) => option.properties.type.const === event.target.value,
            )
            if (next) {
              onChange(initialValue(next))
            }
          }}
        >
          {options.map((option) => (
            <MenuItem
              key={text(option.properties.type.const)}
              value={text(option.properties.type.const)}
            >
              {text(option.properties.type.const).replaceAll('_', ' ')}
            </MenuItem>
          ))}
        </TextField>
        <Fields schema={selected} value={value} onChange={onChange} label={label} />
      </Stack>
    )
  }
  if (field.properties) {
    const current = record(value)
    const groups = fieldGroups(field)
    if (groups.length > 0) {
      return (
        <Stack spacing={2}>
          {groups.map((group) => {
            const properties = Object.fromEntries(
              group.fields
                .filter((key) => field.properties && key in field.properties)
                .map((key) => [key, field.properties?.[key] || {}]),
            )
            const entries = Object.entries(properties)
            const single =
              entries.length === 1 && nonNull(entries[0][1]).properties ? entries[0] : undefined
            return (
              <EditorSection
                key={group.title}
                title={messages.editorSections[group.title]}
                dirty={
                  baseline !== undefined &&
                  group.fields.some((key) => !valuesEqual(current[key], record(baseline)[key]))
                }
              >
                <Fields
                  schema={
                    single ? single[1] : { type: 'object', properties, required: field.required }
                  }
                  value={single ? (current[single[0]] ?? null) : value}
                  baseline={single ? record(baseline)[single[0]] : baseline}
                  label={messages.editorSections[group.title]}
                  onChange={(next) => {
                    onChange(single ? { ...current, [single[0]]: next } : next)
                  }}
                  bare
                />
              </EditorSection>
            )
          })}
        </Stack>
      )
    }
    const grid = (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 3,
        }}
      >
        {orderedFields(field)
          .filter(([, child]) => resolve(child).const === undefined)
          .map(([key, child]) => (
            <Box
              key={key}
              sx={{
                minWidth: 0,
                gridColumn:
                  nonNull(child).properties ||
                  nonNull(child).type === 'array' ||
                  key.includes('markdown')
                    ? '1 / -1'
                    : undefined,
              }}
            >
              <Fields
                schema={child}
                value={current[key] ?? null}
                baseline={record(baseline)[key]}
                onChange={(next) => {
                  onChange({ ...current, [key]: next })
                }}
                label={key}
                required={field.required?.includes(key)}
                bare={bare && orderedFields(field).length === 1}
              />
            </Box>
          ))}
      </Box>
    )
    if (bare) {
      return grid
    }
    return (
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
        <Stack spacing={3}>
          <Typography variant="h6" component="h3">
            {labelText}
          </Typography>
          {grid}
        </Stack>
      </Paper>
    )
  }
  if (field.type === 'array' && field.items) {
    const items = field.items
    const current = Array.isArray(value) ? value : []
    const addButton = (
      <Button
        variant="outlined"
        onClick={() => {
          onChange([...current, initialValue(items)])
        }}
      >
        {messages.add}
        {labelText}
      </Button>
    )
    return (
      <Stack spacing={2}>
        {!bare && <Typography component="h3">{labelText}</Typography>}
        {current.map((entry, index) => (
          <Stack key={index} spacing={1}>
            <Fields
              schema={items}
              reference={relation}
              value={entry}
              label={`${labelText} ${text(index + 1)}`}
              onChange={(next) => {
                onChange(current.map((item, position) => (position === index ? next : item)))
              }}
              required
            />
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Button
                color="error"
                variant="outlined"
                onClick={() => {
                  onChange(current.filter((_, position) => position !== index))
                }}
              >
                {messages.remove}
              </Button>
              {index === current.length - 1 && addButton}
            </Stack>
          </Stack>
        ))}
        {current.length === 0 && <Stack direction="row">{addButton}</Stack>}
      </Stack>
    )
  }
  const enumValues = field.enum || (field.type === 'boolean' ? [true, false] : undefined)
  if (enumValues) {
    return (
      <TextField
        select
        label={labelText}
        required={required}
        value={value === null ? '' : text(value)}
        onChange={(event) => {
          onChange(enumValues.find((option) => text(option) === event.target.value) ?? null)
        }}
      >
        {!required && <MenuItem value="">{messages.notSpecified}</MenuItem>}
        {enumValues.map((option) => (
          <MenuItem key={text(option)} value={text(option)}>
            {text(option).replaceAll('_', ' ')}
          </MenuItem>
        ))}
      </TextField>
    )
  }
  if (field.format === 'date-time') {
    return (
      <DateTimeField
        value={typeof value === 'string' ? value : null}
        label={labelText}
        required={required}
        onChange={onChange}
      />
    )
  }
  const markdown = label.includes('markdown')
  const numeric = field.type === 'number' || field.type === 'integer'
  return (
    <Stack spacing={1}>
      <TextField
        label={labelText}
        required={required}
        value={value ?? ''}
        multiline={markdown || label.includes('note') || label === 'description'}
        minRows={markdown ? 4 : undefined}
        type={numeric ? 'number' : field.format === 'date' ? 'date' : 'text'}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: {
            min: field.minimum,
            max: field.maximum,
            minLength: field.minLength,
            maxLength: field.maxLength,
            step: field.type === 'integer' ? 1 : 'any',
          },
        }}
        onChange={(event) => {
          onChange(
            event.target.value === ''
              ? null
              : numeric
                ? Number(event.target.value)
                : event.target.value,
          )
        }}
      />
      {markdown && (
        <>
          <Button
            variant="text"
            onClick={() => {
              setPreview(!preview)
            }}
          >
            {preview ? messages.hidePreview : messages.previewMarkdown}
          </Button>
          {preview && (
            <Box sx={{ overflowWrap: 'anywhere', '& p + p': { mt: 2 } }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text(value || '')}</ReactMarkdown>
            </Box>
          )}
        </>
      )}
    </Stack>
  )
}
