# Admin guide

Admin covers pinned messages, group rules, notes, and admin management.

## Pin

| Command | Description |
| --- | --- |
| `/pin [loud]` (reply) | Pin the replied message; add `loud` to notify the group |
| `/unpin` (reply) | Unpin the replied message |
| `/unpinall` | Unpin every message in the group |
| `/pinned` | Show the most recently pinned message |

Required right: Pin messages (`can_pin_messages`).

## Rules

| Command | Description |
| --- | --- |
| `/setrules <text>` | Set the group rules |
| `/rules` | Show the group rules (any member can call this) |
| `/clearrules` | Clear the group rules |

```
/setrules 1. Be respectful. 2. No spam. 3. English only.
```

> [!NOTE]
> Rules are stored and rendered as raw HTML, so you can use formatting tags such as `<b>`, `<i>`, and `<code>` directly. They are not double-escaped on retrieval.

## Notes

Notes are reusable text snippets that can be recalled by name. Any member can retrieve a note.

| Command | Description |
| --- | --- |
| `/save <name> <content>` | Save a note, or save the replied message as a note |
| `/get <name>` | Retrieve a note (you can also type `#name`) |
| `/notes` | List every saved note |
| `/clear <name>` | Delete a saved note |
| `/removeall` | Delete every saved note |
| `/private <on\|off>` | Make notes deliver via private chat |

Examples:

```
/save faq Read the rules at /rules before asking questions.
/get faq
#faq
```

> [!IMPORTANT]
> Like rules, note content is stored as raw HTML. Formatting tags render correctly, and the note's markdown URL-button attachments are preserved.

## Admin

| Command | Description |
| --- | --- |
| `/promote <target>` | Promote a member to admin |
| `/demote <target>` | Remove a member's admin rights |
| `/adminlist` | List the group's admins |
| `/title <target> <title>` | Set a custom admin title |

Required right: Promote admins (`can_promote_members`).

> [!TIP]
> `/promote` uses a relaxed target guard, so you can re-promote an existing admin to adjust their permission flags or grant topic-management rights without triggering an error.

Next: [Security guide](security.md).
