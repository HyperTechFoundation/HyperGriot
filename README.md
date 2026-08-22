# HyperGriot

HyperGriot is a modular, high-performance Telegram group-management bot built in TypeScript on the Telegram Bot API. It keeps group chats clean and organized, covering moderation, onboarding, governance, automated protection, federations, and audit logging.

Every moderation command runs through one **command-resolution engine** that detects how a target was referenced and resolves it to a Telegram user ID with zero extra API calls on the common path:

```
/ban            (replying to a message)   bans the user you replied to
/ban @spammer   raid                      bans @spammer, reason "raid"
/ban 123456789  nsfw                      bans user ID 123456789
/ban                                      asks who you mean, instead of failing silently
```

The engine classifies each command into one of four target types - reply, mention, userid, or empty - validates the caller and target, extracts any reason or duration, and returns a consistent result that the feature modules act on.

> [!IMPORTANT]
> Commands work with both `/` and `!` as the prefix. For example, `/ban` and `!ban` behave identically.

## Documentation

> [!NOTE]
> This repository is documentation-first. The implementation lives in the local working tree; this `README.md` and the `docs/` tree are what is published.

| Document | Description |
| --- | --- |
| [docs/README.md](docs/README.md) | Documentation home, map, and reading paths |
| [Getting Started](docs/getting-started/introduction.md) | Introduction, quickstart, configuration |
| [Concepts](docs/concepts/command-resolution.md) | Command resolution and permissions |
| [Guides](docs/guides/moderation.md) | Per-feature usage guides |
| [Architecture](docs/architecture/overview.md) | System design, pipeline, data model |
| [Reference](docs/reference/command-index.md) | Command index, help menu, troubleshooting |
| [Deployment](docs/deployment/deployment.md) | Every deployment method and operations runbook |
| [Release notes](docs/project/release-notes.md) | Current release state and changes |

**Start here:** [docs/README.md](docs/README.md).

## Features

- **Moderation** - ban, temp ban, silent ban, unban, mute, temp mute, silent mute, unmute, kick
- **Welcome** - welcome and goodbye messages with templating, buttons, and join verification
- **Admin** - pin, rules, notes, admin promotion and titles
- **Security** - antiflood, locks, filters, reports, warnings, approvals
- **Federation** - federations with cross-group bans, log channels
- **Cleanup** - message purges, service-message cleanup, command disabling, forum-topic awareness

For the full command reference, see the [Command index](docs/reference/command-index.md).

## Technology stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| Runtime | Node.js 18 or newer |
| Framework | grammY |
| Persistence | Abstracted repository (JSON in v0.5.0-beta) |
| Transport | Long polling (development) and webhooks (production) |

## Getting started

```bash
npm install
cp .env.example .env   # set BOT_TOKEN and OWNERS
npm run build
npm start
```

> [!TIP]
> For a guided walkthrough, see the [Quickstart](docs/getting-started/quickstart.md).

The bot must be granted admin rights in each group (Ban users, Delete messages, Pin messages, Promote admins) to use moderation features. See [Permissions](docs/concepts/permissions.md).

## Testing

```bash
npm test            # run the vitest suite
npm run typecheck   # tsc --noEmit
```

The v0.5.0-beta release passes 12 test suites and 83 tests under strict TypeScript. See the [Release notes](docs/project/release-notes.md) for details.

## License

MIT.
