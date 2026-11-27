# Database backups and restores

The scripts create and restore PostgreSQL custom-format dumps for one selected application database. They require PostgreSQL 18 client tools (`pg_dump`, `pg_restore`, `dropdb`, `createdb`, and `psql`). Remote `dev` and `prod` runs also require an OpenSSH client that supports forwarding from a local Unix socket. A dump contains that database's schema, data, and large objects; it does not include cluster-wide roles or other databases.

## Gallery images and VPS backups

Regular full VPS backups can cover both the database and gallery images, so a separate image backup is not required if those backups include the PostgreSQL and `gallery_media` Docker volumes. Confirm that the backup configuration includes both volumes and supports a consistent database restore; restore testing is the way to verify coverage.

The database backup scripts described here do **not** back up `gallery_media`. Gallery originals, thumbnails, and fullscreen images live in that volume, while captions, translations, ordering, and image references live in PostgreSQL. Cover images and location logos are stored in PostgreSQL and are included in database dumps. Restore the database and gallery volume from a matching backup to keep records and files aligned.

For portable image transfers, use the [media export/import commands](media-transfers.md).
They include gallery files and metadata, covers, and logos, support dry runs and
selective imports, and preserve unrelated destination content. After a database clone,
import an archive from the matching source state to restore the gallery files.

## Back up

From the repository root, select `local`, `dev`, or `prod`:

```sh
./scripts/db-backup.sh local
./scripts/db-backup.sh dev
./scripts/db-backup.sh prod
```

By default, dumps are written to the ignored `backups/` directory with a UTC timestamp. You can provide an explicit output path as the second argument:

```sh
./scripts/db-backup.sh prod /safe/location/knut-vandrar-prod.dump
```

`local` reads `.env`. For `dev` and `prod`, the scripts read `.env.vps.development` / `.env.vps.production` if present, otherwise `/etc/knut-vandrar/development.env` / `/etc/knut-vandrar/production.env`. On a workstation, create any missing ignored files from their checked-in examples and set their database credentials to match the VPS files:

```sh
cp -n .env.vps.development.example .env.vps.development
cp -n .env.vps.production.example .env.vps.production
```

`local` connects directly to `127.0.0.1`. For `dev` and `prod`, set `MEDIA_SSH_HOST` in the matching ignored workstation environment file to the VPS SSH host or an alias from `~/.ssh/config`. The database scripts reuse the existing SSH key/configuration, open a tunnel on a private local Unix socket to the VPS's configured `POSTGRES_PORT`, wait for PostgreSQL to respond, and close the tunnel on success, failure, or interruption. Workstation config files fail fast if `MEDIA_SSH_HOST` is empty. When using the VPS configuration under `/etc/knut-vandrar/`, the scripts connect directly to VPS loopback.

For example, set `MEDIA_SSH_HOST=knut-vps` in `.env.vps.development` and `.env.vps.production` on your workstation, where `knut-vps` is configured in `~/.ssh/config`. Then run:

```sh
./scripts/db-backup.sh dev
./scripts/db-backup.sh prod
```

SSH runs in batch mode, so unattended backups work with a configured SSH key or agent and a previously verified host key. No SSH password prompt or database port open to the workstation is required. Keep backups somewhere safe and outside the repository.

## Restore

Restore takes an environment and a custom-format dump. It validates the archive and database connection before replacing the selected database. By default, it asks you to type the target database name to confirm:

```sh
./scripts/db-restore.sh local backups/knut-vandrar-local-20261105T220000Z.dump
./scripts/db-restore.sh dev backups/knut-vandrar-dev.dump
./scripts/db-restore.sh prod backups/knut-vandrar-prod.dump
```

Restore forcibly disconnects clients, drops and recreates only the selected database, then loads the dump. The selected `POSTGRES_USER` must have permission to drop and recreate that database (the project's PostgreSQL container user does). The source dump is left unchanged. `--yes` skips the confirmation prompt and should only be used intentionally:

```sh
./scripts/db-restore.sh prod backups/knut-vandrar-prod.dump --yes
```

Take a fresh backup before restoring over important data. Do not use `docker compose down -v` as a substitute; it removes the persistent database volume.
