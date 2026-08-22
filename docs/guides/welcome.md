# Onboarding guide

Onboarding covers the welcome and goodbye messages sent when members join or leave a group. Both support templating, buttons, and automatic cleanup of previous messages.

## Welcome

| Command | Description |
| --- | --- |
| `/setwelcome <text>` | Set the message sent to new members |
| `/welcome` | Show the current welcome message |
| `/welcome on\|off` | Enable or disable the welcome |
| `/welcomebutton <text\|url>` | Attach a button under the welcome message |
| `/cleanwelcome <on\|off>` | Delete the previous welcome when a new one is sent |
| `/welcomemute <time\|off>` | Mute new joiners until they are approved |
| `/clearwelcome` | Reset the welcome message to the default |

## Goodbye

| Command | Description |
| --- | --- |
| `/setgoodbye <text>` | Set the message sent when a member leaves |
| `/goodbye` | Show the current goodbye message |
| `/goodbye on\|off` | Enable or disable the goodbye |
| `/cleangoodbye <on\|off>` | Delete the previous goodbye when someone new leaves |
| `/cleargoodbye` | Reset the goodbye message |

## Placeholders

Welcome and goodbye templates support these placeholders, which are replaced with the relevant user's details before the message is sent:

| Placeholder | Replaced with |
| --- | --- |
| `{first}` | First name |
| `{last}` | Last name |
| `{fullname}` | Full name |
| `{username}` | Username |
| `{mention}` | A clickable mention of the user |
| `{id}` | Numeric user ID |
| `{count}` | Current member count |
| `{chatname}` | The group's name |

Example:

```
/setwelcome Welcome {mention} to {chatname}! You are member #{count}. Please read /rules.
```

> [!IMPORTANT]
> Placeholder values are HTML-escaped before they are inserted into the template, then the template's own formatting is parsed. This order prevents injection through a user's name or username.

## Approval-gated joins

When `/welcomemute` is set, new joiners are muted for the given duration. Combined with the approval system (see the [Security guide](security.md)), this creates a gating flow where an admin must `/approve` a new member before they can speak.

> [!TIP]
> If your group is linked to a federation, federation-banned users are removed on join before any welcome message is sent. See [Federations](federations.md).

Next: [Admin guide](admin.md).
