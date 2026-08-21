# Permissions

HyperGriot enforces a strict permission model before any moderation action runs. This page describes the hierarchy, the required Telegram admin rights, and the guard sequence.

## Role hierarchy

| Role | Who they are | Capabilities |
| --- | --- | --- |
| Global owner | A user ID listed in `OWNERS` | Bypasses every check; can manage the bot globally |
| Chat creator / admins | Telegram-granted admins of a group | Run moderation and configuration commands, subject to their rights |
| Member | A regular participant | Run read commands (`/rules`, `/notes`, `/report`, `/get`) and be the target of actions |

## Required Telegram admin rights

Grant the bot these rights in every group where it should moderate (Group settings, Administrators, add the bot):

| Right | Powers these commands |
| --- | --- |
| Ban users (`can_restrict_members`) | `/ban`, `/tban`, `/sban`, `/unban`, `/mute`, `/tmute`, `/smute`, `/unmute`, `/kick` |
| Delete messages (`can_delete_messages`) | Locks, clean and service-message cleanup, filters, `/clean`, silent bans |
| Pin messages (`can_pin_messages`) | `/pin`, `/unpin`, `/unpinall`, `/pinned` |
| Promote admins (`can_promote_members`) | `/promote`, `/demote`, `/title` |
| Invite users (`can_invite_users`) | Recovery and edge cases |

> [!IMPORTANT]
> If a required right is missing, the corresponding command fails with a clear message naming the right it needs. The bot never silently no-ops.

## The guard sequence

Before a moderation command executes, the engine runs these checks in order. The first failure stops the command and returns a human-readable message.

```
Is this a group (not a PM)?
  -> Is the caller an admin or owner?
     -> Does the bot have the required right?
        -> Was a target resolved?
           -> Is the target protected (admin, bot, or owner)?
              -> (temp commands) Was a duration provided?
                 -> Execute
```

## Protected targets

The bot refuses to act on:

- Itself.
- Any global owner.
- Any admin of the current group.

> [!NOTE]
> The `/promote` command uses a relaxed target guard that allows re-promoting an existing admin. This lets an owner adjust another admin's permission flags or grant topic-management rights without a self-blocking error.

## PM-capable commands

Most commands require a group context. A small set is federation-scoped or informational and also works in the bot's private chat:

| Command | In PM | Note |
| --- | :---: | --- |
| `/fban`, `/unfban` | Yes | Ban or unban across the federation; target by @mention or numeric ID |
| `/newfed`, `/delfed` | Yes | Federation ownership |
| `/fedinfo`, `/fedadmins`, `/fedbanlist`, `/fedowner` | Yes | Read-only federation information |
| `/fedpromote`, `/feddemote` | Yes | Federation admin management |
| `/start`, `/help`, `/ping`, `/id` | Yes | General and informational |
| `/joinfed`, `/leavefed` | No | These bind a group to a federation |
| All moderation and configuration | No | Require a group context |

> [!TIP]
> Federation commands are authorized against the federation, not the group. A caller must be the federation owner or a federation admin to run `/fban` or federation-management commands.

## Safe rendering

All user-controlled text (names, reasons, usernames, note and rule content) is HTML-escaped before it appears in any message, preventing injection through user input.

Next: [Moderation guide](../guides/moderation.md).
