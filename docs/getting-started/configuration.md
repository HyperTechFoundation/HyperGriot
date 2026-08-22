# Configuration

HyperGriot is configured through environment variables, loaded from a `.env` file in the project root. Copy `.env.example` to `.env` and edit it.

## Environment variables

| Variable | Required | Default | Description |
| --- | :---: | --- | --- |
| `BOT_TOKEN` | Yes | | Bot token from @BotFather |
| `OWNERS` | No | | Comma-separated global-owner Telegram user IDs (for example, `111,222`). Without this, no user has owner bypass privileges |
| `DATA_DIR` | No | `./data` | Directory for the persistent store |
| `DEBUG` | No | `0` | Set to `1` to enable verbose logging |
| `WEBHOOK_DOMAIN` | No | | Set to enable webhook mode (for example, `bot.example.com`). Omit for long polling |
| `WEBHOOK_PORT` | No | `8080` | Local port the webhook server listens on (behind your reverse proxy) |
| `WEBHOOK_PATH` | No | `/hypergriot` | Path segment appended to the domain |
| `WEBHOOK_SECRET` | No | | Optional secret token validated against Telegram's header |

## Transport selection

The transport is chosen automatically based on `WEBHOOK_DOMAIN`:

- **Long polling** (when `WEBHOOK_DOMAIN` is unset): the bot calls `getUpdates`. No public URL is required. Suitable for development and small deployments.
- **Webhook** (when `WEBHOOK_DOMAIN` is set): Telegram posts updates to your HTTPS endpoint. Suitable for production and horizontal scaling.

> [!WARNING]
> Long polling supports exactly one running process. If two processes poll the same token, Telegram returns `409 Conflict` and updates are dropped. To run more than one instance, switch to webhooks. See [Deployment](../deployment/deployment.md).

## Persistence

All per-group state (settings, notes, filters, warnings, approvals, disabled commands, log channels, and federations) is stored under `DATA_DIR`. By default this is `./data/hypergriot.json`.

> [!IMPORTANT]
> In any deployment where the process or container may be recreated, mount `DATA_DIR` on a persistent volume. Otherwise all group configuration is lost on restart.

## Security notes

> [!CAUTION]
> Never commit `.env` to version control. The `.gitignore` file already excludes it. If a token leaks, revoke it immediately via @BotFather (`/revoke`) and redeploy.

When using webhooks, set `WEBHOOK_SECRET` and choose an unguessable `WEBHOOK_PATH`. The bot validates the secret header Telegram sends on each request.

Next: [Command resolution](../concepts/command-resolution.md).
