import { describe, expect, it, vi } from "vitest";
import { Context } from "grammy";
import { normalizePrefixMiddleware } from "../src/core/prefix.js";
import { createBot } from "../src/bot.js";
import { store } from "../src/repository/store.js";
import { invalidateAdminCache } from "../src/core/guards.js";

const CHAT_ID = -100123456789;
const ADMIN_USER = { id: 10001, first_name: "LeadAdmin", username: "leadadmin", is_bot: false };
const TARGET_USER = { id: 20002, first_name: "TargetUser", username: "targetuser", is_bot: false };
const BOT_USER = { id: 99999, first_name: "HyperGriotBot", username: "hypergriotbot", is_bot: true };

describe("dual-prefix normalization middleware", () => {
  it("rewrites !command to /command and injects bot_command entity", async () => {
    const update = {
      update_id: 1,
      message: {
        message_id: 10,
        date: Math.floor(Date.now() / 1000),
        chat: { id: CHAT_ID, type: "supergroup", title: "Test Group" },
        from: ADMIN_USER,
        text: "!ban @targetuser spam",
      },
    };

    const ctx = new Context(update as any, {} as any, BOT_USER);
    let nextCalled = false;
    await normalizePrefixMiddleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx.message?.text).toBe("/ban @targetuser spam");
    expect(ctx.message?.entities).toEqual([
      {
        type: "bot_command",
        offset: 0,
        length: 4, // '/ban'.length
      },
    ]);
  });

  it("leaves standard /command unaffected", async () => {
    const originalEntities = [{ type: "bot_command" as const, offset: 0, length: 4 }];
    const update = {
      update_id: 2,
      message: {
        message_id: 11,
        date: Math.floor(Date.now() / 1000),
        chat: { id: CHAT_ID, type: "supergroup", title: "Test Group" },
        from: ADMIN_USER,
        text: "/ban @targetuser spam",
        entities: originalEntities,
      },
    };

    const ctx = new Context(update as any, {} as any, BOT_USER);
    await normalizePrefixMiddleware(ctx, async () => {});

    expect(ctx.message?.text).toBe("/ban @targetuser spam");
    expect(ctx.message?.entities).toEqual(originalEntities);
  });

  it("handles captions starting with !", async () => {
    const update = {
      update_id: 3,
      message: {
        message_id: 12,
        date: Math.floor(Date.now() / 1000),
        chat: { id: CHAT_ID, type: "supergroup", title: "Test Group" },
        from: ADMIN_USER,
        caption: "!pin loud",
      },
    };

    const ctx = new Context(update as any, {} as any, BOT_USER);
    await normalizePrefixMiddleware(ctx, async () => {});

    expect(ctx.message?.caption).toBe("/pin loud");
    expect(ctx.message?.caption_entities).toEqual([
      {
        type: "bot_command",
        offset: 0,
        length: 4, // '/pin'.length
      },
    ]);
  });

  it("triggers actual bot commands when executed with '!' prefix", async () => {
    invalidateAdminCache();
    store.resetForTests();

    const bot = createBot();
    const replies: string[] = [];

    const update = {
      update_id: 4,
      message: {
        message_id: 20,
        date: Math.floor(Date.now() / 1000),
        chat: { id: CHAT_ID, type: "supergroup", title: "Test Group" },
        from: ADMIN_USER,
        text: "!ping",
      },
    };

    const ctx = new Context(update as any, {} as any, BOT_USER as any);
    ctx.reply = vi.fn(async (text: string) => {
      replies.push(text);
      return {} as any;
    });

    await bot.middleware()(ctx, async () => {});
    expect(replies[0]).toBe("Pong! HyperGriot is online.");
  });

  it("correctly preserves bot username tag in command length for !cmd@BotUsername", async () => {
    const update = {
      update_id: 5,
      message: {
        message_id: 25,
        date: Math.floor(Date.now() / 1000),
        chat: { id: CHAT_ID, type: "supergroup", title: "Test Group" },
        from: ADMIN_USER,
        text: "!ping@HyperGriotBot",
      },
    };

    const ctx = new Context(update as any, {} as any, BOT_USER);
    await normalizePrefixMiddleware(ctx, async () => {});

    expect(ctx.message?.text).toBe("/ping@HyperGriotBot");
    expect(ctx.message?.entities).toEqual([
      {
        type: "bot_command",
        offset: 0,
        length: 19, // '/ping@HyperGriotBot'.length
      },
    ]);
  });
});
