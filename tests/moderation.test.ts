import { describe, expect, it, beforeEach, vi } from "vitest";
import { Context } from "grammy";
import { moderationComposer } from "../src/modules/moderation/index.js";
import { clearUsernameCache } from "../src/core/resolver.js";
import { store } from "../src/repository/store.js";
import { invalidateAdminCache } from "../src/core/guards.js";

const CHAT_ID = -100123456789;
const ADMIN_USER = { id: 100, first_name: "LeadAdmin", username: "leadadmin", is_bot: false };
const TARGET_USER = { id: 200, first_name: "TargetUser", username: "targetuser", is_bot: false };
const BOT_USER = { id: 999, first_name: "HyperGriotBot", username: "hypergriotbot", is_bot: true };

function createMockContext(options: {
  text: string;
  from?: typeof ADMIN_USER;
  replyTo?: typeof TARGET_USER;
  chatType?: string;
  botRights?: { can_restrict_members?: boolean; can_delete_messages?: boolean };
}) {
  const replies: { text: string; parse_mode?: string }[] = [];
  const apiCalls: { method: string; args: any[] } = [];

  const update = {
    update_id: 1,
    message: {
      message_id: 10,
      date: Math.floor(Date.now() / 1000),
      chat: { id: CHAT_ID, type: options.chatType ?? "supergroup", title: "Test Group" },
      from: options.from ?? ADMIN_USER,
      text: options.text,
      entities: [
        { type: "bot_command", offset: 0, length: options.text.split(" ")[0]!.length },
      ],
      reply_to_message: options.replyTo
        ? {
            message_id: 5,
            date: Math.floor(Date.now() / 1000),
            chat: { id: CHAT_ID, type: options.chatType ?? "supergroup" },
            from: options.replyTo,
            text: "Hello I am target",
          }
        : undefined,
    },
  };

  const api = {
    getMe: vi.fn(async () => BOT_USER),
    getChatAdministrators: vi.fn(async () => [
      { user: ADMIN_USER, status: "administrator" },
      {
        user: BOT_USER,
        status: "administrator",
        can_restrict_members: options.botRights?.can_restrict_members ?? true,
        can_delete_messages: options.botRights?.can_delete_messages ?? true,
      },
    ]),
    getChatMember: vi.fn(async (_chatId: number, userId: number) => {
      if (userId === BOT_USER.id) {
        return {
          user: BOT_USER,
          status: "administrator",
          can_restrict_members: options.botRights?.can_restrict_members ?? true,
          can_delete_messages: options.botRights?.can_delete_messages ?? true,
        };
      }
      if (userId === ADMIN_USER.id) {
        return { user: ADMIN_USER, status: "administrator" };
      }
      return { user: { id: userId, first_name: "SomeMember", is_bot: false }, status: "member" };
    }),
    banChatMember: vi.fn(async (chatId: number, userId: number, extra?: any) => {
      apiCalls.push({ method: "banChatMember", args: [chatId, userId, extra] });
    }),
    unbanChatMember: vi.fn(async (chatId: number, userId: number, extra?: any) => {
      apiCalls.push({ method: "unbanChatMember", args: [chatId, userId, extra] });
    }),
    restrictChatMember: vi.fn(async (chatId: number, userId: number, perms: any, extra?: any) => {
      apiCalls.push({ method: "restrictChatMember", args: [chatId, userId, perms, extra] });
    }),
    sendMessage: vi.fn(async (chatId: number, text: string, extra?: any) => {
      apiCalls.push({ method: "sendMessage", args: [chatId, text, extra] });
    }),
    deleteMessage: vi.fn(async () => {
      apiCalls.push({ method: "deleteMessage", args: [] });
    }),
  } as any;

  const ctx = new Context(update, api, BOT_USER);
  ctx.reply = vi.fn(async (text: string, extra?: any) => {
    replies.push({ text, parse_mode: extra?.parse_mode });
    return {} as any;
  });
  ctx.deleteMessage = vi.fn(async () => {
    apiCalls.push({ method: "deleteMessage", args: [] });
    return true as any;
  });

  return { ctx, replies, apiCalls };
}

beforeEach(() => {
  clearUsernameCache();
  invalidateAdminCache();
  store.resetForTests();
});

