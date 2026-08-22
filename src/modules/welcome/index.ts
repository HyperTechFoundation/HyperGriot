/**
 * Onboarding module — Welcome and Goodbye management.
 * Implements templating, welcome buttons, cleanwelcome, and welcomemute.
 * See docs/design.md §5.2 and docs/PRD.md §6.2.
 */

import { Composer, type Context, InlineKeyboard } from "grammy";
import type { User } from "grammy/types";
import { adminsOnly, botCanDelete, botCanPin, botCanRestrict, onlyGroups } from "../../core/guards.js";
import { escapeHtml } from "../../core/formatting.js";
import { parseTime } from "../../core/time.js";
import { store } from "../../repository/store.js";
import type { InlineUrlButton } from "../../types/index.js";

export const welcomeComposer = new Composer<Context>();

// Track previous welcome/goodbye message IDs for cleanwelcome / cleangoodbye
const lastWelcomeMsg = new Map<number, number>(); // chatId -> messageId
const lastGoodbyeMsg = new Map<number, number>(); // chatId -> messageId

/** Format a welcome/goodbye template with user and chat metadata. */
export function formatTemplate(
  template: string,
  user: User,
  chat: { title?: string; id: number; memberCount?: number },
): string {
  const first = escapeHtml(user.first_name || "");
  const last = escapeHtml(user.last_name || "");
  const fullname = last ? `${first} ${last}` : first;
  const username = user.username ? `@${escapeHtml(user.username)}` : first;
  const mention = `<a href="tg://user?id=${user.id}">${first}</a>`;
  const id = String(user.id);
  const count = String(chat.memberCount ?? "");
  const chatname = escapeHtml(chat.title || "the group");

  return template
    .replace(/\{first\}/g, first)
    .replace(/\{last\}/g, last)
    .replace(/\{fullname\}/g, fullname)
    .replace(/\{username\}/g, username)
    .replace(/\{mention\}/g, mention)
    .replace(/\{id\}/g, id)
    .replace(/\{count\}/g, count)
    .replace(/\{chatname\}/g, chatname);
}

/** Parse button specification e.g. "Google|https://google.com" or "[Google](https://google.com)". */
export function parseButton(input: string): InlineUrlButton | null {
  const trimmed = input.trim();
  if (trimmed.includes("|")) {
    const [text, url] = trimmed.split("|").map((s) => s.trim());
    if (text && url && /^https?:\/\//i.test(url)) {
      return { text, url };
    }
  }
  const mdMatch = /^\[([^\]]+)\]\((https?:\/\/[^\)]+)\)$/i.exec(trimmed);
  if (mdMatch && mdMatch[1] && mdMatch[2]) {
    return { text: mdMatch[1].trim(), url: mdMatch[2].trim() };
  }
  return null;
}

// ── Welcome Commands ────────────────────────────────────────────

welcomeComposer.command("setwelcome", onlyGroups, adminsOnly, async (ctx) => {
  let text = "";
  if (ctx.message?.reply_to_message?.text) {
    text = ctx.message.reply_to_message.text;
  } else {
    text = ctx.message?.text?.replace(/^\/setwelcome(@\w+)?\s*/i, "").trim() || "";
  }

  if (!text) {
    await ctx.reply(
      "Please provide the welcome message text or reply to a message with /setwelcome.\n\n" +
        "Placeholders: {first}, {last}, {fullname}, {username}, {mention}, {id}, {chatname}, {count}",
    );
    return;
  }

  store.setWelcomeText(ctx.chat.id, text);
  await ctx.reply("Welcome message updated.");
});

welcomeComposer.command("welcome", onlyGroups, async (ctx) => {
  const args = ctx.message?.text?.replace(/^\/welcome(@\w+)?\s*/i, "").trim().toLowerCase();

  // If argument is on/off, toggle (admin only)
  if (args === "on" || args === "off") {
    const isAdmin = await import("../../core/guards.js").then((m) =>
      m.isGroupAdmin(ctx, ctx.from!.id),
    );
    if (!isAdmin) {
      await ctx.reply("You need to be an admin to change welcome settings.");
      return;
    }
    const enable = args === "on";
    store.setWelcomeEnabled(ctx.chat.id, enable);
    await ctx.reply(`Welcome messages have been ${enable ? "enabled" : "disabled"}.`);
    return;
  }

  // Otherwise show current welcome preview
  const cfg = store.getWelcome(ctx.chat.id);
  const preview = formatTemplate(cfg.text, ctx.from!, {
    id: ctx.chat.id,
    title: ctx.chat.title,
    memberCount: 1,
  });

  const kb = new InlineKeyboard();
  for (const btn of cfg.buttons) {
    kb.url(btn.text, btn.url).row();
  }

  const status = cfg.enabled ? "Enabled" : "Disabled";
  await ctx.reply(
    `<b>Welcome message (${status}):</b>\n\n${preview}`,
    {
      parse_mode: "HTML",
      reply_markup: cfg.buttons.length > 0 ? kb : undefined,
    },
  );
});

