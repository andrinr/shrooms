# Deployment and operations

[Back to shrooms](../README.md)

## Static hosting (recommended)

Deploy `_site/` to GitHub Pages or another static host after `npm run build`. The map and browser notebook work without a backend. Saved spots stay in the current browser and origin; use Export / Import to transfer them. Clearing site data removes them.

## Optional weather backend

Use one Linux VPS with **2 CPU cores, 4 GB RAM and 20 GB or more disk**, Docker Engine and the Compose plugin. The application runs as an unprivileged user behind Caddy. SQLite and the weather cache live in a persistent volume. This is a single-instance deployment; do not run independent replicas against copied databases.

A small European Hetzner cloud server is a suitable starting point. Allow roughly CHF 5–10/month before domain and off-server backups; confirm the current [provider pricing](https://www.hetzner.com/cloud/) and [price adjustments](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) when ordering. No provider account or paid resource is provisioned by this repository. Any comparable Docker host works.

Free hosts with ephemeral disks or idle shutdown are unsuitable for this configuration: scheduled weather updates need a running process. The browser notebook does not depend on server storage.

## First deployment

1. Install Docker and Compose using the [official instructions](https://docs.docker.com/engine/install/ubuntu/).
2. Point your domain's A record (and AAAA only if IPv6 works) to the server.
3. Allow inbound TCP 80/443, optional UDP 443, and restricted SSH. Do not expose port 3000.
4. Clone the repository and configure it:

```sh
git clone https://github.com/andrinr/shrooms.git
cd shrooms
cp .env.example .env
# Edit DOMAIN in .env; use a hostname without https:// or a trailing slash.
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 app proxy
```

Visit `https://YOUR_DOMAIN`. Caddy obtains and renews TLS certificates. `/api/health` reports application health and weather freshness separately; an upstream weather outage should not take the map offline.

Save a test spot in the browser notebook and reload the page. Export a backup and check that importing it does not duplicate the spot. The retired account endpoints return HTTP 410; existing databases remain untouched.

## Configuration

| Setting | Purpose |
| --- | --- |
| `DOMAIN` | Compose/Caddy hostname |
| `OPEN_METEO_API_KEY` | Optional commercial weather key; keep in `.env` |
| `PUBLIC_ORIGIN` | Exact HTTPS origin outside Compose; mandatory in production |
| `STORAGE_DIR` | Database/cache directory; Compose sets `/app/storage` |
| `WEATHER_AUTO_REFRESH=false` | Disable scheduled upstream requests for isolated tests |
| `TRUST_PROXY=true` | Trust the final forwarding address for rate limits; only behind the bundled proxy with port 3000 inaccessible publicly |
| `PORT`, `HOST` | Listener settings outside Compose |

Production cookies are HttpOnly, SameSite=Lax and Secure. Mutations validate the request origin; authenticated mutations also require a session CSRF token. Do not set `TRUST_PROXY=true` on a directly exposed app server.

The [free weather endpoint](https://open-meteo.com/en/pricing) is restricted to non-commercial use. A supplied commercial key switches the backend to the customer endpoint. Updates run every six hours; incomplete responses retain the last snapshot and failures back off for 15 minutes. Weather older than 48 hours is omitted from scores.

## Legacy server backups

These preserve old account data, if present. They do not back up browser notebooks; use the notebook’s Export button for those.

Run an online SQLite backup rather than copying the active database file alone:

```sh
docker compose exec -T app node scripts/backup.cjs /app/storage/backups/shrooms.sqlite
mkdir -p backups
docker compose cp app:/app/storage/backups/shrooms.sqlite ./backups/shrooms.sqlite
```

Schedule this daily on the host, retain dated copies, and transfer them to private off-server storage. Restrict access: backups contain account hashes, sessions and private locations. The named volume protects against container replacement, not server loss. Never use `docker compose down -v` for a routine update.

### Restore

First make a backup of the current database. Stop the app before replacing files. The following uses a locally prepared `backups/shrooms.sqlite`:

```sh
docker compose stop app
docker compose run --rm --no-deps --user root -v "$PWD/backups:/restore:ro" app sh -c 'rm -f /app/storage/shrooms.sqlite-wal /app/storage/shrooms.sqlite-shm; cp /restore/shrooms.sqlite /app/storage/shrooms.sqlite; chown node:node /app/storage/shrooms.sqlite; chmod 600 /app/storage/shrooms.sqlite'
docker compose up -d app
```

Use a known-good backup, then verify sign-in and a saved spot. Weather can be rebuilt automatically; it is not required in the database backup. Test restoration on a separate environment before relying on a backup schedule.

## Updates

Back up first, record the current commit, then:

```sh
git pull --ff-only
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 app
```

For rollback, check out the recorded release commit and rebuild. Future schema-changing releases may require restoring the matching backup; do not assume downgrades are compatible. The current schema is SQLite `user_version=1`.

Caddy and Node image tags receive updates on rebuild. Monitor disk space, `/api/health`, weather freshness and backup completion. Rate limits are process-local and reset on restart. Add upstream abuse controls if opening registration to a large audience.

## Static alternative

`npm run build` produces `_site/` for GitHub Pages or any static host. No private data or backend files are included. Accounts are unavailable there. The full backend must run at the site's origin; cross-origin API hosting is deliberately unsupported.
