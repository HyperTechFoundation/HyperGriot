# Introduction

HyperGriot is a single bot that consolidates everything a Telegram group needs to stay clean and organized: moderation, member onboarding, governance, automated protection, cross-group federations, and audit logging.

## What problem it solves

Managing a busy Telegram group by hand does not scale. Spam, raids, and rule-breakers overwhelm small admin teams, and most bots demand rigid command syntax and fail silently when an admin replies instead of mentioning, or gives an ID instead of replying. HyperGriot fixes this with one consistent engine that understands how an admin actually refers to a target.

## The defining capability

Every moderation command runs through a shared **command-resolution engine**. It detects how a target was referenced and resolves it to a Telegram user ID with zero extra API calls on the common path:

```
/ban            (replying to a message)   bans the user you replied to
/ban @spammer   raid                      bans @spammer, with the reason "raid"
/ban 123456789  nsfw                      bans user ID 123456789
/ban                                      asks who you mean, instead of failing silently
```

Read [Command resolution](../concepts/command-resolution.md) for the full mechanism.

## Feature overview

| Area | What it covers |
| --- | --- |
| Moderation | Ban, temp ban, silent ban, unban, mute, temp mute, silent mute, unmute, kick |
| Onboarding | Welcome and goodbye messages with templating and buttons |
| Governance | Pin, rules, notes, admin promotion and titles |
| Protection | Antiflood, locks, filters, reports, warnings, approvals |
| Network | Federations with cross-group bans, log channels |
| Hygiene | Message purges, service-message cleanup, command disabling, forum-topic awareness |

## Who it is for

| Role | Typical needs |
| --- | --- |
| Group owner | Full control, secure defaults, federation ownership |
| Group admin | Fast ban/mute/kick, logs, rules, notes, locks |
| Group member | Read rules and notes, get welcomed, report issues |
| Network operator | Federations, shared bans, consistent configuration across groups |

## Design principles

- **One engine, many commands.** A single resolver drives every moderation action.
- **Fast path by default.** Targets resolve with no API calls in the common case.
- **Predictable over clever.** Explicit references win over coincidental replies; failures explain exactly what is missing.
- **Clean messaging.** All user-facing text is plain, professional, and emoji-free.
- **Modular and toggleable.** Each feature is an independent, per-group module.

> [!NOTE]
> HyperGriot uses only the official Telegram Bot API. It is not a userbot (MTProto client), so some operations that require user-account APIs (such as resolving any arbitrary username) have deliberate limitations documented in [Troubleshooting](../reference/troubleshooting.md).

Next: [Quickstart](quickstart.md).
