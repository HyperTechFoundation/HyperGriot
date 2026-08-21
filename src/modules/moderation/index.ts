/**
 * Moderation module — /ban /tban /sban /unban · /mute /tmute /smute /unmute · /kick
 *
 * Every command funnels through the command-resolution engine (resolveTarget) and the
 * guard sequence (group-only → admin → bot rights → target → duration). See
 * docs/design.md §5.1.
 */

import { Composer, type Context } from "grammy";
import type { ChatPermissions } from "grammy/types";
import { resolveTarget } from "../../core/target.js";
import {
  adminsOnly,
  assertTarget,
  botCanDelete,
  botCanRestrict,
  getDisplayInfo,
  onlyGroups,
} from "../../core/guards.js";
import { buildBanCard, buildKickCard, buildMuteCard, buildUnbanCard, buildUnmuteCard, userLink } from "../../core/formatting.js";
import { store } from "../../repository/store.js";
import type { TargetResult, UserInfo } from "../../types/index.js";

export const moderationComposer = new Composer<Context>();

// ── Shared helpers ──────────────────────────────────────────────

/** Mirror a moderation card to the group's log channel (if set). */
async function mirrorToLog(ctx: Context, text: string): Promise<void> {
  const logChatId = store.getLogChatId(ctx.chat!.id);
  if (logChatId === null) return;
  try {
    await ctx.api.sendMessage(logChatId, text, { parse_mode: "HTML" });
  } catch {
    /* best-effort */
  }
}

interface Prepared {
  target: TargetResult;
  info: UserInfo;
  admin: UserInfo;
}
interface PrepareOpts {
  expectTime?: boolean;
  needDuration?: boolean;
}

/** Resolve target + run guard sequence; returns an error string or a prepared action. */
async function prepare(
  ctx: Context,
  opts: PrepareOpts = {},
): Promise<{ error: string } | Prepared> {
  const target = await resolveTarget(ctx, { expectTime: opts.expectTime });

  if (!(await botCanRestrict(ctx))) {
    return { error: "I need the **Ban Users** right to do this." };
  }
  const targetErr = await assertTarget(ctx, target);
  if (targetErr) return { error: targetErr };
  if (opts.needDuration && !target.durationMs) {
    return { error: "Please provide a duration, e.g. `2h`, `1d`, `1w`." };
  }

  const info = await getDisplayInfo(ctx, target);
  const admin: UserInfo = {
    id: ctx.from!.id,
    firstName: ctx.from!.first_name,
    username: ctx.from!.username,
  };
  return { target, info, admin };
}

/** Run a Telegram API action, replying a friendly message on failure. */
async function runAction(ctx: Context, action: () => Promise<unknown>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (err) {
    await ctx.reply("That didn't work — Telegram returned an error.");
    if (err instanceof Error) console.error("[moderation]", err.message);
    return false;
  }
}

/** A fully-restrictive permission set (mute). */
const MUTE_PERMS: ChatPermissions = {
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
};

/** A permissive permission set (unmute — restores member posting rights). */
const UNMUTE_PERMS: ChatPermissions = {
  can_send_messages: true,
  can_send_audios: true,
  can_send_documents: true,
  can_send_photos: true,
  can_send_videos: true,
  can_send_video_notes: true,
  can_send_voice_notes: true,
  can_send_polls: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true,
  can_change_info: false,
  can_invite_users: false,
  can_pin_messages: false,
  can_manage_topics: false,
};

function untilDate(durationMs: number | null): number | undefined {
  if (!durationMs) return undefined;
  // Enforce Telegram's 30-second minimum duration threshold
  const safeMs = Math.max(30_000, durationMs);
  return Math.floor((Date.now() + safeMs) / 1000);
}

async function tryDeleteCommand(ctx: Context): Promise<void> {
  if (!(await botCanDelete(ctx))) return;
  try {
    await ctx.deleteMessage();
  } catch {
    /* ignore */
  }
}

// ── Ban family ──────────────────────────────────────────────────

moderationComposer.command("ban", onlyGroups, adminsOnly, async (ctx) => {
  const r = await prepare(ctx);
  if ("error" in r) return ctx.reply(r.error);

  if (
    !(await runAction(ctx, () => ctx.api.banChatMember(ctx.chat!.id, r.target.userId!)))
  )
    return;
  const card = buildBanCard({ user: r.info, admin: r.admin, reason: r.target.reason });
  await ctx.reply(card, { parse_mode: "HTML" });
  await mirrorToLog(ctx, card);
});

moderationComposer.command("tban", onlyGroups, adminsOnly, async (ctx) => {
  const r = await prepare(ctx, { expectTime: true, needDuration: true });
  if ("error" in r) return ctx.reply(r.error);

  if (
    !(await runAction(ctx, () =>
      ctx.api.banChatMember(ctx.chat!.id, r.target.userId!, {
        until_date: untilDate(r.target.durationMs),
      }),
    ))
  )
    return;
  const card = buildBanCard({
    user: r.info,
    admin: r.admin,
    reason: r.target.reason,
    durationLabel: r.target.durationLabel,
  });
  await ctx.reply(card, { parse_mode: "HTML" });
  await mirrorToLog(ctx, card);
});

