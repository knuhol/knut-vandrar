'use client'

import { createTheme, ThemeProvider, ScopedCssBaseline } from '@mui/material'

const theme = createTheme({
  cssVariables: {
    nativeColor: true,
    rootSelector: '.admin-theme',
    colorSchemeSelector: '.admin-theme',
  },
  palette: { mode: 'dark' },
  spacing: (factor: number) => `calc(var(--spacing) * ${String(factor)} * 2)`,
  typography: {
    fontFamily: 'var(--font-admin-roboto), "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 'var(--radius-sm)' } } },
    MuiButton: {
      defaultProps: { variant: 'contained' },
      styleOverrides: { root: { alignSelf: 'flex-start', width: 'fit-content', maxWidth: '100%' } },
    },
    MuiTextField: { defaultProps: { fullWidth: true } },
  },
})

export function AdminTheme({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <ScopedCssBaseline
        enableColorScheme
        className="admin-theme"
        sx={{ minHeight: '100svh', bgcolor: 'background.default' }}
      >
        {children}
      </ScopedCssBaseline>
    </ThemeProvider>
  )
}
