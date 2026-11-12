# Backend

FastAPI API with SQLAlchemy 2 and Alembic. The application package is `knut_vandrar_backend` under `src/`; API routes, schemas, database setup, models, translation adapters, and settings each have separate modules. Hikes and reusable trails are exposed through public CRUD routes. Hike localized content has English source text plus stored Swedish and Czech translations; optional information cards use a typed API union backed by PostgreSQL JSONB. From the repository root, start the full development stack with `./scripts/compose.sh up --build`. `src/knut_vandrar_backend/settings.py` validates and loads backend configuration. Compose builds its connection using `DATABASE_SERVICE_HOST`, `POSTGRES_INTERNAL_PORT`, and the PostgreSQL credentials; a host-run backend uses the existing `DATABASE_URL` and `POSTGRES_PORT` from the root `.env`. `API_HOST` and `API_PORT` control the API listener, while `BACKEND_PORT` selects its host-published port.

Trail logos and hike cover images are stored as image bytes in PostgreSQL. `PUT /api/locations/{location_id}/logo` and `PUT /api/hikes/{hike_id}/cover-image` accept a raw image body (`application/octet-stream`); supported formats are PNG, JPEG, GIF, WebP, and SVG, up to 5 MiB. Trail responses include an absolute `logo_url`, and hike list/detail responses include an absolute `cover_image_url`; those URLs are served by the matching `GET` endpoints. Replace an image by uploading another image to the same endpoint, or remove it with the matching `DELETE` endpoint. For example, after creating a trail and saving its ID:

```sh
curl --fail-with-body --request PUT "$API_URL/api/locations/$LOCATION_ID/logo" \
  --header 'Content-Type: application/octet-stream' \
  --data-binary @trail-logo.svg
```

Hike records may also include optional `start_point` and `end_point` text. The `youtube_video` info card accepts YouTube URLs, including `youtube.com` and `youtu.be` links.

```sh
curl --fail-with-body --request PUT "$API_URL/api/hikes/$HIKE_ID/cover-image" \
  --header 'Content-Type: application/octet-stream' \
  --data-binary @hike-cover.webp
```

The translation worker uses `OPENAI_API_KEY` and the translation profiles and glossary stored in the database. It queues translations on English content changes, preserves earlier translation versions, and serves outdated localized content while replacements are generated. To enqueue only translations explicitly marked `needs_retranslation`, run `npm run translations:retranslate` from the repository root or `make translations-retranslate`; the backend container must be running. Repeated calls skip queued or running jobs. Missing translations and English content changes are queued automatically. After changing worker code, restart the translation-worker service so it uses the same profile fingerprint and request settings as the backend.

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

Migrations are applied automatically at container startup. Revision 004 migrates existing trails into hiking locations without replacing IDs, logos, country associations, or hike translations. It also supports fresh databases through the existing migration chain. Back up before upgrading; reversal requires restoring that backup. Create future revisions from this directory with `alembic revision --autogenerate -m "describe the change"` and review them before use.

Translation requests use `OPENAI_REQUEST_TIMEOUT_SECONDS` from the root `.env` (default: 600 seconds). This is a network inactivity timeout, not a strict total generation deadline. Increase it for slower high-effort translations. Recreate the translation-worker service after changing its environment settings.

## Hiking content and upcoming administration

`/api/locations` replaces `/api/trails`; hikes now reference `location_id` and return
`location`. Locations have kind `trail` or `area`, multiple enum terrain values,
translated regions, waymarking, loop/Arctic Circle attributes, hiking months, and
practical options. Facilities use explicit `unknown` / `known` states: known with
an empty collection means none identified. Ratings use integers 0–10, representing
half-star units; null means unassessed. Localized notes render each non-empty line
separately in the frontend.

`/api/regions` and `/api/achievements` provide typed CRUD contracts. Achievements
are manually authored text with enum icons and explicit ordering, not automatically
awarded. Hikes support paired coordinates, decimal kilometres, stage ranges in
either direction, route scope, and one set of overnight counts. Set
`overnights_recorded_at` when recording counts, including an explicitly empty set.

All authored content uses English source text and queues Swedish/Czech translations.
`PUT /api/{locations|regions|achievements}/{id}/translations/{locale}` accepts the
same text fields as that entity's `english` object and protects them in `manual`
state. Hikes use `PUT /api/hikes/{id}/translations/{locale}` similarly. To release a
manual override, explicitly change its state through the corresponding `/review`
endpoint; use `needs_retranslation` to request a replacement (hikes also support
the existing retranslation CLI). Manual content can become outdated but cannot be
overwritten by queued or in-flight automatic jobs. Authored translation versions
are retained, and untranslated reusable content falls back to English with metadata
identifying the returned language.

Development content is inserted once outside the repository. There is no application
seed routine or development fixture executed by migrations. Required language,
information-card and translation-profile configuration remains in the migration chain.
The checked-in FastAPI OpenAPI export is the frontend contract; regenerate it with
`python scripts/export_openapi.py` and verify with `--check` after API changes.


## Backend write authentication

GET/HEAD reads are public. Every POST, PUT, PATCH and DELETE API operation inherits
Bearer authentication through the application's global dependency, including image
uploads, translation overrides, review-state changes and new routers. Browser CORS
preflight remains available. Write operations advertise `AdminBearer` in OpenAPI;
public reads do not require it.

Set `API_WRITE_TOKEN` in the root `.env` to a cryptographically random URL-safe token
of 43–128 characters. Keep it server-only: never use `NEXT_PUBLIC_`, send it in a URL,
embed it in the frontend, or log it. The setting is omitted from settings repr output.
An absent/empty setting disables writes with HTTP 503 while reads and health checks
continue working. Explicit invalid configuration prevents startup. Missing, malformed,
or incorrect credentials return HTTP 401 and `WWW-Authenticate: Bearer`.

Use `Authorization: Bearer <token>` over HTTPS in production. Rotate by updating the
private environment value and recreating the backend service to load it; the old token
then ceases to work. Compose forwards this secret only to the backend, including VPS
configuration. Each environment should have a different token. This is a single shared
administrator credential, with no browser login, sessions, user roles or ACLs yet.
The future admin server can hold it privately while authenticating browsers separately.

`POST /api/translations/requeue` requires the same Bearer token and no request body.
It calls the same service as the retranslation CLI and returns `{"queued": N,
"skipped": N}` after committing the queued jobs. Only entries explicitly marked
`needs_retranslation` are considered; `skipped` counts entries already queued/running
for the current source/profile. Manual overrides and merely outdated content are not
selected. Translation requests are performed by the existing worker, not this endpoint.
CLI usage is unchanged and does not require an HTTP token.
