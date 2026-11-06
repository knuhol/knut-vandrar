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
