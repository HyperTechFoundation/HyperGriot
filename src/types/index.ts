/**
 * Shared HyperGriot types.
 * Mirrors the contracts defined in docs/design.md §4, §7 and docs/TRD.md §6, §8.
 */

/** How the command specified its target user. */
export type TargetType = "reply" | "mention" | "userid" | "empty";

/** Result of parsing a command's arguments through the target engine. */
export interface TargetResult {
  /** The kind of reference the admin used to identify the target. */
  type: TargetType;
  /** Resolved Telegram user ID, or null when nobody could be identified. */
  userId: number | null;
  /** @username if the target was supplied as a mention, for display. */
  username: string | null;
  /** Populated user object when already known (reply / text-mention); null for numeric IDs. */
  user: UserInfo | null;
  /** The reason text (empty string when none was provided). */
  reason: string;
  /** Whether a non-empty reason was explicitly given. */
  reasonPresent: boolean;
  /** Parsed duration in milliseconds (for /tban, /tmute). Null if none. */
  durationMs: number | null;
  /** Human-readable duration label, e.g. "2h" or "3 days". */
  durationLabel: string | null;
}

/** Minimal view of a Telegram user used for formatting & resolution. */
export interface UserInfo {
  id: number;
  firstName: string;
  username?: string;
}

/** Outcome of an access check — null message means success. */
export type GuardOutcome = string | null;

/** Options accepted by the target resolver. */
export interface ResolveOptions {
  /** Command parses a duration token (true for /tban, /tmute). */
  expectTime?: boolean;
}

/** Discrete lockable permission areas within a chat. */
export type LockType =
  | "messages"
  | "media"
  | "audio"
  | "voice"
  | "video"
  | "stickers"
  | "gifs"
  | "polls"
  | "games"
  | "inline"
  | "contacts"
  | "location"
  | "forward"
  | "link"
  | "bots"
  | "other";

export const ALL_LOCK_TYPES: readonly LockType[] = [
  "messages",
  "media",
  "audio",
  "voice",
  "video",
  "stickers",
  "gifs",
  "polls",
  "games",
  "inline",
  "contacts",
  "location",
  "forward",
  "link",
  "bots",
  "other",
] as const;

/** Inline button format for welcome/goodbye/notes/rules. */
export interface InlineUrlButton {
  text: string;
  url: string;
}

/** Welcome message configuration. */
export interface WelcomeConfig {
  text: string;
  enabled: boolean;
  buttons: InlineUrlButton[];
  clean: boolean;
  muteDurationMs: number | null;
}

/** Goodbye message configuration. */
export interface GoodbyeConfig {
  text: string;
  enabled: boolean;
  clean: boolean;
}

/** Rules configuration. */
export interface RulesConfig {
  text: string;
  button?: InlineUrlButton;
}

/** Note definition. */
export interface Note {
  name: string;
  text: string;
  buttons?: InlineUrlButton[];
  private: boolean;
}

/** Custom filter trigger and auto-reply. */
export interface Filter {
  trigger: string;
  reply: string;
}

/** Flood protection mode. */
export type FloodMode = "mute" | "ban" | "kick" | "tmute" | "tban";

/** Flood protection settings. */
export interface FloodConfig {
  limit: number;
  windowMs: number;
  mode: FloodMode;
}

/** Warning action when limit reached. */
export type WarnAction = "mute" | "kick" | "ban" | "tmute" | "tban";

/** Warning settings for a chat. */
export interface WarnConfig {
  limit: number;
  action: WarnAction;
  strong: boolean;
}

/** A user's warning history in a chat. */
export interface UserWarnings {
  count: number;
  reasons: string[];
}

/** Clean settings for automated service message management. */
export interface CleanConfig {
  welcome: boolean;
  goodbye: boolean;
  service: boolean;
}

/** Federation data structure. */
export interface Federation {
  id: string;
  name: string;
  owner: number;
  admins: number[];
  chats: number[];
}

/** Federated ban record. */
export interface FedBan {
  userId: number;
  reason: string;
  banner: number;
  ts: number;
}

/** Global chat settings aggregated. */
export interface ChatSettings {
  welcome: WelcomeConfig;
  goodbye: GoodbyeConfig;
  rules: RulesConfig;
  locks: Set<LockType>;
  flood: FloodConfig;
  warn: WarnConfig;
  clean: CleanConfig;
  reportsEnabled: boolean;
  approvalGated: boolean;
  logChatId: number | null;
  fedId: string | null;
  disabledCommands: Set<string>;
}
