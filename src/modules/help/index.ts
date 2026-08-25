/**
 * Miss Rose-style Interactive Documentation & Help System.
 * Features an authentic 3-column category grid (no close button),
 * structured interactive category pages, command drilldowns, interactive lock types,
 * interactive variable lookups, and hierarchical back navigation.
 */

import { Composer, InlineKeyboard, type Context } from "grammy";
import { escapeHtml } from "../../core/formatting.js";
import { ALL_LOCK_TYPES, type LockType } from "../../types/index.js";

export interface Cmd {
  name: string;
  args?: string;
  desc: string;
  details?: string;
  userPerm?: string;
  botPerm?: string;
  examples?: string[];
  behaviour?: string;
  notes?: string;
  related?: string[];
}

export interface Cat {
  id: string;
  label: string;
  description: string;
  userPerm?: string;
  botPerm?: string;
  options?: string;
  examples?: string[];
  notes?: string[];
  cmds: Cmd[];
  extra?: string;
}

export const CATEGORIES: Cat[] = [
  {
    id: "admin",
    label: "Admin",
    description: "Manage group administrators, member promotions, demotions, and custom titles.",
    userPerm: "Group Creator / Admin with 'Add New Admins' rights",
    botPerm: "Can Promote Members",
    examples: [
      "/promote @username",
      "/demote 123456789",
      "/title @username Senior Mod",
      "/adminlist",
    ],
    notes: [
      "Admin rights and membership lists are cached locally (admin status is cached locally for up to 30 seconds to optimize performance).",
      "Membership changes automatically refresh the cache.",
      "Custom titles can be up to 16 characters in length.",
    ],
    cmds: [
      {
        name: "/promote",
        args: "<reply/username/mention/userid>",
        desc: "Promote a member to group administrator.",
        details: "Grants standard administrator rights (change info, delete messages, restrict members, invite users, pin messages, manage video chats).",
        userPerm: "Group Creator or Admin with 'Promote Members' right",
        botPerm: "Can Promote Members",
        examples: ["/promote @alice", "/promote 123456789"],
        behaviour: "The target user is immediately promoted to administrator with default management permissions.",
        notes: "Cannot promote users if the bot lacks administrator promotion rights.",
        related: ["/demote", "/adminlist", "/title"],
      },
      {
        name: "/demote",
        args: "<reply/username/mention/userid>",
        desc: "Demote an administrator back to a standard member.",
        details: "Revokes all administrative rights from the target user.",
        userPerm: "Group Creator or Admin who promoted the target",
        botPerm: "Can Promote Members",
        examples: ["/demote @bob", "/demote 123456789"],
        behaviour: "The target administrator loses all admin rights and returns to standard member status.",
        notes: "Only the group creator or the admin who originally promoted the user can demote them.",
        related: ["/promote", "/adminlist"],
      },
      {
        name: "/adminlist",
        desc: "List all administrators and the group owner.",
        details: "Fetches and formats a clean list of all administrators with their titles and IDs.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/adminlist"],
        behaviour: "Sends a formatted list of all current chat administrators, showing the creator and custom titles.",
        related: ["/promote", "/demote"],
      },
      {
        name: "/title",
        args: "<reply/username/mention/userid> <title>",
        desc: "Set a custom title for an administrator.",
        details: "Assigns a custom title badge (up to 16 characters) shown next to the admin's name in group messages.",
        userPerm: "Group Creator or Admin with 'Promote Members' right",
        botPerm: "Can Promote Members",
        examples: ["/title @alice Lead Mod", "/title 123456789 Support"],
        behaviour: "Updates the administrator's custom title badge in the group.",
        notes: "Custom titles are limited to 16 characters by Telegram.",
        related: ["/promote", "/adminlist"],
      },
    ],
    extra:
      "Admin rights and membership lists are cached locally (admin status is cached locally for up to 30 seconds to optimize performance). " +
      "Membership changes automatically refresh the cache.",
  },
  {
    id: "flood",
    label: "Antiflood",
    description: "Protect your group from rapid message spam by automatically taking action on users who send too many messages in a short window.",
    userPerm: "Group Administrator",
    botPerm: "Can Restrict Members (for mute/kick/ban actions) & Delete Messages",
    options:
      "• <b>Flood Threshold:</b> Number of messages (e.g. <code>5</code>) within a 5-second sliding window.\n" +
      "• <b>Actions:</b> <code>mute</code> (indefinite mute), <code>ban</code> (permanent ban), <code>kick</code> (remove), <code>tmute &lt;time&gt;</code> (temporary mute, default 1h), <code>tban &lt;time&gt;</code> (temporary ban).",
    examples: [
      "/setflood 5",
      "/setfloodmode tmute 2h",
      "/setflood off",
      "/flood",
    ],
    notes: [
      "Antiflood tracks user message frequency in a sliding 5-second window.",
      "Admins and approved users are completely exempt from antiflood limits.",
      "Inactive tracking keys are automatically pruned from memory.",
    ],
    cmds: [
      {
        name: "/setflood",
        args: "<N/off>",
        desc: "Set the flood limit to N messages in 5 seconds (or 'off' to disable).",
        details: "Controls how many messages a regular user can send in a 5-second window before triggering antiflood enforcement.",
        userPerm: "Group Administrator",
        botPerm: "Can Restrict Members",
        examples: ["/setflood 5", "/setflood 10", "/setflood off"],
        behaviour: "Configures the message threshold. Any user exceeding N messages in 5s will be punished according to /setfloodmode.",
        notes: "Set to 'off' or 0 to disable flood protection.",
        related: ["/flood", "/setfloodmode"],
      },
      {
        name: "/flood",
        desc: "Display the current flood control threshold and enforcement action.",
        details: "Shows whether antiflood is enabled, the message limit, and the configured punishment mode.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/flood"],
        behaviour: "Replies with the active antiflood settings for the current group.",
        related: ["/setflood", "/setfloodmode"],
      },
      {
        name: "/setfloodmode",
        args: "<mute/ban/kick/tmute/tban> [time]",
        desc: "Configure the punishment action for flooders.",
        details: "Selects what happens when a user breaches the flood limit. Default: temporary mute for 1 hour.",
        userPerm: "Group Administrator",
        botPerm: "Can Restrict Members",
        examples: [
          "/setfloodmode tmute 1h",
          "/setfloodmode tban 1d",
          "/setfloodmode mute",
          "/setfloodmode ban",
          "/setfloodmode kick",
        ],
        behaviour: "Updates the automated punishment executed when a flood threshold breach is detected.",
        notes: "Duration tokens support m (minutes), h (hours), d (days), w (weeks).",
        related: ["/setflood", "/flood"],
      },
    ],
    extra:
      "Antiflood tracks user message frequency in a sliding 5-second window. " +
      "Admins and approved users are completely exempt from antiflood limits.",
  },
  {
    id: "approval",
    label: "Approval",
    description: "Approve trusted members so they are exempt from locks, media filters, and antiflood limits, and control entry approval gating.",
    userPerm: "Group Administrator",
    botPerm: "Can Restrict Members (for approval gating)",
    options:
      "• <b>Approved Status:</b> Exempts members from automated security restrictions.\n" +
      "• <b>Approval Gating:</b> When enabled, new unapproved joiners are restricted from speaking until approved by an admin.",
    examples: [
      "/approve @username",
      "/unapprove 123456789",
      "/approved",
      "/approval on",
    ],
    notes: [
      "Approved users are not administrators, but trusted community members who bypass automated bot restrictions.",
      "Approval gating mutes non-admin new members immediately upon joining until an admin runs /approve.",
    ],
    cmds: [
      {
        name: "/approve",
        args: "<reply/username/mention/userid>",
        desc: "Approve a user (exempts them from locks, media limits, and flood control).",
        details: "Adds the user to the group's approved list. Approved users bypass all lock types and flood restrictions.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/approve @alice", "/approve 123456789"],
        behaviour: "User is granted approved status. If muted by approval gating, their messaging restrictions are lifted.",
        related: ["/unapprove", "/approved", "/approval"],
      },
      {
        name: "/unapprove",
        args: "<reply/username/mention/userid>",
        desc: "Remove a user's approval status.",
        details: "Revokes approved privileges, making the user subject to standard group locks and flood rules.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/unapprove @bob", "/unapprove 123456789"],
        behaviour: "Removes the user from the approved list.",
        related: ["/approve", "/approved"],
      },
      {
        name: "/approved",
        desc: "List all approved users in this chat.",
        details: "Displays the names and user IDs of all currently approved members in the chat.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/approved"],
        behaviour: "Sends a list of all approved users in the group.",
        related: ["/approve", "/unapprove"],
      },
      {
        name: "/approval",
        args: "[on/off]",
        desc: "View or toggle approval gating for new joiners.",
        details: "When enabled, newly joined non-admin users are automatically restricted from sending messages until an admin approves them.",
        userPerm: "Group Administrator",
        botPerm: "Can Restrict Members",
        examples: ["/approval on", "/approval off", "/approval"],
        behaviour: "Toggles approval-gated verification mode for new members.",
        related: ["/approve", "/approved"],
      },
    ],
    extra:
      "Approved users are not administrators, but trusted community members who bypass automated bot restrictions.",
  },
  {
    id: "bans",
    label: "Bans",
    description: "Keep your chat safe with powerful banning, muting, and kicking tools supporting flexible durations and silent execution.",
    userPerm: "Group Administrator with 'Ban Users' / 'Restrict Members' right",
    botPerm: "Can Restrict Members & Delete Messages",
    options:
      "• <b>Durations:</b> <code>30s</code> (seconds), <code>15m</code> (minutes), <code>2h</code> (hours), <code>3d</code> (days), <code>1w</code> (weeks). Min: 30s, Max: 366d.\n" +
      "• <b>Silent Commands:</b> <code>/sban</code> and <code>/smute</code> automatically delete the command message and suppress the public card.",
    examples: [
      "/ban @spammer Scam link",
      "/tban @troll 24h Breaking rules",
      "/sban @bot",
      "/mute @user 30m Cool down",
      "/unban @user",
    ],
    notes: [
      "Durations support flexible time tokens (e.g. 30m, 2h, 1d, 1w) in any argument position.",
      "Silent commands (/sban, /smute) automatically delete the caller's message and skip the public ban card.",
      "Actions are mirrored to the configured log channel.",
    ],
    cmds: [
      {
        name: "/ban",
        args: "<reply/username/mention/userid> [reason]",
        desc: "Permanently ban a user from the group.",
        details: "Kicks the target user from the group and prevents them from rejoining.",
        userPerm: "Group Administrator (Ban Users)",
        botPerm: "Can Restrict Members",
        examples: ["/ban @alice Spamming", "/ban 123456789 Phishing link"],
        behaviour: "The user is removed and banned permanently.",
        related: ["/tban", "/sban", "/unban", "/kick"],
      },
      {
        name: "/tban",
        args: "<reply/username/mention/userid> <time> [reason]",
        desc: "Temporarily ban a user for a set duration.",
        details: "Bans the user and automatically lifts the ban when the specified duration expires.",
        userPerm: "Group Administrator (Ban Users)",
        botPerm: "Can Restrict Members",
        examples: ["/tban @alice 2h Flooding", "/tban 123456789 3d Insubordination"],
        behaviour: "Bans the user and automatically lifts the ban when the specified duration expires.",
        notes: "Minimum duration is 30 seconds; maximum duration is 366 days.",
        related: ["/ban", "/unban", "/tmute"],
      },
      {
        name: "/sban",
        args: "<reply/username/mention/userid> [reason]",
        desc: "Silently ban a user without sending a public announcement card.",
        details: "Bans the target user and immediately deletes the invoking admin command.",
        userPerm: "Group Administrator (Ban Users)",
        botPerm: "Can Restrict Members & Delete Messages",
        examples: ["/sban @spammer", "/sban 123456789 Crypto bot"],
        behaviour: "Bans the user and deletes the command message without sending a public announcement card.",
        related: ["/ban", "/smute"],
      },
      {
        name: "/unban",
        args: "<reply/username/mention/userid> [reason]",
        desc: "Lift a ban on a user, allowing them to rejoin the group.",
        details: "Removes ban restrictions for the specified user.",
        userPerm: "Group Administrator (Ban Users)",
        botPerm: "Can Restrict Members",
        examples: ["/unban @alice Appeal approved", "/unban 123456789"],
        behaviour: "Lifts the ban so the user can rejoin via invite link.",
        related: ["/ban", "/tban"],
      },
      {
        name: "/mute",
        args: "<reply/username/mention/userid> [reason]",
        desc: "Mute a user indefinitely.",
        details: "Revokes messaging and media privileges from the target member in the group.",
        userPerm: "Group Administrator (Restrict Members)",
        botPerm: "Can Restrict Members",
        examples: ["/mute @alice Swearing", "/mute 123456789"],
        behaviour: "Revokes permissions to send text, media, stickers, and polls.",
        related: ["/tmute", "/smute", "/unmute"],
      },
      {
        name: "/tmute",
        args: "<reply/username/mention/userid> <time> [reason]",
        desc: "Temporarily mute a user for a specified duration.",
        details: "Restricts messaging rights for the specified time; rights are restored automatically upon expiration.",
        userPerm: "Group Administrator (Restrict Members)",
        botPerm: "Can Restrict Members",
        examples: ["/tmute @alice 30m Calming down", "/tmute 123456789 1d Rule 2"],
        behaviour: "Restricts messaging permissions until the timer expires.",
        related: ["/mute", "/unmute", "/tban"],
      },
      {
        name: "/smute",
        args: "<reply/username/mention/userid> [reason]",
        desc: "Silently mute a user without a public card.",
        details: "Mutes the target user and deletes the admin's command message.",
        userPerm: "Group Administrator (Restrict Members)",
        botPerm: "Can Restrict Members & Delete Messages",
        examples: ["/smute @alice", "/smute 123456789 Disruptive"],
        behaviour: "Mutes user and deletes command message silently.",
        related: ["/mute", "/sban"],
      },
      {
        name: "/unmute",
        args: "<reply/username/mention/userid> [reason]",
        desc: "Restore messaging permissions to a muted user.",
        details: "Lifts restrictions, allowing the member to speak and send media again.",
        userPerm: "Group Administrator (Restrict Members)",
        botPerm: "Can Restrict Members",
        examples: ["/unmute @alice", "/unmute 123456789"],
        behaviour: "Restores normal member sending permissions.",
        related: ["/mute", "/tmute"],
      },
      {
        name: "/kick",
        args: "<reply/username/mention/userid> [reason]",
        desc: "Remove a user from the chat (they may rejoin immediately).",
        details: "Kicks the user and unbans them immediately so they can return via invite link.",
        userPerm: "Group Administrator (Ban Users)",
        botPerm: "Can Restrict Members",
        examples: ["/kick @alice Inactive", "/kick 123456789"],
        behaviour: "Kicks the user from the group without a permanent ban.",
        related: ["/ban", "/mute"],
      },
    ],
    extra:
      "Durations support flexible time tokens (e.g. 30m, 2h, 1d, 1w) in any argument position. " +
      "Silent commands (/sban, /smute) automatically delete the caller's message and skip the public ban card.",
  },
  {
    id: "cleanservice",
    label: "Clean Service",
    description: "Clean service allows you to automatically delete Telegram service notifications to keep your chat clean.",
    userPerm: "Group Administrator",
    botPerm: "Can Delete Messages",
    examples: ["/cleanservice on", "/cleanservice off", "/cleanservice"],
    notes: [
      "When enabled, join notifications, leave notifications, and pin announcements sent by Telegram will be automatically deleted.",
    ],
    cmds: [
      {
        name: "/cleanservice",
        args: "<on/off>",
        desc: "Auto-delete join, leave, and pin service messages.",
        details: "When enabled, service messages sent by Telegram (user joined, user left, message pinned, photo changed) are immediately deleted.",
        userPerm: "Group Administrator",
        botPerm: "Can Delete Messages",
        examples: ["/cleanservice on", "/cleanservice off"],
        behaviour: "Toggles automatic deletion of Telegram service notifications.",
        related: ["/cleanwelcome", "/cleangoodbye"],
      },
    ],
    extra:
      "When enabled, join notifications, leave notifications, and pin announcements sent by Telegram will be automatically deleted.",
  },
  {
    id: "disabling",
    label: "Disabling",
    description: "Not everyone wants every command. Disable specific commands for regular chat members.",
    userPerm: "Group Administrator",
    botPerm: "None",
    options:
      "• <b>Disableable Commands:</b> <code>help</code>, <code>rules</code>, <code>notes</code>, <code>get</code>, <code>ping</code>, <code>id</code>, <code>feds</code>, <code>fedinfo</code>, <code>fedadmins</code>, <code>fedbanlist</code>, <code>fedsubs</code>, <code>fedowner</code>, <code>approved</code>, <code>flood</code>, <code>locks</code>, <code>locktypes</code>, <code>disabled</code>, <code>disableable</code>.",
    examples: [
      "/disable ping",
      "/disable rules",
      "/enable ping",
      "/disabled",
      "/enableall",
    ],
    notes: [
      "Core admin and configuration commands cannot be disabled to prevent locking yourself out.",
      "Admins can always use disabled commands.",
    ],
    cmds: [
      {
        name: "/disable",
        args: "<command>",
        desc: "Disable a command for non-admins in this group.",
        details: "Prevents regular members from triggering the specified command. Administrators can always use disabled commands.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/disable ping", "/disable notes"],
        behaviour: "The command is blocked for regular members.",
        related: ["/enable", "/disabled", "/disableable"],
      },
      {
        name: "/enable",
        args: "<command>",
        desc: "Re-enable a previously disabled command in this group.",
        details: "Restores access to the specified command for all chat members.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/enable ping"],
        behaviour: "The command is unblocked and available to everyone.",
        related: ["/disable", "/enableall"],
      },
      {
        name: "/enableall",
        desc: "Re-enable all disabled commands in the chat.",
        details: "Clears the disabled commands list, restoring all commands for regular users.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/enableall"],
        behaviour: "Removes all command restrictions for regular users.",
        related: ["/disable", "/enable", "/disabled"],
      },
      {
        name: "/disabled",
        desc: "List all commands currently disabled in this group.",
        details: "Shows every command that is currently restricted for regular chat members.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/disabled"],
        behaviour: "Sends a list of currently disabled commands.",
        related: ["/disable", "/disableable"],
      },
      {
        name: "/disableable",
        desc: "List all commands eligible to be disabled.",
        details: "Displays the complete list of commands that administrators can disable.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/disableable"],
        behaviour: "Displays all disableable commands.",
        related: ["/disable", "/disabled"],
      },
    ],
    extra:
      "Core admin and configuration commands cannot be disabled to prevent locking yourself out. Admins can always use disabled commands.",
  },
  {
    id: "feds",
    label: "Federations",
    description: "Federations allow multiple chats to share bans across a network.",
    userPerm: "Federation Owner / Admin (for fed actions); Group Admin (for /joinfed, /leavefed)",
    botPerm: "Can Restrict Members",
    options:
      "• <b>Federation Scope:</b> Bans issued with <code>/fban</code> propagate across all subscribed groups with bounded concurrency.\n" +
      "• <b>PM Usability:</b> Management commands (<code>/newfed</code>, <code>/fban</code>, <code>/unfban</code>, <code>/fedinfo</code>) work directly in private message with the bot.",
    examples: [
      "/newfed Shield Network",
      "/joinfed <fedId>",
      "/fban @scammer Spreading malware",
      "/unfban 123456789 False flag",
      "/fedinfo",
    ],
    notes: [
      "Federation commands like /fban and /unfban work directly in the bot's private chat.",
      "When a user is fed-banned, the ban is automatically applied across every linked group in real-time.",
      "New joiners in any connected group are verified in O(1) time.",
    ],
    cmds: [
      {
        name: "/newfed",
        args: "<name>",
        desc: "Create a new federation (works in PM).",
        details: "Initializes a new federation with the specified name and assigns you as the owner.",
        userPerm: "Everyone (creates own federation)",
        botPerm: "None",
        examples: ["/newfed Crypto Shield", "/newfed Gaming Alliance"],
        behaviour: "Creates a new federation and generates a unique federation ID.",
        related: ["/delfed", "/fedinfo", "/joinfed"],
      },
      {
        name: "/delfed",
        args: "[fedId]",
        desc: "Delete a federation you own (works in PM).",
        details: "Permanently deletes the federation, unlinks all subscribed chats, and clears the federation ban list.",
        userPerm: "Federation Owner",
        botPerm: "None",
        examples: ["/delfed", "/delfed fed_123456"],
        behaviour: "Deletes federation, removes subscriptions, and purges ban list.",
        related: ["/newfed", "/fedinfo"],
      },
      {
        name: "/joinfed",
        args: "<fedId>",
        desc: "Link the current group to a federation.",
        details: "Subscribes the chat to the federation, enabling real-time ban synchronization and auto-ban on join.",
        userPerm: "Group Administrator",
        botPerm: "Can Restrict Members",
        examples: ["/joinfed fed_123456"],
        behaviour: "Connects the group to the specified federation.",
        related: ["/leavefed", "/fedsubs"],
      },
      {
        name: "/leavefed",
        desc: "Disconnect the current group from its federation.",
        details: "Unlinks the chat from the federation. Existing bans remain in place, but future fed-bans will not apply.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/leavefed"],
        behaviour: "Disconnects the group from its active federation.",
        related: ["/joinfed", "/fedsubs"],
      },
      {
        name: "/fban",
        args: "<reply/username/mention/userid> [reason]",
        desc: "Ban a user across all federation chats (works in PM).",
        details: "Records a federation-wide ban and fans out bans across all subscribed groups with bounded concurrency.",
        userPerm: "Federation Owner or Admin",
        botPerm: "Can Restrict Members",
        examples: ["/fban @spammer Network-wide spam", "/fban 123456789 Phishing"],
        behaviour: "Bans user across all subscribed groups in parallel.",
        related: ["/unfban", "/fedbanlist"],
      },
      {
        name: "/unfban",
        args: "<reply/username/mention/userid> [reason]",
        desc: "Remove a federation ban everywhere (works in PM).",
        details: "Lifts the federation ban and unbans the user across all connected groups.",
        userPerm: "Federation Owner or Admin",
        botPerm: "Can Restrict Members",
        examples: ["/unfban @alice Appeal accepted", "/unfban 123456789"],
        behaviour: "Removes ban record and unbans user across all connected groups.",
        related: ["/fban", "/fedbanlist"],
      },
      {
        name: "/fedinfo",
        args: "[fedId]",
        desc: "View details and subscriber stats about a federation.",
        details: "Shows federation name, ID, owner ID, administrator count, subscribed chats count, and total ban count.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/fedinfo", "/fedinfo fed_123456"],
        behaviour: "Sends a card with federation metadata and statistics.",
        related: ["/fedadmins", "/fedsubs", "/fedbanlist"],
      },
      {
        name: "/fedadmins",
        args: "[fedId]",
        desc: "List all administrators in the federation.",
        details: "Displays the owner and all administrators authorized to issue federation bans.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/fedadmins", "/fedadmins fed_123456"],
        behaviour: "Lists all federation admins.",
        related: ["/fedpromote", "/feddemote"],
      },
      {
        name: "/fedbanlist",
        args: "[fedId]",
        desc: "List all active federation bans.",
        details: "Displays user IDs and ban reasons recorded in the active federation.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/fedbanlist", "/fedbanlist fed_123456"],
        behaviour: "Lists recorded federation bans.",
        related: ["/fban", "/unfban"],
      },
      {
        name: "/fedsubs",
        args: "[fedId]",
        desc: "List all group chats connected to the federation.",
        details: "Displays the list of subscribed chat IDs linked to the active federation.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/fedsubs", "/fedsubs fed_123456"],
        behaviour: "Lists subscribed chat IDs.",
        related: ["/joinfed", "/leavefed"],
      },
      {
        name: "/fedowner",
        args: "[fedId]",
        desc: "Show the owner of the federation.",
        details: "Displays the name/ID of the creator and owner of the federation.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/fedowner"],
        behaviour: "Displays the federation owner's ID.",
        related: ["/fedinfo", "/fedadmins"],
      },
      {
        name: "/fedpromote",
        args: "<reply/username/mention/userid>",
        desc: "Promote a user to federation administrator.",
        details: "Grants federation admin rights, authorizing the user to issue and remove federation bans.",
        userPerm: "Federation Owner",
        botPerm: "None",
        examples: ["/fedpromote @alice", "/fedpromote 123456789"],
        behaviour: "Promotes user to federation admin.",
        related: ["/feddemote", "/fedadmins"],
      },
      {
        name: "/feddemote",
        args: "<reply/username/mention/userid>",
        desc: "Demote a federation administrator.",
        details: "Revokes federation administrative rights from the specified user.",
        userPerm: "Federation Owner",
        botPerm: "None",
        examples: ["/feddemote @bob", "/feddemote 123456789"],
        behaviour: "Demotes federation admin back to standard user.",
        related: ["/fedpromote", "/fedadmins"],
      },
    ],
    extra:
      "Federation commands like /fban and /unfban work directly in the bot's private chat. " +
      "When a user is fed-banned, the ban is automatically applied across every linked group in real-time.",
  },
  {
    id: "filters",
    label: "Filters",
    description: "Make your chat more interactive by setting up automated keyword replies.",
    userPerm: "Group Administrator",
    botPerm: "None (Can Delete Messages if cleaning)",
    options:
      "• <b>Matching:</b> Triggers match case-insensitively anywhere within messages.\n" +
      "• <b>Format:</b> <code>/filter &lt;trigger&gt; &lt;reply text&gt;</code>.",
    examples: [
      "/filter website Visit our portal at https://example.com",
      "/filter rules Please check the /rules",
      "/stop website",
      "/filters",
    ],
    notes: [
      "Filters match case-insensitive substrings within messages.",
      "Administrators and approved users do not trigger filters.",
    ],
    cmds: [
      {
        name: "/filter",
        args: "<trigger> <reply>",
        desc: "Add an automated reply to a trigger word.",
        details: "Configures HyperGriot to automatically respond with the reply text whenever someone sends the trigger keyword.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/filter rules Please check our /rules!", "/filter site https://example.com"],
        behaviour: "Saves automated response for the trigger keyword.",
        related: ["/stop", "/stopall", "/filters"],
      },
      {
        name: "/stop",
        args: "<trigger>",
        desc: "Remove a filter trigger.",
        details: "Deletes the automated response for the specified keyword.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/stop rules", "/stop site"],
        behaviour: "Deletes specified filter trigger.",
        related: ["/filter", "/stopall"],
      },
      {
        name: "/stopall",
        desc: "Remove all active filters in this chat.",
        details: "Clears all automated trigger replies configured for this group.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/stopall"],
        behaviour: "Purges all filter triggers in the chat.",
        related: ["/filter", "/stop", "/filters"],
      },
      {
        name: "/filters",
        desc: "List all active filters in this chat.",
        details: "Displays all configured filter keywords in the chat.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/filters"],
        behaviour: "Sends a list of all active filter triggers.",
        related: ["/filter", "/stop"],
      },
    ],
    extra: "Filters match case-insensitive substrings within messages.",
  },
  {
    id: "greetings",
    label: "Greetings",
    description: "Give your new members a warm welcome and say goodbye when they leave!",
    userPerm: "Group Administrator",
    botPerm: "Can Delete Messages (for cleanwelcome/cleangoodbye), Can Restrict Members (for welcomemute)",
    options:
      "• <b>Supported Variables:</b> {first}, {last}, {fullname}, {username}, {mention}, {id}, {count}, {chatname}.\n" +
      "• <b>Supported Formatting:</b> HTML tags (&lt;b&gt;, &lt;i&gt;, &lt;u&gt;, &lt;s&gt;, &lt;code&gt;, &lt;pre&gt;, &lt;a href&gt;).\n" +
      "• <b>Buttons:</b> <code>[Button Text](https://url)</code> or <code>Button Text | https://url</code>.",
    examples: [
      "/setwelcome Welcome {mention} to <b>{chatname}</b>! Member #{count}.",
      "/welcomebutton Rules | https://t.me/example",
      "/cleanwelcome on",
      "/welcomemute 10m",
      "/welcome on",
    ],
    notes: [
      "Customise messages with placeholders: {first}, {last}, {fullname}, {username}, {mention}, {id}, {count}, {chatname}.",
      "Clean welcome automatically deletes the previous greeting when a new member joins.",
      "Welcome mute restricts new joiners until their duration passes or an admin approves them.",
    ],
    cmds: [
      {
        name: "/setwelcome",
        args: "<text>",
        desc: "Set the welcome message template.",
        details: "Configures the template sent when new members join. Supports all greeting variables and HTML formatting.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/setwelcome Welcome {mention} to {chatname}!"],
        behaviour: "Updates the stored welcome template.",
        related: ["/welcome", "/welcomebutton", "/cleanwelcome", "/clearwelcome"],
      },
      {
        name: "/welcome",
        args: "[on/off]",
        desc: "Show current welcome preview or toggle it on/off.",
        details: "Displays a preview of the active welcome message, or enables/disables welcome messages when given 'on' or 'off'.",
        userPerm: "Group Administrator (to toggle), Everyone (to preview)",
        botPerm: "None",
        examples: ["/welcome", "/welcome on", "/welcome off"],
        behaviour: "Shows welcome preview or changes active status.",
        related: ["/setwelcome", "/clearwelcome"],
      },
      {
        name: "/welcomebutton",
        args: "<text|url>",
        desc: "Attach an inline URL button under the welcome message.",
        details: "Adds a clickable inline button below the welcome message linking to a URL or channel.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/welcomebutton Community Rules | https://t.me/myrules"],
        behaviour: "Attaches URL button under welcome message.",
        related: ["/setwelcome", "/welcome"],
      },
      {
        name: "/cleanwelcome",
        args: "<on/off>",
        desc: "Auto-delete the previous welcome on new member joins.",
        details: "When enabled, HyperGriot deletes the previous welcome message whenever a new member joins to prevent timeline clutter.",
        userPerm: "Group Administrator",
        botPerm: "Can Delete Messages",
        examples: ["/cleanwelcome on", "/cleanwelcome off"],
        behaviour: "Toggles auto-cleaning of previous welcome messages.",
        related: ["/setwelcome", "/cleangoodbye"],
      },
      {
        name: "/welcomemute",
        args: "<time/off>",
        desc: "Mute new joiners until verified or approved.",
        details: "Temporarily restricts messaging permissions for newly joined members for the specified duration (or 'off' to disable).",
        userPerm: "Group Administrator",
        botPerm: "Can Restrict Members",
        examples: ["/welcomemute 10m", "/welcomemute 1h", "/welcomemute off"],
        behaviour: "Mutes new joiners automatically upon join.",
        related: ["/approve", "/approval"],
      },
      {
        name: "/clearwelcome",
        desc: "Reset the welcome message back to default.",
        details: "Clears custom welcome templates, buttons, and settings, restoring factory defaults.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/clearwelcome"],
        behaviour: "Clears welcome template.",
        related: ["/setwelcome", "/welcome"],
      },
      {
        name: "/setgoodbye",
        args: "<text>",
        desc: "Set the goodbye message template.",
        details: "Configures the template sent when a member leaves the group. Supports greeting variables.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/setgoodbye Goodbye {first}, we will miss you!"],
        behaviour: "Updates goodbye message template.",
        related: ["/goodbye", "/cleangoodbye", "/cleargoodbye"],
      },
      {
        name: "/goodbye",
        args: "[on/off]",
        desc: "Show current goodbye preview or toggle it on/off.",
        details: "Displays the active goodbye message, or turns departure notifications on/off.",
        userPerm: "Group Administrator (to toggle), Everyone (to preview)",
        botPerm: "None",
        examples: ["/goodbye", "/goodbye on", "/goodbye off"],
        behaviour: "Shows goodbye preview or changes active status.",
        related: ["/setgoodbye", "/cleargoodbye"],
      },
      {
        name: "/cleangoodbye",
        args: "<on/off>",
        desc: "Auto-delete the previous goodbye message on departures.",
        details: "Deletes the preceding goodbye message when another member leaves.",
        userPerm: "Group Administrator",
        botPerm: "Can Delete Messages",
        examples: ["/cleangoodbye on", "/cleangoodbye off"],
        behaviour: "Toggles auto-cleaning of previous departure messages.",
        related: ["/cleanwelcome", "/goodbye"],
      },
      {
        name: "/cleargoodbye",
        desc: "Reset the goodbye message back to default.",
        details: "Restores the default departure message template.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/cleargoodbye"],
        behaviour: "Resets goodbye template.",
        related: ["/setgoodbye", "/goodbye"],
      },
    ],
    extra:
      "Customise messages with placeholders: {first}, {last}, {fullname}, {username}, {mention}, {id}, {count}, {chatname}.",
  },
  {
    id: "locks",
    label: "Locks",
    description: "Locks allow you to control which types of messages can be sent in your group.",
    userPerm: "Group Administrator",
    botPerm: "Can Delete Messages",
    options:
      "Supported 16 lock types: messages, media, audio, voice, video, stickers, gifs, polls, games, inline, contacts, location, forward, link, bots, other.",
    examples: [
      "/lock stickers",
      "/lock link",
      "/unlock media",
      "/locks",
      "/lockall",
      "/unlockall",
    ],
    notes: [
      "Locks affect new messages sent by non-admin, non-approved members.",
      "Existing messages in chat history are not automatically deleted.",
      "Administrators and approved members are completely exempt from locks.",
    ],
    cmds: [
      {
        name: "/lock",
        args: "<type>",
        desc: "Lock a message type so only admins can send it.",
        details: "Deletes incoming messages matching the locked type sent by non-admin, non-approved members.",
        userPerm: "Group Administrator",
        botPerm: "Can Delete Messages",
        examples: ["/lock stickers", "/lock link", "/lock media"],
        behaviour: "Enables the lock for the specified message type.",
        notes: "Multiple lock types can be listed separated by spaces.",
        related: ["/unlock", "/locks", "/locktypes", "/lockall"],
      },
      {
        name: "/unlock",
        args: "<type>",
        desc: "Unlock a message type.",
        details: "Restores permission for regular members to send the specified message type.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/unlock stickers", "/unlock media"],
        behaviour: "Disables the lock for the specified message type.",
        related: ["/lock", "/locks", "/unlockall"],
      },
      {
        name: "/locks",
        desc: "Show which message types are currently locked.",
        details: "Displays a list of all active locks in the current group.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/locks"],
        behaviour: "Replies with the list of currently locked types.",
        related: ["/lock", "/unlock", "/locktypes"],
      },
      {
        name: "/locktypes",
        desc: "List all lockable message types.",
        details: "Displays all 16 supported message types available for locking.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/locktypes"],
        behaviour: "Displays all 16 supported lock types.",
        related: ["/lock", "/locks"],
      },
      {
        name: "/lockall",
        desc: "Lock all message types at once.",
        details: "Applies locks across all 16 supported message types, completely restricting regular members.",
        userPerm: "Group Administrator",
        botPerm: "Can Delete Messages",
        examples: ["/lockall"],
        behaviour: "All 16 supported locks are enabled for the current chat.",
        notes: "Administrators and approved users remain exempt.",
        related: ["/unlockall", "/locks"],
      },
      {
        name: "/unlockall",
        desc: "Unlock all message types.",
        details: "Lifts all active locks in the chat.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/unlockall"],
        behaviour: "All active locks are disabled.",
        related: ["/lockall", "/locks"],
      },
    ],
    extra:
      "Lockable types include: messages, media, audio, voice, video, stickers, gifs, polls, games, inline, contacts, location, forward, link, bots, other. " +
      "Approved members and admins are exempt from locks.",
  },
  {
    id: "logs",
    label: "Log Channels",
    description: "Keep track of all moderation actions in a dedicated log channel.",
    userPerm: "Group Administrator",
    botPerm: "Administrator in both the group and log channel with 'Post Messages' rights",
    examples: ["/logchannel -1001987654321", "/unlogchannel"],
    notes: [
      "When configured, all bans, mutes, kicks, warnings, and unbans are cleanly logged with detailed audit cards.",
      "Make sure HyperGriot is an admin in the log channel with permission to post messages.",
    ],
    cmds: [
      {
        name: "/logchannel",
        args: "[channel_id]",
        desc: "Reply to a message forwarded from a channel (or run in channel) to set log channel.",
        details: "Connects the group to a logging channel. Audit cards for bans, mutes, kicks, warnings, and unbans are sent automatically.",
        userPerm: "Group Administrator",
        botPerm: "Can Post Messages (in channel)",
        examples: ["/logchannel -1001234567890", "/logchannel"],
        behaviour: "Sets the destination channel for audit logs.",
        related: ["/unlogchannel"],
      },
      {
        name: "/unlogchannel",
        desc: "Stop mirroring moderation actions to the log channel.",
        details: "Disconnects the active log channel from this group.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/unlogchannel"],
        behaviour: "Removes log channel association.",
        related: ["/logchannel"],
      },
    ],
    extra:
      "When configured, all bans, mutes, kicks, warnings, and unbans are cleanly logged with detailed audit cards. Make sure HyperGriot is an admin in the log channel.",
  },
  {
    id: "misc",
    label: "Misc",
    description: "General bot utilities, status checks, and identity helpers.",
    userPerm: "Everyone",
    botPerm: "None",
    examples: ["/id", "/ping", "/start", "/help locks"],
    notes: [
      "All commands support both / and ! prefixes in group chats as well as in direct messages with the bot.",
    ],
    cmds: [
      {
        name: "/id",
        desc: "Show the current chat ID and relevant user IDs.",
        details: "Displays the group's chat ID, your personal user ID, and the replied user's ID if used on a reply.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/id"],
        behaviour: "Sends chat ID and user ID info.",
        related: ["/ping", "/help"],
      },
      {
        name: "/ping",
        desc: "Check bot latency and online status.",
        details: "Responds with pong to confirm HyperGriot is online and responsive.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/ping"],
        behaviour: "Replies with 'Pong! HyperGriot is online.'",
        related: ["/id", "/start"],
      },
      {
        name: "/start",
        desc: "Start the bot and read the introduction.",
        details: "Sends the initial greeting and getting-started guide (primarily in PM).",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/start"],
        behaviour: "Sends welcome message and instructions.",
        related: ["/help"],
      },
      {
        name: "/help",
        args: "[category/command]",
        desc: "Open the interactive command menu or view help for a specific command.",
        details: "Browse all documentation categories or look up detailed syntax and permissions for any command (e.g. /help bans or /help /tban).",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/help", "/help locks", "/help /tban"],
        behaviour: "Opens documentation menu or specific reference.",
        related: ["/start"],
      },
    ],
    extra:
      "All commands support both / and ! prefixes in group chats as well as in direct messages with the bot.",
  },
  {
    id: "notes",
    label: "Notes",
    description: "Save useful messages, rules, or FAQs for quick access at any time.",
    userPerm: "Group Administrator (to save/delete); Everyone (to view)",
    botPerm: "None",
    options:
      "• <b>Shortcut:</b> Type <code>#notename</code> in chat to instantly fetch a saved note.\n" +
      "• <b>Formatting:</b> Notes support Markdown/HTML formatting and inline URL buttons using <code>[Button](buttonurl:url)</code>.",
    examples: [
      "/save rules Our rules: 1. Be kind 2. No spam",
      "/get rules",
      "#rules",
      "/notes",
      "/private on",
    ],
    notes: [
      "Notes support Markdown/HTML formatting and inline URL buttons using the standard [Button Text](buttonurl:link) syntax.",
      "Enabling private mode delivers note contents via DM to reduce chat clutter.",
    ],
    cmds: [
      {
        name: "/save",
        args: "<name> <content>",
        desc: "Save a note, or reply to a message with /save <name>.",
        details: "Stores text, links, or media under a keyword name for quick recall.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/save faq https://example.com/faq", "/save links Useful links"],
        behaviour: "Saves note under the given name.",
        related: ["/get", "/notes", "/clear", "/removeall"],
      },
      {
        name: "/get",
        args: "<name>",
        desc: "Retrieve a note. You can also type #name in chat.",
        details: "Fetches and sends the content stored under the specified note name.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/get faq", "#faq"],
        behaviour: "Sends the content of the note.",
        related: ["/save", "/notes"],
      },
      {
        name: "/notes",
        desc: "List all notes saved in this chat.",
        details: "Displays a list of all saved note keywords available in the group.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/notes"],
        behaviour: "Sends a list of all saved note names.",
        related: ["/get", "/save"],
      },
      {
        name: "/clear",
        args: "<name>",
        desc: "Delete a saved note.",
        details: "Removes the note stored under the given name.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/clear faq"],
        behaviour: "Deletes the note.",
        related: ["/save", "/removeall"],
      },
      {
        name: "/removeall",
        desc: "Delete all notes in this chat.",
        details: "Clears all stored notes from the current group.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/removeall"],
        behaviour: "Deletes all notes in the chat.",
        related: ["/clear", "/notes"],
      },
      {
        name: "/private",
        args: "<on/off>",
        desc: "Deliver note contents via private message.",
        details: "When enabled, /get and #notename responses are sent to the user via PM to reduce group noise.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/private on", "/private off"],
        behaviour: "Toggles private note delivery mode.",
        related: ["/get", "/notes"],
      },
    ],
    extra:
      "Notes support Markdown/HTML formatting and inline URL buttons using the standard [Button Text](buttonurl:link) syntax.",
  },
  {
    id: "pin",
    label: "Pin",
    description: "Pin important messages and manage group announcements easily.",
    userPerm: "Group Administrator with 'Pin Messages' right",
    botPerm: "Can Pin Messages",
    examples: ["/pin", "/pin loud", "/unpin", "/pinned"],
    notes: [
      "HyperGriot requires the 'Pin Messages' permission to pin or unpin messages in the group.",
      "Pins are silent by default; add 'loud' to notify all chat members.",
    ],
    cmds: [
      {
        name: "/pin",
        args: "[loud]",
        desc: "Pin the replied message (silent by default; add 'loud' to notify everyone).",
        details: "Pins the message to the top of the chat. By default pins silently; use 'loud' to send a notification to all members.",
        userPerm: "Group Administrator (Pin Messages)",
        botPerm: "Can Pin Messages",
        examples: ["/pin", "/pin loud"],
        behaviour: "Pins the replied message to the chat header.",
        related: ["/unpin", "/unpinall", "/pinned"],
      },
      {
        name: "/unpin",
        desc: "Unpin the replied message or the latest pin.",
        details: "Removes the pinned status from the replied message or the current top pin.",
        userPerm: "Group Administrator (Pin Messages)",
        botPerm: "Can Pin Messages",
        examples: ["/unpin"],
        behaviour: "Unpins the message from the chat header.",
        related: ["/pin", "/unpinall"],
      },
      {
        name: "/unpinall",
        desc: "Unpin every message in the chat.",
        details: "Clears all pinned messages from the group header.",
        userPerm: "Group Administrator (Pin Messages)",
        botPerm: "Can Pin Messages",
        examples: ["/unpinall"],
        behaviour: "Clears all pinned messages.",
        related: ["/unpin", "/pin"],
      },
      {
        name: "/pinned",
        desc: "Show the most recently pinned message.",
        details: "Fetches and displays a link/preview of the current pinned announcement.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/pinned"],
        behaviour: "Sends link/content of active pin.",
        related: ["/pin"],
      },
    ],
    extra:
      "HyperGriot requires the 'Pin Messages' permission to pin or unpin messages in the group.",
  },
  {
    id: "purges",
    label: "Purges",
    description: "Delete large numbers of unwanted messages quickly.",
    userPerm: "Group Administrator with 'Delete Messages' right",
    botPerm: "Can Delete Messages",
    examples: ["/clean 10", "/clean 50"],
    notes: [
      "Due to Telegram limitations, bots can only delete messages sent within the last 48 hours.",
    ],
    cmds: [
      {
        name: "/clean",
        args: "<N>",
        desc: "Delete N messages starting backwards from the replied message (1–100).",
        details: "Bulk-deletes up to 100 messages starting backwards from the replied message.",
        userPerm: "Group Administrator (Delete Messages)",
        botPerm: "Can Delete Messages",
        examples: ["/clean 20", "/clean 100"],
        behaviour: "Deletes up to N messages backwards from reply point.",
        notes: "Telegram API restricts bots from deleting messages older than 48 hours.",
        related: ["/cleanservice"],
      },
    ],
    extra:
      "Due to Telegram limitations, bots can only delete messages sent within the last 48 hours.",
  },
  {
    id: "reports",
    label: "Reports",
    description: "Allow chat members to report offensive or rule-breaking messages to admins.",
    userPerm: "Everyone (to report), Group Administrator (to configure)",
    botPerm: "None",
    examples: ["/report Offensive message", "/reports on", "/reports off"],
    notes: [
      "When reporting, reply to the offending message so admins have full context.",
    ],
    cmds: [
      {
        name: "/report",
        args: "[reason]",
        desc: "Reply to a message to alert all group administrators.",
        details: "Notifies all group administrators about the offending message with a direct link and context.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/report", "/report Inappropriate language"],
        behaviour: "Alerts chat admins about the replied message.",
        related: ["/reports"],
      },
      {
        name: "/reports",
        args: "[on/off]",
        desc: "Show or toggle the member report system.",
        details: "Enables or disables the /report command for group members.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/reports", "/reports on", "/reports off"],
        behaviour: "Toggles reporting feature on/off.",
        related: ["/report"],
      },
    ],
    extra:
      "When reporting, reply to the offending message so admins have full context.",
  },
  {
    id: "rules",
    label: "Rules",
    description: "Set up and display your group's rules so everyone knows the guidelines.",
    userPerm: "Group Administrator (to configure); Everyone (to read)",
    botPerm: "None",
    options:
      "• <b>Formatting:</b> Rules text supports standard HTML tags.\n" +
      "• <b>Buttons:</b> <code>/setrulesbutton &lt;text|url&gt;</code> attaches an inline button linking to full guidelines.",
    examples: [
      "/setrules 1. Be respectful\n2. No spamming\n3. English only",
      "/setrulesbutton Full Guidelines | https://example.com/rules",
      "/rules",
      "/clearrules",
    ],
    notes: [
      "The /rules command is open to all group members so anyone can check the rules at any time.",
    ],
    cmds: [
      {
        name: "/setrules",
        args: "<text>",
        desc: "Set the group rules.",
        details: "Saves the community rules displayed when users run /rules. Supports HTML formatting.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/setrules 1. Be polite\n2. No commercial spam"],
        behaviour: "Saves the group rules text.",
        related: ["/rules", "/setrulesbutton", "/clearrules"],
      },
      {
        name: "/setrulesbutton",
        args: "<text|url>",
        desc: "Attach an inline URL button under the rules display.",
        details: "Adds a button below the /rules response linking to external documentation or resources.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/setrulesbutton Community Portal | https://example.com"],
        behaviour: "Attaches URL button below rules card.",
        related: ["/rules", "/setrules"],
      },
      {
        name: "/rules",
        desc: "Display the group rules.",
        details: "Sends the formatted community guidelines to the chat.",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/rules"],
        behaviour: "Displays the group rules.",
        related: ["/setrules", "/clearrules"],
      },
      {
        name: "/clearrules",
        desc: "Clear the group rules.",
        details: "Deletes the stored rules and attached button.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/clearrules"],
        behaviour: "Purges group rules.",
        related: ["/rules", "/setrules"],
      },
    ],
    extra:
      "The /rules command is open to all group members so anyone can check the rules at any time.",
  },
  {
    id: "warnings",
    label: "Warnings",
    description: "Warn users for misbehaviour and automatically punish repeat offenders.",
    userPerm: "Group Administrator with 'Restrict Members' right",
    botPerm: "Can Restrict Members & Delete Messages",
    options:
      "• <b>Warning Limits:</b> Default is 3 warnings before punishment.\n" +
      "• <b>Punishment Actions:</b> <code>mute</code> (indefinite mute), <code>kick</code> (remove), <code>ban</code> (permanent ban), <code>tmute</code> (temporary mute), <code>tban</code> (temporary ban).\n" +
      "• <b>Strong Warn:</b> When enabled, applies the punishment action immediately on every warning.",
    examples: [
      "/warn @user Breaking rule 1",
      "/warns @user",
      "/setwarnlimit 5",
      "/setwarnaction tmute",
      "/resetwarn @user",
    ],
    notes: [
      "When a member reaches the warning threshold, HyperGriot executes the configured punishment automatically and clears their warnings.",
    ],
    cmds: [
      {
        name: "/warn",
        args: "<reply/username/mention/userid> [reason]",
        desc: "Add a warning to a user.",
        details: "Increments the user's warning counter and automatically triggers the punishment action if the limit is reached.",
        userPerm: "Group Administrator (Restrict Members)",
        botPerm: "Can Restrict Members",
        examples: ["/warn @alice Inappropriate language", "/warn 123456789 Flooding"],
        behaviour: "Logs warning strike; triggers automated action if limit reached.",
        related: ["/warns", "/resetwarn", "/rmwarn", "/setwarnlimit", "/setwarnaction"],
      },
      {
        name: "/warns",
        args: "[reply/username/mention/userid]",
        desc: "Show a user's accumulated warnings.",
        details: "Displays the active warning count and recorded reasons for a user (or yourself if omitted).",
        userPerm: "Everyone",
        botPerm: "None",
        examples: ["/warns", "/warns @alice"],
        behaviour: "Sends warning summary for the target user.",
        related: ["/warn", "/resetwarn"],
      },
      {
        name: "/resetwarn",
        args: "<reply/username/mention/userid>",
        desc: "Reset a user's warning count.",
        details: "Clears all warnings and reasons accumulated by the specified member.",
        userPerm: "Group Administrator (Restrict Members)",
        botPerm: "None",
        examples: ["/resetwarn @alice", "/resetwarn 123456789"],
        behaviour: "Resets user's warnings back to 0.",
        related: ["/warn", "/rmwarn"],
      },
      {
        name: "/rmwarn",
        args: "<reply/username/mention/userid>",
        desc: "Remove a user's most recent warning.",
        details: "Decrements the warning count by 1 and removes the latest logged reason.",
        userPerm: "Group Administrator (Restrict Members)",
        botPerm: "None",
        examples: ["/rmwarn @alice", "/rmwarn 123456789"],
        behaviour: "Decrements warning count by 1.",
        related: ["/resetwarn", "/warn"],
      },
      {
        name: "/strongwarn",
        args: "<on/off>",
        desc: "Execute the punishment action immediately on every warning.",
        details: "When enabled, each /warn triggers the configured action (e.g. mute) immediately in addition to logging the strike.",
        userPerm: "Group Administrator",
        botPerm: "Can Restrict Members",
        examples: ["/strongwarn on", "/strongwarn off"],
        behaviour: "Toggles strong warning mode.",
        related: ["/warn", "/setwarnaction"],
      },
      {
        name: "/setwarnlimit",
        args: "<N>",
        desc: "Set how many warnings trigger the action (e.g. 3).",
        details: "Configures the strike threshold before automatic punishment is applied.",
        userPerm: "Group Administrator",
        botPerm: "None",
        examples: ["/setwarnlimit 3", "/setwarnlimit 5"],
        behaviour: "Sets warning strike threshold.",
        related: ["/warn", "/setwarnaction"],
      },
      {
        name: "/setwarnaction",
        args: "<mute/kick/ban/tmute/tban>",
        desc: "Choose what happens at the warning limit.",
        details: "Sets the punishment applied when a user reaches the warning threshold (mute, kick, ban, tmute, tban).",
        userPerm: "Group Administrator",
        botPerm: "Can Restrict Members",
        examples: ["/setwarnaction ban", "/setwarnaction tmute", "/setwarnaction kick"],
        behaviour: "Updates punishment executed at warning limit.",
        related: ["/setwarnlimit", "/warn"],
      },
    ],
    extra:
      "When a member reaches the warning threshold, HyperGriot executes the configured punishment automatically and clears their warnings.",
  },
];

