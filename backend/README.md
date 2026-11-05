# Backend

FastAPI API with SQLAlchemy 2 and Alembic. The application package is `knut_vandrar_backend` under `src/`; API routes, schemas, database setup, models, and settings each have separate modules. From the repository root, start the full development stack with `./scripts/compose.sh up --build`. `src/knut_vandrar_backend/settings.py` validates and loads backend configuration. Compose builds its connection using `DATABASE_SERVICE_HOST`, `POSTGRES_INTERNAL_PORT`, and the PostgreSQL credentials; a host-run backend uses the existing `DATABASE_URL` and `POSTGRES_PORT` from the root `.env`. `API_HOST` and `API_PORT` control the API listener, while `BACKEND_PORT` selects its host-published port.

Create and activate a virtual environment, then install the development extras for Ruff, mypy, and pytest:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -c constraints.txt -e ".[dev]"
```

From this directory, use Ruff for formatting and linting, and mypy for static type checks:

```sh
python -m ruff format --check .
python -m ruff format .
python -m ruff check .
python -m ruff check --fix .
python -m mypy
python -m pytest
```

Tests use in-memory SQLite and do not need PostgreSQL.

Migrations are applied automatically at container startup. Create revisions from this directory with `alembic revision --autogenerate -m "describe the change"` and review them before use.
