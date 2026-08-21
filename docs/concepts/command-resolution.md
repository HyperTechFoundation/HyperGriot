# Command resolution

The command-resolution engine is the backbone of HyperGriot. Every moderation, governance, and network command asks it the same question: given this command message, who is the target, and what extra context (reason, duration) was provided?

## Target types

Every command classifies its target into one of four types:

| Type | Trigger | Where the user ID comes from |
| --- | --- | --- |
| `reply` | The command is sent as a reply to a message | The replied message's sender |
| `mention` | An @username or inline text-mention appears in the command | A text-mention's inline user object, or the username cache |
| `userid` | The first argument is a numeric user ID | The number itself |
| `empty` | None of the above | Nothing to act on |

## Resolution priority

The engine resolves the target in this order:

1. If the arguments contain an explicit reference (an @mention or a numeric ID), use it.
2. Otherwise, if the command is a reply, target the replied user.
3. Otherwise, the target is empty and the command fails with guidance.

> [!IMPORTANT]
> An explicit reference always wins over a coincidental reply. If you reply to Alice but write `/ban @bob reason`, the bot bans Bob, not Alice. This makes behavior predictable.

## Four-tier resolution

Because the Telegram Bot API has no global username-to-ID lookup endpoint, HyperGriot resolves targets through a four-tier progressive strategy. Each tier is only consulted if the previous one missed.

| Tier | Source | Cost |
| --- | --- | --- |
| 1. Inline entity inspection | `text_mention` entities, `text_link` URL parameters | No API call, no database read |
| 2. In-memory cache | Recently active users in the current process | No API call |
| 3. Persistent user store | All users ever observed, persisted to disk | A local read |
| 4. Dynamic administrator resolution | `getChatAdministrators` when a username miss occurs during a group command | One Telegram API call |

The common cases (reply, inline text-mention, numeric ID, cached username) resolve with zero Telegram API calls.

## The target-fallback safeguard

> [!IMPORTANT]
> The engine distinguishes "no target was given" from "a target was given but could not be resolved." When an admin provides an @username that is not yet known while also replying to another user, the bot never silently falls back to the replied user. It reports that the username could not be resolved and asks for a reply or numeric ID instead.

This prevents the most dangerous class of moderation mistake: actioning the wrong person.

## What the engine returns

```ts
interface TargetResult {
  type: "reply" | "mention" | "userid" | "empty";
  userId: number | null;
  username: string | null;
  reason: string;            // "" when none
  reasonPresent: boolean;
  durationMs: number | null; // temp commands only
  durationLabel: string | null;
}
```

## Reason extraction

After the command token, the target token, and (for temp commands) the duration token are removed, the remaining text becomes the reason. An empty reason is normalized to `None`. Reason text is HTML-escaped before it is rendered in any message.

## Duration parsing

Temp commands (`/tban`, `/tmute`) parse a duration token. The grammar is one or more number-plus-unit pairs:

```
token := unit+
unit  := <positive integer> <s | m | h | d | w>
```

| Unit | Meaning |
| --- | --- |
| `s` | seconds |
| `m` | minutes |
| `h` | hours |
| `d` | days |
| `w` | weeks |

Combinations are allowed, for example `1h30m` or `2d12h`.

> [!NOTE]
> The duration token can appear in any position. `/tban @user 2h raid` and `/tban 2h @user raid` are both accepted.

## Dual-prefix support

Every command works identically with `/` or `!`. A normalization middleware intercepts messages that begin with `!`, rewrites the leading `!` to `/`, and injects a synthetic `bot_command` entity so the command router handles it natively. This includes commands that carry a bot-username tag, such as `!ban@YourBot`.

> [!TIP]
> You do not need to do anything to enable the `!` prefix. It works everywhere automatically, including in the bot's private chat.

## The username limitation

> [!WARNING]
> HyperGriot can only act on an @username if it has previously observed that user. A user who has never sent a message or joined a group the bot is in cannot be resolved by username. In that case, reply to one of their messages or use their numeric user ID. See [Troubleshooting](../reference/troubleshooting.md).

Next: [Permissions](permissions.md).
