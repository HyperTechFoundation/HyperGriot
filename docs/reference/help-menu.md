# Help menu

The `/help` command opens an interactive inline-keyboard menu modeled on Miss Rose. It is available to everyone, in both private chat and groups, and requires no admin rights.

## Layout

The root menu shows a short introduction and helpful startup commands, followed by 18 category buttons arranged in a clean three-column grid, and a Close button.

```
+-------------------------------------------------------------+
|                            Help                             |
| Hey! My name is HyperGriot...                               |
+-----------------------------+-------------------------------+
| Admin                       | Antiflood       | Approval    |
| Bans                        | Clean Service   | Disabling   |
| Federations                 | Filters         | Greetings   |
| Locks                       | Log Channels    | Misc        |
| Notes                       | Pin             | Purges      |
| Reports                     | Rules           | Warnings    |
+-----------------------------+-------------------------------+
|                            Close                            |
+-------------------------------------------------------------+
```

## Navigation

Tapping any category performs an in-place edit of the message (`editMessageText`) and shows:

1. A category title header.
2. A short conceptual overview of the module.
3. The complete command listing with usage signatures (for example, `/command <target> <time> [reason]`).
4. Operational notes covering caching, rate-limit windows, or permission requirements.
5. A Back button that returns to the root grid.

The Close button deletes the help message entirely.

> [!IMPORTANT]
> Usage signatures are HTML-escaped before they are rendered. Because arguments contain angle brackets (for example `<target>`), escaping is required; otherwise the brackets would be interpreted as HTML tags and break the message.

## Clean-text standard

> [!NOTE]
> All help-menu text adheres to the clean-text standard: professional plain text with standard HTML markup, no decorative emoji, and consistent punctuation.

## Programmatic access

The menu is driven by a command catalog data structure (`COMMAND_CATALOG`) that holds each category's id, label, and command list. The same catalog is the single source of truth for the inline buttons, so the menu never drifts from the real command set.

For the authoritative wording of every command description, see the [Command index](command-index.md).

Next: [Troubleshooting](troubleshooting.md).
