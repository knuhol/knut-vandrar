# Database backups and restores

The scripts create and restore PostgreSQL custom-format dumps for one selected application database. They require PostgreSQL 18 client tools (`pg_dump`, `pg_restore`, `dropdb`, `createdb`, and `psql`). A dump contains that database's schema, data, and large objects; it does not include cluster-wide roles or other databases.

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

`local` reads `.env`. For `dev` and `prod`, the scripts read `.env.vps.development` / `.env.vps.production` if present, otherwise `/etc/knut-vandrar/development.env` / `/etc/knut-vandrar/production.env`. On a workstation, create the ignored local files from their checked-in examples and set their credentials to match the VPS files:

```sh
cp .env.vps.development.example .env.vps.development
cp .env.vps.production.example .env.vps.production
```

`local` always connects to `127.0.0.1`. Set `DB_BACKUP_HOST` to the VPS hostname or address when connecting to `dev` or `prod` remotely; it defaults to `127.0.0.1` when running on the VPS itself.

For example, from a workstation:

```sh
DB_BACKUP_HOST=your-vps-host ./scripts/db-backup.sh dev
DB_BACKUP_HOST=your-vps-host ./scripts/db-backup.sh prod
```

Keep backups somewhere safe and outside the repository. The dev and production templates use public database ports `5433` and `5432`, respectively; the corresponding firewall rules must allow your workstation to connect.

## Restore

Restore takes an environment and a custom-format dump. It validates the archive and database connection before replacing the selected database. By default, it asks you to type the target database name to confirm:

```sh
./scripts/db-restore.sh local backups/knut-vandrar-local-20261105T220000Z.dump
DB_BACKUP_HOST=your-vps-host ./scripts/db-restore.sh dev backups/knut-vandrar-dev.dump
DB_BACKUP_HOST=your-vps-host ./scripts/db-restore.sh prod backups/knut-vandrar-prod.dump
```

Restore forcibly disconnects clients, drops and recreates only the selected database, then loads the dump. The selected `POSTGRES_USER` must have permission to drop and recreate that database (the project's PostgreSQL container user does). The source dump is left unchanged. `--yes` skips the confirmation prompt and should only be used intentionally:

```sh
./scripts/db-restore.sh prod backups/knut-vandrar-prod.dump --yes
```

Take a fresh backup before restoring over important data. Do not use `docker compose down -v` as a substitute; it removes the persistent database volume.
