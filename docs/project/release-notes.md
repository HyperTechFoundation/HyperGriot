# Release notes

## v0.5.0-beta

The v0.5.0-beta release hardens the core command-resolution engine, resolves a set of security and usability edge cases across modules, optimizes Telegram API throughput, and delivers an interactive help menu modeled on Miss Rose.

> [!NOTE]
> All user-facing communications adhere to a clean-text standard: zero decorative emoji, standardized punctuation, and robust HTML entity escaping.

### Command resolution and mention pipeline

The command-resolution engine maps user inputs (replies, text mentions, @username strings, `t.me` links, `tg://user?id=` links, and raw numeric user IDs) to a concrete Telegram user identifier. Because the Bot API lacks a username-to-ID lookup, HyperGriot uses a four-tier progressive strategy:

1. Inline entity inspection (text-mention entities and text-link URL parameters), with no API or database call.
2. In-memory cache of recently active users.
3. Persistent user store on disk, holding every user observed across any group or private chat.
4. Dynamic administrator resolution via `getChatAdministrators` on an unindexed username miss during a group command.

> [!IMPORTANT]
> A target-fallback vulnerability was fixed. Previously, when an admin targeted an unindexed username while replying to another user, the engine could fall back to the replied user. The engine now strictly evaluates whether the target type is empty before considering reply context, so an explicit target argument is never overwritten with an innocent replied user.

### Pipeline and prefix normalization

The pipeline middleware intercepts every update before module dispatch:

```
Incoming update -> Prefix normalization -> Logging -> User ingestion
                -> Disabled commands filter -> Module handlers
```

Dual-prefix routing supports `/` and `!` interchangeably. The normalization middleware rewrites a leading `!` to `/` and injects a synthetic `bot_command` entity, including correct handling of bot-username tags such as `!command@YourBot`.

> [!TIP]
> User ingestion records identity metadata across every update type: senders, replies, forwards, join and leave events, callback queries, and chat-member transitions.

### Interactive help menu

The help system is an inline-keyboard matrix matching Miss Rose. The root menu presents an introduction and startup commands, followed by 18 category buttons in a three-column grid and a Close button. Selecting a category edits the message in place to show a header, a module overview, the complete command listing with usage signatures, operational notes, and a Back button.

### Moderation and audit hardening

- `/sban` and `/smute` delete the triggering command, emit no public card or acknowledgment, and route the full audit card only to the configured log channel.
- The duration utility enforces a 30-second minimum, preventing short duration tokens from producing accidental permanent bans or mutes.
- `/unban` and `/unmute` events are now mirrored to the log channel via dedicated formatters, giving complete parity with punitive actions.

### Governance, protection, and federation

- `/promote` uses a relaxed target guard, allowing owners to re-promote existing administrators to adjust permission flags without a self-blocking error.
- Rules and notes no longer undergo double HTML escaping on retrieval; formatting tags render correctly while URL-button attachments are preserved.
- When a group is linked to a federation, every new member is checked against the federation ban registry and removed on join, before any welcome or onboarding flow.

### Hygiene and bulk operations

The `/clean` command now aggregates target message IDs and issues a single bulk deletion request via the `deleteMessages` endpoint, with a graceful fallback to individual deletions for older message ranges.

> [!WARNING]
> Individual message-deletion loops in high-traffic chats cause immediate API throttling. The bulk approach avoids this.

### Verification

The release is validated with TypeScript strict typechecking and the Vitest suite.

| Test suite | Tests | Scope |
| --- | :---: | --- |
| `target.test.ts` | 16 | Entity, cache, store, token, and reply resolution |
| `moderation.test.ts` | 7 | Ban, tban, sban, unban, mute, tmute, smute, kick |
| `governance.test.ts` | 6 | Pin, rules, notes, hashtag invocation, promote, adminlist |
| `protection.test.ts` | 7 | Locks, filters, antiflood, warnings, approvals |
| `network.test.ts` | 5 | Federation lifecycle, fban/unfban fan-out, PM commands |
| `onboarding.test.ts` | 5 | Welcome and goodbye templating, buttons, join fedban check |
| `help.test.ts` | 9 | Three-column layout, HTML escaping, category transitions |
| `prefix.test.ts` | 5 | Dual-prefix normalization and bot-tag preservation |
| `hygiene.test.ts` | 4 | Bulk clean, command disabling, service-message deletion |
| `store.test.ts` | 7 | JSON persistence, schema buckets, serialization |
| `time.test.ts` | 5 | Time-token parsing |
| `formatting.test.ts` | 7 | HTML card generators, user-link formatting |

Totals: 12 test suites, 83 tests passing, zero typecheck errors.

Back to: [Documentation home](../README.md).
