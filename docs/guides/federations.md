# Federations guide

A federation is a set of linked groups that share a ban list. A federation ban (`/fban`) removes a user from every group in the federation, and a federation unban (`/unfban`) lifts it everywhere.

## Federation lifecycle

| Command | Description | In PM |
| --- | --- | :---: |
| `/newfed <name>` | Create a federation; you become its owner | Yes |
| `/delfed` | Delete your federation | Yes |
| `/joinfed <fedId>` | Link this group to a federation | No |
| `/leavefed` | Remove this group from its federation | No |
| `/fedinfo [fedId]` | Show details about a federation | Yes |
| `/fedadmins` | List a federation's admins | Yes |
| `/fedbanlist` | List every federation ban | Yes |
| `/fedowner` | Show the federation owner | Yes |
| `/fedpromote <target>` | Promote a user to federation admin | Yes |
| `/feddemote <target>` | Demote a federation admin | Yes |

## Federation bans

| Command | Description | In PM |
| --- | --- | :---: |
| `/fban <target> [reason]` | Ban a user across every group in the federation | Yes |
| `/unfban <target> [reason]` | Remove a federation ban everywhere | Yes |

Examples:

```
/newfed My Community Network
/joinfed fed-abc123
/fban @raider coordinated raid
/unfban 123456789 appeal accepted
```

> [!IMPORTANT]
> Federation commands are authorized against the federation, not the group. To run `/fban`, `/fedpromote`, or `/feddemote`, the caller must be the federation owner or a federation admin.

## How fan-out works

When `/fban` runs, the engine resolves the target through the same four-tier pipeline used by group moderation, records the ban in the federation's ban registry, and then enqueues a removal action against every group linked to the federation.

> [!NOTE]
> `/fban` works in the bot's private chat because it is federation-scoped rather than group-scoped. In a PM there is no reply context, so the target must be supplied as an @mention or a numeric user ID.

## Ban on join

> [!WARNING]
> When a group is linked to a federation, every newly joining member is checked against the federation's ban registry. A federation-banned user is removed immediately, before any welcome message or onboarding flow runs. This prevents banned users from simply leaving and rejoining a linked group.

## Cross-group rate limits

Federation fan-out can trigger many outbound API calls at once. HyperGriot batches removals and respects Telegram's `Retry-After` (HTTP 429) with backoff. For very large federations running multiple workers, fan-out should be routed through a shared queue.

Next: [Log channels guide](log-channels.md).