export const INTRO =
  "<b>Help</b>\n\n" +
  "Hey! My name is HyperGriot. I am a group management bot, here to help you get around and keep the order in your groups!\n" +
  "I have lots of handy features, such as flood control, a warning system, a note keeping system, and even predetermined replies on certain keywords.\n\n" +
  "<b>Helpful commands:</b>\n" +
  "- <code>/start</code>: Starts me! You've probably already used this.\n" +
  "- <code>/help</code>: Sends this message; I'll tell you more about myself!\n" +
  "- <code>/ping</code>: Checks if I'm online and responsive!\n" +
  "- <code>/id</code>: Shows the chat ID and relevant user IDs.\n\n" +
  "All commands can be used with the following prefixes: <code>/</code> <code>!</code>";

export interface LockTypeDoc {
  type: LockType;
  label: string;
  summary: string;
  affects: string[];
  notAffects: string[];
}

export const LOCK_TYPE_DOCS: Record<LockType, LockTypeDoc> = {
  messages: {
    type: "messages",
    label: "Messages (Text)",
    summary: "Prevents regular members from sending text messages.",
    affects: ["All regular text messages", "Formatted text"],
    notAffects: ["Media captions", "Stickers", "Photos (unless locked via media)"],
  },
  media: {
    type: "media",
    label: "All Media",
    summary: "Prevents regular members from sending any form of media.",
    affects: ["Photos", "Videos", "Video Notes", "Audio files", "Voice messages", "Documents", "GIFs"],
    notAffects: ["Plain text messages", "Stickers (unless locked via stickers)"],
  },
  audio: {
    type: "audio",
    label: "Music & Audio",
    summary: "Prevents regular members from sending music and audio files.",
    affects: ["Music files (.mp3, .flac, .wav, etc.)"],
    notAffects: ["Voice recordings (unless locked via voice)"],
  },
  voice: {
    type: "voice",
    label: "Voice Notes",
    summary: "Prevents regular members from sending voice messages.",
    affects: ["Voice audio recordings (.ogg/.opus)"],
    notAffects: ["Audio files", "Videos"],
  },
  video: {
    type: "video",
    label: "Videos & Video Notes",
    summary: "Prevents regular members from sending video files and video notes.",
    affects: ["Video files (.mp4)", "Round video notes"],
    notAffects: ["Photos", "GIFs"],
  },
  stickers: {
    type: "stickers",
    label: "Stickers",
    summary: "Prevents regular members from sending Telegram stickers.",
    affects: ["Static stickers (.webp)", "Animated stickers (.tgs)", "Video stickers (.webm)"],
    notAffects: ["GIFs", "Photos", "Text messages"],
  },
  gifs: {
    type: "gifs",
    label: "GIF Animations",
    summary: "Prevents regular members from sending GIF animations.",
    affects: ["GIF animations", "MPEG4 animations"],
    notAffects: ["Stickers", "Videos", "Photos"],
  },
  polls: {
    type: "polls",
    label: "Polls & Quizzes",
    summary: "Prevents regular members from creating polls and quiz polls.",
    affects: ["Regular polls", "Quiz polls"],
    notAffects: ["Standard text", "Other media"],
  },
  games: {
    type: "games",
    label: "HTML5 Games",
    summary: "Prevents regular members from starting Telegram HTML5 games.",
    affects: ["Telegram HTML5 games"],
    notAffects: ["Regular messages", "Polls"],
  },
  inline: {
    type: "inline",
    label: "Inline Bot Queries",
    summary: "Prevents regular members from sending messages via inline bots (via_bot).",
    affects: ["Messages sent via inline bots (e.g. @gif, @gamebot)"],
    notAffects: ["Direct bot commands", "Normal user messages"],
  },
  contacts: {
    type: "contacts",
    label: "Contact Cards",
    summary: "Prevents regular members from sharing phone contact cards (vCards).",
    affects: ["Telegram shared contacts"],
    notAffects: ["Plain phone numbers sent as text"],
  },
  location: {
    type: "location",
    label: "Location & Venues",
    summary: "Prevents regular members from sharing map locations and venue cards.",
    affects: ["Live locations", "Static map pins", "Venues"],
    notAffects: ["Plain addresses sent as text"],
  },
  forward: {
    type: "forward",
    label: "Forwarded Messages",
    summary: "Prevents regular members from forwarding messages from other users or channels.",
    affects: ["All forwarded messages"],
    notAffects: ["Directly typed original messages"],
  },
  link: {
    type: "link",
    label: "Web Links & URLs",
    summary: "Prevents regular members from sending any HTTP/HTTPS links or text links.",
    affects: ["Web URLs", "Text link entities"],
    notAffects: ["Plain text without hyperlinks"],
  },
  bots: {
    type: "bots",
    label: "Bot Additions",
    summary: "Prevents non-admins from adding new bots to the group.",
    affects: ["Bot addition events"],
    notAffects: ["Human members joining"],
  },
  other: {
    type: "other",
    label: "Dice & Payments",
    summary: "Prevents animated dice rolls, invoices, and payment messages.",
    affects: ["Telegram dice emojis", "Invoices", "Successful payments"],
    notAffects: ["Regular text messages"],
  },
};

