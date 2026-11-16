# VPS deployment

The CI workflow deploys successful `dev` commits to `dev.vandrar.se` and successful `main` commits to `knut.vandrar.se`. The production workflow is ready before DNS is moved; the domain will begin resolving to the VPS only after its DNS record is changed.

## VPS preparation

Run these steps as the account that owns Docker deployments. Replace `<repository-url>` with the repository's SSH clone URL.

1. Confirm the Traefik Docker network name:

   ```sh
   docker network ls
   ```

   The deployment Compose files use the dedicated `vandrar_web-net` network. Traefik must be attached to it; your inspection confirmed that it is already connected. The network name, domains, Traefik entrypoint, and certificate resolver are fixed in the Compose routing overlays, not configured in the environment files.

2. Create independent checkouts:

   ```sh
   sudo mkdir -p /srv/knut-vandrar /etc/knut-vandrar
   sudo chown -R "$USER":"$USER" /srv/knut-vandrar
   git clone <repository-url> /srv/knut-vandrar/dev
   git clone <repository-url> /srv/knut-vandrar/prod
   ```

   Configure a read-only deploy key for these checkouts if the repository is private. The deploy account needs Docker access and permission to bind the PostgreSQL ports.

3. Create the environment files outside the repository. The checked-in dev and production templates mirror the complete root `.env.example` key set and add environment-specific preset values. Copy the matching template and replace the placeholder password with a unique random hexadecimal value (for example, `openssl rand -hex 32`; this is safe in Compose env files):

   - `.env.vps.development.example` → `/etc/knut-vandrar/development.env`
   - `.env.vps.production.example` → `/etc/knut-vandrar/production.env`

   Protect them with `chmod 600`. Set `OPENAI_API_KEY` in each environment file to enable automatic translation there; if it is blank, translations remain queued until a key is configured. The Compose projects publish PostgreSQL on TCP `5433` (development) and `5432` (production), respectively. Configure the VPS firewall to allow those ports only from the addresses that need database access. Do not reuse passwords across environments. Keep each template's runtime image settings aligned with the checked-in `.nvmrc` and `.python-version`; the deploy script reads those files and supplies their versions as build arguments.

4. Ensure Traefik and these Compose projects share the `vandrar_web-net` external Docker network. The web containers have no host-published ports; Traefik routes HTTPS requests for each domain to the frontend and `/api` paths to FastAPI. PostgreSQL remains directly reachable on its published host port.

5. Confirm the DNS A/AAAA record for `dev.vandrar.se` points to the VPS. Production DNS for `knut.vandrar.se` can remain unchanged until ready.

## Gallery media storage (`/media`)

The current deployment uses a Docker-managed named volume for gallery files. No
manual `mkdir /media`, host directory ownership changes, or additional server mount
is required. During the normal deployment, Compose creates each environment's volume
if it does not already exist and mounts it into the backend container:

```yaml
environment:
  MEDIA_ROOT: /media
volumes:
  - gallery_media:/media
```

This configuration lives in `docker-compose.vps.yml`. The deployment script selects
separate Compose project names, so the actual volumes are independent:

| Environment | Docker volume | Path inside its backend container |
| --- | --- | --- |
| Dev | `knut-vandrar-dev_gallery_media` | `/media` |
| Production | `knut-vandrar-prod_gallery_media` | `/media` |

`/media` is the container's view of the mounted volume. Reading or writing
`/media/photos/...` reads or writes that volume's files directly; there is no second
copy or synchronization step. Each container sees its own environment's files at
the same container path. The VPS host's own `/media` directory is a separate path
and has no connection to these volumes under the current configuration.

Keep `MEDIA_ROOT=/media` in the VPS environment templates/files. Compose explicitly
sets the backend's `MEDIA_ROOT` to `/media`, so editing that environment-file value
alone does not change the container path or where Docker stores the volume. When
running the backend directly on a host, outside Docker, `MEDIA_ROOT` instead selects
an ordinary host directory. That host-run directory is independent of the Compose
volume.

Docker manages the volume's physical location on the VPS. If needed, the deployment
account can inspect it manually without printing application credentials:

```sh
docker volume inspect --format '{{ .Mountpoint }}' knut-vandrar-dev_gallery_media
docker volume inspect --format '{{ .Mountpoint }}' knut-vandrar-prod_gallery_media
```

Use the application and media-transfer commands to manage image files. Do not serve
the volume as a public static directory: gallery originals and import recovery
journals are private. Public thumbnails/fullscreen images and authenticated original
downloads are delivered through FastAPI. Ensure the Docker storage filesystem has
space for originals, derivatives, and temporary import staging. The backend creates
its photo and recovery subdirectories with private permissions.

Volumes persist across normal container rebuilds and replacements. Include each
`gallery_media` volume and its matching PostgreSQL volume in consistent backups;
PostgreSQL dumps alone omit gallery file bytes. Preserve the Compose project names
and volume declarations across deployments, and never use `docker compose down -v`
unless deletion of that environment's persistent data has been explicitly authorized.
Choosing a specific host directory instead would require a bind-mount configuration
change and migration of existing volume contents; changing `MEDIA_ROOT` alone does
not perform that migration.

