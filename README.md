# knut-vandrar

A Docker-first starter for a travel companion application. The stack is Next.js 16, React 19, TypeScript, Tailwind CSS 4, FastAPI, SQLAlchemy 2, Alembic, and PostgreSQL 18.

Runtime versions are defined only in `.nvmrc` and `.python-version`, and CI reads those files. Docker builds use the official Node Alpine and Python slim images with the versions from those files. `./scripts/compose.sh` exports `NODE_VERSION` and `PYTHON_VERSION` for Compose; use it because the Compose files require both build arguments. Use `nvm install` and `nvm use` locally; Python version managers such as pyenv can read `.python-version`.

npm saves exact dependency versions via `.npmrc`; keep direct dependency pins exact and synchronize both npm lockfiles when updating them. Python installs use `backend/constraints.txt` to pin transitive dependencies; keep it aligned with the pins in `pyproject.toml` and `requirements.txt`.

## Start the application

Install Docker Desktop (or Docker Engine with the Compose plugin), then run this from the repository root:

```sh
# First run only, and only if .env does not already exist.
cp .env.example .env
./scripts/compose.sh up --build
```

Compose starts PostgreSQL, waits for its health check, applies Alembic migrations, then starts the API, translation worker, and frontend. `.env` is the source for local configuration. `.env.example` has the same variables and structure with safe local placeholders. The PostgreSQL database name, user, and password are required. Set `OPENAI_API_KEY` to enable automatic translations; without it, the worker leaves queued translations untouched. The existing host-run `DATABASE_URL` is preserved; Compose creates its container URL from the PostgreSQL variables because containers use Docker service DNS rather than the host address.

The root npm shortcut for the foreground startup command above is `npm run dev`. Other root shortcuts are listed below.

Use the configured host ports from `.env` (shown here with the template defaults):

- Frontend: `http://localhost:${FRONTEND_PORT}`
- API: `http://localhost:${BACKEND_PORT}`
- API docs: `http://localhost:${BACKEND_PORT}/docs`
- API health: `http://localhost:${BACKEND_PORT}/health` (also `/api/health`)

`FRONTEND_PORT`, `BACKEND_PORT`, and `POSTGRES_PORT` are host-published ports. `FRONTEND_INTERNAL_PORT`, `API_PORT`, and `POSTGRES_INTERNAL_PORT` configure the ports inside the containers. The browser uses the public `NEXT_PUBLIC_API_URL`; the backend container uses `DATABASE_SERVICE_HOST` and PostgreSQL's internal port. `127.0.0.1` in the backend health check refers to the backend container itself.

Stop the foreground services with `Ctrl+C`, or run `./scripts/compose.sh down` (shortcut: `npm stop`) to remove containers while preserving volumes. PostgreSQL data persists in the named `postgres_data_v18` volume. `./scripts/compose.sh down -v` removes all project volumes, including the database and frontend caches; use it only when you intentionally want to reset local container data.

### Root npm scripts

Run these commands from the repository root:

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds and starts the Compose stack in the foreground. |
| `npm run build` | Builds the Compose service images without starting them. |
| `npm start` | Starts the Compose stack in the background without forcing an image rebuild. |
| `npm stop` | Stops and removes the Compose containers while preserving volumes. |
| `npm run fresh` | Removes the Compose containers and **all project volumes**, then rebuilds and starts the stack. This deletes local database and other volume data. |
| `npm run install:all` | Installs npm workspace dependencies and backend Python requirements for local development outside Docker. Activate `backend/.venv` first. |
| `npm run translations:retranslate` | Queues missing, outdated, and `needs_retranslation` hike translations for the worker. Requires the stack to be running. |

The Compose commands in this table use `scripts/compose.sh`, which supplies the Node and Python build versions from `.nvmrc` and `.python-version`.

## VPS deployment

See [the VPS deployment guide](docs/vps-deployment.md) for production and development deployment, Traefik routing, public database ports, GitHub setup, and VPS preparation.

## Database backups and restores

Use [`scripts/db-backup.sh`](scripts/db-backup.sh) and [`scripts/db-restore.sh`](scripts/db-restore.sh) to back up or replace the local, dev, or production database. See the [backup and restore guide](docs/database-backups.md) for configuration and safe restore instructions.

## Development

