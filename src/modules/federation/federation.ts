/**
 * Federation submodule — Multi-group ban sharing and governance.
 * Supports execution in both groups and the bot's private chat.
 * See docs/design.md §5.5, docs/TRD.md §8.1, and docs/PRD.md §6.5.
 */

import { randomUUID } from "node:crypto";
import { Composer, type Context } from "grammy";
import { adminsOnly, getDisplayInfo, onlyGroups } from "../../core/guards.js";
import { buildFbanCard, escapeHtml, userLink } from "../../core/formatting.js";
import { resolveTarget } from "../../core/target.js";
import { store } from "../../repository/store.js";
import type { FedBan, Federation, UserInfo } from "../../types/index.js";

export const federationComposer = new Composer<Context>();

/** Helper to find the relevant federation for a context (chat or caller). */
export function getActiveFed(ctx: Context, explicitFedId?: string): Federation | null {
  if (explicitFedId) {
    const fed = store.getFed(explicitFedId);
    if (fed) return fed;
  }

  const userId = ctx.from?.id;

  if (ctx.chat && ctx.chat.type !== "private") {
    const fedId = store.getChatFedId(ctx.chat.id);
    if (fedId) return store.getFed(fedId);
  }

  if (userId) {
    const userFeds = store.getFedsForUser(userId);
    if (userFeds.length > 0) {
      const owned = userFeds.find((f) => f.owner === userId);
      return owned || userFeds[0]!;
    }
  }

  return null;
}

/** Check if user is an admin or owner of a given federation. */
export function isFedAdmin(userId: number, fed: Federation): boolean {
  return fed.owner === userId || fed.admins.includes(userId);
}

export interface FanOutResult {
  succeeded: number[];
  failed: { chatId: number; error: unknown; retryable: boolean }[];
}

/** Check if an API error is transient/retryable (rate limits or server errors). */
export function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if ("error_code" in err) {
    const code = (err as any).error_code;
    return code === 429 || code >= 500;
  }
  if ("name" in err && (err as any).name === "HttpError") {
    return true;
  }
  return false;
}

/** Fan out an action across federation chats with bounded concurrency and deduplication. */
export async function fanOutFederationAction(
  chatIds: number[],
  action: (chatId: number) => Promise<unknown>,
  concurrency = 5,
): Promise<FanOutResult> {
  const uniqueChats = Array.from(new Set(chatIds));
  const succeeded: number[] = [];
  const failed: { chatId: number; error: unknown; retryable: boolean }[] = [];

  let index = 0;
  async function worker(): Promise<void> {
    while (index < uniqueChats.length) {
      const i = index++;
      const chatId = uniqueChats[i];
      if (chatId === undefined) break;
      try {
        await action(chatId);
        succeeded.push(chatId);
      } catch (err) {
        const retryable = isRetryableError(err);
        failed.push({ chatId, error: err, retryable });
      }
    }
  }

  const workerCount = Math.min(concurrency, uniqueChats.length);
  if (workerCount > 0) {
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);
  }

  return { succeeded, failed };
}

// ── Federation Management Commands (PM & Groups) ─────────────────

federationComposer.command("newfed", async (ctx) => {
  const name = ctx.message?.text?.replace(/^\/newfed(@\w+)?\s*/i, "").trim();
  if (!name) {
    await ctx.reply("Usage: <code>/newfed &lt;name&gt;</code>", { parse_mode: "HTML" });
    return;
  }

  const fedId = randomUUID().slice(0, 8);
  const ownerId = ctx.from!.id;
  const fed = store.createFed(fedId, name, ownerId);

  await ctx.reply(
    `Created federation <b>${escapeHtml(fed.name)}</b>!\n\n` +
      `• Federation ID: <code>${fed.id}</code>\n` +
      `• Creator / Owner: <code>${ownerId}</code>\n\n` +
      `To link this federation to a group, run <code>/joinfed ${fed.id}</code> in the group.`,
    { parse_mode: "HTML" },
  );
});

federationComposer.command("delfed", async (ctx) => {
  const fedId = ctx.message?.text?.replace(/^\/delfed(@\w+)?\s*/i, "").trim();
  const userId = ctx.from!.id;

  let targetFed: Federation | null = null;
  if (fedId) {
    targetFed = store.getFed(fedId);
  } else {
    targetFed = getActiveFed(ctx);
  }

  if (!targetFed) {
    await ctx.reply("Usage: <code>/delfed &lt;fedId&gt;</code>", { parse_mode: "HTML" });
    return;
  }

  if (targetFed.owner !== userId) {
    await ctx.reply("Only the federation owner can delete this federation.");
    return;
  }

  store.deleteFed(targetFed.id);
  await ctx.reply(`Federation <b>${escapeHtml(targetFed.name)}</b> (<code>${targetFed.id}</code>) has been deleted.`, {
    parse_mode: "HTML",
  });
});