### Where media export/import reads and writes

The shell wrappers execute the Python CLI in the selected environment's **running
backend container** with `docker compose exec -T`. For a remote environment, SSH runs
that same command in its VPS checkout. The CLI uses the container's database settings
and `MEDIA_ROOT=/media`.

The workstation setting `MEDIA_REMOTE_CHECKOUTS_DIR=/srv/knut-vandrar` selects the
parent directory of the VPS `dev/` and `prod/` repository checkouts. Override it with
`--remote-checkouts-dir /absolute/path` when the checkouts live elsewhere. This
setting controls where SSH runs the command; `MEDIA_ROOT` controls gallery storage
inside the backend container.

| Data | Export reads from | Import writes to |
| --- | --- | --- |
| Gallery originals, thumbnails, fullscreen images | `/media`, backed by the source environment's `gallery_media` volume | `/media`, backed by the destination environment's `gallery_media` volume |
| Covers, location logos, and gallery metadata | Source PostgreSQL database | Destination PostgreSQL database |
| Portable archive | Created from the above data | Read from the supplied archive file or stdin |

The export archive itself is written to the output path on the machine where the
wrapper was started, defaulting to that checkout's `backups/` directory. For example,
running a dev export from a laptop with `--ssh` saves the archive on the laptop.
Running the wrapper directly on the VPS saves it on the VPS. Exporting does not move
live media out of its volume.

Import reads the archive from the invoking machine and streams it to the destination
container, over SSH when selected. It extracts temporary files and its recovery
journal under `/media/.transfers/`, publishes gallery files under `/media/photos/`,
and updates PostgreSQL. A dry run stages and validates the archive but does not
publish image files or update application records. It does not leave a separate
archive file in the destination volume.

The local Compose setup uses the same `gallery_media:/media` mount; these wrappers
therefore use the local Docker volume too. The root `.env` host-run setting such as
`MEDIA_ROOT=./backend/.media` applies when Python runs outside Docker and does not
make that host directory share files with the local Docker volume.

See the [media transfer guide](media-transfers.md) for commands, selection filters,
owner mappings, conflict handling, and interrupted-import recovery.

## GitHub setup

Create GitHub Environments named `development` and `production`. Add these secrets to both environments (or as repository secrets if you prefer shared credentials):

- `SERVER_HOST`: VPS hostname or address
- `SERVER_USER`: deployment account
- `SERVER_SSH_KEY`: private key that can SSH as that account
- `SERVER_KNOWN_HOSTS`: verified `known_hosts` entry for the VPS

Install the matching public key in the VPS deployment account's `authorized_keys`. Verify the host key fingerprint independently before adding it to GitHub. The workflow uses strict host-key checking.

The workflow assumes the environment checkouts are at `/srv/knut-vandrar/dev` and `/srv/knut-vandrar/prod`. If you choose different locations, update the paths in `.github/workflows/ci.yml`.

Allow GitHub Actions to update the `dev` branch after a promotion PR merges. If branch protection or a ruleset blocks the force update, grant the workflow token a narrow bypass for that branch or adjust the rule. The promotion PR workflow itself needs Actions' `pull-requests: write` permission.

## Branch behavior

- Pushes to `dev` open or update a `dev` → `main` PR and deploy to development after CI passes.
- Merging that PR resets `dev` to the merge commit on `main`.
- Pushes to `main` deploy to production after CI passes.
- Deployments use the exact workflow commit SHA, serialize per environment, wait for Compose health checks, and keep dev and production database volumes separate.

Back up each database independently with the [database backup scripts](database-backups.md). Keep backup files off the VPS or copy them to your chosen backup storage. Never use `docker compose down -v` on either deployment project unless you intend to delete that project's database volume.

### Frontend content caching and languages

The public site uses Next.js server rendering and fetches API data on each
server request with caching disabled. Content changes, including translations
and direct SQL edits, are available on the next server request. Currently open
browser tabs do not receive live updates.

`INTERNAL_API_URL` is supplied by Compose as `http://backend-internal:${API_PORT}`.
The `backend-internal` alias exists only on each deployment's private default
network, which the frontend also joins. This keeps server-side API requests within
the correct environment. Both deployments share the Traefik network for public
routing, so the generic `backend` hostname on that network can resolve to either
environment and must not be used for internal API requests.

The `.env` equivalent of `INTERNAL_API_URL` is only for running the frontend on the
host. Recreate services after changing environment variables or network membership;
a restart alone does not apply those changes.

Pages have explicit `/sv`, `/en` and `/cs` prefixes and localized hike paths/slugs.
Unprefixed requests use the saved locale cookie, then browser language preferences,
then Swedish. Explicit locale URLs take priority. No location permission or IP geolocation
service is used. Missing hike translations are omitted; outdated translations stay visible.

Only the public hiking interface is implemented. The shared Radix dropdown, Tailwind tokens,
fonts and component styles can be reused for the future admin panel; no admin CRUD UI or
authentication has been introduced in this redesign.