export interface VariableDoc {
  key: string;
  label: string;
  output: string;
  example: string;
  sampleResult: string;
}

export const GREETING_VARS: Record<string, VariableDoc> = {
  first: {
    key: "{first}",
    label: "First Name",
    output: "The user's first name (HTML-escaped).",
    example: "Welcome {first} to the chat!",
    sampleResult: "Welcome Alice to the chat!",
  },
  last: {
    key: "{last}",
    label: "Last Name",
    output: "The user's last name (HTML-escaped), or empty if none.",
    example: "Welcome {first} {last}!",
    sampleResult: "Welcome Alice Smith!",
  },
  fullname: {
    key: "{fullname}",
    label: "Full Name",
    output: "The user's first and last name combined.",
    example: "Hello {fullname}!",
    sampleResult: "Hello Alice Smith!",
  },
  username: {
    key: "{username}",
    label: "Username",
    output: "The user's @username (or first name if user has no username).",
    example: "Follow @{username}",
    sampleResult: "Follow @alice",
  },
  mention: {
    key: "{mention}",
    label: "Mention Link",
    output: "Clickable HTML mention link to the user profile (<a href=\"tg://user?id=...\">Name</a>).",
    example: "Welcome {mention} to our group!",
    sampleResult: "Welcome <a href=\"tg://user?id=12345\">Alice</a> to our group!",
  },
  id: {
    key: "{id}",
    label: "User ID",
    output: "The user's numeric Telegram user ID.",
    example: "User ID: <code>{id}</code>",
    sampleResult: "User ID: <code>123456789</code>",
  },
  count: {
    key: "{count}",
    label: "Member Count",
    output: "The current total number of members in the group.",
    example: "You are member #{count}!",
    sampleResult: "You are member #420!",
  },
  chatname: {
    key: "{chatname}",
    label: "Chat Name",
    output: "The group's title (HTML-escaped).",
    example: "Welcome to <b>{chatname}</b>!",
    sampleResult: "Welcome to <b>HyperGriot Community</b>!",
  },
};

