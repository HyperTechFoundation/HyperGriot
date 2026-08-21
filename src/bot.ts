/**
 * HyperGriot bot wiring — assembles the update pipeline and feature modules.
 * See docs/TRD.md §3 (architecture) and docs/design.md §5.
 */

import { Bot, type Context } from "grammy";
import { config } from "./config.js";
import { normalizePrefixMiddleware } from "./core/prefix.js";
import {
  disabledCommandsMiddleware,
  loggingMiddleware,
  userIngestionMiddleware,
} from "./core/pipeline.js";
import { invalidateAdminCache } from "./core/guards.js";
import { helpComposer } from "./core/help.js";
import { registerModeration } from "./modules/moderation/index.js";
import { registerOnboarding } from "./modules/onboarding/index.js";
import { registerGovernance } from "./modules/governance/index.js";
import { registerProtection } from "./modules/protection/index.js";
import { registerNetwork } from "./modules/network/index.js";
import { registerHygiene } from "./modules/hygiene/index.js";

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  // ── Global Pipeline Middlewares (Prefix normalization MUST be first) ──
  bot.use(normalizePrefixMiddleware);
  bot.use(loggingMiddleware);
  bot.use(userIngestionMiddleware);
  bot.use(disabledCommandsMiddleware);

  // Invalidate the admin cache whenever membership/admin rights change.
  bot.on("chat_member", (ctx) => {
    invalidateAdminCache(ctx.chat.id);
  });

  // ── Basic commands ────────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Hi! I'm <b>HyperGriot</b>, a modular, high-performance Telegram group-management bot.\n\n" +
        "Add me to your group and make me an administrator with full rights to get started.\n\n" +
        "Use /help to view commands.",
      { parse_mode: "HTML" },
    );
  });

  bot.use(helpComposer);

  bot.command("ping", (ctx) => ctx.reply("Pong! HyperGriot is online."));

  bot.command("id", async (ctx) => {
    const lines = [`Chat ID: <code>${ctx.chat.id}</code>`];
    if (ctx.from) lines.push(`Your ID: <code>${ctx.from.id}</code>`);
    const reply = ctx.message?.reply_to_message?.from;
    if (reply) lines.push(`Replied user ID: <code>${reply.id}</code>`);
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  });

  // ── Feature Modules ───────────────────────────────────────────────
  registerModeration(bot);
  registerOnboarding(bot);
  registerGovernance(bot);
  registerProtection(bot);
  registerNetwork(bot);
  registerHygiene(bot);

  return bot;
}
