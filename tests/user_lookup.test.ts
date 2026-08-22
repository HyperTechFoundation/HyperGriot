import { describe, it, expect, beforeEach } from "vitest";
import {
  cacheUser,
  resolveUsername,
  userInfoById,
  clearUsernameCache,
} from "../src/core/resolver.js";
import { store } from "../src/repository/store.js";

describe("User Cache and Lookup (Index by ID and Username)", () => {
  beforeEach(() => {
    store.resetForTests();
    clearUsernameCache();
  });

  it("inserts a user and allows lookup by ID and username", () => {
    cacheUser({ id: 100, first_name: "Alice", username: "alice_w" });

    // ID lookup
    const byId = userInfoById(100);
    expect(byId).toEqual({ id: 100, firstName: "Alice", username: "alice_w" });

    // Username lookup
    const byUsername = resolveUsername("alice_w");
    expect(byUsername).toEqual({ id: 100, firstName: "Alice", username: "alice_w" });

    const byMention = resolveUsername("@Alice_W");
    expect(byMention).toEqual({ id: 100, firstName: "Alice", username: "alice_w" });
  });

  it("updates user info and avoids stale username mappings", () => {
    // Initial registration
    cacheUser({ id: 200, first_name: "Bob", username: "bob_old" });
    expect(resolveUsername("bob_old")?.id).toBe(200);

    // User updates their username
    cacheUser({ id: 200, first_name: "Bobby", username: "bob_new" });

    // Old username should no longer resolve
    expect(resolveUsername("bob_old")).toBeNull();

    // New username should resolve to user 200
    expect(resolveUsername("bob_new")).toEqual({ id: 200, firstName: "Bobby", username: "bob_new" });

    // ID lookup returns updated info
    expect(userInfoById(200)).toEqual({ id: 200, firstName: "Bobby", username: "bob_new" });
  });

  it("handles user updating to have no username", () => {
    cacheUser({ id: 300, first_name: "Charlie", username: "charlie_u" });
    expect(resolveUsername("charlie_u")?.id).toBe(300);

    // Charlie removes username
    cacheUser({ id: 300, first_name: "Charlie", username: undefined });

    expect(resolveUsername("charlie_u")).toBeNull();
    expect(userInfoById(300)).toEqual({ id: 300, firstName: "Charlie", username: undefined });
  });

  it("returns null for missing user lookups", () => {
    expect(userInfoById(999999)).toBeNull();
    expect(resolveUsername("non_existent_user")).toBeNull();
  });

  it("manages multiple distinct users simultaneously", () => {
    const users = [
      { id: 1, first_name: "User1", username: "u1" },
      { id: 2, first_name: "User2", username: "u2" },
      { id: 3, first_name: "User3", username: undefined },
      { id: 4, first_name: "User4", username: "u4" },
    ];

    users.forEach((u) => cacheUser(u));

    expect(userInfoById(1)?.firstName).toBe("User1");
    expect(userInfoById(2)?.firstName).toBe("User2");
    expect(userInfoById(3)?.firstName).toBe("User3");
    expect(userInfoById(4)?.firstName).toBe("User4");

    expect(resolveUsername("u1")?.id).toBe(1);
    expect(resolveUsername("u2")?.id).toBe(2);
    expect(resolveUsername("u3")).toBeNull();
    expect(resolveUsername("u4")?.id).toBe(4);
  });

  it("populates memory cache on store fallback and supports clearUsernameCache", () => {
    // Direct store insertion (simulating pre-existing persisted data)
    store.saveUser({ id: 500, firstName: "Dana", username: "dana_store" });

    // Clear memory cache
    clearUsernameCache();

    // ID lookup hits store and caches
    const fromStore = userInfoById(500);
    expect(fromStore).toEqual({ id: 500, firstName: "Dana", username: "dana_store" });

    // Clear store to verify in-memory cache now serves the request
    store.resetForTests();
    expect(userInfoById(500)).toEqual({ id: 500, firstName: "Dana", username: "dana_store" });
    expect(resolveUsername("dana_store")).toEqual({ id: 500, firstName: "Dana", username: "dana_store" });
  });
});
