import { describe, expect, it, beforeEach, vi } from "vitest";
import { Context } from "grammy";
import { networkComposer } from "../src/modules/network/index.js";
import { store } from "../src/repository/store.js";
import { invalidateAdminCache } from "../src/core/guards.js";

const CHAT_1 = -100111111111;
const CHAT_2 = -100222222222;
const PM_CHAT = 10001;
const OWNER_USER = { id: 10001, first_name: "FedOwner", username: "fedowner", is_bot: false };
const FED_ADMIN = { id: 20002, first_name: "FedAdmin", username: "fedadmin", is_bot: false };
const SPAMMER_USER = { id: 30003, first_name: "Spammer", username: "spammer", is_bot: false };
const BOT_USER = { id: 99999, first_name: "HyperGriotBot", username: "hypergriotbot", is_bot: true };

function createMockContext(options: {
  text: string;
  chatId?: number;
  chatType?: "supergroup" | "private";
  from?: typeof OWNER_USER | typeof FED_ADMIN | typeof SPAMMER_USER;
  replyTo?: any;
}) {
  const chatId = options.chatId ?? CHAT_1;
  const chatType = options.chatType ?? (chatId > 0 ? "private" : "supergroup");
  const replies: { text: string; parse_mode?: string }[] = [];
  const apiCalls: { method: string; args: any[] } = [];

  const update = {
    update_id: 1,
    message: {
      message_id: 10,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: chatType, title: chatType === "private" ? undefined : "Federated Group" },
      from: options.from ?? OWNER_USER,
      text: options.text,
      entities: [
        { type: "bot_command", offset: 0, length: options.text.split(" ")[0]!.length },
      ],
      reply_to_message: options.replyTo
        ? { message_id: 5, date: Math.floor(Date.now() / 1000), chat: { id: chatId, type: chatType }, from: options.replyTo }
        : undefined,
    },
  };

  const api = {
    getMe: vi.fn(async () => BOT_USER),
    getChatAdministrators: vi.fn(async () => [
      { user: OWNER_USER, status: "creator" },
      { user: FED_ADMIN, status: "administrator" },
      {
        user: BOT_USER,
        status: "administrator",
        can_restrict_members: true,
        can_delete_messages: true,
      },
    ]),
    getChatMember: vi.fn(async (_chatId: number, userId: number) => {
      if (userId === BOT_USER.id) {
        return { user: BOT_USER, status: "administrator" };
      }
      if (userId === OWNER_USER.id) {
        return { user: OWNER_USER, status: "creator" };
      }
      return { user: { id: userId, first_name: "Member", username: "member" }, status: "member" };
    }),
    banChatMember: vi.fn(async (cId: number, userId: number) => {
      apiCalls.push({ method: "banChatMember", args: [cId, userId] });
    }),
    unbanChatMember: vi.fn(async (cId: number, userId: number, extra?: any) => {
      apiCalls.push({ method: "unbanChatMember", args: [cId, userId, extra] });
    }),
    sendMessage: vi.fn(async (cId: number, text: string, extra?: any) => {
      apiCalls.push({ method: "sendMessage", args: [cId, text, extra] });
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

describe("network module (federation & log channel)", () => {
  it("creates a federation and links groups", async () => {
    const { ctx: newCtx, replies: newReplies } = createMockContext({
      text: "/newfed GlobalAlliance",
      from: OWNER_USER,
    });
    await networkComposer.middleware()(newCtx, async () => {});
    expect(newReplies[0]?.text).toContain("Created federation <b>GlobalAlliance</b>");

    // Extract fedId
    const fedMatch = /Federation ID: <code>([a-zA-Z0-9-]+)<\/code>/.exec(newReplies[0]!.text);
    expect(fedMatch).not.toBeNull();
    const fedId = fedMatch![1]!;

    // Join CHAT_1
    const { ctx: join1Ctx, replies: join1Replies } = createMockContext({
      text: `/joinfed ${fedId}`,
      chatId: CHAT_1,
      from: OWNER_USER,
    });
    await networkComposer.middleware()(join1Ctx, async () => {});
    expect(join1Replies[0]?.text).toContain("Joined federation");

    // Join CHAT_2
    const { ctx: join2Ctx, replies: join2Replies } = createMockContext({
      text: `/joinfed ${fedId}`,
      chatId: CHAT_2,
      from: OWNER_USER,
    });
    await networkComposer.middleware()(join2Ctx, async () => {});
    expect(join2Replies[0]?.text).toContain("Joined federation");

    // Check fed subs
    expect(store.getFed(fedId)?.chats).toEqual([CHAT_1, CHAT_2]);
  });

  it("fans out fban across all subscribed chats", async () => {
    const fed = store.createFed("fed-123", "TestFed", OWNER_USER.id);
    store.subscribeChatToFed(CHAT_1, fed.id);
    store.subscribeChatToFed(CHAT_2, fed.id);

    const { ctx: fbanCtx, replies: fbanReplies, apiCalls } = createMockContext({
      text: `/fban ${SPAMMER_USER.id} Raiding networks`,
      chatId: CHAT_1,
      from: OWNER_USER,
    });
    await networkComposer.middleware()(fbanCtx, async () => {});

    expect(fbanReplies[0]?.text).toContain("got fed-banned from TestFed.");
    expect(fbanReplies[0]?.text).toContain("Reason: Raiding networks");

    // Check ban fan-out across CHAT_1 and CHAT_2
    expect(apiCalls.some((c) => c.method === "banChatMember" && c.args[0] === CHAT_1 && c.args[1] === SPAMMER_USER.id)).toBe(true);
    expect(apiCalls.some((c) => c.method === "banChatMember" && c.args[0] === CHAT_2 && c.args[1] === SPAMMER_USER.id)).toBe(true);

    // Check fed ban record in store
    expect(store.getFedBan(fed.id, SPAMMER_USER.id)?.reason).toBe("Raiding networks");
  });

  it("executes /fban inside the bot's PM and applies across all linked groups", async () => {
    const fed = store.createFed("fed-pm", "PMFed", OWNER_USER.id);
    store.subscribeChatToFed(CHAT_1, fed.id);
    store.subscribeChatToFed(CHAT_2, fed.id);

    const { ctx: fbanCtx, replies: fbanReplies, apiCalls } = createMockContext({
      text: `/fban ${SPAMMER_USER.id} PM Spammer`,
      chatId: PM_CHAT,
      chatType: "private",
      from: OWNER_USER,
    });

    await networkComposer.middleware()(fbanCtx, async () => {});

    expect(fbanReplies[0]?.text).toContain("got fed-banned from PMFed.");
    expect(fbanReplies[0]?.text).toContain("Reason: PM Spammer");

    // Check ban fan-out across linked groups CHAT_1 and CHAT_2
    expect(apiCalls.some((c) => c.method === "banChatMember" && c.args[0] === CHAT_1 && c.args[1] === SPAMMER_USER.id)).toBe(true);
    expect(apiCalls.some((c) => c.method === "banChatMember" && c.args[0] === CHAT_2 && c.args[1] === SPAMMER_USER.id)).toBe(true);
  });

  it("rejects /joinfed in PM as a group-only command", async () => {
    const fed = store.createFed("fed-test", "TestFed", OWNER_USER.id);
    const { ctx, replies } = createMockContext({
      text: `/joinfed ${fed.id}`,
      chatId: PM_CHAT,
      chatType: "private",
      from: OWNER_USER,
    });

    await networkComposer.middleware()(ctx, async () => {});
    expect(replies[0]?.text).toContain("I can't do this in a private chat. Run it in a group.");
  });

  it("configures log channel", async () => {
    const { ctx, replies } = createMockContext({
      text: "/logchannel -100999999999",
      from: OWNER_USER,
    });
    await networkComposer.middleware()(ctx, async () => {});
    expect(replies[0]?.text).toContain("Moderation log channel set");
    expect(store.getLogChatId(CHAT_1)).toBe(-100999999999);
  });
});
