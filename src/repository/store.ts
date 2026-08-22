/**
 * Persistent per-group settings store.
 *
 * Implements full persistence for settings, notes, rules, locks, flood, warnings,
 * approval, filters, cleaning, disabling, log channels, and federations.
 * Backed by a robust JSON store with debounced write coalescing.
 * (See docs/TRD.md §8 and docs/design.md §7).
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import type {
  CleanConfig,
  Federation,
  FedBan,
  Filter,
  FloodConfig,
  FloodMode,
  InlineUrlButton,
  LockType,
  Note,
  RulesConfig,
  UserWarnings,
  WarnAction,
  WarnConfig,
  WelcomeConfig,
  GoodbyeConfig,
} from "../types/index.js";

interface ChatBucket {
  welcome?: Partial<WelcomeConfig>;
  goodbye?: Partial<GoodbyeConfig>;
  rules?: { text: string; button?: InlineUrlButton };
  notes?: Record<string, Note>;
  notesPrivate?: boolean;
  filters?: Record<string, string>;
  locks?: string[];
  flood?: Partial<FloodConfig>;
  warnConfig?: Partial<WarnConfig>;
  warnings?: Record<string, UserWarnings>;
  approved?: Record<string, boolean>;
  approvalGated?: boolean;
  reportsEnabled?: boolean;
  clean?: Partial<CleanConfig>;
  disabled?: string[];
  fedId?: string;
}

export interface StoredUser {
  id: number;
  firstName: string;
  username?: string;
  lastSeen: number;
}

interface StoreShape {
  chats: Record<string, ChatBucket>;
  logChat: Record<string, number>; // chatId -> logChatId
  federations: Record<string, Federation>;
  fedBans: Record<string, Record<string, FedBan>>; // fedId -> userId -> FedBan
  users: Record<string, StoredUser>; // userId -> StoredUser
  usernames: Record<string, number>; // lowercase username -> userId
}

const STORE_PATH = join(config.dataDir, "hypergriot.json");

let data: StoreShape = {
  chats: {},
  logChat: {},
  federations: {},
  fedBans: {},
  users: {},
  usernames: {},
};

function load(): void {
  try {
    let raw = "";
    if (existsSync(STORE_PATH)) {
      raw = readFileSync(STORE_PATH, "utf8");
    } else if (existsSync(STORE_PATH + ".tmp")) {
      raw = readFileSync(STORE_PATH + ".tmp", "utf8");
    }

    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoreShape>;
      data = {
        chats: parsed.chats ?? {},
        logChat: parsed.logChat ?? {},
        federations: parsed.federations ?? {},
        fedBans: parsed.fedBans ?? {},
        users: parsed.users ?? {},
        usernames: parsed.usernames ?? {},
      };
    }
  } catch (err) {
    if (config.debug) console.error("[store] failed to load, starting empty:", err);
    data = { chats: {}, logChat: {}, federations: {}, fedBans: {}, users: {}, usernames: {} };
  }
}

function writeAtomic(filePath: string, content: string): void {
  const tmpPath = filePath + ".tmp";
  writeFileSync(tmpPath, content);
  renameSync(tmpPath, filePath);
}

let writeScheduled = false;
function persist(): void {
  if (writeScheduled) return;
  writeScheduled = true;
  setImmediate(() => {
    writeScheduled = false;
    try {
      mkdirSync(dirname(STORE_PATH), { recursive: true });
      writeAtomic(STORE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("[store] failed to persist:", err);
    }
  });
}

/** Synchronous flush for tests or shutdown. */
export function flushSync(): void {
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    writeAtomic(STORE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("[store] failed to flushSync:", err);
  }
}

function bucket(chatId: number): ChatBucket {
  const key = String(chatId);
  if (!data.chats[key]) data.chats[key] = {};
  return data.chats[key]!;
}

