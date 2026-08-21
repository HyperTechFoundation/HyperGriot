/**
 * The Command-Resolution Engine — the backbone of every moderation & management command.
 *
 * Resolves targets across:
 *   1. inline text_mention entity (contains Telegram User directly)
 *   2. inline text_link entity with tg://user?id=
 *   3. @username mention entity & raw @username token (cache -> store -> chat admins lookup)
 *   4. tg://user?id= numeric link token
 *   5. numeric user ID token (e.g. 12345678)
 *   6. reply-to-message sender
 *
 * Priority: an explicit target argument wins over a coincidental reply.
 * See docs/design.md §4 and docs/TRD.md §6.
 */

import type { Context } from "grammy";
import type { MessageEntity } from "grammy/types";
import type { ResolveOptions, TargetResult, TargetType, UserInfo } from "../types/index.js";
import { isTimeToken, parseTime } from "./time.js";
import { cacheUser, resolveUsernameWithContext, userInfoById } from "./resolver.js";

interface Token {
  text: string;
  start: number; // offset within argsText
  end: number;
}

/** Split argsText into tokens while tracking each token's [start,end) offsets. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

/** Telegram user IDs are large; require ≥ 5 digits to avoid mistaking short reason numbers. */
const USERID_RE = /^\d{5,}$/;

function userFromTelegram(u: {
  id: number;
  first_name: string;
  username?: string;
}): UserInfo {
  return { id: u.id, firstName: u.first_name, username: u.username };
}

/**
 * Resolve the target, reason and (optionally) duration for a command.
 * @param ctx grammY context of the command message.
 * @param opts.expectTime set true for /tban, /tmute (parses a duration token).
 */
export async function resolveTarget(
  ctx: Context,
  opts: ResolveOptions = {},
): Promise<TargetResult> {
  const msg = ctx.message ?? ctx.editedMessage;
  const text = msg?.text ?? msg?.caption ?? "";
  const entities: MessageEntity[] = msg?.entities ?? msg?.caption_entities ?? [];

  // Locate where the arguments begin (just after the bot_command entity).
  const cmdEntity = entities.find((e) => e.type === "bot_command");
  const argsStart = cmdEntity ? cmdEntity.offset + cmdEntity.length : 0;
  const argsText = text.slice(argsStart);

  let tokens = tokenize(argsText);

  // ── 1) Duration (temp commands) ──────────────────────────────
  let durationMs: number | null = null;
  let durationLabel: string | null = null;
  if (opts.expectTime) {
    for (let i = 0; i < tokens.length; i++) {
      if (isTimeToken(tokens[i]!.text)) {
        const parsed = parseTime(tokens[i]!.text);
        if (parsed) {
          durationMs = parsed.ms;
          durationLabel = parsed.label;
          tokens = [...tokens.slice(0, i), ...tokens.slice(i + 1)];
          break;
        }
      }
    }
  }

  // ── 2) Target classification ─────────────────────────────────
  let type: TargetType = "empty";
  let userId: number | null = null;
  let username: string | null = null;
  let user: UserInfo | null = null;

  // (a) Check text_mention or text_link or mention entities inside args region
  const mentionEntity = entities.find(
    (e) =>
      (e.type === "text_mention" ||
        e.type === "mention" ||
        (e.type === "text_link" && e.url.startsWith("tg://user?id="))) &&
      e.offset >= argsStart,
  );

  if (mentionEntity) {
    const localOffset = mentionEntity.offset - argsStart;
    const idx = tokens.findIndex((t) => localOffset >= t.start && localOffset < t.end);

    if (mentionEntity.type === "text_mention" && mentionEntity.user) {
      type = "mention";
      user = userFromTelegram(mentionEntity.user);
      userId = user.id;
      username = mentionEntity.user.username ?? null;
      cacheUser(mentionEntity.user);
    } else if (mentionEntity.type === "text_link" && mentionEntity.url) {
      type = "mention";
      const match = /tg:\/\/user\?id=(\d+)/.exec(mentionEntity.url);
      if (match) {
        userId = parseInt(match[1]!, 10);
        const existing = userInfoById(userId);
        if (existing) {
          user = existing;
          username = existing.username ?? null;
        }
      }
    } else {
      type = "mention";
      const tok =
        idx >= 0
          ? tokens[idx]!.text
          : text.slice(mentionEntity.offset, mentionEntity.offset + mentionEntity.length);
      const name = tok.replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "").replace(/^t\.me\//, "");
      username = name;
      const resolved = await resolveUsernameWithContext(name, ctx);
      if (resolved) {
        user = resolved;
        userId = resolved.id;
      }
    }
    if (idx >= 0) tokens = [...tokens.slice(0, idx), ...tokens.slice(idx + 1)];
  } else if (
    tokens.length > 0 &&
    (tokens[0]!.text.startsWith("@") ||
      tokens[0]!.text.startsWith("t.me/") ||
      tokens[0]!.text.startsWith("https://t.me/"))
  ) {
    // (b) Raw @username token even without a Telegram mention entity
    type = "mention";
    const name = tokens[0]!.text
      .replace(/^@/, "")
      .replace(/^https?:\/\/t\.me\//, "")
      .replace(/^t\.me\//, "");
    username = name;
    tokens = tokens.slice(1);
    const resolved = await resolveUsernameWithContext(name, ctx);
    if (resolved) {
      user = resolved;
      userId = resolved.id;
    }
  } else if (tokens.length > 0 && /^tg:\/\/user\?id=(\d+)$/.test(tokens[0]!.text)) {
    // (c) Raw tg://user?id=123456 token
    type = "userid";
    const match = /^tg:\/\/user\?id=(\d+)$/.exec(tokens[0]!.text)!;
    userId = Number(match[1]);
    tokens = tokens.slice(1);
    const existing = userInfoById(userId);
    if (existing) {
      user = existing;
      username = existing.username ?? null;
    }
  } else if (tokens.length > 0 && USERID_RE.test(tokens[0]!.text)) {
    // (d) Explicit numeric user ID
    type = "userid";
    userId = Number(tokens[0]!.text);
    tokens = tokens.slice(1);
    const existing = userInfoById(userId);
    if (existing) {
      user = existing;
      username = existing.username ?? null;
    }
  }

  // (e) Reply fallback ONLY if no explicit target was provided in arguments
  const reply = msg?.reply_to_message;
  if (type === "empty" && reply?.from) {
    type = "reply";
    user = userFromTelegram(reply.from);
    userId = user.id;
    username = reply.from.username ?? null;
    cacheUser(reply.from);
  }

  // ── 3) Reason = whatever text remains ────────────────────────
  const reason = tokens.map((t) => t.text).join(" ").trim();

  return {
    type,
    userId,
    username,
    user,
    reason,
    reasonPresent: reason.length > 0,
    durationMs,
    durationLabel,
  };
}
