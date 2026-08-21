# HyperGriot Documentation

HyperGriot is a modular, high-performance Telegram group-management bot built in TypeScript on the Telegram Bot API. It handles moderation, onboarding, governance, automated protection, federations, and audit logging through one consistent command-resolution engine.

> [!IMPORTANT]
> This is the live documentation for **HyperGriot v0.5.0-beta**. The bot supports commands with both `/` and `!` prefixes interchangeably (for example, `/ban` and `!ban` behave identically).

## Documentation map

| Section | Contents |
| --- | --- |
| [Getting Started](getting-started/introduction.md) | Introduction, quickstart, configuration |
| [Concepts](concepts/command-resolution.md) | How targets are resolved, the permission model |
| [Guides](guides/moderation.md) | Per-feature usage guides |
| [Architecture](architecture/overview.md) | System design, pipeline, data model |
| [Reference](reference/command-index.md) | Full command index, help menu, troubleshooting |
| [Deployment](deployment/deployment.md) | Every deployment method and operations runbook |
| [Project](project/release-notes.md) | Release notes |

## Recommended reading paths

**New user (group admin)**
1. [Introduction](getting-started/introduction.md)
2. [Quickstart](getting-started/quickstart.md)
3. [Command resolution](concepts/command-resolution.md)
4. [Moderation guide](guides/moderation.md)
5. [Command index](reference/command-index.md)

**Network operator (multiple groups)**
1. [Introduction](getting-started/introduction.md)
2. [Federations guide](guides/federations.md)
3. [Log channels guide](guides/log-channels.md)
4. [Deployment](deployment/deployment.md)

**Contributor / developer**
1. [Introduction](getting-started/introduction.md)
2. [Architecture overview](architecture/overview.md)
3. [Command resolution](concepts/command-resolution.md)
4. [Permissions](concepts/permissions.md)
5. [Troubleshooting](reference/troubleshooting.md)

## Conventions used in these docs

> [!NOTE]
> Throughout this documentation, `<target>` always means a reply to a message, an @mention, or a numeric user ID. A command written as `/ban <target> [reason]` therefore accepts any of these reference styles for the target, and an optional reason.

- Commands are shown with the `/` prefix, but `!` works everywhere.
- `<required>` denotes a required argument; `[optional]` denotes an optional one.
- `<a|b>` denotes a choice between options.
- `<time>` denotes a duration token such as `1m`, `2h`, `1d`, or `1w` (combinations like `1h30m` are allowed).

## Project status

| Field | Value |
| --- | --- |
| Version | v0.5.0-beta |
| Language | TypeScript (strict) |
| Runtime | Node.js 18 or newer |
| Framework | grammY |
| Transport | Long polling (development) and webhooks (production) |
| Test suite | 12 suites, 83 tests passing |

See [Release notes](project/release-notes.md) for the current state and recent changes.
