# Backend

FastAPI API with SQLAlchemy 2 and Alembic. The application package is `knut_vandrar_backend` under `src/`; API routes, schemas, database setup, models, translation adapters, and settings each have separate modules. Hikes and reusable trails are exposed through public CRUD routes. Hike localized content has English source text plus stored Swedish and Czech translations; optional information cards use a typed API union backed by PostgreSQL JSONB. From the repository root, start the full development stack with `./scripts/compose.sh up --build`. `src/knut_vandrar_backend/settings.py` validates and loads backend configuration. Compose builds its connection using `DATABASE_SERVICE_HOST`, `POSTGRES_INTERNAL_PORT`, and the PostgreSQL credentials; a host-run backend uses the existing `DATABASE_URL` and `POSTGRES_PORT` from the root `.env`. `API_HOST` and `API_PORT` control the API listener, while `BACKEND_PORT` selects its host-published port.

Trail logos and hike cover images are stored as image bytes in PostgreSQL. `PUT /api/trails/{trail_id}/logo` and `PUT /api/hikes/{hike_id}/cover-image` accept a raw image body (`application/octet-stream`); supported formats are PNG, JPEG, GIF, WebP, and SVG, up to 5 MiB. Trail responses include an absolute `logo_url`, and hike list/detail responses include an absolute `cover_image_url`; those URLs are served by the matching `GET` endpoints. Replace an image by uploading another image to the same endpoint, or remove it with the matching `DELETE` endpoint. For example, after creating a trail and saving its ID:

```sh
curl --fail-with-body --request PUT "$API_URL/api/trails/$TRAIL_ID/logo" \
  --header 'Content-Type: application/octet-stream' \
  --data-binary @trail-logo.svg
```

Hike records may also include optional `start_point` and `end_point` text. The `youtube_video` info card accepts YouTube URLs, including `youtube.com` and `youtu.be` links.

```sh
curl --fail-with-body --request PUT "$API_URL/api/hikes/$HIKE_ID/cover-image" \
  --header 'Content-Type: application/octet-stream' \
  --data-binary @hike-cover.webp
```

The translation worker uses `OPENAI_API_KEY` and the translation profiles and glossary stored in the database. It queues translations on English content changes, preserves earlier translation versions, and serves outdated localized content while replacements are generated. To enqueue missing, outdated, or `needs_retranslation` translations, run `npm run translations:retranslate` from the repository root or `make translations-retranslate`; the backend container must be running.

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

Migrations are applied automatically at container startup. While the schema is being refined, the current schema is maintained as a single Alembic baseline for fresh databases. Existing databases that recorded the previous migration revisions must be recreated before using this baseline. Create future revisions from this directory with `alembic revision --autogenerate -m "describe the change"` and review them before use.