// Group-only federation commands
federationComposer.command("joinfed", onlyGroups, adminsOnly, async (ctx) => {
  const fedId = ctx.message?.text?.replace(/^\/joinfed(@\w+)?\s*/i, "").trim();
  if (!fedId) {
    await ctx.reply("Usage: <code>/joinfed &lt;fedId&gt;</code>", { parse_mode: "HTML" });
    return;
  }

  const fed = store.getFed(fedId);
  if (!fed) {
    await ctx.reply("Federation not found. Check the ID.");
    return;
  }

  store.subscribeChatToFed(ctx.chat.id, fedId);
  await ctx.reply(`Joined federation <b>${escapeHtml(fed.name)}</b>. FBans will now apply to this group.`, {
    parse_mode: "HTML",
  });
});

federationComposer.command("leavefed", onlyGroups, adminsOnly, async (ctx) => {
  const currentFedId = store.getChatFedId(ctx.chat.id);
  if (!currentFedId) {
    await ctx.reply("This group is not linked to any federation.");
    return;
  }

  store.unsubscribeChatFromFed(ctx.chat.id);
  await ctx.reply("Unlinked this group from the federation.");
});

// PM & Group Federation Info Commands
federationComposer.command("fedowner", async (ctx) => {
  const fed = getActiveFed(ctx);
  if (!fed) {
    await ctx.reply(ctx.chat.type === "private" ? "You are not an admin of any federation." : "This group is not linked to any federation.");
    return;
  }

  await ctx.reply(
    `<b>Federation Owner for ${escapeHtml(fed.name)}:</b> <code>${fed.owner}</code>`,
    { parse_mode: "HTML" },
  );
});

federationComposer.command("fedinfo", async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/fedinfo(@\w+)?\s*/i, "").trim();
  let fed: Federation | null = null;
  if (arg) {
    fed = store.getFed(arg);
  } else {
    fed = getActiveFed(ctx);
  }

  if (!fed) {
    await ctx.reply("Please specify a federation ID: <code>/fedinfo &lt;fedId&gt;</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  const banCount = store.getFedBanCount(fed.id);
  await ctx.reply(
    `<b>Federation Info:</b>\n\n` +
      `• Name: <b>${escapeHtml(fed.name)}</b>\n` +
      `• ID: <code>${fed.id}</code>\n` +
      `• Owner: <code>${fed.owner}</code>\n` +
      `• Admins: <b>${fed.admins.length}</b>\n` +
      `• Subscribed Chats: <b>${fed.chats.length}</b>\n` +
      `• Total FBans: <b>${banCount}</b>`,
    { parse_mode: "HTML" },
  );
});

federationComposer.command("fedpromote", async (ctx) => {
  const target = await resolveTarget(ctx);
  if (target.userId === null) {
    if (target.username) {
      await ctx.reply(`I haven't seen @${target.username} yet. Please reply to their message or provide their numeric user ID.`);
    } else {
      await ctx.reply("I don't know who you're referring to — reply to their message, @mention them, or give their user ID.");
    }
    return;
  }

  const fed = getActiveFed(ctx);
  if (!fed) {
    await ctx.reply(ctx.chat.type === "private" ? "You are not an admin of any federation." : "This group is not linked to any federation.");
    return;
  }

  if (fed.owner !== ctx.from!.id) {
    await ctx.reply("Only the federation owner can promote federation admins.");
    return;
  }

  store.addFedAdmin(fed.id, target.userId);
  const info = await getDisplayInfo(ctx, target);
  await ctx.reply(`Promoted ${userLink(info)} to fed admin in <b>${escapeHtml(fed.name)}</b>.`, {
    parse_mode: "HTML",
  });
});

federationComposer.command("feddemote", async (ctx) => {
  const target = await resolveTarget(ctx);
  if (target.userId === null) {
    if (target.username) {
      await ctx.reply(`I haven't seen @${target.username} yet. Please reply to their message or provide their numeric user ID.`);
    } else {
      await ctx.reply("I don't know who you're referring to — reply to their message, @mention them, or give their user ID.");
    }
    return;
  }

  const fed = getActiveFed(ctx);
  if (!fed) {
    await ctx.reply(ctx.chat.type === "private" ? "You are not an admin of any federation." : "This group is not linked to any federation.");
    return;
  }

  if (fed.owner !== ctx.from!.id) {
    await ctx.reply("Only the federation owner can demote federation admins.");
    return;
  }

  store.removeFedAdmin(fed.id, target.userId);
  const info = await getDisplayInfo(ctx, target);
  await ctx.reply(`Demoted ${userLink(info)} from fed admin in <b>${escapeHtml(fed.name)}</b>.`, {
    parse_mode: "HTML",
  });
});

federationComposer.command("fedadmins", async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/fedadmins(@\w+)?\s*/i, "").trim();
  const fed = getActiveFed(ctx, arg || undefined);
  if (!fed) {
    await ctx.reply(ctx.chat.type === "private" ? "You are not an admin of any federation." : "This group is not linked to any federation.");
    return;
  }

  const list = fed.admins.map((a) => `• <code>${a}</code>${a === fed.owner ? " (Owner)" : ""}`).join("\n");
  await ctx.reply(`<b>Admins for ${escapeHtml(fed.name)}:</b>\n\n${list}`, { parse_mode: "HTML" });
});