describe("moderation module integration", () => {
  it("rejects command when called in private chat", async () => {
    const { ctx, replies } = createMockContext({
      text: "/ban",
      chatType: "private",
      replyTo: TARGET_USER,
    });
    await moderationComposer.middleware()(ctx, async () => {});
    expect(replies[0]?.text).toContain("I can't do this in a private chat.");
  });

  it("rejects command when caller is not an admin", async () => {
    const regularUser = { id: 300, first_name: "Regular", username: "reg", is_bot: false };
    const { ctx, replies } = createMockContext({
      text: "/ban",
      from: regularUser,
      replyTo: TARGET_USER,
    });
    await moderationComposer.middleware()(ctx, async () => {});
    expect(replies[0]?.text).toContain("You need to be an admin to use this command.");
  });

  it("executes /ban on reply target and builds ban card", async () => {
    const { ctx, replies, apiCalls } = createMockContext({
      text: "/ban Spamming links",
      replyTo: TARGET_USER,
    });
    await moderationComposer.middleware()(ctx, async () => {});
    expect(apiCalls.some((c) => c.method === "banChatMember" && c.args[1] === TARGET_USER.id)).toBe(true);
    expect(replies[0]?.text).toContain("TargetUser</a> got banned from the group.");
    expect(replies[0]?.text).toContain("Reason: Spamming links");
    expect(replies[0]?.text).toContain("Banned By: LeadAdmin");
  });

  it("executes /tban with duration and reason", async () => {
    const { ctx, replies, apiCalls } = createMockContext({
      text: "/tban 2h Flooding",
      replyTo: TARGET_USER,
    });
    await moderationComposer.middleware()(ctx, async () => {});
    const banCall = apiCalls.find((c) => c.method === "banChatMember");
    expect(banCall).toBeDefined();
    expect(banCall?.args[2]?.until_date).toBeGreaterThan(0);
    expect(replies[0]?.text).toContain("got banned for 2 hours.");
    expect(replies[0]?.text).toContain("Reason: Flooding");
  });

  it("executes /sban silently: deletes trigger and sends no public card", async () => {
    store.setLogChatId(CHAT_ID, -1009999);
    const { ctx, replies, apiCalls } = createMockContext({
      text: "/sban silent spam",
      replyTo: TARGET_USER,
    });
    await moderationComposer.middleware()(ctx, async () => {});
    expect(apiCalls.some((c) => c.method === "banChatMember")).toBe(true);
    expect(apiCalls.some((c) => c.method === "deleteMessage")).toBe(true);
    expect(replies.length).toBe(0); // Truly silent in public chat
    expect(apiCalls.some((c) => c.method === "sendMessage" && c.args[0] === -1009999)).toBe(true); // Mirrored to log
  });

  it("executes /kick via ban + unban", async () => {
    const { ctx, replies, apiCalls } = createMockContext({
      text: "/kick Please leave",
      replyTo: TARGET_USER,
    });
    await moderationComposer.middleware()(ctx, async () => {});
    expect(apiCalls.some((c) => c.method === "banChatMember")).toBe(true);
    expect(apiCalls.some((c) => c.method === "unbanChatMember" && c.args[2]?.only_if_banned === true)).toBe(true);
    expect(replies[0]?.text).toContain("got kicked!");
    expect(replies[0]?.text).toContain("Reason: Please leave");
  });

  it("executes /mute and /unmute with log mirroring", async () => {
    store.setLogChatId(CHAT_ID, -1009999);
    const { ctx, replies, apiCalls } = createMockContext({
      text: "/mute Be quiet",
      replyTo: TARGET_USER,
    });
    await moderationComposer.middleware()(ctx, async () => {});
    expect(apiCalls.some((c) => c.method === "restrictChatMember")).toBe(true);
    expect(replies[0]?.text).toContain("got muted.");
    expect(apiCalls.some((c) => c.method === "sendMessage" && c.args[0] === -1009999)).toBe(true);

    const { ctx: unCtx, replies: unReplies, apiCalls: unApiCalls } = createMockContext({
      text: "/unmute",
      replyTo: TARGET_USER,
    });
    await moderationComposer.middleware()(unCtx, async () => {});
    expect(unReplies[0]?.text).toContain("was unmuted.");
    expect(unApiCalls.some((c) => c.method === "sendMessage" && c.args[0] === -1009999)).toBe(true);
  });
});
