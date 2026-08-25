import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkFloodBreach, pruneFloodMap, clearFloodMap, getFloodMapSize } from "../src/modules/security/index.js";

describe("In-Memory Flood Tracker", () => {
  beforeEach(() => {
    clearFloodMap();
  });

  it("triggers a breach when message count exceeds limit within window", () => {
    const chatId = 1001;
    const userId = 2001;
    const limit = 3;
    const windowMs = 5000;
    const now = 100000;

    // 1st message: no breach
    expect(checkFloodBreach(chatId, userId, limit, windowMs, now)).toBe(false);
    // 2nd message: no breach
    expect(checkFloodBreach(chatId, userId, limit, windowMs, now + 100)).toBe(false);
    // 3rd message within window: breach!
    expect(checkFloodBreach(chatId, userId, limit, windowMs, now + 200)).toBe(true);
  });

  it("does not trigger breach if messages are spaced outside window (old timestamps removed)", () => {
    const chatId = 1001;
    const userId = 2001;
    const limit = 3;
    const windowMs = 5000;

    // Message 1 at t=0
    expect(checkFloodBreach(chatId, userId, limit, windowMs, 1000)).toBe(false);
    // Message 2 at t=2s
    expect(checkFloodBreach(chatId, userId, limit, windowMs, 3000)).toBe(false);
    // Message 3 at t=7s (message 1 has expired)
    expect(checkFloodBreach(chatId, userId, limit, windowMs, 7000)).toBe(false);
    // Message 4 at t=9s (message 2 has expired, count is now 2)
    expect(checkFloodBreach(chatId, userId, limit, windowMs, 9000)).toBe(false);
  });

  it("evicts inactive entries when pruned", () => {
    const windowMs = 5000;
    const t0 = 10000;

    // User A and User B send messages at t0
    checkFloodBreach(1, 101, 5, windowMs, t0);
    checkFloodBreach(1, 102, 5, windowMs, t0);
    expect(getFloodMapSize()).toBe(2);

    // User A sends another message at t0 + 40s
    checkFloodBreach(1, 101, 5, windowMs, t0 + 40000);

    // Prune entries older than 30s at t0 + 40s
    // User B was inactive since t0 (40s ago), should be pruned
    // User A was active at t0 + 40s, should be kept
    const pruned = pruneFloodMap(t0 + 40000, 30000);
    expect(pruned).toBe(1);
    expect(getFloodMapSize()).toBe(1);
  });

  it("isolates flood tracking between different chats and different users", () => {
    const limit = 3;
    const windowMs = 5000;
    const t0 = 50000;

    // Chat 1, User 1: 2 messages
    checkFloodBreach(1, 10, limit, windowMs, t0);
    checkFloodBreach(1, 10, limit, windowMs, t0 + 10);

    // Chat 1, User 2: 2 messages
    checkFloodBreach(1, 20, limit, windowMs, t0);
    checkFloodBreach(1, 20, limit, windowMs, t0 + 10);

    // Chat 2, User 1: 2 messages
    checkFloodBreach(2, 10, limit, windowMs, t0);
    checkFloodBreach(2, 10, limit, windowMs, t0 + 10);

    // None should have breached yet
    expect(getFloodMapSize()).toBe(3);

    // Only Chat 1, User 1 sends 3rd message -> only that one breaches
    expect(checkFloodBreach(1, 10, limit, windowMs, t0 + 20)).toBe(true);
    expect(checkFloodBreach(1, 20, limit, windowMs, t0 + 20)).toBe(true); // Now User 2 reaches 3
    expect(checkFloodBreach(2, 10, limit, windowMs, t0 + 20)).toBe(true); // Now Chat 2 User 1 reaches 3
  });
});
