/**
 * Protection module — Locks, Filters, Antiflood, Warnings, Reports, and Approval.
 * See docs/design.md §5.4 and docs/PRD.md §6.4.
 */

import { Composer, type Context, InlineKeyboard } from "grammy";
import type { Message } from "grammy/types";
import {
  adminsOnly,
  assertTarget,
  botCanDelete,
  botCanRestrict,
  getDisplayInfo,
  isGroupAdmin,
  onlyGroups,
} from "../../core/guards.js";
import { buildWarnCard, escapeHtml, userLink } from "../../core/formatting.js";
import { resolveTarget } from "../../core/target.js";
import { store } from "../../repository/store.js";
import {
  ALL_LOCK_TYPES,
  type FloodMode,
  type LockType,
  type UserInfo,
  type WarnAction,
} from "../../types/index.js";

export const protectionComposer = new Composer<Context>();

// ── In-Memory Flood Tracker ─────────────────────────────────────
interface FloodEntry {
  timestamps: number[];
  lastBreach: number;
}
const floodMap = new Map<string, FloodEntry>(); // key = `${chatId}:${userId}`

function checkFloodBreach(chatId: number, userId: number, limit: number, windowMs: number): boolean {
  const key = `${chatId}:${userId}`;
  const now = Date.now();
  let entry = floodMap.get(key);
  if (!entry) {
    entry = { timestamps: [], lastBreach: 0 };
    floodMap.set(key, entry);
  }

  // Filter timestamps within window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);
  entry.timestamps.push(now);

  if (entry.timestamps.length >= limit && now - entry.lastBreach > windowMs) {
    entry.lastBreach = now;
    entry.timestamps = [];
    return true;
  }
  return false;
}

// ── Helper: detect lock types for incoming message ───────────────
export function detectMessageLockTypes(msg: Message): LockType[] {
  const types: LockType[] = [];

  if (msg.text) types.push("messages");
  if (msg.sticker) types.push("stickers");
  if (msg.animation) types.push("gifs", "media");
  if (msg.photo) types.push("media");
  if (msg.video || msg.video_note) types.push("video", "media");
  if (msg.audio) types.push("audio", "media");
  if (msg.voice) types.push("voice", "media");
  if (msg.document) types.push("media");
  if (msg.poll) types.push("polls");
  if (msg.game) types.push("games");
  if (msg.via_bot) types.push("inline");
  if (msg.contact) types.push("contacts");
  if (msg.location || msg.venue) types.push("location");
  if (msg.forward_origin || (msg as any).forward_from || (msg as any).forward_from_chat) {
    types.push("forward");
  }

  const entities = msg.entities ?? msg.caption_entities ?? [];
  if (entities.some((e) => e.type === "url" || e.type === "text_link")) {
    types.push("link");
  }

  if (msg.new_chat_members?.some((m) => m.is_bot)) {
    types.push("bots");
  }

  if (msg.dice || msg.invoice || msg.successful_payment) {
    types.push("other");
  }

  return types;
}

// ── Shared action executor for Flood & Warnings ─────────────────
async function executePunishment(
  ctx: Context,
  targetId: number,
  action: WarnAction | FloodMode,
  reason: string,
): Promise<void> {
  const chatId = ctx.chat!.id;
  try {
    if (action === "ban") {
      await ctx.api.banChatMember(chatId, targetId);
    } else if (action === "tban") {
      const until = Math.floor(Date.now() / 1000) + 3600; // 1 hour default
      await ctx.api.banChatMember(chatId, targetId, { until_date: until });
    } else if (action === "kick") {
      await ctx.api.banChatMember(chatId, targetId);
      await ctx.api.unbanChatMember(chatId, targetId, { only_if_banned: true });
    } else if (action === "mute") {
      await ctx.api.restrictChatMember(chatId, targetId, {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_manage_topics: false,
      });
    } else if (action === "tmute") {
      const until = Math.floor(Date.now() / 1000) + 3600; // 1 hour default
      await ctx.api.restrictChatMember(
        chatId,
        targetId,
        {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
          can_manage_topics: false,
        },
        { until_date: until },
      );
    }
  } catch (err) {
    if (err instanceof Error) console.error("[punishment error]", err.message);
  }
}

