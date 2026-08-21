/**
 * Miss Rose-style Interactive Help Module.
 * Features an authentic 3-column category grid and deeply detailed module reference pages.
 * See docs/design.md §5.7.
 */

import { Composer, InlineKeyboard, type Context } from "grammy";
import { escapeHtml } from "../../core/formatting.js";

export interface Cmd {
  name: string;
  args?: string;
  desc: string;
}

export interface Cat {
  id: string;
  label: string;
  description: string;
  cmds: Cmd[];
  extra?: string;
}

export const CATEGORIES: Cat[] = [
  {
    id: "admin",
    label: "Admin",
    description: "Make it easy to promote and demote users with the admin module!",
    cmds: [
      { name: "/promote", args: "<reply/username/mention/userid>", desc: "Promote a user." },
      { name: "/demote", args: "<reply/username/mention/userid>", desc: "Demote a user." },
      { name: "/adminlist", desc: "List the admins in the current chat." },
      { name: "/title", args: "<reply/username/mention/userid> <title>", desc: "Set a custom title for an admin." },
    ],
    extra:
      "Sometimes, you promote or demote an admin manually, and HyperGriot doesn't realise it immediately. " +
      "This is because to avoid spamming telegram servers, admin status is cached locally. " +
      "This means that you sometimes have to wait a short time for admin rights to update. Membership changes automatically refresh the cache.",
  },
  {
    id: "flood",
    label: "Antiflood",
    description: "Antiflood allows you to take action on users who send more than x messages in a row.",
    cmds: [
      { name: "/setflood", args: "<N/off>", desc: "Set the flood limit to N messages in 5 seconds. Set to 'off' to disable." },
      { name: "/flood", desc: "Get the current flood control settings." },
      { name: "/setfloodmode", args: "<mute/ban/kick/tmute/tban>", desc: "Choose which action to take on flooders. Default: tmute 1h." },
    ],
    extra:
      "Antiflood tracks user message frequency in a sliding window. " +
      "Admins and approved users are completely exempt from antiflood limits.",
  },
  {
    id: "approval",
    label: "Approval",
    description: "Approve trusted members so they can bypass locks, media limits, and flood restrictions.",
    cmds: [
      { name: "/approve", args: "<reply/username/mention/userid>", desc: "Approve a user (exempt from locks & flood)." },
      { name: "/unapprove", args: "<reply/username/mention/userid>", desc: "Remove a user's approval status." },
      { name: "/approved", desc: "List all approved users in this group." },
    ],
    extra:
      "Approved users are not admins, but are trusted members of your community who won't be restricted by automated filters, locks, or antiflood.",
  },
  {
    id: "bans",
    label: "Bans",
    description: "Keep your chat safe with powerful banning and muting tools.",
    cmds: [
      { name: "/ban", args: "<reply/username/mention/userid> [reason]", desc: "Ban a user permanently from the group." },
      { name: "/tban", args: "<reply/username/mention/userid> <time> [reason]", desc: "Temporarily ban a user (e.g. 2h, 1d, 1w)." },
      { name: "/sban", args: "<reply/username/mention/userid> [reason]", desc: "Silently ban a user and delete the command." },
      { name: "/unban", args: "<reply/username/mention/userid> [reason]", desc: "Lift a ban on a user, allowing them to rejoin." },
      { name: "/mute", args: "<reply/username/mention/userid> [reason]", desc: "Mute a user indefinitely." },
      { name: "/tmute", args: "<reply/username/mention/userid> <time> [reason]", desc: "Temporarily mute a user for a set duration." },
      { name: "/smute", args: "<reply/username/mention/userid> [reason]", desc: "Silently mute a user without a public card." },
      { name: "/unmute", args: "<reply/username/mention/userid> [reason]", desc: "Restore messaging rights to a muted user." },
      { name: "/kick", args: "<reply/username/mention/userid> [reason]", desc: "Remove a user; they can rejoin." },
    ],
    extra:
      "Durations support flexible time tokens (e.g. 30m, 2h, 1d, 1w) in any argument position. " +
      "Silent commands (/sban, /smute) automatically delete the caller's message and skip the public ban card.",
  },
  {
    id: "cleanservice",
    label: "Clean Service",
    description: "Clean service allows you to auto-delete Telegram service notifications to keep your chat clean.",
    cmds: [
      { name: "/cleanservice", args: "<on/off>", desc: "Auto-delete join, leave, and pin service messages." },
    ],
    extra:
      "When enabled, join notifications, leave notifications, and pin announcements sent by Telegram will be automatically deleted.",
  },
  {
    id: "disabling",
    label: "Disabling",
    description: "Not everyone wants every command. Disable specific commands for regular chat members.",
    cmds: [
      { name: "/disable", args: "<command>", desc: "Disable a command for non-admins in this group." },
      { name: "/enable", args: "<command>", desc: "Re-enable a command in this group." },
      { name: "/enableall", desc: "Re-enable all disabled commands." },
      { name: "/disabled", desc: "List all disabled commands in this group." },
      { name: "/disableable", desc: "List all commands that can be disabled." },
    ],
    extra:
      "Core admin and configuration commands cannot be disabled to prevent locking yourself out. Admins can always use disabled commands.",
  },
  {
    id: "feds",
    label: "Federations",
    description: "Federations allow multiple chats to share bans across a network.",
    cmds: [
      { name: "/newfed", args: "<name>", desc: "Create a new federation (works in PM)." },
      { name: "/delfed", args: "[fedId]", desc: "Delete a federation you own (works in PM)." },
      { name: "/joinfed", args: "<fedId>", desc: "Link the current group to a federation." },
      { name: "/leavefed", desc: "Disconnect the current group from its federation." },
      { name: "/fban", args: "<reply/username/mention/userid> [reason]", desc: "Ban a user across all federation chats (works in PM)." },
      { name: "/unfban", args: "<reply/username/mention/userid> [reason]", desc: "Remove a federation ban everywhere (works in PM)." },
      { name: "/fedinfo", args: "[fedId]", desc: "View details and subscriber stats about a federation." },
      { name: "/fedadmins", desc: "List all administrators in the federation." },
      { name: "/fedbanlist", desc: "List all active federation bans." },
      { name: "/fedsubs", desc: "List all group chats connected to the federation." },
      { name: "/fedpromote", args: "<reply/username/mention/userid>", desc: "Promote a user to federation administrator." },
      { name: "/feddemote", args: "<reply/username/mention/userid>", desc: "Demote a federation administrator." },
    ],
    extra:
      "Federation commands like /fban and /unfban work directly in the bot's private chat. " +
      "When a user is fed-banned, the ban is automatically applied across every linked group in real-time.",
  },
  {
    id: "filters",
    label: "Filters",
    description: "Make your chat more interactive by setting up automated keyword replies.",
    cmds: [
      { name: "/filter", args: "<trigger> <reply>", desc: "Add an automated reply to a trigger word." },
      { name: "/stop", args: "<trigger>", desc: "Remove a filter trigger." },
      { name: "/stopall", desc: "Remove all active filters in this chat." },
      { name: "/filters", desc: "List all active filters in this chat." },
    ],
    extra:
      "Filters match case-insensitive substrings. Multi-word triggers can be wrapped in quotes (e.g. /filter \"hello world\" Welcome!).",
  },
  {
    id: "greetings",
    label: "Greetings",
    description: "Give your new members a warm welcome and say goodbye when they leave!",
    cmds: [
      { name: "/setwelcome", args: "<text>", desc: "Set the welcome message template." },
      { name: "/welcome", args: "[on/off]", desc: "Show current welcome preview or toggle it." },
      { name: "/welcomebutton", args: "<text|url>", desc: "Attach an inline URL button under the welcome message." },
      { name: "/cleanwelcome", args: "<on/off>", desc: "Auto-delete the previous welcome on new member joins." },
      { name: "/welcomemute", args: "<time/off>", desc: "Mute new joiners until verified or approved." },
      { name: "/clearwelcome", desc: "Reset the welcome message back to default." },
      { name: "/setgoodbye", args: "<text>", desc: "Set the goodbye message template." },
      { name: "/goodbye", args: "[on/off]", desc: "Show current goodbye preview or toggle it." },
      { name: "/cleangoodbye", args: "<on/off>", desc: "Auto-delete the previous goodbye message on departures." },
    ],
    extra:
      "Customise messages with placeholders: {first}, {last}, {fullname}, {username}, {mention}, {id}, {count}, {chatname}.",
  },
  {
    id: "locks",
    label: "Locks",
    description: "Locks allow you to control which types of messages can be sent in your group.",
    cmds: [
      { name: "/lock", args: "<type>", desc: "Lock a message type so only admins can send it." },
      { name: "/unlock", args: "<type>", desc: "Unlock a message type." },
      { name: "/locks", desc: "Show which message types are currently locked." },
      { name: "/locktypes", desc: "List all lockable message types." },
      { name: "/lockall", desc: "Lock all message types at once." },
      { name: "/unlockall", desc: "Unlock all message types." },
    ],
    extra:
      "Lockable types include: messages, media, audio, voice, video, stickers, gifs, polls, games, inline, contacts, location, forward, link, bots, other. " +
      "Approved members and admins are exempt from locks.",
  },
  {
    id: "logs",
    label: "Log Channels",
    description: "Keep track of all moderation actions in a dedicated log channel.",
    cmds: [
      { name: "/logchannel", desc: "Reply to a message forwarded from a channel (or run in channel) to set log channel." },
      { name: "/unlogchannel", desc: "Stop mirroring moderation actions to the log channel." },
    ],
    extra:
      "When configured, all bans, mutes, kicks, warnings, and unbans are cleanly logged with detailed audit cards. Make sure HyperGriot is an admin in the log channel.",
  },
  {
    id: "misc",
    label: "Misc",
    description: "General bot utilities, status checks, and identity helpers.",
    cmds: [
      { name: "/id", desc: "Show the current chat ID and relevant user IDs." },
      { name: "/ping", desc: "Check bot latency and online status." },
      { name: "/start", desc: "Start the bot and read the introduction." },
      { name: "/help", desc: "Open this interactive command menu." },
    ],
    extra:
      "All commands support both / and ! prefixes in group chats as well as in direct messages with the bot.",
  },
  {
    id: "notes",
    label: "Notes",
    description: "Save useful messages, rules, or FAQs for quick access at any time.",
    cmds: [
      { name: "/save", args: "<name> <content>", desc: "Save a note, or reply to a message with /save <name>." },
      { name: "/get", args: "<name>", desc: "Retrieve a note. You can also type #name in chat." },
      { name: "/notes", desc: "List all notes saved in this chat." },
      { name: "/clear", args: "<name>", desc: "Delete a saved note." },
      { name: "/removeall", desc: "Delete all notes in this chat." },
      { name: "/private", args: "<on/off>", desc: "Deliver note contents via private message." },
    ],
    extra:
      "Notes support Markdown/HTML formatting and inline URL buttons using the standard [Button Text](buttonurl:link) syntax.",
  },
  {
    id: "pin",
    label: "Pin",
    description: "Pin important messages and manage group announcements easily.",
    cmds: [
      { name: "/pin", args: "[loud]", desc: "Pin the replied message (silent by default; add 'loud' to notify everyone)." },
      { name: "/unpin", desc: "Unpin the replied message or the latest pin." },
      { name: "/unpinall", desc: "Unpin every message in the chat." },
      { name: "/pinned", desc: "Show the most recently pinned message." },
    ],
    extra:
      "HyperGriot requires the 'Pin Messages' permission to pin or unpin messages in the group.",
  },
  {
    id: "purges",
    label: "Purges",
    description: "Delete large numbers of unwanted messages quickly.",
    cmds: [
      { name: "/clean", args: "<N>", desc: "Delete N messages starting backwards from the replied message (1–100)." },
    ],
    extra:
      "Due to Telegram limitations, bots can only delete messages sent within the last 48 hours.",
  },
  {
    id: "reports",
    label: "Reports",
    description: "Allow chat members to report offensive or rule-breaking messages to admins.",
    cmds: [
      { name: "/report", desc: "Reply to a message to alert all group administrators." },
      { name: "/reports", args: "[on/off]", desc: "Show or toggle the member report system." },
    ],
    extra:
      "Members can also type @admin in reply to a message to trigger a report notification to the group's admins.",
  },
  {
    id: "rules",
    label: "Rules",
    description: "Set up and display your group's rules so everyone knows the guidelines.",
    cmds: [
      { name: "/setrules", args: "<text>", desc: "Set the group rules." },
      { name: "/rules", desc: "Display the group rules." },
      { name: "/clearrules", desc: "Clear the group rules." },
    ],
    extra:
      "The /rules command is open to all group members so anyone can check the rules at any time.",
  },
  {
    id: "warnings",
    label: "Warnings",
    description: "Warn users for misbehaviour and automatically punish repeat offenders.",
    cmds: [
      { name: "/warn", args: "<reply/username/mention/userid> [reason]", desc: "Add a warning to a user." },
      { name: "/warns", args: "[reply/username/mention/userid]", desc: "Show a user's accumulated warnings." },
      { name: "/resetwarn", args: "<reply/username/mention/userid>", desc: "Reset a user's warning count." },
      { name: "/rmwarn", args: "<reply/username/mention/userid>", desc: "Remove a user's most recent warning." },
      { name: "/strongwarn", args: "<on/off>", desc: "Execute the punishment action immediately on every warning." },
      { name: "/setwarnlimit", args: "<N>", desc: "Set how many warnings trigger the action (e.g. 3)." },
      { name: "/setwarnaction", args: "<mute/kick/ban/tmute/tban>", desc: "Choose what happens at the warning limit." },
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

/** Builds the authentic Miss Rose 3-column inline button grid. */
export function rootKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  CATEGORIES.forEach((c, i) => {
    kb.text(c.label, `h:${c.id}`);
    if (i % 3 === 2) kb.row();
  });
  if (CATEGORIES.length % 3 !== 0) kb.row();
  kb.text("Close", "h:close");
  return kb;
}

export function backKb(): InlineKeyboard {
  return new InlineKeyboard().text("Back", "h:root");
}

export function catText(c: Cat): string {
  const lines: string[] = [
    `<b>${escapeHtml(c.label)}</b>`,
    "",
    escapeHtml(c.description),
    "",
    `<b>${escapeHtml(c.label)} commands:</b>`,
  ];
  for (const cmd of c.cmds) {
    const usage = cmd.args ? `${cmd.name} ${cmd.args}` : cmd.name;
    lines.push(`- <code>${escapeHtml(usage)}</code>: ${escapeHtml(cmd.desc)}`);
  }
  if (c.extra) {
    lines.push("");
    lines.push(escapeHtml(c.extra));
  }
  return lines.join("\n");
}

export const helpComposer = new Composer<Context>();

helpComposer.command("help", async (ctx) => {
  await ctx.reply(INTRO, { parse_mode: "HTML", reply_markup: rootKb() });
});

helpComposer.callbackQuery(/^h:/, async (ctx) => {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();
  try {
    if (data === "h:close") {
      await ctx.deleteMessage();
      return;
    }
    if (data === "h:root") {
      await ctx.editMessageText(INTRO, { parse_mode: "HTML", reply_markup: rootKb() });
      return;
    }
    const cat = CATEGORIES.find((c) => `h:${c.id}` === data);
    if (cat) {
      await ctx.editMessageText(catText(cat), { parse_mode: "HTML", reply_markup: backKb() });
    }
  } catch {
    /* message not modified / already deleted */
  }
});

export function registerHelp(bot: { use: (c: Composer<Context>) => void }): void {
  bot.use(helpComposer);
}
