/**
 * Guards & permission helpers.
 * Implements the access sequence in docs/design.md §4.7 and docs/TRD.md §7.
 */

import type { Context, MiddlewareFn } from "grammy";
import type { ChatMemberAdministrator, ChatMemberOwner } from "grammy/types";
import { isOwner } from "../config.js";
import type { GuardOutcome, TargetResult, UserInfo } from "../types/index.js";
import { cacheUser, userInfoById } from "./resolver.js";

// ── Admin-list cache (short TTL) ────────────────────────────────
const ADMIN_TTL_MS = 30_000;
const adminCache = new Map<number, { members: number[]; ts: number }>();

async function getAdminIds(ctx: Context): Promise<number[]> {
  const chatId = ctx.chat?.id;
  if (!chatId) return [];
  const cached = adminCache.get(chatId);
  if (cached && Date.now() - cached.ts < ADMIN_TTL_MS) return cached.members;
  try {
    const admins = await ctx.api.getChatAdministrators(chatId);
    for (const a of admins) {
      if (a.user) cacheUser(a.user);
    }
    const ids = admins.map((a) => a.user.id);
    adminCache.set(chatId, { members: ids, ts: Date.now() });
    return ids;
  } catch {
    return [];
  }
}

export function invalidateAdminCache(chatId?: number): void {
  if (chatId === undefined) adminCache.clear();
  else adminCache.delete(chatId);
}

/** Is the given user an admin (or creator) of this chat, or a global owner? */
export async function isGroupAdmin(ctx: Context, userId: number): Promise<boolean> {
  if (isOwner(userId)) return true;
  const ids = await getAdminIds(ctx);
  return ids.includes(userId);
}

// ── Bot identity cache ──────────────────────────────────────────
let botIdCache: number | null = null;
async function getBotId(ctx: Context): Promise<number> {
  if (botIdCache !== null) return botIdCache;
  const me = await ctx.api.getMe();
  botIdCache = me.id;
  return me.id;
}

type MemberWithRights = ChatMemberOwner | ChatMemberAdministrator;

function memberRights(member: { status: string }): MemberWithRights | null {
  if (member.status === "creator" || member.status === "administrator") {
    return member as unknown as MemberWithRights;
  }
  return null;
}

async function botMember(ctx: Context): Promise<MemberWithRights | null> {
  const chatId = ctx.chat?.id;
  if (!chatId) return null;
  const me = await ctx.api.getChatMember(chatId, await getBotId(ctx));
  return memberRights(me);
}

export async function botCanRestrict(ctx: Context): Promise<boolean> {
  const m = await botMember(ctx);
  if (!m) return false;
  if (m.status === "creator") return true;
  return Boolean(m.can_restrict_members);
}

export async function botCanDelete(ctx: Context): Promise<boolean> {
  const m = await botMember(ctx);
  if (!m) return false;
  if (m.status === "creator") return true;
  return Boolean(m.can_delete_messages);
}

export async function botCanPin(ctx: Context): Promise<boolean> {
  const m = await botMember(ctx);
  if (!m) return false;
  if (m.status === "creator") return true;
  return Boolean(m.can_pin_messages);
}

export async function botCanPromote(ctx: Context): Promise<boolean> {
  const m = await botMember(ctx);
  if (!m) return false;
  if (m.status === "creator") return true;
  return Boolean(m.can_promote_members);
}

// ── Middleware factories ────────────────────────────────────────

/** Reject when invoked outside a group (PM has no target to act on). */
export const onlyGroups: MiddlewareFn<Context> = async (ctx, next) => {
  if (!ctx.chat || ctx.chat.type === "private") {
    await ctx.reply("I can't do this in a private chat. Run it in a group.");
    return;
  }
  return next();
};

/** Require the caller to be a group admin or global owner. */
export const adminsOnly: MiddlewareFn<Context> = async (ctx, next) => {
  if (!ctx.from || !(await isGroupAdmin(ctx, ctx.from.id))) {
    await ctx.reply("You need to be an admin to use this command.");
    return;
  }
  return next();
};

// ── Target validation ───────────────────────────────────────────

/**
 * Validate the resolved target: it must be known and must not be an admin,
 * the bot itself, or a global owner. Returns an error message or null (ok).
 */
export async function assertTarget(
  ctx: Context,
  target: TargetResult,
  opts?: { allowAdmin?: boolean },
): Promise<GuardOutcome> {
  if (target.userId === null) {
    if (target.username) {
      return `I haven't seen @${target.username} yet. Please reply to their message or provide their numeric user ID.`;
    }
    return "I don't know who you're referring to — reply to their message, @mention them, or give their user ID.";
  }
  const botId = await getBotId(ctx);
  if (target.userId === botId) return "I can't act on myself.";
  if (isOwner(target.userId)) return "I can't act on an owner.";
  if (!opts?.allowAdmin && (await isGroupAdmin(ctx, target.userId))) return "I can't act on another admin.";
  return null;
}

/** Best-effort display info for a target (used when the engine only has an ID). */
export async function getDisplayInfo(
  ctx: Context,
  target: TargetResult,
): Promise<UserInfo> {
  if (target.user) return target.user;
  if (target.userId === null) return { id: 0, firstName: "Unknown" };

  // Try cache first (zero API calls), then the chat member.
  const cached = userInfoById(target.userId);
  if (cached) return cached;

  try {
    const member = await ctx.api.getChatMember(ctx.chat!.id, target.userId);
    if (member.user) cacheUser(member.user);
    return { id: member.user.id, firstName: member.user.first_name, username: member.user.username };
  } catch {
    return { id: target.userId, firstName: "Unknown" };
  }
}