/** Map of category aliases to canonical category IDs. */
const CATEGORY_ALIASES: Record<string, string> = {
  admin: "admin",
  admins: "admin",
  administration: "admin",
  flood: "flood",
  antiflood: "flood",
  approval: "approval",
  approve: "approval",
  approvals: "approval",
  bans: "bans",
  ban: "bans",
  mutes: "bans",
  mute: "bans",
  cleanservice: "cleanservice",
  service: "cleanservice",
  disabling: "disabling",
  disable: "disabling",
  feds: "feds",
  fed: "feds",
  federation: "feds",
  federations: "feds",
  filters: "filters",
  filter: "filters",
  greetings: "greetings",
  welcome: "greetings",
  goodbye: "greetings",
  locks: "locks",
  lock: "locks",
  logs: "logs",
  log: "logs",
  logchannel: "logs",
  logchannels: "logs",
  misc: "misc",
  notes: "notes",
  note: "notes",
  pin: "pin",
  pins: "pin",
  purges: "purges",
  purge: "purges",
  clean: "purges",
  reports: "reports",
  report: "reports",
  rules: "rules",
  rule: "rules",
  warnings: "warnings",
  warning: "warnings",
  warn: "warnings",
  warns: "warnings",
};

/** Find a category by ID, label, or alias. */
export function findCategory(query: string): Cat | null {
  const clean = query.toLowerCase().trim().replace(/^[\/!]/, "");
  const aliasTarget = CATEGORY_ALIASES[clean];
  if (aliasTarget) {
    const found = CATEGORIES.find((c) => c.id === aliasTarget);
    if (found) return found;
  }
  return (
    CATEGORIES.find((c) => c.id === clean || c.label.toLowerCase() === clean) ?? null
  );
}

