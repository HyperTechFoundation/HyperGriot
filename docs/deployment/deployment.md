# Deployment guide

Everything you need to run HyperGriot anywhere, from a laptop to a horizontally scaled production cluster behind a load balancer.

## Transport modes

HyperGriot supports two transports:

| Mode | How updates arrive | Public URL | Scalable | Best for |
| ---- | ------------------ | :---: | :---: | --- |
| Long polling | Bot calls `getUpdates` | No | Single instance only | Development, personal bots, small groups |
| Webhook | Telegram posts to your HTTPS URL | Yes | Many workers behind a load balancer | Production, many groups |

> [!WARNING]
> Long polling (`getUpdates`) can run on exactly one process. Two instances will fight over the update stream (Telegram returns `409 Conflict`) and silently drop updates. To scale past one process, switch to webhooks.

Webhook mode is enabled automatically when `WEBHOOK_DOMAIN` is set; otherwise the bot starts in long-polling mode. See [Configuration](../getting-started/configuration.md) for the full variable reference.

## Prerequisites

| Requirement | Detail |
| --- | --- |
| Node.js | 20 LTS or newer (18 minimum). Verify with `node -v` |
| npm | Ships with Node |
| Bot token | From [@BotFather](https://t.me/BotFather) via `/newbot` |
| Source | The HyperGriot repository checked out locally |
| Webhook only | A public HTTPS endpoint with a valid TLS certificate. Telegram accepts only ports 443, 80, 88, and 8443 |
| Docker only | Docker 24+ and optionally Docker Compose v2 |

## Telegram setup

1. Open [@BotFather](https://t.me/BotFather), run `/newbot`, choose a name and username, and copy the token.
2. Optionally register command hints so users see them in the UI.
3. Optionally disable Group Privacy if members should call read commands directly (BotFather, `/setprivacy`).
4. Add the bot to your group and grant it admin rights.

See the [Permissions](../concepts/permissions.md) table for which admin right powers which command.

> [!IMPORTANT]
> Moderation commands will not work until the bot is granted the Ban Users right in the group. The bot reports the exact right it needs.

## Decision matrix

| Situation | Recommended method |
| --- | --- |
| Just testing on my machine | Method A (local long polling) |
| One cheap VPS, a few groups | Method B (systemd) or Method C (PM2) |
| Reproducible, portable deploys | Method D or E (Docker) |
| Many groups, high traffic, high availability | Method F (webhook plus Nginx) or G (Caddy) |
| No servers to manage | Method H (PaaS) |

## Build the project

```bash
npm ci                 # reproducible install (use npm install if no lockfile)
npm run build          # tsc -> dist/
npm test               # vitest (83 tests)
```

All methods below assume the project is built (`dist/` present) unless they build inside Docker.

---

## Method A - Local development (long polling)

No public URL is required.

```bash
cp .env.example .env   # set BOT_TOKEN and OWNERS; leave WEBHOOK_DOMAIN unset
npm run build
npm start              # node dist/index.js
# or, with hot reload:
npm run dev
```

---

## Method B - systemd (VPS, long polling)

Best for a single Linux server running one long-polling instance.

```bash
useradd -r -s /bin/false hypergriot
mkdir -p /opt/hypergriot && chown hypergriot:hypergriot /opt/hypergriot
```

Copy the built project to `/opt/hypergriot` (including `dist/`, `node_modules/`, `package.json`, and `.env`), then create the unit file:

```ini
# /etc/systemd/system/hypergriot.service
[Unit]
Description=HyperGriot Telegram Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=hypergriot
WorkingDirectory=/opt/hypergriot
EnvironmentFile=/opt/hypergriot/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/hypergriot/data
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now hypergriot
systemctl status hypergriot
journalctl -u hypergriot -f
```

---

## Method C - PM2 process manager

A friendlier alternative to systemd with built-in restarts and log management.

```bash
npm i -g pm2
npm run build
```

`ecosystem.config.cjs`:

```js
module.exports = {
  apps: [{
    name: 'hypergriot',
    script: 'dist/index.js',
    instances: 1,            // long polling: must stay 1
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    env: { NODE_ENV: 'production' },
  }],
};
```

```bash
pm2 start ecosystem.config.cjs
pm2 startup                 # follow the printed command to auto-start on boot
pm2 save
pm2 logs hypergriot
pm2 restart hypergriot
```

---

## Method D - Docker (single container)

`Dockerfile` (multi-stage, slim runtime, healthcheck):

```dockerfile
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
```

Long polling:

```bash
docker build -t hypergriot:latest .
docker run -d --name hypergriot --restart unless-stopped \
  --env-file .env -v "$PWD/data:/app/data" hypergriot:latest
```

Webhook (expose the port for your reverse proxy):

```bash
docker run -d --name hypergriot --restart unless-stopped \
  --env-file .env -v "$PWD/data:/app/data" \
  -p 127.0.0.1:8080:8080 hypergriot:latest
```

> [!NOTE]
> Bind to `127.0.0.1` only. The public path is handled by Nginx or Caddy in Methods F and G.

---

## Method E - Docker Compose

`docker-compose.yml`:

```yaml
services:
  hypergriot:
    build: .
    image: hypergriot:latest
    container_name: hypergriot
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data       # persist the store
    # ports:                   # uncomment for webhook behind a proxy on the same host
    #   - "127.0.0.1:8080:8080"
```

```bash
docker compose up -d --build
docker compose logs -f
docker compose restart
```

---

## Method F - Webhook plus Nginx (production, scaled)

The recommended production topology: Nginx terminates TLS and load-balances across N stateless workers.

**1. Obtain a TLS certificate** (Let's Encrypt):

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d bot.example.com
```

**2. Nginx site:**

```nginx
upstream hypergriot {
    server 127.0.0.1:8080;
    # add more workers: server 127.0.0.1:8081; server 127.0.0.1:8082;
}

server {
    listen 443 ssl http2;
    server_name bot.example.com;

    ssl_certificate     /etc/letsencrypt/live/bot.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bot.example.com/privkey.pem;

    location /hypergriot {
        proxy_pass         http://hypergriot;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_pass_request_headers on;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hypergriot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**3. Start the workers** with `WEBHOOK_DOMAIN=bot.example.com`.

**4. Register the webhook with Telegram** (see [Webhook lifecycle](#webhook-lifecycle)):

```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  --data-urlencode "url=https://bot.example.com/hypergriot" \
  --data-urlencode "secret_token=$WEBHOOK_SECRET" \
  --data-urlencode "max_connections=100"
```

> [!IMPORTANT]
> Telegram only accepts the public ports 443, 80, 88, and 8443. Nginx listens on 443, so this is satisfied. The internal worker port (8080) can be anything.

---

## Method G - Caddy (auto-TLS)

Caddy obtains and renews certificates automatically, with less ceremony than Nginx plus certbot.

`Caddyfile`:

```
bot.example.com {
    reverse_proxy /hypergriot* 127.0.0.1:8080
    # scale by adding backends:
    # reverse_proxy /hypergriot* 127.0.0.1:8080 127.0.0.1:8081 127.0.0.1:8082
}
```

```bash
sudo caddy start
# point bot.example.com's DNS A record at this server first
```

Then start HyperGriot with `WEBHOOK_DOMAIN=bot.example.com` and run the `setWebhook` curl.

---

## Method H - Cloud PaaS (Railway, Render, Fly.io)

PaaS gives you a managed container, a persistent volume, and a public HTTPS URL with no TLS work.

1. Connect your Git repository or push the Docker image.
2. Set the build command to `npm run build` and the start command to `node dist/index.js` (or deploy the `Dockerfile`).
3. Create a persistent volume mounted at `/app/data` (set `DATA_DIR=/app/data`).
4. Provision a public domain and set `WEBHOOK_DOMAIN`, `WEBHOOK_PORT=$PORT`, and `WEBHOOK_PATH=/hypergriot`.
5. Deploy, then run the `setWebhook` curl.

`fly.toml` example:

```toml
[http_service]
  internal_port = 8080
  force_https = true
[[mounts]]
  source = "hypergriot_data"
  destination = "/app/data"
```

> [!WARNING]
> PaaS scales to multiple instances only in webhook mode. Avoid long polling on a PaaS that auto-scales horizontally, since it would run more than one `getUpdates` and conflict.

---

## Webhook lifecycle

Set, inspect, and tear down the webhook:

```bash
# Register or update the webhook
curl "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  --data-urlencode "url=https://bot.example.com/hypergriot" \
  --data-urlencode "secret_token=$WEBHOOK_SECRET"

# Inspect status and last error (first stop when debugging)
curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo" | jq

# Drop pending updates while switching (optional)
curl "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook?drop_pending_updates=true"

# Switch back to long polling
unset WEBHOOK_DOMAIN   # in .env, then restart
curl "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook"
```

---

## Scaling horizontally

| Concern | Guidance |
| --- | --- |
| Transport | Webhooks only for more than one process |
| Stateless workers | The bot is stateless per request; caches are per-worker and eventually consistent |
| Shared store | Single host is fine with the JSON store. For multi-host, point the repository at Postgres (see [Architecture](../architecture/overview.md)) |
| Federation fan-out | A `/fban` must reach every linked chat. With one worker this is direct; with many, use a shared queue such as Redis pub/sub so exactly one worker fans out |
| Load balancing | Nginx or Caddy round-robin, or `chatId`-based hashing for cache locality |
| Rate limits | Telegram enforces roughly 30 messages per second globally and per-chat limits. Respect `Retry-After` (429) |
| Throughput | For high-volume polling, use grammY's runner plugin; for webhooks, just add workers |

---

## Observability

| Signal | How to get it |
| --- | --- |
| Health | `GET /health` returns `200 OK` in webhook mode. Use for load-balancer checks and Docker healthchecks |
| Logs | `journalctl -u hypergriot`, `pm2 logs`, or `docker logs`. Set `DEBUG=1` for verbose logging |
| Audit | Every moderation action is mirrored to the configured log channel (see [Log channels](../guides/log-channels.md)) |
| Telegram-side | `getWebhookInfo` shows `last_error_date` and `last_error_message` |

```bash
curl -fsS http://127.0.0.1:8080/health && echo " OK"
```

---

## Backup and restore

All per-group state lives under `DATA_DIR` (default `./data/hypergriot.json`). Back up that directory.

```bash
# Manual backup
tar czf hypergriot-data-$(date +%F).tgz ./data

# Docker volume backup
docker run --rm -v hypergriot_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/hypergriot-data.tgz -C /data .
```

To restore, stop the bot, replace `./data`, and start again.

> [!NOTE]
> If you migrate the store backend from JSON to Postgres, back up the database instead, for example with `pg_dump`.

---

## Security hardening

- Keep `.env` out of version control (it is gitignored). Use a secrets manager in CI/CD.
- Set `WEBHOOK_SECRET`; the bot validates the secret header Telegram sends.
- Use an unguessable `WEBHOOK_PATH`, for example a random 32-character token.
- Run as a non-root user (the systemd unit and Docker image already do).
- Expose only port 443 publicly; keep the app port (8080) on `127.0.0.1`.
- All user-controlled text is HTML-escaped before sending. Never disable this.

> [!CAUTION]
> If a token leaks, revoke it immediately via BotFather (`/revoke`), update `.env`, redeploy, and re-register the webhook.

---

## Upgrades and rollbacks

```bash
# Upgrade
cd /opt/hypergriot
git pull
npm ci
npm run build
systemctl restart hypergriot      # or: pm2 restart hypergriot  /  docker compose up -d --build

# Rollback
git checkout <previous-tag>
npm ci && npm run build
systemctl restart hypergriot
```

> [!WARNING]
> Back up `./data` before upgrading if a release changes the store schema. Review the [Release notes](../project/release-notes.md) for migrations.

---

## CI/CD

Gate every push on typecheck and tests:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

---

## Quick reference

```bash
# env
cp .env.example .env

# build and run locally
npm ci && npm run build && npm start

# docker
docker build -t hypergriot . && docker run -d --env-file .env -v "$PWD/data:/app/data" hypergriot
docker compose up -d --build && docker compose logs -f

# telegram webhook
TOKEN=123:ABC
curl "https://api.telegram.org/bot$TOKEN/setWebhook?url=https://bot.example.com/hypergriot&secret_token=SECRET"
curl -s "https://api.telegram.org/bot$TOKEN/getWebhookInfo" | jq
curl "https://api.telegram.org/bot$TOKEN/deleteWebhook"   # switch to polling

# health and logs
curl -fsS http://127.0.0.1:8080/health
journalctl -u hypergriot -f   # or: pm2 logs hypergriot  /  docker logs -f hypergriot
```

For runtime problems, see [Troubleshooting](../reference/troubleshooting.md).