// ── Locks Submodule ─────────────────────────────────────────────

protectionComposer.command("lock", onlyGroups, adminsOnly, async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/lock(@\w+)?\s*/i, "").trim().toLowerCase() as LockType;
  if (!arg || !ALL_LOCK_TYPES.includes(arg)) {
    await ctx.reply(`Invalid lock type. Available types:\n<code>${ALL_LOCK_TYPES.join(", ")}</code>`, {
      parse_mode: "HTML",
    });
    return;
  }

  store.lockType(ctx.chat.id, arg);
  await ctx.reply(`Locked <b>${escapeHtml(arg)}</b>. Non-admins cannot send this.`, {
    parse_mode: "HTML",
  });
});

protectionComposer.command("unlock", onlyGroups, adminsOnly, async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/unlock(@\w+)?\s*/i, "").trim().toLowerCase() as LockType;
  if (!arg || !ALL_LOCK_TYPES.includes(arg)) {
    await ctx.reply(`Invalid lock type. Available types:\n<code>${ALL_LOCK_TYPES.join(", ")}</code>`, {
      parse_mode: "HTML",
    });
    return;
  }

  store.unlockType(ctx.chat.id, arg);
  await ctx.reply(`Unlocked <b>${escapeHtml(arg)}</b>.`, { parse_mode: "HTML" });
});

protectionComposer.command("locks", onlyGroups, async (ctx) => {
  const locks = store.getLocks(ctx.chat.id);
  if (locks.size === 0) {
    await ctx.reply("No locks currently active in this group.");
    return;
  }

  const list = Array.from(locks)
    .map((l) => `• <code>${escapeHtml(l)}</code>`)
    .join("\n");
  await ctx.reply(`<b>Active locks in ${escapeHtml(ctx.chat.title)}:</b>\n\n${list}`, {
    parse_mode: "HTML",
  });
});

protectionComposer.command("lockall", onlyGroups, adminsOnly, async (ctx) => {
  store.lockAll(ctx.chat.id, ALL_LOCK_TYPES);
  await ctx.reply("All message types and permissions have been locked.");
});

protectionComposer.command("unlockall", onlyGroups, adminsOnly, async (ctx) => {
  store.unlockAll(ctx.chat.id);
  await ctx.reply("All locks have been cleared.");
});

protectionComposer.command("locktypes", onlyGroups, async (ctx) => {
  await ctx.reply(`<b>Lockable types:</b>\n<code>${ALL_LOCK_TYPES.join(", ")}</code>`, {
    parse_mode: "HTML",
  });
});

// ── Filters Submodule ───────────────────────────────────────────

