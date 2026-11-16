# Frontend

Next.js 16 app using React 19, TypeScript, and Tailwind CSS 4. The recommended workflow is `docker compose up --build` from the repository root; the development container mounts this directory and enables hot reload. `FRONTEND_HOST` and `FRONTEND_INTERNAL_PORT` control the container bind address and listen port; `FRONTEND_PORT` controls its host-published port.

For local development outside Docker, use the Node runtime specified in the repository-root `.nvmrc`, then run `npm install` and `npm run dev` from this directory. `next.config.mjs` loads the repository-root `.env`; `src/config/public.ts` validates the public API URL used for browser-facing image URLs, and `src/config/server.ts` selects the server's API address. Values prefixed with `NEXT_PUBLIC_` are public and must never contain secrets. The frontend keeps no server-only credentials in browser configuration.

Shared components live in `src/components`; page-specific components live near their routes in `src/app/[locale]`. A component with a CSS Module has its own folder containing both files, such as `components/Markdown/Markdown.tsx` and `components/Markdown/Markdown.module.css`. Import the component file directly. Reuse the scales in `src/styles/tokens.css` for styling and keep UI copy in `src/i18n/messages.ts` for every supported locale. The `heroEyebrow` brand line describes long-distance hiking in Swedish, English, and Czech.

`Container` only supplies a centered content width and responsive horizontal gutters. Compose it inside native page sections, with child elements owning their layout and vertical spacing. The shared `main` stays full width; Hero and message pages manage their own layouts without `Container` or viewport-width escape rules.

Shared UI components own their styles and do not accept custom `className` or `style` props, with one exception: `Heading` accepts a single supported Tailwind text-size class, for example `<Heading className="text-3xl">`. Its allowed classes match the text-size tokens in `src/styles/tokens.css`; other classes, arbitrary values, inline styles, and a separate `size` prop are not supported. Headings retain their default sizes by semantic level when no class is provided. Use explicit variants for other supported visual differences, such as button variants, heading tones, logo sizes, and Markdown variants. Put surrounding layout and spacing on native wrapper elements so the library keeps a consistent appearance.

`Button` and `ButtonLink` share their base styling. Their `variant` controls only colors (`primary` for orange, `secondary` for forest), while `size` controls dimensions and text size (`small`, `medium`, or `large`, defaulting to `medium`). For example, use `<Button variant="secondary" size="small">`. Pill-shaped controls use the separate `Pill` and `PillLink` components, including pagination.

Use `ButtonLink stretched` inside a positioned card to extend the link's click and hover area across the card while keeping a single navigation control. Hike cards use this with `size="small"`; keyboard focus also activates the button's highlighted color.

Shared interactions live in `src/styles/interactions.css`. The `card-interactive` utility preserves HikeCard's lift-and-shadow hover effect for all interactive cards without changing background or border colors. Existing global focus outlines remain on their actual links and buttons. Text links share green text and a green underline on hover and keyboard focus while retaining their resting styles. `data-link-kind` identifies button, pill, brand, and whole-card links so the global text-link treatment does not decorate those entire controls; a card's `data-link-label` receives it instead. The common underline offset comes from `src/styles/tokens.css`.

The homepage requests one API page of at most 10 hikes and preserves the API's ordering and pagination metadata. Previous/Next links change the `offset` URL parameter and return to the hike collection. They do not prefetch additional pages. Collection-wide filtering is deferred to the archive.

ESLint uses the current stable ESLint and Unicorn releases. `@eslint/compat` preserves the React, accessibility, and import plugins while they migrate APIs removed in ESLint 10. The root `.npmrc` enables `legacy-peer-deps` for plugins whose peer declarations still exclude ESLint 10; the Docker build copies that configuration into the frontend image. Renamed Unicorn rules retain their configured severity and options.

After changing dependencies, update both lockfiles from the repository root:

```sh
npm install
npm --prefix frontend --userconfig "$PWD/.npmrc" install --package-lock-only --workspaces=false
```

The standalone lockfile command must load the root configuration explicitly because `--prefix frontend` does not inherit the root project's `.npmrc`.

## Tests

Tests live in `tests/specs`, outside the application routes. `jest.config.mjs` uses `next/jest` for TypeScript, JSX, CSS Modules, and asset handling, and maps the existing `@/` alias. Component tests use jsdom, React Testing Library, and jest-dom assertions configured in `tests/setup.ts`. Specs that need Node APIs declare `@jest-environment node`.

Run these from the repository root using the Node runtime from `.nvmrc`:

```sh
npm --workspace frontend test              # all specs, including admin integration
npm --workspace frontend run test:watch    # rerun affected specs while editing
npm --workspace frontend run test:ci       # noninteractive, at most two workers
npm --workspace frontend run test:admin    # only the admin specs
```

Date/time tests run in `Europe/Stockholm` to cover winter, summer, and daylight-saving transitions consistently on every machine. The fractional-hour-offset regression uses a separate Node process with `Asia/Kathmandu`, since changing Jest's virtual `process.env` does not change the runtime time zone.

Scrolling regressions live in `tests/specs/navigation/motion.spec.ts` and use controlled animation frames to cover completion, cancellation, replacement, anchor navigation state, and reduced motion without real-time delays. Markdown chapter regressions live in `tests/specs/components/collapsibleSections.spec.ts`. These replace the former `scripts/test-page-motion.mjs` checks.

The admin integration spec preserves the original HTTP checks. It starts temporary local Next.js and mock API servers with random credentials and throwaway SQLite session storage; it does not need Docker or a running backend. Keep this spec serial within its file and allow its server startup timeout. Use component tests for synchronous components and interactions; async server pages need integration or end-to-end coverage.
