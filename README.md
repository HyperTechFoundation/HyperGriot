
<h1 align="center">
HyperGriot
</h1>

<p align="center">
HyperGriot is a modular, high-performance Telegram group-management bot built in TypeScript on the Telegram Bot API. It keeps group chats clean and organized, covering moderation, onboarding, governance, automated protection, federations, and audit logging.
</p>

<p align="center">
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-Strict-1E1B2E?style=for-the-badge&logo=typescript&logoColor=8B7CF6" alt="TypeScript Strict">
  </a> 
  <a href="https://grammy.dev/">
    <img src="https://img.shields.io/badge/grammY-Telegram-1E1B2E?style=for-the-badge&logo=telegram&logoColor=6C9EFF" alt="grammY Telegram">
  </a> 
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/Node.js-18%2B-1E1B2E?style=for-the-badge&logo=node.js&logoColor=7ED957" alt="Node.js 18+">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/83-Tests-1E1B2E?style=for-the-badge&logo=vitest&logoColor=F59E9B" alt="83 Tests">
  <img src="https://img.shields.io/badge/v0.5.0-beta-1E1B2E?style=for-the-badge&logo=git&logoColor=A78BFA" alt="Version v0.5.0-beta">
  <img src="https://img.shields.io/badge/MIT-License-1E1B2E?style=for-the-badge&logo=opensourceinitiative&logoColor=F5D76E" alt="MIT License">
</p>

--- 

## Introduction 
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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