welcomeComposer.command("welcomebutton", onlyGroups, adminsOnly, async (ctx) => {
  const args = ctx.message?.text?.replace(/^\/welcomebutton(@\w+)?\s*/i, "").trim() || "";
  if (!args || args.toLowerCase() === "clear") {
    store.setWelcomeButtons(ctx.chat.id, []);
    await ctx.reply("Cleared welcome buttons.");
    return;
  }

  const btn = parseButton(args);
  if (!btn) {
    await ctx.reply("Invalid button format. Use: <code>Label|https://example.com</code> or <code>[Label](https://example.com)</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  store.setWelcomeButtons(ctx.chat.id, [btn]);
  await ctx.reply(`Welcome button set: [${escapeHtml(btn.text)}](${escapeHtml(btn.url)})`);
});

welcomeComposer.command("cleanwelcome", onlyGroups, adminsOnly, async (ctx) => {
  const args = ctx.message?.text?.replace(/^\/cleanwelcome(@\w+)?\s*/i, "").trim().toLowerCase();
  if (args !== "on" && args !== "off") {
    const current = store.getWelcome(ctx.chat.id).clean ? "on" : "off";
    await ctx.reply(`Clean welcome is currently <b>${current}</b>. Use /cleanwelcome on|off to change.`, {
      parse_mode: "HTML",
    });
    return;
  }
  const enabled = args === "on";
  store.setCleanWelcome(ctx.chat.id, enabled);
  await ctx.reply(`Clean welcome is now ${enabled ? "enabled" : "disabled"}.`);
});

welcomeComposer.command("welcomemute", onlyGroups, adminsOnly, async (ctx) => {
  const args = ctx.message?.text?.replace(/^\/welcomemute(@\w+)?\s*/i, "").trim().toLowerCase();
  if (!args || args === "off") {
    store.setWelcomeMute(ctx.chat.id, null);
    await ctx.reply("Welcome mute is now disabled.");
    return;
  }

  const parsed = parseTime(args);
  if (!parsed) {
    await ctx.reply("Invalid duration. Provide a time token, e.g. <code>/welcomemute 2h</code> or <code>/welcomemute off</code>.", {
      parse_mode: "HTML",
    });
    return;
  }

  store.setWelcomeMute(ctx.chat.id, parsed.ms);
  await ctx.reply(`New members will be muted for ${parsed.label} upon joining.`);
});

welcomeComposer.command("clearwelcome", onlyGroups, adminsOnly, async (ctx) => {
  store.clearWelcome(ctx.chat.id);
  await ctx.reply("Welcome configuration has been reset to defaults.");
});

// ── Goodbye Commands ────────────────────────────────────────────

welcomeComposer.command("setgoodbye", onlyGroups, adminsOnly, async (ctx) => {
  let text = "";
  if (ctx.message?.reply_to_message?.text) {
    text = ctx.message.reply_to_message.text;
  } else {
    text = ctx.message?.text?.replace(/^\/setgoodbye(@\w+)?\s*/i, "").trim() || "";
  }

  if (!text) {
    await ctx.reply("Please provide the goodbye message text or reply to a message with /setgoodbye.");
    return;
  }

  store.setGoodbyeText(ctx.chat.id, text);
  await ctx.reply("Goodbye message updated.");
});

welcomeComposer.command("goodbye", onlyGroups, async (ctx) => {
  const args = ctx.message?.text?.replace(/^\/goodbye(@\w+)?\s*/i, "").trim().toLowerCase();

  if (args === "on" || args === "off") {
    const isAdmin = await import("../../core/guards.js").then((m) =>
      m.isGroupAdmin(ctx, ctx.from!.id),
    );
    if (!isAdmin) {
      await ctx.reply("You need to be an admin to change goodbye settings.");
      return;
    }
    const enable = args === "on";
    store.setGoodbyeEnabled(ctx.chat.id, enable);
    await ctx.reply(`Goodbye messages have been ${enable ? "enabled" : "disabled"}.`);
    return;
  }

  const cfg = store.getGoodbye(ctx.chat.id);
  const preview = formatTemplate(cfg.text, ctx.from!, {
    id: ctx.chat.id,
    title: ctx.chat.title,
  });

  const status = cfg.enabled ? "Enabled" : "Disabled";
  await ctx.reply(`<b>Goodbye message (${status}):</b>\n\n${preview}`, { parse_mode: "HTML" });
});

welcomeComposer.command("cleangoodbye", onlyGroups, adminsOnly, async (ctx) => {
  const args = ctx.message?.text?.replace(/^\/cleangoodbye(@\w+)?\s*/i, "").trim().toLowerCase();
  if (args !== "on" && args !== "off") {
    const current = store.getGoodbye(ctx.chat.id).clean ? "on" : "off";
    await ctx.reply(`Clean goodbye is currently <b>${current}</b>. Use /cleangoodbye on|off to change.`, {
      parse_mode: "HTML",
    });
    return;
  }
  const enabled = args === "on";
  store.setCleanGoodbye(ctx.chat.id, enabled);
  await ctx.reply(`Clean goodbye is now ${enabled ? "enabled" : "disabled"}.`);
});

welcomeComposer.command("cleargoodbye", onlyGroups, adminsOnly, async (ctx) => {
  store.clearGoodbye(ctx.chat.id);
  await ctx.reply("Goodbye configuration has been reset to defaults.");
});

// ── Join / Leave Event Listeners ─────────────────────────────────

welcomeComposer.on("message:new_chat_members", async (ctx) => {
  const newMembers = ctx.message.new_chat_members;
  const cfg = store.getWelcome(ctx.chat.id);

  for (const member of newMembers) {
    // If bot was added, ignore self
    if (member.is_bot && member.id === ctx.me.id) continue;

    // 1) Check if chat is subscribed to a federation and if user is fed-banned
    const fedId = store.getChatFedId(ctx.chat.id);
    if (fedId) {
      const bans = store.getFedBans(fedId);
      const isBanned = bans.some((b) => b.userId === member.id);
      if (isBanned && (await botCanRestrict(ctx))) {
        try {
          await ctx.api.banChatMember(ctx.chat.id, member.id);
          continue; // User banned; skip welcome
        } catch {
          /* best-effort */
        }
      }
    }

    // 2) Handle welcomemute if configured
    if (cfg.muteDurationMs && (await botCanRestrict(ctx))) {
      try {
        const until = Math.floor((Date.now() + cfg.muteDurationMs) / 1000);
        await ctx.api.restrictChatMember(ctx.chat.id, member.id, {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
          can_manage_topics: false,
        }, { until_date: until });
      } catch {
        /* best-effort */
      }
    }

    if (cfg.enabled) {
      // Clean previous welcome if cleanwelcome is enabled
      if (cfg.clean && (await botCanDelete(ctx))) {
        const prevId = lastWelcomeMsg.get(ctx.chat.id);
        if (prevId) {
          try {
            await ctx.api.deleteMessage(ctx.chat.id, prevId);
          } catch {
            /* ignore */
          }
        }
      }

      let count: number | undefined = undefined;
      try {
        count = await ctx.api.getChatMemberCount(ctx.chat.id);
      } catch {
        /* ignore */
      }

      const text = formatTemplate(cfg.text, member, {
        id: ctx.chat.id,
        title: ctx.chat.title,
        memberCount: count,
      });

      const kb = new InlineKeyboard();
      for (const btn of cfg.buttons) {
        kb.url(btn.text, btn.url).row();
      }

      try {
        const sent = await ctx.reply(text, {
          parse_mode: "HTML",
          reply_markup: cfg.buttons.length > 0 ? kb : undefined,
          message_thread_id: ctx.message.message_thread_id,
        });
        lastWelcomeMsg.set(ctx.chat.id, sent.message_id);
      } catch {
        /* best-effort */
      }
    }
  }
});

welcomeComposer.on("message:left_chat_member", async (ctx) => {
  const member = ctx.message.left_chat_member;
  if (member.is_bot && member.id === ctx.me.id) return;

  const cfg = store.getGoodbye(ctx.chat.id);
  if (!cfg.enabled) return;

  if (cfg.clean && (await botCanDelete(ctx))) {
    const prevId = lastGoodbyeMsg.get(ctx.chat.id);
    if (prevId) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, prevId);
      } catch {
        /* ignore */
      }
    }
  }

  const text = formatTemplate(cfg.text, member, {
    id: ctx.chat.id,
    title: ctx.chat.title,
  });

  try {
    const sent = await ctx.reply(text, {
      parse_mode: "HTML",
      message_thread_id: ctx.message.message_thread_id,
    });
    lastGoodbyeMsg.set(ctx.chat.id, sent.message_id);
  } catch {
    /* best-effort */
  }
});

/** Register the welcome module on a bot instance. */
export function registerWelcome(bot: { use: (c: Composer<Context>) => void }): void {
  bot.use(welcomeComposer);
}
