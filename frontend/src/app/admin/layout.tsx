import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'

import '../globals.css'
import { AdminTheme } from './ui/AdminTheme'
import { EnvironmentBanner } from './ui/EnvironmentBanner'

import { serverConfig } from '@/config/server'

const roboto = Roboto({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-admin-roboto',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Admin | knut-vandrar',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`admin-theme ${roboto.variable}`}>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <AdminTheme>
            <EnvironmentBanner environment={serverConfig.deploymentEnvironment} />
            {children}
          </AdminTheme>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
