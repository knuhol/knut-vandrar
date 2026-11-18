import { Montserrat, Source_Sans_3, Barlow_Condensed } from 'next/font/google'

export const heading = Montserrat({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-heading',
  weight: ['700'],
  display: 'swap',
})
export const body = Source_Sans_3({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-body',
  display: 'swap',
})
export const numbers = Barlow_Condensed({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-numbers',
  weight: ['500', '600'],
  display: 'swap',
})
