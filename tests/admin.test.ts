import { describe, expect, it, beforeEach, vi } from "vitest";
import { Context } from "grammy";
import { adminComposer } from "../src/modules/admin/index.js";
import { store } from "../src/repository/store.js";
import { invalidateAdminCache } from "../src/core/guards.js";

const CHAT_ID = -100123456789;
const ADMIN_USER = { id: 10001, first_name: "LeadAdmin", username: "leadadmin", is_bot: false };
const BOT_USER = { id: 99999, first_name: "HyperGriotBot", username: "hypergriotbot", is_bot: true };

function createMockContext(text: string, replyTo?: any) {
  const replies: { text: string; parse_mode?: string }[] = [];
  const apiCalls: { method: string; args: any[] } = [];

  const update = {
    update_id: 1,
    message: {
      message_id: 10,
      date: Math.floor(Date.now() / 1000),
      chat: { id: CHAT_ID, type: "supergroup", title: "Test Group" },
      from: ADMIN_USER,
      text,
      entities: [
        { type: "bot_command", offset: 0, length: text.split(" ")[0]!.length },
      ],
      reply_to_message: replyTo,
    },
  };

  const api = {
    getMe: vi.fn(async () => BOT_USER),
    getChatAdministrators: vi.fn(async () => [
      { user: ADMIN_USER, status: "creator", custom_title: "Founder" },
      {
        user: BOT_USER,
        status: "administrator",
        can_pin_messages: true,
        can_promote_members: true,
      },
    ]),
    getChatMember: vi.fn(async (_chatId: number, userId: number) => {
      if (userId === BOT_USER.id) {
        return {
          user: BOT_USER,
          status: "administrator",
          can_pin_messages: true,
          can_promote_members: true,
        };
      }
      return { user: { id: userId, first_name: "Member" }, status: "member" };
    }),
    pinChatMessage: vi.fn(async (chatId: number, messageId: number, extra?: any) => {
      apiCalls.push({ method: "pinChatMessage", args: [chatId, messageId, extra] });
    }),
    unpinChatMessage: vi.fn(async (chatId: number, messageId?: number) => {
      apiCalls.push({ method: "unpinChatMessage", args: [chatId, messageId] });
    }),
    promoteChatMember: vi.fn(async (chatId: number, userId: number, perms: any) => {
      apiCalls.push({ method: "promoteChatMember", args: [chatId, userId, perms] });
    }),
  } as any;

  const ctx = new Context(update, api, BOT_USER);
  ctx.reply = vi.fn(async (msg: string, extra?: any) => {
    replies.push({ text: msg, parse_mode: extra?.parse_mode });
    return {} as any;
  });

  return { ctx, replies, apiCalls };
}

beforeEach(() => {
  invalidateAdminCache();
  store.resetForTests();
});

describe("governance module", () => {
  it("pins a message silently by default", async () => {
    const { ctx, replies, apiCalls } = createMockContext("/pin", { message_id: 42, text: "Important announcement" });
    await adminComposer.middleware()(ctx, async () => {});
    expect(apiCalls.some((c) => c.method === "pinChatMessage" && c.args[1] === 42 && c.args[2]?.disable_notification === true)).toBe(true);
    expect(replies[0]?.text).toContain("silently");
  });

  it("pins a message loudly when loud is specified", async () => {
    const { ctx, replies, apiCalls } = createMockContext("/pin loud", { message_id: 42, text: "Loud" });
    await adminComposer.middleware()(ctx, async () => {});
    expect(apiCalls.some((c) => c.method === "pinChatMessage" && c.args[1] === 42 && c.args[2]?.disable_notification === false)).toBe(true);
    expect(replies[0]?.text).toContain("with notification");
  });

  it("sets and retrieves rules", async () => {
    const { ctx: setCtx, replies: setReplies } = createMockContext("/setrules 1. Be kind\n2. No spam");
    await adminComposer.middleware()(setCtx, async () => {});
    expect(setReplies[0]?.text).toContain("updated");

    const { ctx: getCtx, replies: getReplies } = createMockContext("/rules");
    await adminComposer.middleware()(getCtx, async () => {});
    expect(getReplies[0]?.text).toContain("1. Be kind");
  });

  it("saves and lists notes", async () => {
    const { ctx: saveCtx, replies: saveReplies } = createMockContext("/save rules Please read /rules");
    await adminComposer.middleware()(saveCtx, async () => {});
    expect(saveReplies[0]?.text).toContain("Saved note");

    const { ctx: listCtx, replies: listReplies } = createMockContext("/notes");
    await adminComposer.middleware()(listCtx, async () => {});
    expect(listReplies[0]?.text).toContain("#rules");
  });

  it("promotes a user including existing administrators to update rights", async () => {
    // 10001 is ADMIN_USER who is already in getChatAdministrators
    const { ctx, replies, apiCalls } = createMockContext("/promote 10001");
    await adminComposer.middleware()(ctx, async () => {});
    expect(apiCalls.some((c) => c.method === "promoteChatMember" && c.args[1] === 10001)).toBe(true);
    expect(replies[0]?.text).toContain("Successfully promoted");
  });

  it("lists admins nicely formatted", async () => {
    const { ctx, replies } = createMockContext("/adminlist");
    await adminComposer.middleware()(ctx, async () => {});
    expect(replies[0]?.text).toContain("Administrators for Test Group");
    expect(replies[0]?.text).toContain("Founder");
  });
});