protectionComposer.command("filter", onlyGroups, adminsOnly, async (ctx) => {
  const raw = ctx.message?.text?.replace(/^\/filter(@\w+)?\s*/i, "").trim() || "";
  if (!raw) {
    await ctx.reply("Usage: <code>/filter &lt;trigger&gt; &lt;reply&gt;</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  const firstSpace = raw.indexOf(" ");
  if (firstSpace === -1) {
    await ctx.reply("Please provide both a trigger and reply text.");
    return;
  }

  const trigger = raw.slice(0, firstSpace).trim();
  const reply = raw.slice(firstSpace + 1).trim();

  store.addFilter(ctx.chat.id, trigger, reply);
  await ctx.reply(`Filter added for <code>${escapeHtml(trigger)}</code>.`, {
    parse_mode: "HTML",
  });
});

protectionComposer.command("stop", onlyGroups, adminsOnly, async (ctx) => {
  const trigger = ctx.message?.text?.replace(/^\/stop(@\w+)?\s*/i, "").trim() || "";
  if (!trigger) {
    await ctx.reply("Usage: /stop <trigger>");
    return;
  }

  const removed = store.removeFilter(ctx.chat.id, trigger);
  if (removed) {
    await ctx.reply(`Stopped filtering <code>${escapeHtml(trigger)}</code>.`, { parse_mode: "HTML" });
  } else {
    await ctx.reply(`No active filter for <code>${escapeHtml(trigger)}</code>.`, { parse_mode: "HTML" });
  }
});

protectionComposer.command("stopall", onlyGroups, adminsOnly, async (ctx) => {
  store.clearFilters(ctx.chat.id);
  await ctx.reply("All filters have been removed.");
});

protectionComposer.command("filters", onlyGroups, async (ctx) => {
  const filters = store.getFilters(ctx.chat.id);
  const keys = Object.keys(filters);
  if (keys.length === 0) {
    await ctx.reply("No filters active in this chat.");
    return;
  }

  const list = keys.map((k) => `• <code>${escapeHtml(k)}</code>`).join("\n");
  await ctx.reply(`<b>Active filters:</b>\n\n${list}`, { parse_mode: "HTML" });
});

// ── Antiflood Submodule ─────────────────────────────────────────

protectionComposer.command("setflood", onlyGroups, adminsOnly, async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/setflood(@\w+)?\s*/i, "").trim().toLowerCase();
  if (!arg || arg === "off") {
    store.setFloodLimit(ctx.chat.id, 0);
    await ctx.reply("Antiflood has been disabled.");
    return;
  }

  const limit = parseInt(arg, 10);
  if (isNaN(limit) || limit < 3) {
    await ctx.reply("Please provide a number ≥ 3 (e.g. <code>/setflood 5</code>) or <code>/setflood off</code>.", {
      parse_mode: "HTML",
    });
    return;
  }

  store.setFloodLimit(ctx.chat.id, limit);
  await ctx.reply(`Antiflood limit set to <b>${limit} messages / 5s</b>.`, { parse_mode: "HTML" });
});

protectionComposer.command("flood", onlyGroups, async (ctx) => {
  const cfg = store.getFloodConfig(ctx.chat.id);
  if (cfg.limit <= 0) {
    await ctx.reply("Antiflood is currently <b>disabled</b>.", { parse_mode: "HTML" });
  } else {
    await ctx.reply(
      `<b>Antiflood settings:</b>\n• Limit: <b>${cfg.limit}</b> msgs / ${cfg.windowMs / 1000}s\n• Action: <b>${cfg.mode}</b>`,
      { parse_mode: "HTML" },
    );
  }
});

protectionComposer.command("setfloodmode", onlyGroups, adminsOnly, async (ctx) => {
  const mode = ctx.message?.text?.replace(/^\/setfloodmode(@\w+)?\s*/i, "").trim().toLowerCase() as FloodMode;
  const validModes: FloodMode[] = ["mute", "ban", "kick", "tmute", "tban"];
  if (!mode || !validModes.includes(mode)) {
    await ctx.reply(`Invalid flood mode. Choose from: <code>${validModes.join(", ")}</code>`, {
      parse_mode: "HTML",
    });
    return;
  }

  store.setFloodMode(ctx.chat.id, mode);
  await ctx.reply(`Antiflood action set to <b>${mode}</b>.`, { parse_mode: "HTML" });
});

// ── Warnings Submodule ──────────────────────────────────────────

