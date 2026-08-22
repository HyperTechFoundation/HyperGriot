import { describe, expect, it } from "vitest";
import { formatTemplate, parseButton, welcomeComposer } from "../src/modules/welcome/index.js";

describe("welcome formatting and button parser", () => {
  it("replaces template placeholders safely", () => {
    const user = {
      id: 12345,
      first_name: "<Alice>",
      last_name: "Smith",
      username: "alicesmith",
      is_bot: false,
    };
    const chat = { id: 100, title: "<b>Dev Group</b>", memberCount: 42 };

    const tpl = "Hello {first} {last}! User {id} ({mention}) joined {chatname}. Total: {count}.";
    const res = formatTemplate(tpl, user, chat);

    expect(res).toContain("&lt;Alice&gt; Smith");
    expect(res).toContain("User 12345");
    expect(res).toContain('<a href="tg://user?id=12345">&lt;Alice&gt;</a>');
    expect(res).toContain("&lt;b&gt;Dev Group&lt;/b&gt;");
    expect(res).toContain("Total: 42");
    expect(res).not.toContain("<Alice>");
  });

  it("parses pipe-separated button format", () => {
    const btn = parseButton("Docs | https://docs.example.com");
    expect(btn).toEqual({ text: "Docs", url: "https://docs.example.com" });
  });

  it("parses markdown button format", () => {
    const btn = parseButton("[Join Channel](https://t.me/example)");
    expect(btn).toEqual({ text: "Join Channel", url: "https://t.me/example" });
  });

  it("rejects invalid button URLs", () => {
    expect(parseButton("Invalid|javascript:alert(1)")).toBeNull();
    expect(parseButton("NoUrl")).toBeNull();
  });

  it("automatically bans fed-banned users when joining a federated group", async () => {
    const { welcomeComposer } = await import("../src/modules/welcome/index.js");
    const { store } = await import("../src/repository/store.js");
    const { Context } = await import("grammy");
    const { vi } = await import("vitest");

    const CHAT_ID = -100123456789;
    const FED_ID = "fed-test-1";
    store.resetForTests();
    store.createFed(FED_ID, "Test Federation", 9999);
    store.subscribeChatToFed(CHAT_ID, FED_ID);
    store.addFedBan(FED_ID, {
      userId: 55555,
      reason: "Global Spammer",
      banner: 9999,
      ts: Date.now(),
    });

    const apiCalls: any[] = [];
    const update = {
      update_id: 10,
      message: {
        message_id: 50,
        date: Math.floor(Date.now() / 1000),
        chat: { id: CHAT_ID, type: "supergroup", title: "Federated Group" },
        new_chat_members: [{ id: 55555, first_name: "FedBannedSpammer", is_bot: false }],
      },
    };

    const api = {
      getMe: vi.fn(async () => ({ id: 99999, first_name: "Bot", is_bot: true })),
      getChatAdministrators: vi.fn(async () => [
        { user: { id: 99999, first_name: "Bot", is_bot: true }, status: "administrator", can_restrict_members: true },
      ]),
      getChatMember: vi.fn(async () => ({ user: { id: 99999, is_bot: true }, status: "administrator", can_restrict_members: true })),
      banChatMember: vi.fn(async (chatId: number, userId: number) => {
        apiCalls.push({ method: "banChatMember", args: [chatId, userId] });
      }),
    } as any;

    const ctx = new Context(update as any, api, { id: 99999, first_name: "Bot", is_bot: true } as any);
    await welcomeComposer.middleware()(ctx, async () => {});

    expect(apiCalls.some((c) => c.method === "banChatMember" && c.args[0] === CHAT_ID && c.args[1] === 55555)).toBe(true);
  });
});
