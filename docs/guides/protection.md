# Protection guide

Protection features automatically defend a group against spam, floods, and rule violations, and give admins lighter-touch tools (warnings, reports, approvals).

## Locks

Locks block specific message types or behaviors for non-admins. Approved users are exempt.

| Command | Description |
| --- | --- |
| `/lock <type>` | Block a message type for non-admins |
| `/unlock <type>` | Allow a previously locked message type |
| `/locks` | Show which message types are locked |
| `/locktypes` | List every lockable type |
| `/lockall` | Lock every message type at once |
| `/unlockall` | Remove all locks |

Lockable types: `messages`, `media`, `audio`, `voice`, `video`, `stickers`, `gifs`, `polls`, `games`, `inline`, `contacts`, `location`, `forward`, `link`, `bots`, `other`.

> [!NOTE]
> When a non-admin, non-approved member sends a locked message type, the bot deletes it. Admins and approved users are never affected by locks.

Required right: Delete messages (`can_delete_messages`).

## Filters

Filters are keyword triggers that produce an automatic reply.

| Command | Description |
| --- | --- |
| `/filter <trigger> <reply>` | Auto-reply whenever a trigger word is sent |
| `/stop <trigger>` | Remove a filter |
| `/stopall` | Remove every filter |
| `/filters` | List all filters |

```
/filter discord Join our Discord at https://example.com/discord
```

Triggers are matched as case-insensitive substrings anywhere in a message.

## Antiflood

Antiflood limits how many messages a single user may send within a sliding time window.

| Command | Description |
| --- | --- |
| `/setflood <N\|off>` | Set how many messages trigger flood protection |
| `/flood` | Show the current flood settings |
| `/setfloodmode <mute\|ban\|kick\|tmute\|tban>` | Choose the action taken on flood |

> [!IMPORTANT]
> The counter is a per-user sliding window held in memory. When a user exceeds the threshold within the window, the configured action runs. The default action is a 1-hour temp mute, configurable per group.

## Warnings

Warnings accumulate against a user and escalate to a configured action at a limit.

| Command | Description |
| --- | --- |
| `/warn <target> [reason]` | Add a warning to a user |
| `/warns <target>` | Show a user's warnings |
| `/resetwarn <target>` | Reset a user's warning count |
| `/rmwarn <target>` | Remove a user's most recent warning |
| `/strongwarn <on\|off>` | Apply the limit action immediately on every warning |
| `/setwarnlimit <N>` | Set how many warnings trigger the action |
| `/setwarnaction <mute\|kick\|ban\|tmute\|tban>` | Choose the action taken at the warning limit |

## Reports

Reports let members flag a message for admin attention.

| Command | Description |
| --- | --- |
| `/report` (reply) | Reply to a message to alert the admins |
| `/reports on\|off` | Enable or disable the report system |
| `/reports` | Show the current setting |

## Approvals

Approval exempts a user from locks and flood limits. It also powers the gating flow described in [Onboarding](onboarding.md).

| Command | Description |
| --- | --- |
| `/approve <target>` | Exempt a user from locks and flood limits |
| `/unapprove <target>` | Remove a user's approval |
| `/approved` | List approved users |
| `/approval on\|off` | Toggle approval-gated join |

> [!TIP]
> Use approvals for trusted members, bots, or announcement feeds that must be allowed to post content types you otherwise lock for everyone else.

Next: [Federations guide](federations.md).