protectionComposer.command("warn", onlyGroups, adminsOnly, async (ctx) => {
  const target = await resolveTarget(ctx);
  const targetErr = await assertTarget(ctx, target);
  if (targetErr) {
    await ctx.reply(targetErr);
    return;
  }

  const cfg = store.getWarnConfig(ctx.chat.id);
  const userWarns = store.addWarning(ctx.chat.id, target.userId!, target.reason);
  const info = await getDisplayInfo(ctx, target);
  const admin: UserInfo = {
    id: ctx.from!.id,
    firstName: ctx.from!.first_name,
    username: ctx.from!.username,
  };

  const card = buildWarnCard({
    user: info,
    admin,
    reason: target.reason,
    count: userWarns.count,
    limit: cfg.limit,
  });
  await ctx.reply(card, { parse_mode: "HTML" });

  if (userWarns.count >= cfg.limit || cfg.strong) {
    await executePunishment(ctx, target.userId!, cfg.action, target.reason);
    store.resetWarnings(ctx.chat.id, target.userId!);
    await ctx.reply(
      `${userLink(info)} reached the warning limit (${cfg.limit}) and was <b>${cfg.action}ed</b>.`,
      { parse_mode: "HTML" },
    );
  }
});

protectionComposer.command("warns", onlyGroups, async (ctx) => {
  const target = await resolveTarget(ctx);
  const targetId = target.userId ?? ctx.from?.id;
  if (!targetId) {
    await ctx.reply("I don't know who you're referring to.");
    return;
  }

  const userWarns = store.getWarnings(ctx.chat.id, targetId);
  const cfg = store.getWarnConfig(ctx.chat.id);
  const info = await getDisplayInfo(ctx, { ...target, userId: targetId });

  if (userWarns.count === 0) {
    await ctx.reply(`${userLink(info)} has no warnings.`, { parse_mode: "HTML" });
    return;
  }

  const reasons = userWarns.reasons.map((r, i) => `${i + 1}. ${escapeHtml(r)}`).join("\n");
  await ctx.reply(
    `${userLink(info)} has <b>${userWarns.count}/${cfg.limit}</b> warnings:\n\n${reasons}`,
    { parse_mode: "HTML" },
  );
});

protectionComposer.command("resetwarn", onlyGroups, adminsOnly, async (ctx) => {
  const target = await resolveTarget(ctx);
  if (target.userId === null) {
    if (target.username) {
      await ctx.reply(`I haven't seen @${target.username} yet. Please reply to their message or provide their numeric user ID.`);
    } else {
      await ctx.reply("I don't know who you're referring to — reply to their message, @mention them, or give their user ID.");
    }
    return;
  }

  store.resetWarnings(ctx.chat.id, target.userId);
  const info = await getDisplayInfo(ctx, target);
  await ctx.reply(`Warnings reset for ${userLink(info)}.`, { parse_mode: "HTML" });
});

protectionComposer.command("rmwarn", onlyGroups, adminsOnly, async (ctx) => {
  const target = await resolveTarget(ctx);
  if (target.userId === null) {
    if (target.username) {
      await ctx.reply(`I haven't seen @${target.username} yet. Please reply to their message or provide their numeric user ID.`);
    } else {
      await ctx.reply("I don't know who you're referring to — reply to their message, @mention them, or give their user ID.");
    }
    return;
  }

  const updated = store.removeLatestWarning(ctx.chat.id, target.userId);
  const info = await getDisplayInfo(ctx, target);
  await ctx.reply(
    `Removed latest warning for ${userLink(info)}. Current warnings: <b>${updated.count}</b>.`,
    { parse_mode: "HTML" },
  );
});

protectionComposer.command("strongwarn", onlyGroups, adminsOnly, async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/strongwarn(@\w+)?\s*/i, "").trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    const isStrong = store.getWarnConfig(ctx.chat.id).strong;
    await ctx.reply(`Strong warn is currently <b>${isStrong ? "on" : "off"}</b>. Use /strongwarn on|off.`, {
      parse_mode: "HTML",
    });
    return;
  }

  const strong = arg === "on";
  store.setStrongWarn(ctx.chat.id, strong);
  await ctx.reply(`Strong warnings are now <b>${strong ? "enabled" : "disabled"}</b>.`, {
    parse_mode: "HTML",
  });
});

