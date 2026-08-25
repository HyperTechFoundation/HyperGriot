/**
 * Username → user ID resolution cache & persistent store lookup.
 *
 * Telegram's Bot API has no global "get user by @username" endpoint, so HyperGriot builds
 * an active & persistent user database by observing every user interaction across all chats.
 * In addition, on an initial cache miss, it dynamically queries the chat administrators list.
 * See docs/TRD.md §6.4 and docs/design.md §4.4.
 */

import type { Context } from "grammy";
import type { User } from "grammy/types";
import type { UserInfo } from "../types/index.js";
import { store } from "../repository/store.js";

interface CacheEntry {
  userId: number;
  firstName: string;
  username?: string;
  ts: number;
}

const cacheByUsername = new Map<string, CacheEntry>(); // key = lowercased @username
const cacheById = new Map<number, CacheEntry>();       // key = numeric userId

function key(username: string): string {
  return username.replace(/^@/, "").toLowerCase();
}

/** Store/refresh a user in the cache and persistent database from any observed User object. */
export function cacheUser(user: { id: number; first_name?: string; firstName?: string; username?: string }): void {
  const firstName = user.first_name ?? user.firstName ?? "User";
  const entry: CacheEntry = {
    userId: user.id,
    firstName,
    username: user.username,
    ts: Date.now(),
  };

  // If user previously had a different username in cache, clean up old username index
  const existing = cacheById.get(user.id);
  if (existing?.username && existing.username.toLowerCase() !== user.username?.toLowerCase()) {
    cacheByUsername.delete(key(existing.username));
  }

  cacheById.set(user.id, entry);

  if (user.username) {
    cacheByUsername.set(key(user.username), entry);
  }

  // Also persist to store
  try {
    store.saveUser({
      id: user.id,
      firstName,
      username: user.username,
    });
  } catch {
    /* ignore store error */
  }
}

/** Ingest every user visible on an update. */
export function ingestUsers(users: (User | undefined | null)[]): void {
  for (const u of users) {
    if (u) cacheUser(u);
  }
}

/** Resolve an @username to a user ID. Checks memory cache, then persistent store. */
export function resolveUsername(username: string): UserInfo | null {
  const clean = key(username);

  // 1. Fast in-memory cache
  const entry = cacheByUsername.get(clean);
  if (entry) {
    return { id: entry.userId, firstName: entry.firstName, username: entry.username };
  }

  // 2. Persistent store lookup
  try {
    const fromStore = store.getUserByUsername(clean);
    if (fromStore) {
      const cacheEntry: CacheEntry = {
        userId: fromStore.id,
        firstName: fromStore.firstName,
        username: fromStore.username,
        ts: fromStore.lastSeen,
      };
      cacheByUsername.set(clean, cacheEntry);
      cacheById.set(fromStore.id, cacheEntry);
      return { id: fromStore.id, firstName: fromStore.firstName, username: fromStore.username };
    }
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * Resolve an @username with context:
 * 1. Checks memory cache
 * 2. Checks persistent store
 * 3. If in a group chat, fetches chat administrators via API and caches all of them
 */
export async function resolveUsernameWithContext(
  username: string,
  ctx?: Context,
): Promise<UserInfo | null> {
  const clean = key(username);

  let resolved = resolveUsername(clean);
  if (resolved) return resolved;

  // 3. Query group chat administrators if in a group
  if (ctx && ctx.chat && ctx.chat.type !== "private" && ctx.api) {
    try {
      const admins = await ctx.api.getChatAdministrators(ctx.chat.id);
      for (const admin of admins) {
        if (admin.user) {
          cacheUser(admin.user);
        }
      }
      resolved = resolveUsername(clean);
      if (resolved) return resolved;
    } catch {
      /* ignore api error */
    }
  }

  return null;
}

/** Look up display info for a cached user by ID (memory cache -> persistent store). */
export function userInfoById(userId: number): UserInfo | null {
  const cached = cacheById.get(userId);
  if (cached) {
    return { id: cached.userId, firstName: cached.firstName, username: cached.username };
  }

  try {
    const fromStore = store.getUserById(userId);
    if (fromStore) {
      const cacheEntry: CacheEntry = {
        userId: fromStore.id,
        firstName: fromStore.firstName,
        username: fromStore.username,
        ts: fromStore.lastSeen,
      };
      cacheById.set(fromStore.id, cacheEntry);
      if (fromStore.username) {
        cacheByUsername.set(key(fromStore.username), cacheEntry);
      }
      return { id: fromStore.id, firstName: fromStore.firstName, username: fromStore.username };
    }
  } catch {
    /* ignore */
  }

  return null;
}

/** Test helper. */
export function clearUsernameCache(): void {
  cacheByUsername.clear();
  cacheById.clear();
}
