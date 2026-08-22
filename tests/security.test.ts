import { describe, expect, it, beforeEach, vi } from "vitest";
import { Context } from "grammy";
import { detectMessageLockTypes, securityComposer } from "../src/modules/security/index.js";
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
      message_id: 10,
      date: Math.floor(Date.now() / 1000),
      chat: { id: CHAT_ID, type: "supergroup", title: "Test Group" },
      from: options.from ?? ADMIN_USER,
      text: options.text,
      entities: options.text?.startsWith("/")
        ? [{ type: "bot_command", offset: 0, length: options.text.split(" ")[0]!.length }]
        : undefined,
      reply_to_message: options.replyTo
        ? { message_id: 5, date: Math.floor(Date.now() / 1000), chat: { id: CHAT_ID, type: "supergroup" }, from: options.replyTo }
        : undefined,
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
        return {
          user: BOT_USER,
          status: "administrator",
          can_restrict_members: true,
          can_delete_messages: true,
        };
      }
      if (userId === ADMIN_USER.id) {
        return { user: ADMIN_USER, status: "administrator" };
      }
      return { user: { id: userId, first_name: "Member", username: "member" }, status: "member" };
    }),
    deleteMessage: vi.fn(async () => {
      apiCalls.push({ method: "deleteMessage", args: [] });
    }),
    banChatMember: vi.fn(async (chatId: number, userId: number) => {
      apiCalls.push({ method: "banChatMember", args: [chatId, userId] });
    }),
    restrictChatMember: vi.fn(async (chatId: number, userId: number, perms: any) => {
      apiCalls.push({ method: "restrictChatMember", args: [chatId, userId, perms] });
    }),
  } as any;

  const ctx = new Context(update, api, BOT_USER);
  ctx.reply = vi.fn(async (msg: string, extra?: any) => {
    replies.push({ text: msg, parse_mode: extra?.parse_mode });
    return {} as any;
  });
  ctx.deleteMessage = vi.fn(async () => {
    apiCalls.push({ method: "deleteMessage", args: [] });
    return true as any;
  });

  return { ctx, replies, apiCalls };
}

beforeEach(() => {
  invalidateAdminCache();
  store.resetForTests();
});

describe("protection module", () => {
  it("detects lock types correctly from message shapes", () => {
    expect(detectMessageLockTypes({ text: "Hello" } as any)).toContain("messages");
    expect(detectMessageLockTypes({ sticker: {} } as any)).toContain("stickers");
    expect(detectMessageLockTypes({ animation: {} } as any)).toContain("gifs");
    expect(detectMessageLockTypes({ entities: [{ type: "url", offset: 0, length: 10 }] } as any)).toContain("link");
    expect(detectMessageLockTypes({ forward_origin: {} } as any)).toContain("forward");
  });

  it("locks and unlocks types", async () => {
    const { ctx: lockCtx, replies: lockReplies } = createMockContext({ text: "/lock stickers" });
    await securityComposer.middleware()(lockCtx, async () => {});
    expect(lockReplies[0]?.text).toContain("Locked <b>stickers</b>");
    expect(store.isLocked(CHAT_ID, "stickers")).toBe(true);

    const { ctx: unlockCtx, replies: unlockReplies } = createMockContext({ text: "/unlock stickers" });
    await securityComposer.middleware()(unlockCtx, async () => {});
    expect(unlockReplies[0]?.text).toContain("Unlocked <b>stickers</b>");
    expect(store.isLocked(CHAT_ID, "stickers")).toBe(false);
  });

  it("deletes locked content sent by regular members", async () => {
    store.lockType(CHAT_ID, "stickers");
    const { ctx, apiCalls } = createMockContext({
      from: REGULAR_USER,
      msgProps: { sticker: { file_id: "xyz" } },
    });
    await securityComposer.middleware()(ctx, async () => {});
    expect(apiCalls.some((c) => c.method === "deleteMessage")).toBe(true);
  });

  it("does not delete locked content if user is approved", async () => {
    store.lockType(CHAT_ID, "stickers");
    store.setApproved(CHAT_ID, REGULAR_USER.id, true);
    const { ctx, apiCalls } = createMockContext({
      from: REGULAR_USER,
      msgProps: { sticker: { file_id: "xyz" } },
    });
    await securityComposer.middleware()(ctx, async () => {});
    expect(apiCalls.some((c) => c.method === "deleteMessage")).toBe(false);
  });

  it("executes /warn and triggers punishment at limit", async () => {
    store.setWarnLimit(CHAT_ID, 2);
    store.setWarnAction(CHAT_ID, "ban");

    // Warn 1
    const { ctx: w1Ctx, replies: w1Replies, apiCalls: w1Calls } = createMockContext({
      text: "/warn Bad behavior",
      replyTo: REGULAR_USER,
    });
    await securityComposer.middleware()(w1Ctx, async () => {});
    expect(w1Replies[0]?.text).toContain("has been warned (1/2)");
    expect(w1Calls.some((c) => c.method === "banChatMember")).toBe(false);

    // Warn 2 (triggers ban)
    const { ctx: w2Ctx, replies: w2Replies, apiCalls: w2Calls } = createMockContext({
      text: "/warn Bad behavior 2",
      replyTo: REGULAR_USER,
    });
    await securityComposer.middleware()(w2Ctx, async () => {});
    expect(w2Replies[0]?.text).toContain("has been warned (2/2)");
    expect(w2Calls.some((c) => c.method === "banChatMember")).toBe(true);
  });

  it("handles custom text filters", async () => {
    store.addFilter(CHAT_ID, "crypto", "Scam warning: beware of fake crypto!");
    const { ctx, replies } = createMockContext({
      from: REGULAR_USER,
      text: "Is this crypto safe?",
    });
    await securityComposer.middleware()(ctx, async () => {});
    expect(replies[0]?.text).toContain("Scam warning: beware of fake crypto!");
  });

  it("approves and unapproves users", async () => {
    const { ctx: appCtx, replies: appReplies } = createMockContext({
      text: `/approve ${REGULAR_USER.id}`,
    });
    await securityComposer.middleware()(appCtx, async () => {});
    expect(appReplies[0]?.text).toContain("approved");
    expect(store.isApproved(CHAT_ID, REGULAR_USER.id)).toBe(true);

    const { ctx: unappCtx, replies: unappReplies } = createMockContext({
      text: `/unapprove ${REGULAR_USER.id}`,
    });
    await securityComposer.middleware()(unappCtx, async () => {});
    expect(unappReplies[0]?.text).toContain("no longer approved");
    expect(store.isApproved(CHAT_ID, REGULAR_USER.id)).toBe(false);
  });
});
