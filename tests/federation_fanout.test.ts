import { describe, it, expect, vi } from "vitest";
import { fanOutFederationAction, isRetryableError } from "../src/modules/federation/federation.js";

describe("Federation Bounded Fan-Out", () => {
  it("propagates actions across multiple chats successfully", async () => {
    const chats = [101, 102, 103, 104, 105];
    const executed: number[] = [];

    const result = await fanOutFederationAction(chats, async (chatId) => {
      executed.push(chatId);
    }, 2);

    expect(result.succeeded).toEqual(expect.arrayContaining(chats));
    expect(result.failed).toHaveLength(0);
    expect(executed).toHaveLength(5);
  });

  it("deduplicates chat IDs to avoid duplicate operations", async () => {
    const chats = [101, 102, 101, 103, 102, 104];
    const executed: number[] = [];

    const result = await fanOutFederationAction(chats, async (chatId) => {
      executed.push(chatId);
    }, 3);

    expect(result.succeeded).toHaveLength(4);
    expect(executed).toEqual([101, 102, 103, 104]);
    expect(result.failed).toHaveLength(0);
  });

  it("tolerates partial failures and classifies errors accurately", async () => {
    const chats = [101, 102, 103, 104];

    const result = await fanOutFederationAction(chats, async (chatId) => {
      if (chatId === 102) {
        const err: any = new Error("Chat not found");
        err.error_code = 400;
        throw err;
      }
      if (chatId === 103) {
        const err: any = new Error("Too Many Requests");
        err.error_code = 429;
        throw err;
      }
    }, 2);

    expect(result.succeeded).toEqual(expect.arrayContaining([101, 104]));
    expect(result.failed).toHaveLength(2);

    const fail400 = result.failed.find((f) => f.chatId === 102);
    const fail429 = result.failed.find((f) => f.chatId === 103);

    expect(fail400?.retryable).toBe(false);
    expect(fail429?.retryable).toBe(true);
  });

  it("respects concurrency bounds", async () => {
    const chats = [1, 2, 3, 4, 5, 6, 7, 8];
    let maxRunning = 0;
    let currentlyRunning = 0;
    const concurrency = 3;

    await fanOutFederationAction(chats, async () => {
      currentlyRunning++;
      maxRunning = Math.max(maxRunning, currentlyRunning);
      await new Promise((r) => setTimeout(r, 20));
      currentlyRunning--;
    }, concurrency);

    expect(maxRunning).toBeLessThanOrEqual(concurrency);
    expect(maxRunning).toBeGreaterThanOrEqual(1);
  });

  it("identifies retryable vs permanent errors", () => {
    expect(isRetryableError({ error_code: 429 })).toBe(true);
    expect(isRetryableError({ error_code: 500 })).toBe(true);
    expect(isRetryableError({ error_code: 502 })).toBe(true);
    expect(isRetryableError({ name: "HttpError" })).toBe(true);

    expect(isRetryableError({ error_code: 400 })).toBe(false);
    expect(isRetryableError({ error_code: 403 })).toBe(false);
    expect(isRetryableError(new Error("Generic"))).toBe(false);
    expect(isRetryableError(null)).toBe(false);
  });
});
