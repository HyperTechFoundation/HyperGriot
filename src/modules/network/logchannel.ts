/**
 * Log Channel submodule — mirrors moderation and security actions.
 * See docs/design.md §5.5 and docs/PRD.md §6.5.
 */

import { Composer, type Context } from "grammy";
import { adminsOnly, onlyGroups } from "../../core/guards.js";
import { store } from "../../repository/store.js";

export const logChannelComposer = new Composer<Context>();

logChannelComposer.command("logchannel", onlyGroups, async (ctx) => {
  const text = ctx.message?.text?.replace(/^\/logchannel(@\w+)?\s*/i, "").trim() || "";

  // If no args, show current status
  if (!text) {
    const current = store.getLogChatId(ctx.chat.id);
    if (current) {
      await ctx.reply(`Current log channel: <code>${current}</code>`, { parse_mode: "HTML" });
    } else {
      await ctx.reply(
        "No log channel is currently configured. To set one, run <code>/logchannel &lt;channel_id&gt;</code> or forward a message from the channel with /logchannel.",
        { parse_mode: "HTML" },
      );
    }
    return;
  }

  // Admin check for setting
  const isAdmin = await import("../../core/guards.js").then((m) => m.isGroupAdmin(ctx, ctx.from!.id));
  if (!isAdmin) {
    await ctx.reply("You need to be an admin to configure the log channel.");
    return;
  }

  const channelId = Number(text);
  if (!Number.isFinite(channelId)) {
    await ctx.reply("Please provide a valid numeric channel ID, e.g. <code>/logchannel -1001234567890</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  try {
    // Verify bot has access to send messages to this channel
    await ctx.api.sendMessage(channelId, `<b>HyperGriot</b> log channel successfully linked to <b>${ctx.chat.title}</b>.`, {
      parse_mode: "HTML",
    });
    store.setLogChatId(ctx.chat.id, channelId);
    await ctx.reply(`Moderation log channel set to <code>${channelId}</code>.`, { parse_mode: "HTML" });
  } catch {
    await ctx.reply("Could not reach that channel. Make sure HyperGriot is an administrator in the log channel.");
  }
});

logChannelComposer.command("unlogchannel", onlyGroups, adminsOnly, async (ctx) => {
  store.clearLogChatId(ctx.chat.id);
  await ctx.reply("Log channel has been disconnected.");
});
