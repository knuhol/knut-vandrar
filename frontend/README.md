# Frontend

Next.js 15 app using React, TypeScript, and Tailwind CSS. The recommended workflow is `docker compose up --build` from the repository root; the development container mounts this directory and enables hot reload. `FRONTEND_HOST` and `FRONTEND_INTERNAL_PORT` control the container bind address and listen port; `FRONTEND_PORT` controls its host-published port.

For local development outside Docker, run `npm install` and `npm run dev` from this directory. `next.config.js` loads the repository-root `.env`; `src/config/public.ts` validates the public API URL, which the home page uses for its API health indicator. Values prefixed with `NEXT_PUBLIC_` are public and must never contain secrets. The frontend keeps no server-only credentials in browser configuration.
