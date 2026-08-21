import { describe, expect, it, beforeEach, vi } from "vitest";
import { Context } from "grammy";
import { hygieneComposer } from "../src/modules/hygiene/index.js";
import { store } from "../src/repository/store.js";
import { invalidateAdminCache } from "../src/core/guards.js";

const CHAT_ID = -100123456789;
const ADMIN_USER = { id: 10001, first_name: "LeadAdmin", username: "leadadmin", is_bot: false };
const REGULAR_USER = { id: 20002, first_name: "RegularUser", username: "reguser", is_bot: false };
const BOT_USER = { id: 99999, first_name: "HyperGriotBot", username: "hypergriotbot", is_bot: true };

function createMockContext(options: {
  text?: string;
  from?: typeof ADMIN_USER | typeof REGULAR_USER;
  msgProps?: any;
  replyTo?: any;
}) {
  const replies: { text: string; parse_mode?: string }[] = [];
  const apiCalls: { method: string; args: any[] } = [];

  const update = {
    update_id: 1,
    message: {
      message_id: 100,
      date: Math.floor(Date.now() / 1000),
      chat: { id: CHAT_ID, type: "supergroup", title: "Clean Group" },
      from: options.from ?? ADMIN_USER,
      text: options.text,
      entities: options.text?.startsWith("/")
        ? [{ type: "bot_command", offset: 0, length: options.text.split(" ")[0]!.length }]
        : undefined,
      reply_to_message: options.replyTo,
      ...options.msgProps,
    },
  };

  const api = {
    getMe: vi.fn(async () => BOT_USER),
    getChatAdministrators: vi.fn(async () => [
      { user: ADMIN_USER, status: "creator" },
      {
        user: BOT_USER,
        status: "administrator",
        can_restrict_members: true,
        can_delete_messages: true,
      },
    ]),
    getChatMember: vi.fn(async (_chatId: number, userId: number) => {
      if (userId === BOT_USER.id) {
        return { user: BOT_USER, status: "administrator", can_delete_messages: true };
      }
      if (userId === ADMIN_USER.id) {
        return { user: ADMIN_USER, status: "creator" };
      }
      return { user: { id: userId, first_name: "Member" }, status: "member" };
    }),
    deleteMessage: vi.fn(async (chatId: number, messageId: number) => {
      apiCalls.push({ method: "deleteMessage", args: [chatId, messageId] });
    }),
  } as any;

  const ctx = new Context(update, api, BOT_USER);
  ctx.reply = vi.fn(async (msg: string, extra?: any) => {
    replies.push({ text: msg, parse_mode: extra?.parse_mode });
    return { message_id: 999 } as any;
  });
  ctx.deleteMessage = vi.fn(async () => {
    apiCalls.push({ method: "deleteMessage", args: [CHAT_ID, 100] });
    return true as any;
  });

  return { ctx, replies, apiCalls };
}

beforeEach(() => {
  invalidateAdminCache();
  store.resetForTests();
});

describe("hygiene module (clean, disabling, service messages)", () => {
  it("enables and disables cleanservice", async () => {
    const { ctx: onCtx, replies: onReplies } = createMockContext({ text: "/cleanservice on" });
    await hygieneComposer.middleware()(onCtx, async () => {});
    expect(onReplies[0]?.text).toContain("Clean service messages is now <b>enabled</b>");
    expect(store.getCleanConfig(CHAT_ID).service).toBe(true);

    const { ctx: offCtx, replies: offReplies } = createMockContext({ text: "/cleanservice off" });
    await hygieneComposer.middleware()(offCtx, async () => {});
    expect(offReplies[0]?.text).toContain("Clean service messages is now <b>disabled</b>");
    expect(store.getCleanConfig(CHAT_ID).service).toBe(false);
  });

  it("deletes service messages when cleanservice is active", async () => {
    store.setCleanService(CHAT_ID, true);
    const { ctx, apiCalls } = createMockContext({
      from: REGULAR_USER,
      msgProps: { left_chat_member: REGULAR_USER },
    });
    await hygieneComposer.middleware()(ctx, async () => {});
    expect(apiCalls.some((c) => c.method === "deleteMessage")).toBe(true);
  });

  it("disables and enables commands", async () => {
    const { ctx: disCtx, replies: disReplies } = createMockContext({ text: "/disable rules" });
    await hygieneComposer.middleware()(disCtx, async () => {});
    expect(disReplies[0]?.text).toContain("Disabled <code>/rules</code>");
    expect(store.getDisabledCommands(CHAT_ID)).toContain("rules");

    const { ctx: enCtx, replies: enReplies } = createMockContext({ text: "/enable rules" });
    await hygieneComposer.middleware()(enCtx, async () => {});
    expect(enReplies[0]?.text).toContain("Re-enabled <code>/rules</code>");
    expect(store.getDisabledCommands(CHAT_ID)).not.toContain("rules");
  });

  it("purges N messages on /clean N", async () => {
    const { ctx, apiCalls } = createMockContext({
      text: "/clean 5",
      replyTo: { message_id: 50 },
    });
    await hygieneComposer.middleware()(ctx, async () => {});
    expect(apiCalls.filter((c) => c.method === "deleteMessage").length).toBeGreaterThanOrEqual(5);
  });
});