protectionComposer.command("setwarnlimit", onlyGroups, adminsOnly, async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/setwarnlimit(@\w+)?\s*/i, "").trim();
  const limit = parseInt(arg || "", 10);
  if (isNaN(limit) || limit < 1) {
    await ctx.reply("Please provide a valid limit ≥ 1, e.g. <code>/setwarnlimit 3</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  store.setWarnLimit(ctx.chat.id, limit);
  await ctx.reply(`Warning limit set to <b>${limit}</b>.`, { parse_mode: "HTML" });
});

protectionComposer.command("setwarnaction", onlyGroups, adminsOnly, async (ctx) => {
  const action = ctx.message?.text?.replace(/^\/setwarnaction(@\w+)?\s*/i, "").trim().toLowerCase() as WarnAction;
  const validActions: WarnAction[] = ["mute", "kick", "ban", "tmute", "tban"];
  if (!action || !validActions.includes(action)) {
    await ctx.reply(`Invalid action. Choose from: <code>${validActions.join(", ")}</code>`, {
      parse_mode: "HTML",
    });
    return;
  }

  store.setWarnAction(ctx.chat.id, action);
  await ctx.reply(`Warning action set to <b>${action}</b>.`, { parse_mode: "HTML" });
});

// ── Reports Submodule ───────────────────────────────────────────

protectionComposer.command("report", onlyGroups, async (ctx) => {
  if (!store.isReportsEnabled(ctx.chat.id)) {
    return;
  }

  const replyMsg = ctx.message?.reply_to_message;
  if (!replyMsg) {
    await ctx.reply("Reply to a message with /report to flag it for admins.");
    return;
  }

  try {
    const admins = await ctx.api.getChatAdministrators(ctx.chat.id);
    const mentions = admins
      .filter((a) => !a.user.is_bot && a.user.username)
      .map((a) => `@${a.user.username}`)
      .join(" ");

    await ctx.reply(
      `<b>Reported message!</b>\n\nAdmins alerted: ${mentions || "Admin team notified."}`,
      {
        parse_mode: "HTML",
        reply_parameters: { message_id: replyMsg.message_id },
      },
    );
  } catch {
    await ctx.reply("Report submitted to admins.");
  }
});

protectionComposer.command("reports", onlyGroups, async (ctx) => {
  const args = ctx.message?.text?.replace(/^\/reports(@\w+)?\s*/i, "").trim().toLowerCase();
  if (args === "on" || args === "off") {
    const isAdmin = await isGroupAdmin(ctx, ctx.from!.id);
    if (!isAdmin) {
      await ctx.reply("You need to be an admin to change report settings.");
      return;
    }
    const enable = args === "on";
    store.setReportsEnabled(ctx.chat.id, enable);
    await ctx.reply(`Reports are now <b>${enable ? "enabled" : "disabled"}</b>.`, {
      parse_mode: "HTML",
    });
    return;
  }

  const isEnabled = store.isReportsEnabled(ctx.chat.id);
  await ctx.reply(`Reports are currently <b>${isEnabled ? "enabled" : "disabled"}</b>.`, {
    parse_mode: "HTML",
  });
});

// ── Approval Submodule ──────────────────────────────────────────

protectionComposer.command("approve", onlyGroups, adminsOnly, async (ctx) => {
  const target = await resolveTarget(ctx);
  if (target.userId === null) {
    if (target.username) {
      await ctx.reply(`I haven't seen @${target.username} yet. Please reply to their message or provide their numeric user ID.`);
    } else {
      await ctx.reply("I don't know who you're referring to — reply to their message, @mention them, or give their user ID.");
    }
    return;
  }

  store.setApproved(ctx.chat.id, target.userId, true);
  const info = await getDisplayInfo(ctx, target);
  await ctx.reply(`${userLink(info)} has been approved and is exempt from locks and flood rules.`, {
    parse_mode: "HTML",
  });
});

