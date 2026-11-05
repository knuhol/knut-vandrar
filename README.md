# knut-vandrar

A Docker-first starter for a travel companion application. The stack is Next.js 15, React, TypeScript, Tailwind CSS, FastAPI, SQLAlchemy 2, Alembic, and PostgreSQL 16.

## Start the application

Install Docker Desktop (or Docker Engine with the Compose plugin), then run this from the repository root:

```sh
# First run only, and only if .env does not already exist.
cp .env.example .env
docker compose up --build
```

Compose starts PostgreSQL, waits for its health check, applies Alembic migrations, then starts the reloading API and frontend. `.env` is the source for local configuration. `.env.example` has the same variables and structure with safe local placeholders. The PostgreSQL database name, user, and password are required. The existing host-run `DATABASE_URL` is preserved; Compose creates its container URL from the PostgreSQL variables because containers use Docker service DNS rather than the host address.

Use the configured host ports from `.env` (shown here with the template defaults):

- Frontend: `http://localhost:${FRONTEND_PORT}`
- API: `http://localhost:${BACKEND_PORT}`
- API docs: `http://localhost:${BACKEND_PORT}/docs`
- API health: `http://localhost:${BACKEND_PORT}/health` (also `/api/health`)

`FRONTEND_PORT`, `BACKEND_PORT`, and `POSTGRES_PORT` are host-published ports. `FRONTEND_INTERNAL_PORT`, `API_PORT`, and `POSTGRES_INTERNAL_PORT` configure the ports inside the containers. The browser uses the public `NEXT_PUBLIC_API_URL`; the backend container uses `DATABASE_SERVICE_HOST` and PostgreSQL's internal port. `127.0.0.1` in the backend health check refers to the backend container itself.

Stop the services with `Ctrl+C`; use `docker compose down` to remove containers. PostgreSQL data persists in the named `postgres_data` volume. `docker compose down -v` removes that data.

## Development

The frontend source and backend source are mounted into their development containers. Next.js and Uvicorn reload when files change. On frontend startup, the container compares the package manifests with a hash saved in its `node_modules` volume and runs `npm ci` if dependencies have changed; this keeps persistent volumes in sync after rebuilds. Database migrations run automatically each time the backend container starts. `CORS_ORIGINS` controls allowed browser origins. The frontend validates and uses `NEXT_PUBLIC_API_URL` for its API health request; it is browser-visible and must not contain credentials or other secrets.

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
python -m pip install -e ".[dev]"
python -m pytest
```

Tests use an isolated in-memory SQLite database. To run them inside Docker while the stack is up:

```sh
docker compose exec backend pytest
```

Create a new database migration from `backend/` with:

```sh
alembic revision --autogenerate -m "describe the change"
```

Review generated migrations before committing them.

## Formatting, linting, tests, and CI

Prettier formats the frontend, and Ruff formats and lints the backend. Run these commands from the repository root:

```sh
make format-check # check both applications without modifying files
make format-fix   # apply formatting to both applications
make lint         # run frontend and backend lint checks
make test         # run configured tests (currently backend pytest)
make check        # run formatting checks, linting, and tests
```

The frontend has no test suite configured yet; its test command is skipped until one is added. Backend tests use in-memory SQLite. GitHub Actions runs frontend and backend CI jobs in parallel for all branch pushes, pull requests, and manual runs. CI only checks formatting and never writes source files.

To apply formatting automatically, open **Actions → Format → Run workflow**. This workflow applies Prettier and Ruff fixes, then opens a pull request only when files changed. It does not push changes directly to the default branch. For pull request creation, enable **Allow GitHub Actions to create and approve pull requests** under **Settings → Actions → General → Workflow permissions**; the workflow's token is limited to repository contents and pull requests.

## Project layout

```text
frontend/          Next.js app and Tailwind styles
backend/src/       FastAPI routes, SQLAlchemy models, and DB sessions
backend/alembic/   Database migration environment and revisions
backend/tests/     API tests
docker-compose.yml Local development services and persistent volumes
```
