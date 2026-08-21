import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Context } from "grammy";
import type { MessageEntity } from "grammy/types";
import { resolveTarget } from "../src/core/target.js";
import { cacheUser, clearUsernameCache } from "../src/core/resolver.js";
import { store } from "../src/repository/store.js";

// ── Test helpers ────────────────────────────────────────────────
type Ctx = Partial<Context>;

function makeCtx(text: string, entities: MessageEntity[], reply?: object, api?: any, chat?: any): Context {
  return {
    message: { text, entities, reply_to_message: reply },
    api,
    chat: chat ?? { id: -100123456789, type: "supergroup" },
  } as unknown as Context;
}

const cmd = (length: number): MessageEntity => ({ type: "bot_command", offset: 0, length });
const mention = (offset: number, length: number): MessageEntity => ({
  type: "mention",
  offset,
  length,
});
const textMention = (
  offset: number,
  length: number,
  user: { id: number; first_name: string; username?: string; is_bot?: boolean },
): MessageEntity => ({ type: "text_mention", offset, length, user });

const BOB = { id: 111, first_name: "Bob" };
const CAROL = { id: 222, first_name: "Carol", username: "carol" };
const DAVE = { id: 333, first_name: "Dave", username: "dave_admin" };

beforeEach(() => {
  clearUsernameCache();
  store.resetForTests();
});

describe("command-resolution engine", () => {
  it("uses the replied user when only a reply tag is given (empty reason)", async () => {
    const ctx = makeCtx("/ban", [cmd(4)], { from: BOB });
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("reply");
    expect(t.userId).toBe(111);
    expect(t.reason).toBe("");
    expect(t.reasonPresent).toBe(false);
    expect(t.user?.firstName).toBe("Bob");
  });

  it("treats text after the command as the reason when replying", async () => {
    const ctx = makeCtx("/ban raid", [cmd(4)], { from: BOB });
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("reply");
    expect(t.userId).toBe(111);
    expect(t.reason).toBe("raid");
  });

  it("resolves a cached @mention and keeps the reason", async () => {
    cacheUser(CAROL);
    // "/ban @carol spam"
    const ctx = makeCtx("/ban @carol spam", [cmd(4), mention(5, 6)]);
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("mention");
    expect(t.userId).toBe(222);
    expect(t.username).toBe("carol");
    expect(t.reason).toBe("spam");
  });

  it("resolves raw @username token even when Telegram did not produce a mention entity", async () => {
    cacheUser(CAROL);
    // No mention entity in entities array
    const ctx = makeCtx("/ban @carol spamming links", [cmd(4)]);
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("mention");
    expect(t.userId).toBe(222);
    expect(t.username).toBe("carol");
    expect(t.reason).toBe("spamming links");
  });

  it("resolves @mention from persistent store when memory cache was cleared", async () => {
    // Save to store
    store.saveUser(CAROL);
    clearUsernameCache(); // In-memory cache is empty

    const ctx = makeCtx("/ban @carol spam", [cmd(4), mention(5, 6)]);
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("mention");
    expect(t.userId).toBe(222);
    expect(t.user?.firstName).toBe("Carol");
  });

  it("dynamically queries getChatAdministrators when @mention is unknown", async () => {
    const api = {
      getChatAdministrators: vi.fn(async () => [
        { user: { id: 333, first_name: "Dave", username: "dave_admin" }, status: "administrator" },
      ]),
    };

    const ctx = makeCtx("/ban @dave_admin spam", [cmd(4), mention(5, 11)], undefined, api);
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("mention");
    expect(t.userId).toBe(333);
    expect(t.username).toBe("dave_admin");
  });

  it("resolves an inline text_mention directly (zero API calls)", async () => {
    // "/ban Carol reason"
    const ctx = makeCtx("/ban Carol reason", [cmd(4), textMention(5, 5, CAROL)]);
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("mention");
    expect(t.userId).toBe(222);
    expect(t.user?.firstName).toBe("Carol");
    expect(t.reason).toBe("reason");
  });

  it("resolves a numeric user ID", async () => {
    const ctx = makeCtx("/ban 123456789 nsfw", [cmd(4)]);
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("userid");
    expect(t.userId).toBe(123456789);
    expect(t.reason).toBe("nsfw");
  });

  it("resolves tg://user?id=12345678 token", async () => {
    const ctx = makeCtx("/ban tg://user?id=987654321 raid", [cmd(4)]);
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("userid");
    expect(t.userId).toBe(987654321);
    expect(t.reason).toBe("raid");
  });

  it("fails to empty with no target and no reply", async () => {
    const ctx = makeCtx("/ban", [cmd(4)]);
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("empty");
    expect(t.userId).toBeNull();
  });

  it("explicit target wins over a coincidental reply", async () => {
    cacheUser(CAROL);
    const ctx = makeCtx("/ban @carol real", [cmd(4), mention(5, 6)], { from: BOB });
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("mention");
    expect(t.userId).toBe(222); // carol, NOT the replied bob
  });

  it("parses duration + reason for /tban by mention", async () => {
    cacheUser(CAROL);
    // "/tban @carol 2h raid"
    const ctx = makeCtx("/tban @carol 2h raid", [cmd(5), mention(6, 6)]);
    const t = await resolveTarget(ctx, { expectTime: true });
    expect(t.type).toBe("mention");
    expect(t.userId).toBe(222);
    expect(t.durationMs).toBe(2 * 3_600_000);
    expect(t.durationLabel).toBe("2 hours");
    expect(t.reason).toBe("raid");
  });

  it("parses duration + reason for /tban by reply (duration in the text)", async () => {
    const ctx = makeCtx("/tban 2h raid", [cmd(5)], { from: BOB });
    const t = await resolveTarget(ctx, { expectTime: true });
    expect(t.type).toBe("reply");
    expect(t.userId).toBe(111);
    expect(t.durationMs).toBe(2 * 3_600_000);
    expect(t.reason).toBe("raid");
  });

  it("leaves duration null when a temp command omits it", async () => {
    cacheUser(CAROL);
    const ctx = makeCtx("/tban @carol raid", [cmd(5), mention(6, 6)]);
    const t = await resolveTarget(ctx, { expectTime: true });
    expect(t.durationMs).toBeNull();
    expect(t.reason).toBe("raid");
  });

  it("treats a small number as part of the reason, not a user ID", async () => {
    const ctx = makeCtx("/ban 5 spam", [cmd(4)], { from: BOB });
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("reply");
    expect(t.reason).toBe("5 spam");
  });

  it("does NOT fallback to coincidental reply when an explicit unindexed @mention is given", async () => {
    // @unseen is not cached and not in store
    const ctx = makeCtx("/ban @unseen spam", [cmd(4), mention(5, 7)], { from: BOB });
    const t = await resolveTarget(ctx);
    expect(t.type).toBe("mention");
    expect(t.username).toBe("unseen");
    expect(t.userId).toBeNull(); // Must remain null, NOT Bob's ID!
    expect(t.reason).toBe("spam");
  });
});
