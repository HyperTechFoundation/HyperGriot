/**
 * HTML message formatters for moderation actions.
 * Implements the exact message styles specified in docs/PRD.md §6.1.
 * ALL user-controlled text is HTML-escaped before rendering.
 */

import type { UserInfo } from "../types/index.js";

/** Escape a string for safe inclusion in an HTML parse_mode message. */
export function escapeHtml(input: string | undefined | null): string {
  if (!input) return "";
  return String(input).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

/** Render a user's first name as a profile link. Supports UserInfo and Telegram User. */
export function userLink(user: { id: number; firstName?: string; first_name?: string }): string {
  const name = user.firstName ?? user.first_name ?? "User";
  return `<a href="tg://user?id=${user.id}">${escapeHtml(name)}</a>`;
}

export interface CardInput {
  /** Target user display info. */
  user: UserInfo;
  /** Admin who issued the action. */
  admin: UserInfo;
  /** Reason text (already extracted; empty → "None"). */
  reason: string;
  /** Duration label for temp actions, e.g. "2 hours". */
  durationLabel?: string | null;
}

function metadataBlock(user: UserInfo, reason: string): string[] {
  const lines: string[] = [`User ID: ${user.id}`];
  if (user.username) lines.push(`Username: @${escapeHtml(user.username)}`);
  lines.push(`Reason: ${reason.trim().length > 0 ? escapeHtml(reason) : "None"}`);
  return lines;
}

/** Ban card. Header verb: "banned from the group" (or "banned for {time}" if temp). */
export function buildBanCard(input: CardInput): string {
  const header = input.durationLabel
    ? `${userLink(input.user)} got banned for ${input.durationLabel}.`
    : `${userLink(input.user)} got banned from the group.`;
  return [header, ...metadataBlock(input.user, input.reason), `Banned By: ${escapeHtml(input.admin.firstName)}`].join(
    "\n",
  );
}

/** Mute card. Header verb: "muted for {time}" (or "muted" forever). */
export function buildMuteCard(input: CardInput): string {
  const header = input.durationLabel
    ? `${userLink(input.user)} got muted for ${input.durationLabel}.`
    : `${userLink(input.user)} got muted.`;
  return [header, ...metadataBlock(input.user, input.reason), `Muted By: ${escapeHtml(input.admin.firstName)}`].join(
    "\n",
  );
}

/** Kick card. Header verb: "kicked!". */
export function buildKickCard(input: CardInput): string {
  return [
    `${userLink(input.user)} got kicked!`,
    ...metadataBlock(input.user, input.reason),
    `Kicked By: ${escapeHtml(input.admin.firstName)}`,
  ].join("\n");
}

export interface WarnCardInput extends CardInput {
  count: number;
  limit: number;
}

/** Warn card. */
export function buildWarnCard(input: WarnCardInput): string {
  return [
    `${userLink(input.user)} has been warned (${input.count}/${input.limit}).`,
    ...metadataBlock(input.user, input.reason),
    `Warned By: ${escapeHtml(input.admin.firstName)}`,
  ].join("\n");
}

export interface FbanCardInput extends CardInput {
  fedName?: string;
}

/** Fban card. */
export function buildFbanCard(input: FbanCardInput): string {
  const fedSuffix = input.fedName ? ` from ${escapeHtml(input.fedName)}` : "";
  return [
    `${userLink(input.user)} got fed-banned${fedSuffix}.`,
    ...metadataBlock(input.user, input.reason),
    `Banned By: ${escapeHtml(input.admin.firstName)}`,
  ].join("\n");
}

/** Unban card. */
export function buildUnbanCard(input: CardInput): string {
  return [
    `${userLink(input.user)} was unbanned.`,
    ...metadataBlock(input.user, input.reason),
    `Unbanned By: ${escapeHtml(input.admin.firstName)}`,
  ].join("\n");
}

/** Unmute card. */
export function buildUnmuteCard(input: CardInput): string {
  return [
    `${userLink(input.user)} was unmuted.`,
    ...metadataBlock(input.user, input.reason),
    `Unmuted By: ${escapeHtml(input.admin.firstName)}`,
  ].join("\n");
}