federationComposer.command("fedbanlist", async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/fedbanlist(@\w+)?\s*/i, "").trim();
  const fed = getActiveFed(ctx, arg || undefined);
  if (!fed) {
    await ctx.reply(ctx.chat.type === "private" ? "You are not an admin of any federation." : "This group is not linked to any federation.");
    return;
  }

  const bans = store.getFedBans(fed.id);
  if (bans.length === 0) {
    await ctx.reply(`No bans recorded in federation <b>${escapeHtml(fed.name)}</b>.`, { parse_mode: "HTML" });
    return;
  }

  const list = bans.slice(0, 50).map((b) => `• <code>${b.userId}</code>: ${escapeHtml(b.reason)}`).join("\n");
  await ctx.reply(`<b>Bans in ${escapeHtml(fed.name)} (${bans.length} total):</b>\n\n${list}`, {
    parse_mode: "HTML",
  });
});

federationComposer.command("fedsubs", async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/fedsubs(@\w+)?\s*/i, "").trim();
  const fed = getActiveFed(ctx, arg || undefined);
  if (!fed) {
    await ctx.reply(ctx.chat.type === "private" ? "You are not an admin of any federation." : "This group is not linked to any federation.");
    return;
  }

  const list = fed.chats.map((c) => `• <code>${c}</code>`).join("\n");
  await ctx.reply(`<b>Subscribed chats in ${escapeHtml(fed.name)}:</b>\n\n${list || "No chats linked."}`, {
    parse_mode: "HTML",
  });
});

// ── FBan and UnFBan (PM & Groups) ────────────────────────────────

federationComposer.command("fban", async (ctx) => {
  const fed = getActiveFed(ctx);
  if (!fed) {
    await ctx.reply(ctx.chat.type === "private" ? "You are not an admin of any federation." : "This group is not linked to any federation.");
    return;
  }

  const userId = ctx.from!.id;
  if (!isFedAdmin(userId, fed)) {
    await ctx.reply("You must be a federation admin to use /fban.");
    return;
  }

  const target = await resolveTarget(ctx);
  if (target.userId === null) {
    if (target.username) {
      await ctx.reply(`I haven't seen @${target.username} yet. Please reply to their message or provide their numeric user ID.`);
    } else {
      await ctx.reply("I don't know who you're referring to — reply to their message, @mention them, or give their user ID.");
    }
    return;
  }

  if (target.userId === fed.owner || fed.admins.includes(target.userId)) {
    await ctx.reply("I can't fed-ban a federation admin or owner.");
    return;
  }

  // 1) Record fed ban
  const fedBan: FedBan = {
    userId: target.userId,
    reason: target.reason || "None",
    banner: userId,
    ts: Date.now(),
  };
  store.addFedBan(fed.id, fedBan);

  // 2) Fan out ban across all subscribed chats with bounded concurrency
  await fanOutFederationAction(fed.chats, (chatId) =>
    ctx.api.banChatMember(chatId, target.userId!),
  );

  const info = await getDisplayInfo(ctx, target);
  const admin: UserInfo = {
    id: ctx.from!.id,
    firstName: ctx.from!.first_name,
    username: ctx.from!.username,
  };

  const card = buildFbanCard({
    user: info,
    admin,
    reason: target.reason,
    fedName: fed.name,
  });
  await ctx.reply(card, { parse_mode: "HTML" });
});

federationComposer.command("unfban", async (ctx) => {
  const fed = getActiveFed(ctx);
  if (!fed) {
    await ctx.reply(ctx.chat.type === "private" ? "You are not an admin of any federation." : "This group is not linked to any federation.");
    return;
  }

  const userId = ctx.from!.id;
  if (!isFedAdmin(userId, fed)) {
    await ctx.reply("You must be a federation admin to use /unfban.");
    return;
  }

  const target = await resolveTarget(ctx);
  if (target.userId === null) {
    if (target.username) {
      await ctx.reply(`I haven't seen @${target.username} yet. Please reply to their message or provide their numeric user ID.`);
    } else {
      await ctx.reply("I don't know who you're referring to — reply to their message, @mention them, or give their user ID.");
    }
    return;
  }

  store.removeFedBan(fed.id, target.userId);

  // Fan out unban across all subscribed chats with bounded concurrency
  await fanOutFederationAction(fed.chats, (chatId) =>
    ctx.api.unbanChatMember(chatId, target.userId!, { only_if_banned: true }),
  );

  const info = await getDisplayInfo(ctx, target);
  await ctx.reply(`${userLink(info)} has been unbanned from federation <b>${escapeHtml(fed.name)}</b>.`, {
    parse_mode: "HTML",
  });
});
