# Media exports and imports

Published GPX collections, route metadata, track files, and hike collection selections
transfer in the same archive as pictures. Collections can belong to a trail or a hike;
`--map-location` and `--map-hike` remap their respective owners. Generated static hike maps and their rendering provenance also transfer with media.
New archives use format 4;
formats 1, 2 and 3 remain readable when database revisions match. Draft reviews are
excluded. See [track imports](track-imports.md).

Use `scripts/media-export.sh` and `scripts/media-import.sh` to transfer images between
`local`, `dev`, and `prod` without replacing unrelated application content. Both
environments need this code and migrations through `019_hike_stopping_point` applied
through their normal deployment/startup process. The source and destination Alembic revisions must
match. No additional dependencies, cloud storage, or API credentials are needed.

The commands execute Python inside an **already running backend**. They do not start,
restart, rebuild, or remove containers or volumes. Remote commands require SSH access
to the deployment account, Docker access, and the updated repository on the VPS.

## Localhost to dev

From the repository root:

```sh
./scripts/media-export.sh local backups/media.tar
./scripts/media-import.sh dev backups/media.tar --ssh deploy@your-vps --dry-run
./scripts/media-import.sh dev backups/media.tar --ssh deploy@your-vps
```

The dry run reports how many images would be added, replaced, repaired, or skipped,
and any conflicts. It validates all archive files and references, stages temporary
files privately, and locks affected database records while planning. It does not
change application records or published images. A conflict returns a nonzero exit
status and applies **no changes**, even when some other entries could be imported.

To accept conflicting image bytes or imported photo metadata explicitly:

```sh
./scripts/media-import.sh dev backups/media.tar --ssh deploy@your-vps --replace --dry-run
./scripts/media-import.sh dev backups/media.tar --ssh deploy@your-vps --replace
```

Take a matching database/media backup before replacing valuable destination content.
The recovery journal covers interrupted operations; it is not a versioned backup.

## Environment routing

`local` always uses the root `.env` and `docker-compose.yml` on this computer. It
ignores SSH transport settings.

With `--ssh`, dev/prod commands run in `/srv/knut-vandrar/dev` or
`/srv/knut-vandrar/prod` on the selected host. Override the directory containing the
`dev/` and `prod/` repository checkouts with `--remote-checkouts-dir /absolute/path`.
Archives stream over SSH; they are not copied to
a public directory or retained as separate archive files on the VPS.

Configure optional workstation defaults in the root `.env`:

```dotenv
MEDIA_SSH_HOST=deploy@your-vps
MEDIA_REMOTE_CHECKOUTS_DIR=/srv/knut-vandrar
```

`MEDIA_REMOTE_CHECKOUTS_DIR` selects the VPS repository location used to run commands.
`MEDIA_ROOT=/media` selects media storage inside the backend container. In local
Compose, the host's `${MEDIA_ROOT:-./backend/.media}/tracks` is mounted at
`/media/tracks`, so workstation GPX imports and container exports use the same
track files. Photos remain in the existing named media volume. The mount takes
effect when the backend container is next recreated; it does not require any
volume deletion.

`--ssh` and `--remote-checkouts-dir` override these defaults. By default, SSH uses batch authentication and
strict host-key checking; configure keys, ports, and host aliases in `~/.ssh/config`.
For interactive password authentication, add `--ssh-password`. SSH prompts in the
local terminal; the password is not stored in configuration or passed as an argument.
The server must allow password authentication for the selected account. Key-based
batch authentication remains the default. Archive streaming still uses stdin/stdout.
No passwords or tokens are included in the archive or command output.

Without an SSH host, dev/prod commands run on the current host, using the same Compose
projects and routing overlays as deployment. Environment files are read from
`/etc/knut-vandrar/development.env` or `../.env.vps.production` (override the directory with
`DEPLOY_CONFIG_DIR`). If missing, the scripts use the checkout's ignored
`.env.vps.development` or `.env.vps.production` file. Node and Python versions always
come from that checkout's `.nvmrc` and `.python-version`.

## Selecting content and mapping owners

Export all images by omitting filters, or repeat `--hike` and/or `--location`:

```sh
./scripts/media-export.sh local backups/one-hike.tar --hike <hike-uuid>
./scripts/media-export.sh dev backups/location.tar --ssh deploy@your-vps --location <location-uuid>
```

