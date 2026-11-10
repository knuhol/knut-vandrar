# Project instructions

- Keep the Docker-first Next.js/React/TypeScript/Tailwind frontend and FastAPI/SQLAlchemy/Alembic backend architecture simple.
- Pin every direct npm and Python dependency to an exact stable version. Never introduce caret, tilde, wildcard, or dependency version ranges. Update both npm lockfiles with manifest changes. Pin Python transitive dependencies in `backend/constraints.txt` and use it for all installs. Python runtime compatibility constraints are not dependency pins.
- `.nvmrc` is the only source of the Node runtime version. `.python-version` is the only source of the Python runtime version. Docker and CI must read those files; do not duplicate runtime versions elsewhere.
- Preserve ESLint rules and their severity/options whenever possible. Change only what is necessary for dependency compatibility, and explain any such change. Fix application violations instead of disabling checks.
- Use the root `.env` for local configuration. Never overwrite existing values, print secrets, or commit environment files. Keep `.env.example` accurate with safe placeholders.
- Centralize backend and frontend configuration. Only intentionally public browser values may use `NEXT_PUBLIC_`. Distinguish browser URLs, host ports, and Docker-internal service addresses.
- Keep FastAPI as the API schema source of truth. Regenerate the checked-in feTS schema when API contracts change and verify reproducibility.
- Preserve persistent database data. Back up and migrate before PostgreSQL major upgrades; never remove volumes without explicit authorization.
- Keep `docker compose up --build` working, with frontend/backend reload and health checks.
- Verify changes with checks relevant to the task. Do not start, restart, or check running Docker containers automatically at task completion. Run Docker container verification only when the user explicitly requests it; if task scope suggests it is needed, ask first. Avoid redundant test runs after checks pass unless something changes.
- Do not commit, push, publish, or send messages to others without explicit authorization.
- Inspect existing work and preserve unrelated changes. Use `rg` for searches and report changes, verification, and remaining limitations clearly.

## Frontend instructions

- Prefer Tailwind utilities for component styling whenever practical.
- Keep `frontend/src/app/globals.css` limited to essential global rules that cannot be handled through Tailwind configuration or component styling. Prefer removing it when no such rules remain.
- Use the frontend design-token CSS file as the source of truth for spacing, font sizes, colors, and other design values. Never hardcode these values when a token exists. If a needed token does not exist, add a reusable variable to the token file instead of introducing a one-off value.
- Put component-specific CSS in a colocated CSS Module named after its React component, such as `Hero.tsx` and `Hero.module.css`. Keep global selectors and styles out of component modules unless they are required for that component.
- Name React component files with an uppercase initial letter.
- Add a blank line before every `export function` declaration.
- Keep generic components in `frontend/src/components` limited to components shared across the site. Put site-specific components in the app directory near the `page.tsx` that uses them.
- Never hardcode English UI text in components. Add UI strings to the locale message files and provide initial translations for every supported locale.
- Avoid repeated UI and logic; extract reusable components when that makes the code clearer.
- Build toward a component library: prefer configurable shared components, such as buttons, over repeated hardcoded implementations.
