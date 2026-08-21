# Architecture overview

This page describes how HyperGriot is structured internally, for contributors and operators who want to understand the system rather than just use it.

## Technology stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| Language | TypeScript (strict) | Type safety and self-documenting contracts |
| Runtime | Node.js 18 or newer | Mature async I/O for high-throughput bot workloads |
| Framework | grammY | TypeScript-first, lightweight middleware pipeline |
| Transport | Telegram Bot API (long polling and webhooks) | Official, stable, no MTProto |
| Persistence | Abstracted repository (JSON file in v0.5.0-beta) | Per-group config, swappable for SQLite or Postgres |
| Caching | In-memory maps with a persistent backing store | Username-to-ID cache, admin cache, flood counters |
| Testing | Vitest | Fast, ESM-native, TypeScript-friendly |

## Request pipeline

Every incoming update flows through a fixed pipeline before any feature module runs:

```
Incoming update
  -> Prefix normalization        (! rewritten to /, synthetic bot_command entity injected)
  -> Logging
  -> User ingestion              (every observed user cached to memory and disk)
  -> Disabled commands filter    (silently drops disabled commands for non-admins)
  -> Module handlers
```

## Core components

| Component | Responsibility |
| --- | --- |
| Update router / pipeline | Receives updates, runs global middleware |
| Command-resolution engine | Classifies the target, resolves a user ID, extracts reason and duration |
| Guards / permissions | Group-versus-PM checks, admin and owner checks, bot-rights checks, target-rank checks |
| Feature modules | Independent units, each registering its own commands |
| Repository / cache | Durable per-group config plus in-memory caches |

## Module map

| Module group | Modules |
| --- | --- |
| Moderation | ban, tban, sban, unban, mute, tmute, smute, unmute, kick |
| Onboarding | welcome, goodbye |
| Governance | pin, rules, notes, admin |
| Protection | antiflood, locks, filters, reports, warnings, approval |
| Network | federation, logchannel |
| Hygiene | clean, disabling, topics |

## Data model

State is namespaced by chat ID and held behind a repository abstraction so the backend can change without touching modules.

```
chat:{chatId}:settings         welcome, goodbye, rules, locks, flood,
                               reports, approval, cleaning, disabling
chat:{chatId}:notes            name -> { text, buttons, private }
chat:{chatId}:filters          trigger -> reply
chat:{chatId}:warnings:{user}  { count, reasons[] }
chat:{chatId}:approved:{user}  boolean
chat:{chatId}:disabledcmds     set of command names
fed:{fedId}                    { owner, name, chats[], admins[] }
fed:{fedId}:bans:{user}        { reason, banner }
global:username:{lower}        { userId, firstName, ts }
global:admins:{chatId}         cached admin list and timestamp
```

> [!NOTE]
> Hot data (flood counters, caches) lives in memory only. Durable configuration is written through to the store and survives restarts.

## Design principles

- **One engine, many commands.** Modules never re-implement target parsing.
- **Fast path by default.** Resolution avoids Telegram API calls whenever an ID is already available.
- **Idempotent and safe.** Actions are safe to retry; the bot never targets the wrong user.
- **Strict typing.** No `any` in public surfaces.
- **Declarative command metadata.** Each command declares its needs (admin-only, group-only, expects time, expects reason), and the engine enforces them.

## Reliability and error handling

Telegram calls are wrapped with retry and exponential backoff for transient errors. A single bad update never crashes the worker. Moderation outcomes are idempotent: re-banning an already-banned user succeeds, and re-muting updates permissions.

## Observability

Structured logs are emitted per update, including chat ID, user ID, command, target type, resolved ID, latency, and status. Setting `DEBUG=1` enables verbose request logging during development. Every moderation action is mirrored to the configured log channel for audit.

Next: [Command index](../reference/command-index.md).