/** Find a specific command across all categories. */
export function findCommandDoc(query: string): { cat: Cat; cmd: Cmd } | null {
  const clean = query.toLowerCase().trim().replace(/^[\/!]/, "");
  const targetName = `/${clean}`;

  for (const cat of CATEGORIES) {
    for (const cmd of cat.cmds) {
      if (cmd.name.toLowerCase() === targetName) {
        return { cat, cmd };
      }
    }
  }
  return null;
}

/** Builds the authentic Miss Rose 3-column inline button grid (NO close button). */
export function rootKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  CATEGORIES.forEach((c, i) => {
    kb.text(c.label, `h:cat:${c.id}`);
    if (i % 3 === 2 && i < CATEGORIES.length - 1) kb.row();
  });
  return kb;
}

export function backKb(): InlineKeyboard {
  return new InlineKeyboard().text("Back", "h:root");
}

/** Category main documentation keyboard with dedicated section buttons. */
export function catKb(cat: Cat): InlineKeyboard {
  const kb = new InlineKeyboard();

  // Top action: Commands button
  kb.text("Commands", `h:cat_cmds:${cat.id}`);

  // Module-specific interactive sections
  if (cat.id === "locks") {
    kb.row().text("Lock Types", "h:locktypes");
  } else if (cat.id === "greetings") {
    kb.row().text("Variables", "h:vars:greetings").text("Formatting", "h:formatting:greetings");
  } else if (cat.id === "flood") {
    kb.row().text("Flood Modes", "h:floodmodes");
  } else if (cat.id === "warnings") {
    kb.row().text("Warn Actions", "h:warnactions");
  } else if (cat.id === "feds") {
    kb.row().text("Federation Roles", "h:fedroles");
  }

  // Standard sub-sections
  kb.row()
    .text("Examples", `h:cat_ex:${cat.id}`)
    .text("Permissions", `h:cat_perms:${cat.id}`);

  kb.row()
    .text("Notes", `h:cat_notes:${cat.id}`)
    .text("Categories", "h:root");

  return kb;
}

