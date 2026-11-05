# Frontend

Next.js 16 app using React 19, TypeScript, and Tailwind CSS 4. The recommended workflow is `docker compose up --build` from the repository root; the development container mounts this directory and enables hot reload. `FRONTEND_HOST` and `FRONTEND_INTERNAL_PORT` control the container bind address and listen port; `FRONTEND_PORT` controls its host-published port.

For local development outside Docker, run `npm install` and `npm run dev` from this directory. `next.config.mjs` loads the repository-root `.env`; `src/config/public.ts` validates the public API URL, which the home page uses for its API health indicator. Values prefixed with `NEXT_PUBLIC_` are public and must never contain secrets. The frontend keeps no server-only credentials in browser configuration.

ESLint uses the current stable ESLint and Unicorn releases. `@eslint/compat` preserves the React, accessibility, and import plugins while they migrate APIs removed in ESLint 10. The npm ESLint overrides in the root and frontend manifests resolve their older peer declarations to the pinned ESLint version; keep these aligned, and remove the compatibility setup when upstream plugins support ESLint 10 directly. Renamed Unicorn rules retain their configured severity and options.