moderationComposer.command("sban", onlyGroups, adminsOnly, async (ctx) => {
  const r = await prepare(ctx);
  if ("error" in r) return ctx.reply(r.error);

  if (
    !(await runAction(ctx, () => ctx.api.banChatMember(ctx.chat!.id, r.target.userId!)))
  )
    return;
  // Truly silent: delete the trigger command and emit NO public card — log only.
  await tryDeleteCommand(ctx);
  const card = buildBanCard({ user: r.info, admin: r.admin, reason: r.target.reason });
  await mirrorToLog(ctx, card);
});

moderationComposer.command("unban", onlyGroups, adminsOnly, async (ctx) => {
  const r = await prepare(ctx);
  if ("error" in r) return ctx.reply(r.error);

  if (
    !(await runAction(ctx, () =>
      ctx.api.unbanChatMember(ctx.chat!.id, r.target.userId!, { only_if_banned: true }),
    ))
  )
    return;
  const card = buildUnbanCard({ user: r.info, admin: r.admin, reason: r.target.reason });
  await ctx.reply(`${userLink(r.info)} was unbanned.`, { parse_mode: "HTML" });
  await mirrorToLog(ctx, card);
});

// ── Mute family ─────────────────────────────────────────────────

moderationComposer.command("mute", onlyGroups, adminsOnly, async (ctx) => {
  const r = await prepare(ctx);
  if ("error" in r) return ctx.reply(r.error);

  if (
    !(await runAction(ctx, () =>
      ctx.api.restrictChatMember(ctx.chat!.id, r.target.userId!, MUTE_PERMS),
    ))
  )
    return;
  const card = buildMuteCard({ user: r.info, admin: r.admin, reason: r.target.reason });
  await ctx.reply(card, { parse_mode: "HTML" });
  await mirrorToLog(ctx, card);
});

moderationComposer.command("tmute", onlyGroups, adminsOnly, async (ctx) => {
  const r = await prepare(ctx, { expectTime: true, needDuration: true });
  if ("error" in r) return ctx.reply(r.error);

  if (
    !(await runAction(ctx, () =>
      ctx.api.restrictChatMember(ctx.chat!.id, r.target.userId!, MUTE_PERMS, {
        until_date: untilDate(r.target.durationMs),
      }),
    ))
  )
    return;
  const card = buildMuteCard({
    user: r.info,
    admin: r.admin,
    reason: r.target.reason,
    durationLabel: r.target.durationLabel,
  });
  await ctx.reply(card, { parse_mode: "HTML" });
  await mirrorToLog(ctx, card);
});

moderationComposer.command("smute", onlyGroups, adminsOnly, async (ctx) => {
  const r = await prepare(ctx);
  if ("error" in r) return ctx.reply(r.error);

  if (
    !(await runAction(ctx, () =>
      ctx.api.restrictChatMember(ctx.chat!.id, r.target.userId!, MUTE_PERMS),
    ))
  )
    return;
  // Truly silent: delete trigger command and log only
  await tryDeleteCommand(ctx);
  const card = buildMuteCard({ user: r.info, admin: r.admin, reason: r.target.reason });
  await mirrorToLog(ctx, card);
});

moderationComposer.command("unmute", onlyGroups, adminsOnly, async (ctx) => {
  const r = await prepare(ctx);
  if ("error" in r) return ctx.reply(r.error);

  if (
    !(await runAction(ctx, () =>
      ctx.api.restrictChatMember(ctx.chat!.id, r.target.userId!, UNMUTE_PERMS),
    ))
  )
    return;
  const card = buildUnmuteCard({ user: r.info, admin: r.admin, reason: r.target.reason });
  await ctx.reply(`${userLink(r.info)} was unmuted.`, { parse_mode: "HTML" });
  await mirrorToLog(ctx, card);
});

// ── Kick ────────────────────────────────────────────────────────

moderationComposer.command("kick", onlyGroups, adminsOnly, async (ctx) => {
  const r = await prepare(ctx);
  if ("error" in r) return ctx.reply(r.error);

  // Kick = ban, then immediately unban so the user can rejoin.
  const ok = await runAction(ctx, async () => {
    await ctx.api.banChatMember(ctx.chat!.id, r.target.userId!);
    await ctx.api.unbanChatMember(ctx.chat!.id, r.target.userId!, {
      only_if_banned: true,
    });
  });
  if (!ok) return;

  const card = buildKickCard({ user: r.info, admin: r.admin, reason: r.target.reason });
  await ctx.reply(card, { parse_mode: "HTML" });
  await mirrorToLog(ctx, card);
});

/** Register the moderation module on a bot instance. */
export function registerModeration(bot: { use: (c: Composer<Context>) => void }): void {
  bot.use(moderationComposer);
}
