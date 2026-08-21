/**
 * Global update pipeline middleware.
 * Handles update logging, comprehensive user & username ingestion, and command filtering.
 * See docs/TRD.md §3 and docs/design.md §5.
 */

import type { Context, MiddlewareFn } from "grammy";
import type { User } from "grammy/types";
import { ingestUsers } from "./resolver.js";
import { store } from "../repository/store.js";
import { config } from "../config.js";

/** Ingest all users present on the update into the username cache & persistent store. */
export const userIngestionMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const usersToIngest: (User | undefined | null)[] = [];

  if (ctx.from) usersToIngest.push(ctx.from);

  const msg = ctx.message ?? ctx.editedMessage ?? ctx.channelPost;
  if (msg) {
    if (msg.from) usersToIngest.push(msg.from);
    if (msg.reply_to_message?.from) usersToIngest.push(msg.reply_to_message.from);
    const rawMsg = msg as any;
    if (rawMsg.forward_from) usersToIngest.push(rawMsg.forward_from);
    if (rawMsg.forward_origin?.sender_user) {
      usersToIngest.push(rawMsg.forward_origin.sender_user);
    }
    if (msg.new_chat_members) {
      usersToIngest.push(...msg.new_chat_members);
    }
    if (msg.left_chat_member) {
      usersToIngest.push(msg.left_chat_member);
    }

    // Ingest text_mention entities
    const entities = msg.entities ?? msg.caption_entities ?? [];
    for (const e of entities) {
      if (e.type === "text_mention" && e.user) {
        usersToIngest.push(e.user);
      }
    }
  }

  // Chat member updates
  const chatMemberUpdate = (ctx.update as any).chat_member ?? (ctx.update as any).my_chat_member;
  if (chatMemberUpdate) {
    if (chatMemberUpdate.from) usersToIngest.push(chatMemberUpdate.from);
    if (chatMemberUpdate.new_chat_member?.user) usersToIngest.push(chatMemberUpdate.new_chat_member.user);
    if (chatMemberUpdate.old_chat_member?.user) usersToIngest.push(chatMemberUpdate.old_chat_member.user);
  }

  if (ctx.callbackQuery?.from) usersToIngest.push(ctx.callbackQuery.from);
  if (ctx.inlineQuery?.from) usersToIngest.push(ctx.inlineQuery.from);

  if (usersToIngest.length > 0) {
    ingestUsers(usersToIngest);
  }

  return next();
};

/** Log incoming updates when in debug mode. */
export const loggingMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const start = Date.now();
  if (config.debug) {
    const updateId = ctx.update.update_id;
    const from = ctx.from ? `@${ctx.from.username ?? ctx.from.id}` : "unknown";
    const chat = ctx.chat ? `chat:${ctx.chat.id}` : "no-chat";
    const text = ctx.message?.text ? ` "${ctx.message.text}"` : "";
    console.log(`[update:${updateId}] incoming from ${from} in ${chat}${text}`);
  }

  await next();

  if (config.debug) {
    const elapsed = Date.now() - start;
    console.log(`[update:${ctx.update.update_id}] completed in ${elapsed}ms`);
  }
};

/** Filter disabled commands for regular members. */
export const disabledCommandsMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  if (!ctx.chat || ctx.chat.type === "private" || !ctx.message?.text) {
    return next();
  }

  const text = ctx.message.text;
  if (!text.startsWith("/")) {
    return next();
  }

  const cmdMatch = /^\/([a-zA-Z0-9_]+)/.exec(text);
  if (!cmdMatch) {
    return next();
  }

  const cmd = cmdMatch[1]!.toLowerCase();
  const disabled = store.getDisabledCommands(ctx.chat.id);
  if (disabled.includes(cmd)) {
    // If the command is disabled and caller is not admin, ignore silently
    const userId = ctx.from?.id;
    if (userId) {
      const isAdmin = await import("./guards.js").then((m) => m.isGroupAdmin(ctx, userId));
      if (!isAdmin) {
        return; // Ignore completely for non-admins per design §5.6
      }
    }
  }

  return next();
};