A hike selection includes its cover, gallery, generated maps, and associated location logo. A location
selection includes its logo and all its hikes' images. Multiple filters form a union.
Unknown filter IDs fail the export. Omitting the output path creates a timestamped
archive under ignored `backups/`; existing archives are never overwritten. `-` writes
an export to stdout or reads an import from stdin. Import progress and its summary use stdout, with immediate stage messages and periodic byte/image counts. Export progress uses stderr to keep archive stdout clean. Errors use stderr.

Hikes and locations must already exist at the destination. UUIDs are matched exactly;
names and slugs are never used to guess associations. When records were created
independently, supply explicit, repeatable owner mappings:

```sh
./scripts/media-import.sh dev backups/media.tar --ssh deploy@your-vps \
  --map-hike <source-hike-uuid>=<destination-hike-uuid> \
  --map-location <source-location-uuid>=<destination-location-uuid> \
  --dry-run
```

The importer preserves photo IDs. A photo ID already owned by another destination
hike is an error, even with `--replace`. Multiple covers or logos cannot map to the
same destination slot. Importing media does not create hikes, locations, languages,
translation profiles, or other reference data.

## What is preserved

| Content | Transfer behavior |
| --- | --- |
| Covers and location logos | Exact stored bytes, content type, and checksum |
| Gallery photos | Exact private original, thumbnail, and fullscreen bytes; no re-encoding |
| Photo metadata | Dimensions, English source, captions, alt text, translations, review state, and translation provenance |
| Photo order | Existing destination order stays intact; additions are appended in source order |
| Destination-only images and locales | Retained |
| Identical entries | Skipped; repeating an import does not create duplicates |
| Missing gallery files | Repaired from the archive when existing bytes agree |
| Translation requests/history | Jobs and history are not copied or created; obsolete destination jobs for replaced photos are superseded |

On replacement, photo revisions advance to invalidate in-flight translation work.
Imported translations retain their relative source age and profile fingerprints, so
freshness is evaluated against the destination's current profiles. Audit timestamps
are maintained by the destination database rather than copied.

Gallery public URLs contain the original's digest. Different derivatives for the same
photo ID and original digest are rejected, including with `--replace`, because changing
bytes under an immutable URL would leave visitors with inconsistent cached images.
Such separately processed images need distinct photo IDs. Missing files can be
repaired, but conflicting existing bytes are not treated as missing files.

## Validation, storage, and recovery

The uncompressed USTAR archive contains `manifest.json`, streamed `assets.jsonl`
metadata, and per-image files. The manifest records the archive format version and
Alembic revision; URLs and environment credentials are excluded. The archive includes
untouched private originals, which may contain EXIF/GPS metadata; keep it private.
Export files are created with owner-only permissions.

Imports reject unknown versions, invalid metadata, missing/extra/duplicate files,
checksum or size mismatches, corrupt/unsupported images, unsafe paths, links, and
extended tar headers. Archive reads and checksums stream in bounded chunks; a temporary
SQLite index handles metadata and ordering without loading the archive into memory.
The default archive limit is 100 GiB; use `--max-bytes <positive-integer>` to change it.
Allow disk space for the extracted archive plus new gallery generations until cleanup.

An exclusive filesystem lock serializes transfers sharing a media volume. Database
owner and photo locks coordinate application edits and translation workers. Exports
use a PostgreSQL repeatable-read snapshot with shared locks to keep gallery files and
metadata consistent; retry if PostgreSQL reports a concurrent-update failure.

Gallery imports publish complete private generations under
`MEDIA_ROOT/photos/<photo-id>/versions/<original-digest>/`. Existing uploads in the
legacy photo directory remain readable. New generations become public when their
database references commit; the previous generation remains available until then.
Missing files within an existing generation are restored using atomic file links.
Obsolete bytes are removed after a successful commit.

A durable journal under `MEDIA_ROOT/.transfers/` and a SQL commit receipt reconcile
filesystem changes after interruption. Recover promptly before further editing:

```sh
./scripts/media-import.sh dev --recover --ssh deploy@your-vps
```

Recovery removes uncommitted additions or finishes cleanup for committed imports.
Normal imports recover pending work before applying a new archive. Dry runs and exports
stop if recovery is pending. Do not manually delete journals or receipt records.
Keep the database and media volume together during backup/restore.

For a complete environment copy, restore a database dump first and then import media
exported from the matching source state. The database dump already includes covers,
logos, and gallery metadata; importing the archive then repairs the gallery files.
If content can change between the dump and media export, pause edits for that pair.
See [database backups](database-backups.md) for the existing database workflow.
