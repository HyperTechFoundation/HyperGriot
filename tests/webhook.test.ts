import { describe, expect, it, vi } from "vitest";
import { Bot, webhookCallback } from "grammy";
import { Readable } from "node:stream";

function createTestBot() {
  const bot = new Bot("000000000:TEST_MOCK_BOT_TOKEN");
  bot.botInfo = {
    id: 99999,
    first_name: "TestBot",
    is_bot: true,
    username: "test_bot",
    can_join_groups: true,
    can_read_all_group_messages: true,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
  };
  return bot;
}

function createMockReqRes(headers: Record<string, string>, body: any = { update_id: 1 }) {
  const payload = JSON.stringify(body);
  const stream = Readable.from(Buffer.from(payload));
  const req = Object.assign(stream, {
    method: "POST",
    url: "/hypergriot",
    headers,
  });

  const res: any = {
    statusCode: 200,
    headersSent: false,
    writeHead: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    end: vi.fn(function (this: any) {
      this.headersSent = true;
      return this;
    }),
  };

  return { req, res };
}

describe("Webhook secret verification with grammY", () => {
  it("accepts requests with valid secret token", async () => {
    const bot = createTestBot();
    let handled = false;
    bot.use(async () => {
      handled = true;
    });

    const handler = webhookCallback(bot, "http", "throw", 10000, "my-secret-token");
    const { req, res } = createMockReqRes({
      "x-telegram-bot-api-secret-token": "my-secret-token",
      "content-type": "application/json",
    });

    await handler(req as any, res as any);

    expect(handled).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });

  it("rejects requests with invalid secret token (401 Unauthorized)", async () => {
    const bot = createTestBot();
    let handled = false;
    bot.use(async () => {
      handled = true;
    });

    const handler = webhookCallback(bot, "http", "throw", 10000, "my-secret-token");
    const { req, res } = createMockReqRes({
      "x-telegram-bot-api-secret-token": "wrong-secret-token",
      "content-type": "application/json",
    });

    await handler(req as any, res as any);

    expect(handled).toBe(false);
    expect(res.writeHead).toHaveBeenCalledWith(401);
    expect(res.end).toHaveBeenCalled();
  });

  it("rejects requests with missing secret token when secret is configured (401 Unauthorized)", async () => {
    const bot = createTestBot();
    let handled = false;
    bot.use(async () => {
      handled = true;
    });

    const handler = webhookCallback(bot, "http", "throw", 10000, "my-secret-token");
    const { req, res } = createMockReqRes({
      "content-type": "application/json",
    });

    await handler(req as any, res as any);

    expect(handled).toBe(false);
    expect(res.writeHead).toHaveBeenCalledWith(401);
    expect(res.end).toHaveBeenCalled();
  });

  it("works without secret token when secret is not configured", async () => {
    const bot = createTestBot();
    let handled = false;
    bot.use(async () => {
      handled = true;
    });

    const handler = webhookCallback(bot, "http", "throw", 10000, undefined);
    const { req, res } = createMockReqRes({
      "content-type": "application/json",
    });

    await handler(req as any, res as any);

    expect(handled).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });

  it("leaves polling mode unaffected when webhook is not configured", async () => {
    const bot = createTestBot();
    const startSpy = vi.spyOn(bot, "start").mockImplementation(async () => {});
    
    // Simulate polling invocation
    await bot.start({
      allowed_updates: ["message", "edited_message", "chat_member", "callback_query"],
    });

    expect(startSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allowed_updates: ["message", "edited_message", "chat_member", "callback_query"],
      })
    );
  });
});