protectionComposer.command("unapprove", onlyGroups, adminsOnly, async (ctx) => {
  const target = await resolveTarget(ctx);
  if (target.userId === null) {
    if (target.username) {
      await ctx.reply(`I haven't seen @${target.username} yet. Please reply to their message or provide their numeric user ID.`);
    } else {
      await ctx.reply("I don't know who you're referring to — reply to their message, @mention them, or give their user ID.");
    }
    return;
  }

  store.setApproved(ctx.chat.id, target.userId, false);
  const info = await getDisplayInfo(ctx, target);
  await ctx.reply(`${userLink(info)} is no longer approved.`, { parse_mode: "HTML" });
});

protectionComposer.command("approved", onlyGroups, async (ctx) => {
  const userIds = store.getApprovedUsers(ctx.chat.id);
  if (userIds.length === 0) {
    await ctx.reply("No users are currently approved in this group.");
    return;
  }

  const list = userIds.map((id) => `• <code>${id}</code>`).join("\n");
  await ctx.reply(`<b>Approved users in this group:</b>\n\n${list}`, { parse_mode: "HTML" });
});

protectionComposer.command("approval", onlyGroups, adminsOnly, async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/approval(@\w+)?\s*/i, "").trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    const gated = store.isApprovalGated(ctx.chat.id);
    await ctx.reply(`Approval-gated join is currently <b>${gated ? "on" : "off"}</b>.`, {
      parse_mode: "HTML",
    });
    return;
  }

  const gated = arg === "on";
  store.setApprovalGated(ctx.chat.id, gated);
  await ctx.reply(`Approval gating is now <b>${gated ? "enabled" : "disabled"}</b>.`, {
    parse_mode: "HTML",
  });
});

// ── Global Message Interceptor: Locks, Filters & Antiflood ────────

protectionComposer.on("message", async (ctx, next) => {
  if (!ctx.chat || ctx.chat.type === "private" || !ctx.from) {
    return next();
  }

  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  // Admins and approved users bypass locks and flood checks
  const isAdmin = await isGroupAdmin(ctx, userId);
  const isApproved = store.isApproved(chatId, userId);

  if (!isAdmin && !isApproved) {
    // 1) Check locks
    const locks = store.getLocks(chatId);
    if (locks.size > 0) {
      const msgTypes = detectMessageLockTypes(ctx.message);
      const isBreachingLock = msgTypes.some((t) => locks.has(t));

      if (isBreachingLock && (await botCanDelete(ctx))) {
        try {
          await ctx.deleteMessage();
          return; // Stop pipeline for locked content
        } catch {
          /* best-effort */
        }
      }
    }

    // 2) Check Antiflood
    const floodCfg = store.getFloodConfig(chatId);
    if (floodCfg.limit > 0) {
      const breached = checkFloodBreach(chatId, userId, floodCfg.limit, floodCfg.windowMs);
      if (breached && (await botCanRestrict(ctx))) {
        await executePunishment(ctx, userId, floodCfg.mode, "Antiflood triggered");
        try {
          const info = { id: userId, firstName: ctx.from.first_name, username: ctx.from.username };
          await ctx.reply(
            `${userLink(info)} was <b>${floodCfg.mode}ed</b> for flooding.`,
            { parse_mode: "HTML" },
          );
        } catch {
          /* best-effort */
        }
        return;
      }
    }
  }

  // 3) Check custom text filters (applies to all regular text messages)
  if (ctx.message.text && !ctx.message.text.startsWith("/")) {
    const textLower = ctx.message.text.toLowerCase();
    const filters = store.getFilters(chatId);
    for (const [trigger, reply] of Object.entries(filters)) {
      if (textLower.includes(trigger.toLowerCase())) {
        try {
          await ctx.reply(reply, {
            reply_parameters: { message_id: ctx.message.message_id },
          });
        } catch {
          /* best-effort */
        }
        break;
      }
    }
  }

  return next();
});

/** Register the protection module on a bot instance. */
export function registerProtection(bot: { use: (c: Composer<Context>) => void }): void {
  bot.use(protectionComposer);
}
