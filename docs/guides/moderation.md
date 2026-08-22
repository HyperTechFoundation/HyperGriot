# Moderation guide

Moderation commands cover banning, muting, and kicking. They all share the command-resolution engine and the permission guard sequence described in [Command resolution](../concepts/command-resolution.md) and [Permissions](../concepts/permissions.md).

Every command accepts a `<target>` (reply, @mention, or numeric user ID) and an optional `[reason]`.

## Ban

| Command | Description |
| --- | --- |
| `/ban <target> [reason]` | Ban a user permanently from the group |
| `/tban <target> <time> [reason]` | Temporarily ban a user for a set duration |
| `/sban <target> [reason]` | Ban a user silently, without a public message |
| `/unban <target> [reason]` | Lift a ban on a user |

Examples:

```
/ban            (replying)         bans the replied user with reason "None"
/ban raid       (replying)         bans the replied user with reason "raid"
/ban @spammer   advertising        bans @spammer with reason "advertising"
/ban 123456789  raid               bans user ID 123456789
/tban @user 2h   cooling off       temp-bans @user for 2 hours
```

## Mute

| Command | Description |
| --- | --- |
| `/mute <target> [reason]` | Mute a user until they are unmuted |
| `/tmute <target> <time> [reason]` | Temporarily mute a user for a set duration |
| `/smute <target> [reason]` | Mute a user silently, without a public message |
| `/unmute <target> [reason]` | Restore a user's ability to send messages |

Muting uses Telegram's `restrictChatMember` with all sending permissions disabled. Unmuting restores them. Temp mute passes an `until_date`.

## Kick

| Command | Description |
| --- | --- |
| `/kick <target> [reason]` | Remove a user; they can rejoin |

A kick performs a ban followed by an immediate unban, so the member is removed but not permanently excluded.

## Message format

Every moderation action emits a styled card:

```
<user, linked to profile> got banned from the group.
User ID: 123456789
Username: @spammer
Reason: advertising
Banned By: Admin
```

The header verb changes with the action (`got banned`, `got muted`, `got kicked`). Temp actions include the duration in the header. The `Username` and `Reason` lines appear only when relevant; an empty reason shows `None`.

## Silent moderation

> [!IMPORTANT]
> `/sban` and `/smute` are designed for covert moderation. They delete the triggering command, emit no public card or acknowledgment in the chat, and route the full audit card only to the configured log channel.

## The 30-second rule

> [!WARNING]
> Under the Telegram Bot API, an `until_date` within 30 seconds of the current time is treated as permanent. HyperGriot enforces a 30-second minimum on all durations, so short tokens like `5s` cannot accidentally produce a permanent ban or mute.

Required right: Ban users (`can_restrict_members`) for all commands in this guide.

Next: [Welcome guide](welcome.md).