The frontend source and backend source are mounted into their development containers. Next.js and Uvicorn reload when files change. On frontend startup, the container compares the package manifests with a hash saved in its `node_modules` volume and runs `npm ci` if dependencies have changed; this keeps persistent volumes in sync after rebuilds. Database migrations run automatically each time the backend container starts. `CORS_ORIGINS` controls allowed browser origins. The frontend validates and uses `NEXT_PUBLIC_API_URL` for its API health request; it is browser-visible and must not contain credentials or other secrets.

Hike text is authored in English and translated into Swedish and Czech by the background worker. The generated locale is published immediately; when a translation is missing it is omitted, and an older translation remains available while a newer version is queued. Translation profiles and glossary entries live in the database (`translation_profiles` and `translation_glossary_entries`) and can be maintained directly there. Set a translation's `review_status` to `needs_retranslation` to flag it. Then run `npm run translations:retranslate` (or `make translations-retranslate`) to queue every missing, outdated, or flagged translation. New English content changes are queued automatically.

## API schema and typed frontend client

FastAPI is the source of truth for the API contract and serves its OpenAPI document at `/openapi.json`. The frontend uses the [feTS client](https://www.fets.dev/) with a generated TypeScript OpenAPI constant; the API client takes its endpoint from `NEXT_PUBLIC_API_URL`.

feTS is a TypeScript client library, so it is installed in `frontend/`. The backend remains FastAPI and uses its built-in `app.openapi()` method; no feTS Python package or server is needed. The exporter imports the FastAPI app directly, so schema generation does not require a running PostgreSQL connection.

After creating `backend/.venv`, installing `backend`'s `[dev]` dependencies, activating that environment, and creating the project `.env`, generate the checked-in client schema from the repository root:

```sh
npm --workspace frontend run generate:api
```

Check that the committed generated file matches the current backend schema:

```sh
npm --workspace frontend run check:api
```

When the Docker Compose stack is running, generate using the backend container's Python environment and the host-mounted frontend source:

```sh
make generate-api-docker
```

The generated `frontend/src/generated/openapi.ts` is committed. CI and `make check` verify it is current. After changing API routes or response/request models, regenerate the schema and include the updated file with the backend change. feTS itself does not require client code generation; this small exporter serializes FastAPI's OpenAPI output as a TypeScript `as const` document so feTS can infer the API types as its documented client workflow expects.

Run backend tests locally from the repository root:

```sh
cd backend
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -c constraints.txt -e ".[dev]"
python -m pytest
```

Tests use an isolated in-memory SQLite database. To run them inside Docker while the stack is up:


```sh
./scripts/compose.sh exec backend pytest
```

Create a new database migration from `backend/` with:

```sh
alembic revision --autogenerate -m "describe the change"
```

Review generated migrations before committing them.

## Formatting, linting, tests, and CI

Prettier formats the frontend. Ruff formats and lints the backend, and mypy checks its types. Run these commands from the repository root:

```sh
make format-check # check both applications without modifying files
make format-fix   # apply formatting to both applications
make lint         # run frontend and backend lint checks
make test         # run configured tests (currently backend pytest)
make check        # run formatting checks, linting, and tests
```

The frontend has no test suite configured yet; its test command is skipped until one is added. Backend tests use in-memory SQLite. GitHub Actions runs frontend, backend, and Docker build/health checks on pull requests targeting `main` or `dev`, on pushes to `main`, and when manually dispatched (manual runs perform checks only). Successful `dev` → `main` pull requests deploy the proposed commit to development; pushes to `main` deploy production. The promotion workflow opens the `dev` → `main` pull request, and another workflow resets the `dev` branch to the merged `main` commit. Because the promotion PR is created with `GITHUB_TOKEN`, GitHub may hold its pull request checks for maintainer approval; approve them from the pull request banner. CI and deployment do not commit source changes.

## Project layout

```text
frontend/          Next.js app and Tailwind styles
frontend/scripts/  Frontend container entrypoint
backend/src/knut_vandrar_backend/ FastAPI app, routes, schemas, models, and database code
backend/alembic/   Database migration environment and revisions
backend/scripts/   Backend schema exporter
backend/tests/     API tests
scripts/           Compose, deployment, and database backup/restore tooling
docker-compose.yml Local development services and persistent volumes
```
