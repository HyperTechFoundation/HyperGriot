import { describe, it, expect, beforeEach, vi } from "vitest";
import { Context } from "grammy";
import { welcomeComposer } from "../src/modules/welcome/index.js";
import { store } from "../src/repository/store.js";
import { invalidateAdminCache } from "../src/core/guards.js";

describe("Approval-gated behavior on member join", () => {
  const CHAT_ID = -1001122334455;
  let apiCalls: any[] = [];

  beforeEach(() => {
    store.resetForTests();
    invalidateAdminCache();
    apiCalls = [];
  });

  function createMockContext(member: { id: number; first_name: string; is_bot: boolean }, admins: number[] = [99999]) {
    const update = {
      update_id: 1,
      message: {
        message_id: 100,
        date: Math.floor(Date.now() / 1000),
        chat: { id: CHAT_ID, type: "supergroup", title: "Test Group" },
        new_chat_members: [member],
      },
    };

    const api = {
      getMe: vi.fn(async () => ({ id: 99999, first_name: "Bot", is_bot: true })),
      getChatAdministrators: vi.fn(async () =>
        admins.map((id) => ({
          user: { id, first_name: "Admin", is_bot: id === 99999 },
          status: id === 99999 ? "administrator" : "creator",
          can_restrict_members: true,
        }))
      ),
      getChatMember: vi.fn(async (chatId: number, userId: number) => ({
        user: { id: userId, first_name: "User", is_bot: false },
        status: admins.includes(userId) ? "administrator" : "member",
        can_restrict_members: true,
      })),
      getChatMemberCount: vi.fn(async () => 10),
      restrictChatMember: vi.fn(async (chatId: number, userId: number, perms: any, opts?: any) => {
        apiCalls.push({ method: "restrictChatMember", chatId, userId, perms, opts });
      }),
      banChatMember: vi.fn(async (chatId: number, userId: number) => {
        apiCalls.push({ method: "banChatMember", chatId, userId });
      }),
      deleteMessage: vi.fn(async () => {}),
      sendMessage: vi.fn(async () => ({ message_id: 101 })),
    };

    return new Context(update as any, api as any, { id: 99999, first_name: "Bot", is_bot: true } as any);
  }

  it("does NOT restrict unapproved member when approval gating is disabled", async () => {
    store.setApprovalGated(CHAT_ID, false);
    const ctx = createMockContext({ id: 12345, first_name: "John", is_bot: false });

    await welcomeComposer.middleware()(ctx, async () => {});

    const restrictCalls = apiCalls.filter((c) => c.method === "restrictChatMember");
    expect(restrictCalls.length).toBe(0);
  });

  it("restricts unapproved non-admin member when approval gating is enabled", async () => {
    store.setApprovalGated(CHAT_ID, true);
    const ctx = createMockContext({ id: 12345, first_name: "John", is_bot: false });

    await welcomeComposer.middleware()(ctx, async () => {});

    const restrictCalls = apiCalls.filter((c) => c.method === "restrictChatMember");
    expect(restrictCalls.length).toBe(1);
    expect(restrictCalls[0].userId).toBe(12345);
    expect(restrictCalls[0].perms.can_send_messages).toBe(false);
    expect(restrictCalls[0].opts).toBeUndefined(); // Indefinite restriction
  });

  it("does NOT restrict approved member when approval gating is enabled", async () => {
    store.setApprovalGated(CHAT_ID, true);
    store.setApproved(CHAT_ID, 12345, true);
    const ctx = createMockContext({ id: 12345, first_name: "John", is_bot: false });

    await welcomeComposer.middleware()(ctx, async () => {});

    const restrictCalls = apiCalls.filter((c) => c.method === "restrictChatMember");
    expect(restrictCalls.length).toBe(0);
  });

  it("does NOT restrict admin when approval gating is enabled", async () => {
    store.setApprovalGated(CHAT_ID, true);
    const ctx = createMockContext({ id: 88888, first_name: "AdminUser", is_bot: false }, [99999, 88888]);

    await welcomeComposer.middleware()(ctx, async () => {});

    const restrictCalls = apiCalls.filter((c) => c.method === "restrictChatMember");
    expect(restrictCalls.length).toBe(0);
  });

  it("does NOT restrict bot when approval gating is enabled", async () => {
    store.setApprovalGated(CHAT_ID, true);
    const ctx = createMockContext({ id: 77777, first_name: "SomeBot", is_bot: true });

    await welcomeComposer.middleware()(ctx, async () => {});

    const restrictCalls = apiCalls.filter((c) => c.method === "restrictChatMember");
    expect(restrictCalls.length).toBe(0);
  });

  it("applies indefinite mute for unapproved and timed welcomemute for approved when both enabled", async () => {
    store.setApprovalGated(CHAT_ID, true);
    store.setWelcomeMute(CHAT_ID, 3600000); // 1 hour

    // Unapproved user: gets indefinite restriction (approval gate)
    const ctx1 = createMockContext({ id: 11111, first_name: "Unapproved", is_bot: false });
    await welcomeComposer.middleware()(ctx1, async () => {});

    const calls1 = apiCalls.filter((c) => c.userId === 11111);
    expect(calls1.length).toBe(1);
    expect(calls1[0].opts).toBeUndefined(); // Indefinite, not timed

    // Approved user: gets timed restriction (welcomemute)
    store.setApproved(CHAT_ID, 22222, true);
    const ctx2 = createMockContext({ id: 22222, first_name: "Approved", is_bot: false });
    await welcomeComposer.middleware()(ctx2, async () => {});

    const calls2 = apiCalls.filter((c) => c.userId === 22222);
    expect(calls2.length).toBe(1);
    expect(calls2[0].opts).toHaveProperty("until_date"); // Timed
  });
});
