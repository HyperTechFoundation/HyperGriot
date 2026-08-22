import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  botCanRestrict,
  botCanDelete,
  botCanPin,
  botCanPromote,
  invalidateAdminCache,
  invalidateBotMemberCache,
} from "../src/core/guards.js";

describe("Bot Permission Caching & Invalidation", () => {
  beforeEach(() => {
    invalidateAdminCache();
    vi.restoreAllMocks();
  });

  function createMockContext(chatId: number, botMemberResponse: any) {
    return {
      chat: { id: chatId, type: "supergroup" },
      api: {
        getMe: vi.fn().mockResolvedValue({ id: 99999, is_bot: true }),
        getChatMember: vi.fn().mockResolvedValue(botMemberResponse),
      },
    } as any;
  }

  it("caches bot permissions on first check (cache miss) and uses cache on subsequent checks (cache hit)", async () => {
    const ctx = createMockContext(100, {
      status: "administrator",
      can_restrict_members: true,
      can_delete_messages: true,
      can_pin_messages: false,
      can_promote_members: false,
    });

    // 1st call: cache miss, calls getChatMember
    const canRestrict1 = await botCanRestrict(ctx);
    expect(canRestrict1).toBe(true);
    expect(ctx.api.getChatMember).toHaveBeenCalledTimes(1);

    // 2nd call: cache hit, doesn't call getChatMember again
    const canDelete1 = await botCanDelete(ctx);
    expect(canDelete1).toBe(true);
    expect(ctx.api.getChatMember).toHaveBeenCalledTimes(1);

    // 3rd call: cache hit for canPin
    const canPin1 = await botCanPin(ctx);
    expect(canPin1).toBe(false);
    expect(ctx.api.getChatMember).toHaveBeenCalledTimes(1);

    // 4th call: cache hit for canPromote
    const canPromote1 = await botCanPromote(ctx);
    expect(canPromote1).toBe(false);
    expect(ctx.api.getChatMember).toHaveBeenCalledTimes(1);
  });

  it("refetches permissions when cache is explicitly invalidated", async () => {
    const ctx = createMockContext(200, {
      status: "administrator",
      can_restrict_members: true,
      can_delete_messages: false,
    });

    await botCanRestrict(ctx);
    expect(ctx.api.getChatMember).toHaveBeenCalledTimes(1);

    // Invalidate cache for this chat
    invalidateBotMemberCache(200);

    // Should fetch again
    await botCanRestrict(ctx);
    expect(ctx.api.getChatMember).toHaveBeenCalledTimes(2);
  });

  it("reflects permission changes after invalidation", async () => {
    let currentPerms = {
      status: "administrator",
      can_restrict_members: false,
      can_delete_messages: false,
    };

    const ctx = {
      chat: { id: 300, type: "supergroup" },
      api: {
        getMe: vi.fn().mockResolvedValue({ id: 99999, is_bot: true }),
        getChatMember: vi.fn().mockImplementation(async () => currentPerms),
      },
    } as any;

    expect(await botCanRestrict(ctx)).toBe(false);
    expect(ctx.api.getChatMember).toHaveBeenCalledTimes(1);

    // Bot is granted restrict permission
    currentPerms = {
      status: "administrator",
      can_restrict_members: true,
      can_delete_messages: true,
    };
    invalidateAdminCache(300);

    expect(await botCanRestrict(ctx)).toBe(true);
    expect(ctx.api.getChatMember).toHaveBeenCalledTimes(2);
  });

  it("handles expiration after TTL", async () => {
    vi.useFakeTimers();
    try {
      const ctx = createMockContext(400, {
        status: "administrator",
        can_delete_messages: true,
      });

      await botCanDelete(ctx);
      expect(ctx.api.getChatMember).toHaveBeenCalledTimes(1);

      // Advance time by 31 seconds (TTL is 30s)
      vi.advanceTimersByTime(31_000);

      await botCanDelete(ctx);
      expect(ctx.api.getChatMember).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps permissions for unrelated chats isolated", async () => {
    const ctxChatA = createMockContext(501, {
      status: "administrator",
      can_restrict_members: true,
    });
    const ctxChatB = createMockContext(502, {
      status: "member",
    });

    expect(await botCanRestrict(ctxChatA)).toBe(true);
    expect(ctxChatA.api.getChatMember).toHaveBeenCalledTimes(1);

    expect(await botCanRestrict(ctxChatB)).toBe(false);
    expect(ctxChatB.api.getChatMember).toHaveBeenCalledTimes(1);
  });
});
