# Cleanup guide

Cleanup features keep a group tidy: bulk message purges, automatic cleanup of service messages, per-group command disabling, and forum-topic awareness.

## Message cleanup

| Command | Description |
| --- | --- |
| `/clean <N>` (reply) | Delete N messages starting from the replied one |
| `/cleanwelcome <on\|off>` | Auto-delete the previous welcome when a new one is sent |
| `/cleangoodbye <on\|off>` | Auto-delete the previous goodbye when someone new leaves |
| `/cleanservice <on\|off>` | Auto-delete Telegram service messages (join, leave, pin) |

> [!IMPORTANT]
> `/clean` uses Telegram's bulk deletion endpoint (`deleteMessages`) in a single request rather than deleting messages one by one. This avoids the HTTP 429 throttling that individual deletion loops cause in busy chats, with a graceful fallback to individual deletions for older message ranges.

Required right: Delete messages (`can_delete_messages`).

## Command disabling

You can disable specific commands for non-admins in a group. Disabled commands produce no response for members; admins can always re-enable them.

| Command | Description |
| --- | --- |
| `/disable <command>` | Turn off a command for non-admins in this group |
| `/enable <command>` | Re-enable a disabled command |
| `/enableall` | Re-enable every command |
| `/disabled` | List commands disabled in this group |
| `/disableable` | List commands that can be disabled |

```
/disable id
/disableable
/enable id
```

> [!NOTE]
> Disabling is applied through the pipeline middleware before module dispatch. A non-admin who calls a disabled command is filtered silently, without generating error noise in the chat.

## Forum-topic awareness

In forum-enabled supergroups (groups with topics), HyperGriot scopes automated replies to the topic or thread in which they are relevant, including welcome messages, notes, and log mirroring.

> [!TIP]
> Moderation remains chat-wide regardless of topic. A ban issued in one topic applies to the whole group.

## General commands

| Command | Description |
| --- | --- |
| `/start` | Start the bot and read the introduction |
| `/help` | Open the command menu |
| `/ping` | Check the bot is online |
| `/id` | Show the chat ID and relevant user IDs |

Next: [Architecture overview](../architecture/overview.md).
