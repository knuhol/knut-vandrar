// Public browser configuration only. Never read server-only values here.

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL

if (!configuredApiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL must be configured before the frontend starts')
}

const parsedApiUrl = new URL(configuredApiUrl)
if (parsedApiUrl.username || parsedApiUrl.password) {
  throw new Error('NEXT_PUBLIC_API_URL must not include credentials')
}

export const publicConfig = Object.freeze({
  apiBaseUrl: configuredApiUrl.replace(/\/+$/, ''),
})
