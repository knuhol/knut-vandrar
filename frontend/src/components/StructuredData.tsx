type StructuredValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | StructuredValue[]
  | { [key: string]: StructuredValue }

export function StructuredData({ data }: { data: StructuredValue }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
