# Log channels guide

A log channel is a chat that mirrors moderation actions for audit. When a log channel is configured, every ban, mute, kick, unban, unmute, warning, and federation ban is posted there as a styled card, identical to the one shown in the group (or, for silent actions, the one that was suppressed).

## Commands

| Command | Description |
| --- | --- |
| `/logchannel` (reply in the channel) | Set the replied channel as the moderation log |
| `/unlogchannel` | Stop mirroring actions to a log channel |
| `/logchannel` | Show the current log channel |

## Setup

1. Create a channel (or use an existing one) and add the bot as an administrator with permission to post messages.
2. In the channel, forward or send a message, then reply to it from the bot with `/logchannel`.

> [!IMPORTANT]
> The bot must be an admin of the log channel with the right to post messages, or the mirrored cards will fail to send. Failures are handled gracefully and never interrupt the moderation action itself.

## What is mirrored

| Action | Mirrored |
| --- | :---: |
| Ban, temp ban, silent ban | Yes |
| Unban | Yes |
| Mute, temp mute, silent mute | Yes |
| Unmute | Yes |
| Kick | Yes |
| Warning | Yes |
| Federation ban / unban | Yes |

> [!NOTE]
> Silent moderation commands (`/sban`, `/smute`) post no card in the group. Their full audit card is sent only to the log channel, so the log remains the complete record of every action.

## Typical use

A log channel gives owners and network operators a single place to review everything that happens across one or many groups. For multi-group setups, point every group's log at the same channel to get a unified audit feed.

Next: [Hygiene guide](hygiene.md).