/** Keyboard listing all commands in a category with clickable command drilldowns. */
export function catCmdsKb(cat: Cat): InlineKeyboard {
  const kb = new InlineKeyboard();
  cat.cmds.forEach((cmd, i) => {
    const shortName = cmd.name.replace(/^\//, "");
    kb.text(cmd.name, `h:cmd:${shortName}`);
    if (i % 2 === 1 && i < cat.cmds.length - 1) kb.row();
  });
  kb.row().text(`Back (${cat.label})`, `h:cat:${cat.id}`).text("All Categories", "h:root");
  return kb;
}

/** Keyboard for specific command drilldown. */
export function cmdKb(cat: Cat): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${cat.label} Commands`, `h:cat_cmds:${cat.id}`)
    .row()
    .text(`${cat.label} Module`, `h:cat:${cat.id}`)
    .text("All Categories", "h:root");
}

/** Keyboard for interactive 16 lock types. */
export function lockTypesKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  ALL_LOCK_TYPES.forEach((t, i) => {
    kb.text(t, `h:locktype:${t}`);
    if (i % 3 === 2 && i < ALL_LOCK_TYPES.length - 1) kb.row();
  });
  kb.row().text("Locks Module", "h:cat:locks").text("All Categories", "h:root");
  return kb;
}

/** Keyboard for individual lock type drilldown. */
export function lockTypeKb(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Lock Types", "h:locktypes")
    .text("Locks Module", "h:cat:locks");
}

/** Keyboard for interactive greetings variables. */
export function greetingsVarsKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  const keys = Object.keys(GREETING_VARS);
  keys.forEach((k, i) => {
    kb.text(`{${k}}`, `h:var:${k}`);
    if (i % 3 === 2 && i < keys.length - 1) kb.row();
  });
  kb.row().text("Greetings Module", "h:cat:greetings").text("All Categories", "h:root");
  return kb;
}

/** Keyboard for individual greeting variable drilldown. */
export function greetingVarKb(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Variables", "h:vars:greetings")
    .text("Greetings Module", "h:cat:greetings");
}

/** Standard back keyboard to category. */
export function backToCatKb(cat: Cat): InlineKeyboard {
  return new InlineKeyboard()
    .text(`Back (${cat.label})`, `h:cat:${cat.id}`)
    .text("All Categories", "h:root");
}

// ── Screen Rendering Functions ───────────────────────────────────

/** Renders clean category overview screen. */
export function catOverviewText(c: Cat): string {
  const lines: string[] = [
    `<b>${escapeHtml(c.label)}</b>`,
    "",
    escapeHtml(c.description),
    "",
    "<b>Permissions:</b>",
    `• User: ${escapeHtml(c.userPerm ?? "Group Administrator")}`,
    `• Bot: ${escapeHtml(c.botPerm ?? "None required")}`,
    "",
    "Select a section below to explore commands, configuration options, examples, or notes.",
  ];
  return lines.join("\n");
}

/** Full category documentation (for backward compat / fallback). */
export function catText(c: Cat): string {
  const lines: string[] = [
    `<b>${escapeHtml(c.label)}</b>`,
    "",
    escapeHtml(c.description),
  ];

  if (c.userPerm || c.botPerm) {
    lines.push("");
    lines.push("<b>Permissions:</b>");
    if (c.userPerm) lines.push(`• User: ${escapeHtml(c.userPerm)}`);
    if (c.botPerm) lines.push(`• Bot: ${escapeHtml(c.botPerm)}`);
  }

  if (c.options) {
    lines.push("");
    lines.push("<b>Options & Parameters:</b>");
    lines.push(c.options);
  }

  lines.push("");
  lines.push(`<b>${escapeHtml(c.label)} commands:</b>`);
  for (const cmd of c.cmds) {
    const usage = cmd.args ? `${cmd.name} ${cmd.args}` : cmd.name;
    lines.push(`- <code>${escapeHtml(usage)}</code>: ${escapeHtml(cmd.desc)}`);
  }

  if (c.examples && c.examples.length > 0) {
    lines.push("");
    lines.push("<b>Examples:</b>");
    for (const ex of c.examples) {
      lines.push(`• <code>${escapeHtml(ex)}</code>`);
    }
  }

  if (c.extra) {
    lines.push("");
    lines.push(escapeHtml(c.extra));
  }
  return lines.join("\n");
}

/** Renders category commands list screen. */
export function catCmdsText(c: Cat): string {
  const lines: string[] = [
    `<b>${escapeHtml(c.label)} Commands</b>`,
    "",
    `Here are the commands available in <b>${escapeHtml(c.label)}</b>. Click any command button below for full documentation, arguments, and examples.`,
    "",
  ];
  for (const cmd of c.cmds) {
    const usage = cmd.args ? `${cmd.name} ${cmd.args}` : cmd.name;
    lines.push(`• <code>${escapeHtml(usage)}</code>`);
    lines.push(`  ${escapeHtml(cmd.desc)}`);
  }
  return lines.join("\n");
}

/** Renders category examples screen. */
export function catExamplesText(c: Cat): string {
  const lines: string[] = [
    `<b>${escapeHtml(c.label)} — Examples</b>`,
    "",
    `Practical copy-pasteable examples for <b>${escapeHtml(c.label)}</b>:`,
    "",
  ];
  if (c.examples && c.examples.length > 0) {
    for (const ex of c.examples) {
      lines.push(`• <code>${escapeHtml(ex)}</code>`);
    }
  } else {
    lines.push("No examples configured for this module.");
  }
  return lines.join("\n");
}

/** Renders category permissions screen. */
export function catPermsText(c: Cat): string {
  const lines: string[] = [
    `<b>${escapeHtml(c.label)} — Permissions</b>`,
    "",
    "<b>Required User Permissions:</b>",
    `• ${escapeHtml(c.userPerm ?? "Group Administrator")}`,
    "",
    "<b>Required Bot Permissions:</b>",
    `• ${escapeHtml(c.botPerm ?? "None required")}`,
  ];
  return lines.join("\n");
}

/** Renders category notes screen. */
export function catNotesText(c: Cat): string {
  const lines: string[] = [
    `<b>${escapeHtml(c.label)} — Behaviour & Notes</b>`,
    "",
  ];
  if (c.notes && c.notes.length > 0) {
    for (const note of c.notes) {
      lines.push(`• ${escapeHtml(note)}`);
    }
  } else if (c.extra) {
    lines.push(escapeHtml(c.extra));
  } else {
    lines.push("No additional notes for this module.");
  }
  return lines.join("\n");
}

/** Renders individual command drilldown screen. */
export function cmdText(cat: Cat, cmd: Cmd): string {
  const lines: string[] = [
    `<b>${escapeHtml(cmd.name)}</b>`,
    "",
    escapeHtml(cmd.details ?? cmd.desc),
    "",
    "<b>Syntax:</b>",
    `<code>${escapeHtml(cmd.name)}${cmd.args ? " " + escapeHtml(cmd.args) : ""}</code>`,
    "",
    "<b>Arguments:</b>",
    cmd.args ? `• <code>${escapeHtml(cmd.args)}</code>` : "• None required",
    "",
    "<b>Required User Permissions:</b>",
    `• ${escapeHtml(cmd.userPerm ?? cat.userPerm ?? "Group Administrator")}`,
    "",
    "<b>Required Bot Permissions:</b>",
    `• ${escapeHtml(cmd.botPerm ?? cat.botPerm ?? "None required")}`,
  ];

  if (cmd.examples && cmd.examples.length > 0) {
    lines.push("");
    lines.push("<b>Examples:</b>");
    for (const ex of cmd.examples) {
      lines.push(`• <code>${escapeHtml(ex)}</code>`);
    }
  }

  if (cmd.behaviour) {
    lines.push("");
    lines.push("<b>Behaviour:</b>");
    lines.push(escapeHtml(cmd.behaviour));
  }

  if (cmd.notes) {
    lines.push("");
    lines.push("<b>Side Effects / Limitations:</b>");
    lines.push(escapeHtml(cmd.notes));
  }

  if (cmd.related && cmd.related.length > 0) {
    lines.push("");
    lines.push("<b>Related Commands:</b> " + cmd.related.map((r) => `<code>${escapeHtml(r)}</code>`).join(", "));
  }

  return lines.join("\n");
}

/** Renders lock types overview screen. */
export function lockTypesText(): string {
  return (
    "<b>Lock Types</b>\n\n" +
    "HyperGriot supports 16 distinct lock types. Click on any lock type below to view what it restricts, what it does not affect, and how to use it.\n\n" +
    "<b>Quick Syntax:</b>\n" +
    "• <code>/lock &lt;type&gt;</code>\n" +
    "• <code>/unlock &lt;type&gt;</code>"
  );
}

/** Renders individual lock type detail screen. */
export function lockTypeDocText(doc: LockTypeDoc): string {
  const lines: string[] = [
    `<b>Lock Type:</b> <code>${doc.type}</code> (${escapeHtml(doc.label)})`,
    "",
    escapeHtml(doc.summary),
    "",
    "<b>Lock Command:</b>",
    `<code>/lock ${doc.type}</code>`,
    "",
    "<b>Unlock Command:</b>",
    `<code>/unlock ${doc.type}</code>`,
    "",
    "<b>What it affects:</b>",
    ...doc.affects.map((a) => `• ${escapeHtml(a)}`),
    "",
    "<b>What it does NOT affect:</b>",
    ...doc.notAffects.map((na) => `• ${escapeHtml(na)}`),
    "",
    "<b>Note:</b>",
    "Administrators and approved users are completely exempt from locks.",
  ];
  return lines.join("\n");
}

/** Renders greetings variables overview screen. */
export function greetingsVarsText(): string {
  return (
    "<b>Greetings Variables</b>\n\n" +
    "HyperGriot supports dynamic placeholders in welcome and goodbye message templates. Click any variable below to see its exact output format and examples."
  );
}

/** Renders individual greeting variable detail screen. */
export function greetingVarDocText(doc: VariableDoc): string {
  const lines: string[] = [
    `<b>Variable:</b> <code>${doc.key}</code> (${escapeHtml(doc.label)})`,
    "",
    escapeHtml(doc.output),
    "",
    "<b>Example Template:</b>",
    `<code>/setwelcome ${doc.example}</code>`,
    "",
    "<b>Sample Output:</b>",
    doc.sampleResult,
  ];
  return lines.join("\n");
}

/** Renders welcome/goodbye formatting and buttons screen. */
export function formattingDocText(): string {
  return (
    "<b>Welcome Formatting & Buttons</b>\n\n" +
    "HyperGriot supports standard HTML formatting tags and inline URL buttons in welcome, goodbye, rules, and notes templates.\n\n" +
    "<b>Supported HTML Tags:</b>\n" +
    "• <code>&lt;b&gt;bold text&lt;/b&gt;</code> → <b>bold text</b>\n" +
    "• <code>&lt;i&gt;italic text&lt;/i&gt;</code> → <i>italic text</i>\n" +
    "• <code>&lt;u&gt;underlined&lt;/u&gt;</code> → <u>underlined</u>\n" +
    "• <code>&lt;s&gt;strikethrough&lt;/s&gt;</code> → <s>strikethrough</s>\n" +
    "• <code>&lt;code&gt;monospace code&lt;/code&gt;</code> → <code>monospace code</code>\n" +
    "• <code>&lt;pre&gt;code block&lt;/pre&gt;</code>\n" +
    "• <code>&lt;a href=\"https://example.com\"&gt;link text&lt;/a&gt;</code>\n\n" +
    "<b>Button Syntax:</b>\n" +
    "Use <code>/welcomebutton &lt;text|url&gt;</code> or <code>/setrulesbutton &lt;text|url&gt;</code>:\n" +
    "• <code>Channel | https://t.me/mychannel</code>\n" +
    "• <code>[Rules](https://example.com/rules)</code>"
  );
}

// ── Composer & Handlers ──────────────────────────────────────────

export const helpComposer = new Composer<Context>();

helpComposer.command("help", async (ctx) => {
  const text = ctx.message?.text ?? "";
  const query = text.replace(/^\/help(@\w+)?\s*/i, "").trim();

  // 1. No arguments -> show main category menu
  if (!query) {
    await ctx.reply(INTRO, { parse_mode: "HTML", reply_markup: rootKb() });
    return;
  }

  // 2. Direct category lookup: /help <category>
  const cat = findCategory(query);
  if (cat) {
    await ctx.reply(catOverviewText(cat), { parse_mode: "HTML", reply_markup: catKb(cat) });
    return;
  }

  // 3. Direct command lookup: /help <command>
  const cmdMatch = findCommandDoc(query);
  if (cmdMatch) {
    await ctx.reply(cmdText(cmdMatch.cat, cmdMatch.cmd), {
      parse_mode: "HTML",
      reply_markup: cmdKb(cmdMatch.cat),
    });
    return;
  }

  // 4. Unknown query fallback
  await ctx.reply(
    `No help entry found for "<code>${escapeHtml(query)}</code>".\n\n` +
      `Try searching for another command or browse the available modules.`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("Browse Categories", "h:root"),
    },
  );
});

helpComposer.callbackQuery(/^h:/, async (ctx) => {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();
  try {
    // 1. Close button (legacy / direct delete)
    if (data === "h:close") {
      await ctx.deleteMessage();
      return;
    }

    // 2. Main menu (Root)
    if (data === "h:root") {
      await ctx.editMessageText(INTRO, { parse_mode: "HTML", reply_markup: rootKb() });
      return;
    }

    // 3. Category Commands: h:cat_cmds:<id>
    if (data.startsWith("h:cat_cmds:")) {
      const catId = data.replace("h:cat_cmds:", "");
      const cat = CATEGORIES.find((c) => c.id === catId);
      if (cat) {
        await ctx.editMessageText(catCmdsText(cat), {
          parse_mode: "HTML",
          reply_markup: catCmdsKb(cat),
        });
        return;
      }
    }

    // 4. Category Examples: h:cat_ex:<id>
    if (data.startsWith("h:cat_ex:")) {
      const catId = data.replace("h:cat_ex:", "");
      const cat = CATEGORIES.find((c) => c.id === catId);
      if (cat) {
        await ctx.editMessageText(catExamplesText(cat), {
          parse_mode: "HTML",
          reply_markup: backToCatKb(cat),
        });
        return;
      }
    }

    // 5. Category Permissions: h:cat_perms:<id>
    if (data.startsWith("h:cat_perms:")) {
      const catId = data.replace("h:cat_perms:", "");
      const cat = CATEGORIES.find((c) => c.id === catId);
      if (cat) {
        await ctx.editMessageText(catPermsText(cat), {
          parse_mode: "HTML",
          reply_markup: backToCatKb(cat),
        });
        return;
      }
    }

    // 6. Category Notes: h:cat_notes:<id>
    if (data.startsWith("h:cat_notes:")) {
      const catId = data.replace("h:cat_notes:", "");
      const cat = CATEGORIES.find((c) => c.id === catId);
      if (cat) {
        await ctx.editMessageText(catNotesText(cat), {
          parse_mode: "HTML",
          reply_markup: backToCatKb(cat),
        });
        return;
      }
    }

    // 7. Command drilldown: h:cmd:<name>
    if (data.startsWith("h:cmd:")) {
      const cmdName = data.replace("h:cmd:", "");
      const match = findCommandDoc(cmdName);
      if (match) {
        await ctx.editMessageText(cmdText(match.cat, match.cmd), {
          parse_mode: "HTML",
          reply_markup: cmdKb(match.cat),
        });
        return;
      }
    }

    // 8. Interactive Lock Types Menu: h:locktypes
    if (data === "h:locktypes") {
      await ctx.editMessageText(lockTypesText(), {
        parse_mode: "HTML",
        reply_markup: lockTypesKb(),
      });
      return;
    }

    // 9. Lock Type Detail Drilldown: h:locktype:<type>
    if (data.startsWith("h:locktype:")) {
      const lockType = data.replace("h:locktype:", "") as LockType;
      const doc = LOCK_TYPE_DOCS[lockType];
      if (doc) {
        await ctx.editMessageText(lockTypeDocText(doc), {
          parse_mode: "HTML",
          reply_markup: lockTypeKb(),
        });
        return;
      }
    }

    // 10. Greetings Variables Menu: h:vars:greetings
    if (data === "h:vars:greetings") {
      await ctx.editMessageText(greetingsVarsText(), {
        parse_mode: "HTML",
        reply_markup: greetingsVarsKb(),
      });
      return;
    }

    // 11. Greeting Variable Detail Drilldown: h:var:<name>
    if (data.startsWith("h:var:")) {
      const varKey = data.replace("h:var:", "");
      const doc = GREETING_VARS[varKey];
      if (doc) {
        await ctx.editMessageText(greetingVarDocText(doc), {
          parse_mode: "HTML",
          reply_markup: greetingVarKb(),
        });
        return;
      }
    }

    // 12. Greetings Formatting Guide: h:formatting:greetings
    if (data === "h:formatting:greetings") {
      const greetingsCat = CATEGORIES.find((c) => c.id === "greetings")!;
      await ctx.editMessageText(formattingDocText(), {
        parse_mode: "HTML",
        reply_markup: backToCatKb(greetingsCat),
      });
      return;
    }

    // 13. Flood Modes Guide: h:floodmodes
    if (data === "h:floodmodes") {
      const floodCat = CATEGORIES.find((c) => c.id === "flood")!;
      const text =
        "<b>Antiflood Modes</b>\n\n" +
        "Configure using <code>/setfloodmode &lt;mode&gt; [duration]</code>:\n\n" +
        "• <code>mute</code>: Indefinitely mutes the user in the group.\n" +
        "• <code>tmute &lt;time&gt;</code>: Temporarily mutes the user (e.g. <code>1h</code>, <code>2d</code>).\n" +
        "• <code>kick</code>: Removes the user from the group (they can rejoin).\n" +
        "• <code>ban</code>: Permanently bans the user from the group.\n" +
        "• <code>tban &lt;time&gt;</code>: Temporarily bans the user for a set duration.";
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: backToCatKb(floodCat),
      });
      return;
    }

    // 14. Warn Actions Guide: h:warnactions
    if (data === "h:warnactions") {
      const warnCat = CATEGORIES.find((c) => c.id === "warnings")!;
      const text =
        "<b>Warning Punishment Actions</b>\n\n" +
        "Configure using <code>/setwarnaction &lt;action&gt;</code>:\n\n" +
        "• <code>ban</code>: Permanently bans the user once warning limit is hit.\n" +
        "• <code>tban</code>: Temporarily bans the user once warning limit is hit.\n" +
        "• <code>mute</code>: Indefinitely mutes the user once warning limit is hit.\n" +
        "• <code>tmute</code>: Temporarily mutes the user once warning limit is hit.\n" +
        "• <code>kick</code>: Kicks the user once warning limit is hit.";
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: backToCatKb(warnCat),
      });
      return;
    }

    // 15. Federation Roles Guide: h:fedroles
    if (data === "h:fedroles") {
      const fedCat = CATEGORIES.find((c) => c.id === "feds")!;
      const text =
        "<b>Federation Roles & Permissions</b>\n\n" +
        "• <b>Federation Owner:</b> Creator of the federation. Can delete federation (/delfed), promote admins (/fedpromote), and demote admins (/feddemote).\n" +
        "• <b>Federation Admin:</b> Authorized to issue federation bans (/fban) and lift federation bans (/unfban).\n" +
        "• <b>Group Admin:</b> Can subscribe their group to a federation (/joinfed) or unsubscribe (/leavefed).";
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: backToCatKb(fedCat),
      });
      return;
    }

    // 16. Category overview: h:cat:<id> or legacy h:<id>
    const catIdMatch = data.match(/^h:(?:cat:)?([a-z0-9_-]+)$/);
    if (catIdMatch && catIdMatch[1]) {
      const cat = CATEGORIES.find((c) => c.id === catIdMatch[1]);
      if (cat) {
        await ctx.editMessageText(catOverviewText(cat), {
          parse_mode: "HTML",
          reply_markup: catKb(cat),
        });
        return;
      }
    }
  } catch {
    /* message not modified / already deleted */
  }
});

export function registerHelp(bot: { use: (c: Composer<Context>) => void }): void {
  bot.use(helpComposer);
}
