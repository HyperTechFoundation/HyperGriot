/**
 * Hygiene module — Clean (purge/service), Command Disabling, and Topic Awareness.
 * See docs/design.md §5.6 and docs/PRD.md §6.6.
 */

import { Composer, type Context } from "grammy";
import { adminsOnly, botCanDelete, onlyGroups } from "../../core/guards.js";
import { escapeHtml } from "../../core/formatting.js";
import { store } from "../../repository/store.js";

export const cleanupComposer = new Composer<Context>();

/** List of commands that can be disabled by group admins. */
export const DISABLEABLE_COMMANDS: readonly string[] = [
  "rules",
  "notes",
  "get",
  "warns",
  "locks",
  "filters",
  "report",
  "flood",
  "welcome",
  "goodbye",
  "pinned",
  "adminlist",
  "approved",
  "fedinfo",
  "fedadmins",
  "fedbanlist",
  "fedsubs",
  "id",
  "ping",
] as const;

// ── Clean Submodule ─────────────────────────────────────────────

cleanupComposer.command("cleanservice", onlyGroups, adminsOnly, async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/cleanservice(@\w+)?\s*/i, "").trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    const current = store.getCleanConfig(ctx.chat.id).service ? "on" : "off";
    await ctx.reply(`Clean service messages is currently <b>${current}</b>. Use /cleanservice on|off.`, {
      parse_mode: "HTML",
    });
    return;
  }

  const enabled = arg === "on";
  store.setCleanService(ctx.chat.id, enabled);
  await ctx.reply(`Clean service messages is now <b>${enabled ? "enabled" : "disabled"}</b>.`, {
    parse_mode: "HTML",
  });
});

cleanupComposer.command("clean", onlyGroups, adminsOnly, async (ctx) => {
  if (!(await botCanDelete(ctx))) {
    await ctx.reply("I need the **Delete Messages** right to do this.");
    return;
  }

  const arg = ctx.message?.text?.replace(/^\/clean(@\w+)?\s*/i, "").trim();
  const count = parseInt(arg || "1", 10);

  if (isNaN(count) || count < 1 || count > 100) {
    await ctx.reply("Please specify a number of messages to purge (1–100), e.g. <code>/clean 10</code>.", {
      parse_mode: "HTML",
    });
    return;
  }

  const replyMsg = ctx.message?.reply_to_message;
  const startId = replyMsg ? replyMsg.message_id : ctx.message!.message_id;

  const messageIds: number[] = [];
  for (let i = 0; i < count; i++) {
    const id = startId - i;
    if (id > 0) messageIds.push(id);
  }
  if (!messageIds.includes(ctx.message!.message_id)) {
    messageIds.push(ctx.message!.message_id);
  }

  try {
    if (typeof (ctx.api as any).deleteMessages === "function") {
      await (ctx.api as any).deleteMessages(ctx.chat.id, messageIds);
    } else {
      await Promise.all(
        messageIds.map((id) => ctx.api.deleteMessage(ctx.chat.id, id).catch(() => {})),
      );
    }
  } catch {
    await Promise.all(
      messageIds.map((id) => ctx.api.deleteMessage(ctx.chat.id, id).catch(() => {})),
    );
  }

  const notice = await ctx.reply(`Cleaned ${count} messages.`);
  setTimeout(() => {
    ctx.api.deleteMessage(ctx.chat.id, notice.message_id).catch(() => {});
  }, 4000);
});

// ── Disabling Submodule ─────────────────────────────────────────

cleanupComposer.command("disable", onlyGroups, adminsOnly, async (ctx) => {
  const cmd = ctx.message?.text?.replace(/^\/disable(@\w+)?\s*/i, "").trim().toLowerCase().replace(/^\//, "");
  if (!cmd) {
    await ctx.reply("Usage: <code>/disable &lt;command&gt;</code>", { parse_mode: "HTML" });
    return;
  }

  if (!DISABLEABLE_COMMANDS.includes(cmd)) {
    await ctx.reply(
      `Command <code>/${escapeHtml(cmd)}</code> cannot be disabled. Use /disableable to view disableable commands.`,
      { parse_mode: "HTML" },
    );
    return;
  }

  store.disableCommand(ctx.chat.id, cmd);
  await ctx.reply(`Disabled <code>/${escapeHtml(cmd)}</code> for non-admins.`, { parse_mode: "HTML" });
});

cleanupComposer.command("enable", onlyGroups, adminsOnly, async (ctx) => {
  const cmd = ctx.message?.text?.replace(/^\/enable(@\w+)?\s*/i, "").trim().toLowerCase().replace(/^\//, "");
  if (!cmd) {
    await ctx.reply("Usage: <code>/enable &lt;command&gt;</code>", { parse_mode: "HTML" });
    return;
  }

  const enabled = store.enableCommand(ctx.chat.id, cmd);
  if (enabled) {
    await ctx.reply(`Re-enabled <code>/${escapeHtml(cmd)}</code>.`, { parse_mode: "HTML" });
  } else {
    await ctx.reply(`Command <code>/${escapeHtml(cmd)}</code> was not disabled.`, { parse_mode: "HTML" });
  }
});

cleanupComposer.command("enableall", onlyGroups, adminsOnly, async (ctx) => {
  store.enableAllCommands(ctx.chat.id);
  await ctx.reply("All commands have been re-enabled in this group.");
});

cleanupComposer.command("disabled", onlyGroups, async (ctx) => {
  const disabled = store.getDisabledCommands(ctx.chat.id);
  if (disabled.length === 0) {
    await ctx.reply("No commands are currently disabled in this group.");
    return;
  }

  const list = disabled.map((c) => `• <code>/${escapeHtml(c)}</code>`).join("\n");
  await ctx.reply(`<b>Disabled commands in this chat:</b>\n\n${list}`, { parse_mode: "HTML" });
});

cleanupComposer.command("disableable", onlyGroups, async (ctx) => {
  const list = DISABLEABLE_COMMANDS.map((c) => `• <code>/${escapeHtml(c)}</code>`).join("\n");
  await ctx.reply(`<b>Commands that can be disabled:</b>\n\n${list}`, { parse_mode: "HTML" });
});

// ── Auto-Clean Service Messages Interceptor ─────────────────────

cleanupComposer.on("message", async (ctx, next) => {
  if (!ctx.chat || ctx.chat.type === "private") {
    return next();
  }

  const cleanCfg = store.getCleanConfig(ctx.chat.id);
  if (cleanCfg.service && (await botCanDelete(ctx))) {
    const msg = ctx.message;
    const isService = Boolean(
      msg.new_chat_members ||
        msg.left_chat_member ||
        msg.new_chat_title ||
        msg.new_chat_photo ||
        msg.delete_chat_photo ||
        msg.pinned_message ||
        msg.group_chat_created ||
        msg.supergroup_chat_created ||
        msg.channel_chat_created ||
        msg.video_chat_started ||
        msg.video_chat_ended ||
        msg.video_chat_participants_invited ||
        msg.forum_topic_created ||
        msg.forum_topic_closed ||
        msg.forum_topic_reopened
    );

    if (isService) {
      try {
        await ctx.deleteMessage();
        return; // Stopped service message
      } catch {
        /* best-effort */
      }
    }
  }

  return next();
});

/** Register the cleanup module on a bot instance. */
export function registerCleanup(bot: { use: (c: Composer<Context>) => void }): void {
  bot.use(cleanupComposer);
}
