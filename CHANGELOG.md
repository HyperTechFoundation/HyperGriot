# Changelog

All notable changes to HyperGriot are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). As a beta
release, stability guarantees are limited to the behavior described under each entry.

## [Unreleased]

No unreleased changes.

## [0.5.0-beta] - 2026-08-21

The first beta release. It hardens the command-resolution engine, resolves a set of security
and usability edge cases across modules, optimizes Telegram API throughput, and introduces an
interactive help menu modeled on Miss Rose.

### Added

- **Four-tier target resolution.** References now resolve through a progressive pipeline: inline
  entity inspection, an in-memory cache, a persistent on-disk user store, and dynamic
  administrator resolution via `getChatAdministrators`. The common cases resolve with zero
  Telegram API calls.
- **Dual-prefix command support.** Every command works with `/` or `!`, including commands that
  carry a bot-username tag (for example `!ban@YourBot`). A normalization middleware rewrites the
  prefix and injects a synthetic `bot_command` entity.
- **Interactive help menu.** A three-column inline-keyboard menu with 18 categories, in-place
  category transitions, usage signatures, and operational notes.
- **Federation ban-on-join.** When a group is linked to a federation, every new member is checked
  against the federation ban registry and removed on join, before any welcome or onboarding flow.
- **Audit mirroring for unbans and unmutes.** `/unban` and `/unmute` events now post dedicated
  cards to the log channel, giving full parity with punitive actions.
- **Persistent user store.** Observed users are persisted to disk so username-to-ID resolution
  survives restarts and accumulates across groups.
- **Bulk message deletion.** `/clean` issues a single `deleteMessages` request instead of one
  request per message.
- **Broader user ingestion.** Identity metadata is recorded across senders, replies, forwards,
  join and leave events, callback queries, and chat-member transitions.

### Changed

- **Clean-text standard.** All user-facing messages are now plain, professional text with zero
  decorative emoji.
- **Rules and notes render as raw HTML.** Formatting tags (`<b>`, `<i>`, `<code>`, `<a>`) render
  correctly on retrieval, and URL-button attachments are preserved. Retrieval no longer
  double-escapes content.
- **Relaxed promote guard.** `/promote` now allows re-promoting an existing admin to adjust
  permission flags or grant topic-management rights without a self-blocking error.
- **Silent moderation.** `/sban` and `/smute` delete the triggering command, emit no public card,
  and route the audit card only to the configured log channel.
- **Disabled-command filtering.** Commands disabled per group are filtered silently for non-admins
  before dispatch, without generating error noise in the chat.

### Fixed

- **Target-fallback vulnerability.** When an admin targeted an unindexed `@username` while replying
  to another user, the engine could fall back to the replied user. It now strictly checks whether
  the target type is empty before considering reply context, so an explicit target is never
  overwritten with an innocent replied user.
- **Accidental permanent durations.** Short duration tokens that fell within Telegram's 30-second
  window could produce permanent bans or mutes. Durations are now clamped to a 30-second minimum.
- **Purge throttling.** `/clean` no longer fires up to 100 individual deletion requests, which
  caused HTTP 429 throttling in busy chats.
- **Help-menu HTML escaping.** Angle brackets in usage signatures (for example `<target>`) are
  escaped before rendering, so they no longer break the message.

### Security

- **Moderation targeting safety.** Resolved the target-fallback issue that could cause an action
  to affect the wrong user (see Fixed).
- **Input injection hardening.** User-controlled values in names, reasons, rules, notes, and
  help-menu signatures are HTML-escaped before rendering.

### Tests

- The test suite now comprises 12 suites and 83 passing tests under strict TypeScript, covering
  target resolution, the time parser, HTML formatting, the store, and every module.

[Unreleased]: https://github.com/OWNER/REPO/compare/v0.5.0-beta...HEAD
[0.5.0-beta]: https://github.com/OWNER/REPO/releases/tag/v0.5.0-beta
