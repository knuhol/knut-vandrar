import type { Metadata } from 'next'
import globalStyles from './globals.css'

const _globalStyles = globalStyles

export const metadata: Metadata = {
  title: 'Knut vandrar',
  description: 'A Full Stack Application for Knut vandrar',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
