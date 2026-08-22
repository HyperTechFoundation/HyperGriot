# Command index

A complete reference of every HyperGriot command. Remember that `!` works in place of `/` everywhere, and that `<target>` means a reply, an @mention, or a numeric user ID.

## Moderation

| Command | Description |
| --- | --- |
| `/ban <target> [reason]` | Ban a user permanently from the group |
| `/tban <target> <time> [reason]` | Temporarily ban a user for a set duration |
| `/sban <target> [reason]` | Ban a user silently, without a public message |
| `/unban <target> [reason]` | Lift a ban on a user |
| `/mute <target> [reason]` | Mute a user until they are unmuted |
| `/tmute <target> <time> [reason]` | Temporarily mute a user for a set duration |
| `/smute <target> [reason]` | Mute a user silently, without a public message |
| `/unmute <target> [reason]` | Restore a user's ability to send messages |
| `/kick <target> [reason]` | Remove a user; they can rejoin |

## Admins

| Command | Description |
| --- | --- |
| `/promote <target>` | Promote a member to admin |
| `/demote <target>` | Remove a member's admin rights |
| `/adminlist` | List the group's admins |
| `/title <target> <title>` | Set a custom admin title |

## Welcome and goodbye

| Command | Description |
| --- | --- |
| `/setwelcome <text>` | Set the message sent to new members |
| `/welcome [on\|off]` | Show the welcome message, or enable or disable it |
| `/welcomebutton <text\|url>` | Attach a button under the welcome message |
| `/cleanwelcome <on\|off>` | Delete the previous welcome when a new one is sent |
| `/welcomemute <time\|off>` | Mute new joiners until they are approved |
| `/clearwelcome` | Reset the welcome message to the default |
| `/setgoodbye <text>` | Set the message sent when a member leaves |
| `/goodbye [on\|off]` | Show the goodbye message, or enable or disable it |
| `/cleangoodbye <on\|off>` | Delete the previous goodbye when someone new leaves |
| `/cleargoodbye` | Reset the goodbye message to the default |

## Rules and notes

| Command | Description |
| --- | --- |
| `/setrules <text>` | Set the group rules |
| `/setrulesbutton <text\|url>` | Attach a button under the rules message |
| `/rules` | Show the group rules |
| `/clearrules` | Clear the group rules |
| `/save <name> <content>` | Save a note, or save the replied message as a note |
| `/get <name>` | Retrieve a note (you can also type `#name`) |
| `/notes` | List every saved note |
| `/clear <name>` | Delete a saved note |
| `/removeall` | Delete every saved note |
| `/private <on\|off>` | Make notes deliver via private chat |

## Pin

| Command | Description |
| --- | --- |
| `/pin [loud]` | Pin the replied message; add `loud` to notify the group |
| `/unpin` | Unpin the replied message |
| `/unpinall` | Unpin every message in the group |
| `/pinned` | Show the most recently pinned message |

## Protection

| Command | Description |
| --- | --- |
| `/lock <type>` | Block a message type for non-admins |
| `/unlock <type>` | Allow a previously locked message type |
| `/locks` | Show which message types are locked |
| `/locktypes` | List every lockable type |
| `/lockall` | Lock every message type at once |
| `/unlockall` | Remove all locks |
| `/filter <trigger> <reply>` | Auto-reply whenever a trigger word is sent |
| `/stop <trigger>` | Remove a filter |
| `/stopall` | Remove every filter |
| `/filters` | List all filters |
| `/setflood <N\|off>` | Set how many messages trigger flood protection |
| `/flood` | Show the current flood settings |
| `/setfloodmode <mute\|ban\|kick\|tmute\|tban>` | Choose the action taken on flood |
| `/warn <target> [reason]` | Add a warning to a user |
| `/warns <target>` | Show a user's warnings |
| `/resetwarn <target>` | Reset a user's warning count |
| `/rmwarn <target>` | Remove a user's most recent warning |
| `/strongwarn <on\|off>` | Apply the limit action immediately on every warning |
| `/setwarnlimit <N>` | Set how many warnings trigger the action |
| `/setwarnaction <mute\|kick\|ban\|tmute\|tban>` | Choose the action taken at the warning limit |
| `/report` | Reply to a message to alert the admins |
| `/reports [on\|off]` | Show or toggle the report system |
| `/approve <target>` | Exempt a user from locks and flood limits |
| `/unapprove <target>` | Remove a user's approval |
| `/approved` | List approved users |
| `/approval on\|off` | Toggle approval-gated join |

## Federations

| Command | Description | PM |
| --- | --- | :---: |
| `/newfed <name>` | Create a ban federation; you become its owner | Yes |
| `/delfed [fedId]` | Delete a federation you own | Yes |
| `/joinfed <fedId>` | Link this group to a federation | No |
| `/leavefed` | Remove this group from its federation | No |
| `/fban <target> [reason]` | Ban a user across every group in the federation | Yes |
| `/unfban <target> [reason]` | Remove a federation ban everywhere | Yes |
| `/fedinfo [fedId]` | Show details about a federation | Yes |
| `/fedadmins` | List a federation's admins | Yes |
| `/fedbanlist` | List every federation ban | Yes |
| `/fedsubs` | List all group chats connected to the federation | Yes |
| `/fedowner` | Show the federation owner | Yes |
| `/fedpromote <target>` | Promote a user to federation admin | Yes |
| `/feddemote <target>` | Demote a federation admin | Yes |

## Log channels and cleanup

| Command | Description |
| --- | --- |
| `/logchannel` | Reply inside a channel to set it as the moderation log |
| `/unlogchannel` | Stop mirroring actions to a log channel |
| `/clean <N>` | Delete N messages starting from the replied one |
| `/cleanservice <on\|off>` | Auto-delete join, leave, and pin service messages |
| `/disable <command>` | Turn off a command for non-admins in this group |
| `/enable <command>` | Re-enable a disabled command |
| `/enableall` | Re-enable every command |
| `/disabled` | List commands disabled in this group |
| `/disableable` | List commands that can be disabled |

## General

| Command | Description |
| --- | --- |
| `/start` | Start the bot and read the introduction |
| `/help` | Open the command menu |
| `/ping` | Check the bot is online |
| `/id` | Show the chat ID and relevant user IDs |

Next: [Help menu](help-menu.md).