export const store = {
  init(): void {
    load();
  },

  resetForTests(): void {
    data = { chats: {}, logChat: {}, federations: {}, fedBans: {}, users: {}, usernames: {} };
  },

  // ── Welcome & Goodbye ──────────────────────────────────────
  getWelcome(chatId: number): WelcomeConfig {
    const b = bucket(chatId);
    return {
      text: b.welcome?.text ?? "Welcome {mention} to {chatname}!",
      enabled: b.welcome?.enabled ?? true,
      buttons: b.welcome?.buttons ?? [],
      clean: b.welcome?.clean ?? false,
      muteDurationMs: b.welcome?.muteDurationMs ?? null,
    };
  },
  setWelcomeText(chatId: number, text: string): void {
    const b = bucket(chatId);
    if (!b.welcome) b.welcome = {};
    b.welcome.text = text;
    persist();
  },
  setWelcomeEnabled(chatId: number, enabled: boolean): void {
    const b = bucket(chatId);
    if (!b.welcome) b.welcome = {};
    b.welcome.enabled = enabled;
    persist();
  },
  setWelcomeButtons(chatId: number, buttons: InlineUrlButton[]): void {
    const b = bucket(chatId);
    if (!b.welcome) b.welcome = {};
    b.welcome.buttons = buttons;
    persist();
  },
  setCleanWelcome(chatId: number, clean: boolean): void {
    const b = bucket(chatId);
    if (!b.welcome) b.welcome = {};
    b.welcome.clean = clean;
    persist();
  },
  setWelcomeMute(chatId: number, durationMs: number | null): void {
    const b = bucket(chatId);
    if (!b.welcome) b.welcome = {};
    b.welcome.muteDurationMs = durationMs;
    persist();
  },
  clearWelcome(chatId: number): void {
    const b = bucket(chatId);
    delete b.welcome;
    persist();
  },

  getGoodbye(chatId: number): GoodbyeConfig {
    const b = bucket(chatId);
    return {
      text: b.goodbye?.text ?? "Goodbye {first}!",
      enabled: b.goodbye?.enabled ?? false,
      clean: b.goodbye?.clean ?? false,
    };
  },
  setGoodbyeText(chatId: number, text: string): void {
    const b = bucket(chatId);
    if (!b.goodbye) b.goodbye = {};
    b.goodbye.text = text;
    persist();
  },
  setGoodbyeEnabled(chatId: number, enabled: boolean): void {
    const b = bucket(chatId);
    if (!b.goodbye) b.goodbye = {};
    b.goodbye.enabled = enabled;
    persist();
  },
  setCleanGoodbye(chatId: number, clean: boolean): void {
    const b = bucket(chatId);
    if (!b.goodbye) b.goodbye = {};
    b.goodbye.clean = clean;
    persist();
  },
  clearGoodbye(chatId: number): void {
    const b = bucket(chatId);
    delete b.goodbye;
    persist();
  },

  // ── Rules ──────────────────────────────────────────────────
  getRules(chatId: number): RulesConfig {
    const b = bucket(chatId);
    return {
      text: b.rules?.text ?? "No rules have been set for this group yet.",
      button: b.rules?.button,
    };
  },
  setRules(chatId: number, text: string): void {
    const b = bucket(chatId);
    if (!b.rules) b.rules = { text };
    else b.rules.text = text;
    persist();
  },
  setRulesButton(chatId: number, button?: InlineUrlButton): void {
    const b = bucket(chatId);
    if (!b.rules) b.rules = { text: "No rules set.", button };
    else b.rules.button = button;
    persist();
  },
  clearRules(chatId: number): void {
    const b = bucket(chatId);
    delete b.rules;
    persist();
  },

  // ── Notes ──────────────────────────────────────────────────
  getNotes(chatId: number): Record<string, Note> {
    return bucket(chatId).notes ?? {};
  },
  getNote(chatId: number, name: string): Note | null {
    return bucket(chatId).notes?.[name.toLowerCase()] ?? null;
  },
  saveNote(chatId: number, note: Note): void {
    const b = bucket(chatId);
    if (!b.notes) b.notes = {};
    b.notes[note.name.toLowerCase()] = note;
    persist();
  },
  deleteNote(chatId: number, name: string): boolean {
    const b = bucket(chatId);
    if (!b.notes || !b.notes[name.toLowerCase()]) return false;
    delete b.notes[name.toLowerCase()];
    persist();
    return true;
  },
  clearAllNotes(chatId: number): void {
    const b = bucket(chatId);
    delete b.notes;
    persist();
  },
  isNotesPrivate(chatId: number): boolean {
    return Boolean(bucket(chatId).notesPrivate);
  },
  setNotesPrivate(chatId: number, isPrivate: boolean): void {
    bucket(chatId).notesPrivate = isPrivate;
    persist();
  },

  // ── Filters ────────────────────────────────────────────────
  getFilters(chatId: number): Record<string, string> {
    return bucket(chatId).filters ?? {};
  },
  addFilter(chatId: number, trigger: string, reply: string): void {
    const b = bucket(chatId);
    if (!b.filters) b.filters = {};
    b.filters[trigger.toLowerCase()] = reply;
    persist();
  },
  removeFilter(chatId: number, trigger: string): boolean {
    const b = bucket(chatId);
    if (!b.filters || !b.filters[trigger.toLowerCase()]) return false;
    delete b.filters[trigger.toLowerCase()];
    persist();
    return true;
  },
  clearFilters(chatId: number): void {
    const b = bucket(chatId);
    delete b.filters;
    persist();
  },

  // ── Locks ──────────────────────────────────────────────────
  getLocks(chatId: number): Set<LockType> {
    return new Set((bucket(chatId).locks ?? []) as LockType[]);
  },
  isLocked(chatId: number, type: LockType): boolean {
    const locks = bucket(chatId).locks ?? [];
    return locks.includes(type);
  },
  lockType(chatId: number, type: LockType): void {
    const b = bucket(chatId);
    if (!b.locks) b.locks = [];
    if (!b.locks.includes(type)) {
      b.locks.push(type);
      persist();
    }
  },
  unlockType(chatId: number, type: LockType): void {
    const b = bucket(chatId);
    if (b.locks && b.locks.includes(type)) {
      b.locks = b.locks.filter((l) => l !== type);
      persist();
    }
  },
  lockAll(chatId: number, types: readonly LockType[]): void {
    const b = bucket(chatId);
    b.locks = [...types];
    persist();
  },
  unlockAll(chatId: number): void {
    const b = bucket(chatId);
    b.locks = [];
    persist();
  },

  // ── Antiflood ──────────────────────────────────────────────
  getFloodConfig(chatId: number): FloodConfig {
    const b = bucket(chatId);
    return {
      limit: b.flood?.limit ?? 6,
      windowMs: b.flood?.windowMs ?? 5_000,
      mode: (b.flood?.mode ?? "tmute") as FloodMode,
    };
  },
  setFloodLimit(chatId: number, limit: number): void {
    const b = bucket(chatId);
    if (!b.flood) b.flood = {};
    b.flood.limit = limit;
    persist();
  },
  setFloodMode(chatId: number, mode: FloodMode): void {
    const b = bucket(chatId);
    if (!b.flood) b.flood = {};
    b.flood.mode = mode;
    persist();
  },

  // ── Warnings ───────────────────────────────────────────────
  getWarnConfig(chatId: number): WarnConfig {
    const b = bucket(chatId);
    return {
      limit: b.warnConfig?.limit ?? 3,
      action: (b.warnConfig?.action ?? "ban") as WarnAction,
      strong: b.warnConfig?.strong ?? false,
    };
  },
  setWarnLimit(chatId: number, limit: number): void {
    const b = bucket(chatId);
    if (!b.warnConfig) b.warnConfig = {};
    b.warnConfig.limit = limit;
    persist();
  },
  setWarnAction(chatId: number, action: WarnAction): void {
    const b = bucket(chatId);
    if (!b.warnConfig) b.warnConfig = {};
    b.warnConfig.action = action;
    persist();
  },
  setStrongWarn(chatId: number, strong: boolean): void {
    const b = bucket(chatId);
    if (!b.warnConfig) b.warnConfig = {};
    b.warnConfig.strong = strong;
    persist();
  },
  getWarnings(chatId: number, userId: number): UserWarnings {
    const b = bucket(chatId);
    return b.warnings?.[String(userId)] ?? { count: 0, reasons: [] };
  },
  addWarning(chatId: number, userId: number, reason: string): UserWarnings {
    const b = bucket(chatId);
    if (!b.warnings) b.warnings = {};
    const existing = b.warnings[String(userId)] ?? { count: 0, reasons: [] };
    const updated: UserWarnings = {
      count: existing.count + 1,
      reasons: [...existing.reasons, reason || "None"],
    };
    b.warnings[String(userId)] = updated;
    persist();
    return updated;
  },
  removeLatestWarning(chatId: number, userId: number): UserWarnings {
    const b = bucket(chatId);
    if (!b.warnings || !b.warnings[String(userId)]) return { count: 0, reasons: [] };
    const existing = b.warnings[String(userId)]!;
    if (existing.count <= 1) {
      delete b.warnings[String(userId)];
      persist();
      return { count: 0, reasons: [] };
    }
    const updated: UserWarnings = {
      count: existing.count - 1,
      reasons: existing.reasons.slice(0, -1),
    };
    b.warnings[String(userId)] = updated;
    persist();
    return updated;
  },
  resetWarnings(chatId: number, userId: number): void {
    const b = bucket(chatId);
    if (b.warnings) {
      delete b.warnings[String(userId)];
      persist();
    }
  },

  // ── Approval ───────────────────────────────────────────────
  isApproved(chatId: number, userId: number): boolean {
    return Boolean(bucket(chatId).approved?.[String(userId)]);
  },
  setApproved(chatId: number, userId: number, value: boolean): void {
    const b = bucket(chatId);
    if (!b.approved) b.approved = {};
    if (value) {
      b.approved[String(userId)] = true;
    } else {
      delete b.approved[String(userId)];
    }
    persist();
  },
  getApprovedUsers(chatId: number): number[] {
    const app = bucket(chatId).approved ?? {};
    return Object.keys(app)
      .filter((k) => app[k])
      .map((k) => Number(k));
  },
  isApprovalGated(chatId: number): boolean {
    return Boolean(bucket(chatId).approvalGated);
  },
  setApprovalGated(chatId: number, gated: boolean): void {
    bucket(chatId).approvalGated = gated;
    persist();
  },

  // ── Reports ────────────────────────────────────────────────
  isReportsEnabled(chatId: number): boolean {
    return bucket(chatId).reportsEnabled ?? true;
  },
  setReportsEnabled(chatId: number, enabled: boolean): void {
    bucket(chatId).reportsEnabled = enabled;
    persist();
  },

  // ── Service Message Cleaning ───────────────────────────────
  getCleanConfig(chatId: number): CleanConfig {
    const b = bucket(chatId);
    return {
      welcome: b.clean?.welcome ?? false,
      goodbye: b.clean?.goodbye ?? false,
      service: b.clean?.service ?? false,
    };
  },
  setCleanService(chatId: number, clean: boolean): void {
    const b = bucket(chatId);
    if (!b.clean) b.clean = {};
    b.clean.service = clean;
    persist();
  },

  // ── Disabling Commands ─────────────────────────────────────
  getDisabledCommands(chatId: number): string[] {
    return bucket(chatId).disabled ?? [];
  },
  disableCommand(chatId: number, command: string): boolean {
    const b = bucket(chatId);
    if (!b.disabled) b.disabled = [];
    const normalized = command.toLowerCase().replace(/^\//, "");
    if (!b.disabled.includes(normalized)) {
      b.disabled.push(normalized);
      persist();
      return true;
    }
    return false;
  },
  enableCommand(chatId: number, command: string): boolean {
    const b = bucket(chatId);
    if (!b.disabled) return false;
    const normalized = command.toLowerCase().replace(/^\//, "");
    const idx = b.disabled.indexOf(normalized);
    if (idx !== -1) {
      b.disabled.splice(idx, 1);
      persist();
      return true;
    }
    return false;
  },
  enableAllCommands(chatId: number): void {
    const b = bucket(chatId);
    b.disabled = [];
    persist();
  },

  // ── Log Channel ────────────────────────────────────────────
  getLogChatId(chatId: number): number | null {
    return data.logChat[String(chatId)] ?? null;
  },
  setLogChatId(chatId: number, logChatId: number): void {
    data.logChat[String(chatId)] = logChatId;
    persist();
  },
  clearLogChatId(chatId: number): void {
    delete data.logChat[String(chatId)];
    persist();
  },

  // ── Federations ────────────────────────────────────────────
  createFed(id: string, name: string, ownerId: number): Federation {
    const fed: Federation = {
      id,
      name,
      owner: ownerId,
      admins: [ownerId],
      chats: [],
    };
    data.federations[id] = fed;
    if (!data.fedBans[id]) data.fedBans[id] = {};
    persist();
    return fed;
  },
  getFed(id: string): Federation | null {
    return data.federations[id] ?? null;
  },
  deleteFed(id: string): boolean {
    if (!data.federations[id]) return false;
    delete data.federations[id];
    delete data.fedBans[id];
    // Unlink any chats
    for (const chat of Object.values(data.chats)) {
      if (chat.fedId === id) delete chat.fedId;
    }
    persist();
    return true;
  },
  setFedOwner(id: string, newOwnerId: number): boolean {
    const fed = data.federations[id];
    if (!fed) return false;
    fed.owner = newOwnerId;
    if (!fed.admins.includes(newOwnerId)) fed.admins.push(newOwnerId);
    persist();
    return true;
  },
  addFedAdmin(id: string, adminId: number): boolean {
    const fed = data.federations[id];
    if (!fed) return false;
    if (!fed.admins.includes(adminId)) {
      fed.admins.push(adminId);
      persist();
      return true;
    }
    return false;
  },
  removeFedAdmin(id: string, adminId: number): boolean {
    const fed = data.federations[id];
    if (!fed) return false;
    fed.admins = fed.admins.filter((a) => a !== adminId);
    persist();
    return true;
  },
  subscribeChatToFed(chatId: number, fedId: string): boolean {
    const fed = data.federations[fedId];
    if (!fed) return false;
    bucket(chatId).fedId = fedId;
    if (!fed.chats.includes(chatId)) {
      fed.chats.push(chatId);
    }
    persist();
    return true;
  },
  unsubscribeChatFromFed(chatId: number): boolean {
    const b = bucket(chatId);
    const fedId = b.fedId;
    if (!fedId) return false;
    delete b.fedId;
    const fed = data.federations[fedId];
    if (fed) {
      fed.chats = fed.chats.filter((c) => c !== chatId);
    }
    persist();
    return true;
  },
  getChatFedId(chatId: number): string | null {
    return bucket(chatId).fedId ?? null;
  },
  addFedBan(fedId: string, ban: FedBan): void {
    if (!data.fedBans[fedId]) data.fedBans[fedId] = {};
    data.fedBans[fedId]![String(ban.userId)] = ban;
    persist();
  },
  removeFedBan(fedId: string, userId: number): boolean {
    if (!data.fedBans[fedId] || !data.fedBans[fedId]![String(userId)]) return false;
    delete data.fedBans[fedId]![String(userId)];
    persist();
    return true;
  },
  isFedBanned(fedId: string, userId: number): boolean {
    return Boolean(data.fedBans[fedId]?.[String(userId)]);
  },
  getFedBan(fedId: string, userId: number): FedBan | null {
    return data.fedBans[fedId]?.[String(userId)] ?? null;
  },
  getFedBans(fedId: string): FedBan[] {
    return Object.values(data.fedBans[fedId] ?? {});
  },
  getFedBanCount(fedId: string): number {
    return Object.keys(data.fedBans[fedId] ?? {}).length;
  },
  getFedsForUser(userId: number): Federation[] {
    return Object.values(data.federations).filter(
      (f) => f.owner === userId || f.admins.includes(userId),
    );
  },

  // ── Users & Mentions ───────────────────────────────────────
  saveUser(user: { id: number; firstName?: string; first_name?: string; username?: string }): void {
    if (!data.users) data.users = {};
    if (!data.usernames) data.usernames = {};
    const firstName = user.firstName ?? user.first_name ?? "User";

    // Clean up previous username index if username changed
    const existing = data.users[String(user.id)];
    if (existing?.username && existing.username.toLowerCase() !== user.username?.toLowerCase()) {
      delete data.usernames[existing.username.toLowerCase()];
    }

    data.users[String(user.id)] = {
      id: user.id,
      firstName,
      username: user.username,
      lastSeen: Date.now(),
    };
    if (user.username) {
      data.usernames[user.username.toLowerCase()] = user.id;
    }
    persist();
  },
  getUserById(userId: number): StoredUser | null {
    return data.users?.[String(userId)] ?? null;
  },
  getUserByUsername(username: string): StoredUser | null {
    const clean = username.replace(/^@/, "").toLowerCase();
    const userId = data.usernames?.[clean];
    if (!userId) return null;
    return data.users?.[String(userId)] ?? null;
  },
};

export type Store = typeof store;
