/**
 * Governance module — Pin, Rules, Notes, and Admin management.
 * See docs/design.md §5.3 and docs/PRD.md §6.3.
 */

import { Composer, type Context, InlineKeyboard } from "grammy";
import {
  adminsOnly,
  assertTarget,
  botCanPin,
  botCanPromote,
  getDisplayInfo,
  onlyGroups,
} from "../../core/guards.js";
import { escapeHtml, userLink } from "../../core/formatting.js";
import { resolveTarget } from "../../core/target.js";
import { store } from "../../repository/store.js";
import { parseButton } from "../welcome/index.js";
import type { InlineUrlButton, Note, UserInfo } from "../../types/index.js";

export const adminComposer = new Composer<Context>();

// ── Pin Submodule ───────────────────────────────────────────────

adminComposer.command("pin", onlyGroups, adminsOnly, async (ctx) => {
  if (!(await botCanPin(ctx))) {
    await ctx.reply("I need the **Pin Messages** right to do this.");
    return;
  }

  const replyMsg = ctx.message?.reply_to_message;
  if (!replyMsg) {
    await ctx.reply("Reply to a message with /pin to pin it.");
    return;
  }

  const args = ctx.message?.text?.replace(/^\/pin(@\w+)?\s*/i, "").trim().toLowerCase() || "";
  const isLoud = args.includes("loud");

  try {
    await ctx.api.pinChatMessage(ctx.chat.id, replyMsg.message_id, {
      disable_notification: !isLoud,
    });
    await ctx.reply(`Message pinned ${isLoud ? "with notification." : "silently."}`);
  } catch (err) {
    await ctx.reply("Failed to pin message. Check bot permissions.");
  }
});

adminComposer.command("unpin", onlyGroups, adminsOnly, async (ctx) => {
  if (!(await botCanPin(ctx))) {
    await ctx.reply("I need the **Pin Messages** right to do this.");
    return;
  }

  const replyMsg = ctx.message?.reply_to_message;
  try {
    if (replyMsg) {
      await ctx.api.unpinChatMessage(ctx.chat.id, replyMsg.message_id);
      await ctx.reply("Message unpinned.");
    } else {
      await ctx.api.unpinChatMessage(ctx.chat.id);
      await ctx.reply("Latest pinned message unpinned.");
    }
  } catch {
    await ctx.reply("Failed to unpin message.");
  }
});

adminComposer.command("unpinall", onlyGroups, adminsOnly, async (ctx) => {
  if (!(await botCanPin(ctx))) {
    await ctx.reply("I need the **Pin Messages** right to do this.");
    return;
  }

  try {
    await ctx.api.unpinAllChatMessages(ctx.chat.id);
    await ctx.reply("All pinned messages have been unpinned.");
  } catch {
    await ctx.reply("Failed to unpin messages.");
  }
});

adminComposer.command("pinned", onlyGroups, async (ctx) => {
  try {
    const chat = await ctx.api.getChat(ctx.chat.id);
    if ("pinned_message" in chat && chat.pinned_message) {
      const msg = chat.pinned_message;
      const text = msg.text ? `\n\n"${escapeHtml(msg.text.slice(0, 150))}${msg.text.length > 150 ? "…" : ""}"` : "";
      await ctx.reply(`<b>Current pinned message:</b>${text}`, { parse_mode: "HTML" });
    } else {
      await ctx.reply("There is no pinned message in this group.");
    }
  } catch {
    await ctx.reply("Could not retrieve pinned message.");
  }
});

// ── Rules Submodule ─────────────────────────────────────────────

adminComposer.command("setrules", onlyGroups, adminsOnly, async (ctx) => {
  let text = "";
  if (ctx.message?.reply_to_message?.text) {
    text = ctx.message.reply_to_message.text;
  } else {
    text = ctx.message?.text?.replace(/^\/setrules(@\w+)?\s*/i, "").trim() || "";
  }

  if (!text) {
    await ctx.reply("Please provide the rules text or reply to a message with /setrules.");
    return;
  }

  store.setRules(ctx.chat.id, text);
  await ctx.reply("Group rules have been updated.");
});

adminComposer.command("rules", onlyGroups, async (ctx) => {
  const rulesCfg = store.getRules(ctx.chat.id);
  const kb = new InlineKeyboard();
  if (rulesCfg.button) {
    kb.url(rulesCfg.button.text, rulesCfg.button.url);
  }

  await ctx.reply(`<b>Rules for ${escapeHtml(ctx.chat.title)}:</b>\n\n${rulesCfg.text}`, {
    parse_mode: "HTML",
    reply_markup: rulesCfg.button ? kb : undefined,
  });
});

adminComposer.command("clearrules", onlyGroups, adminsOnly, async (ctx) => {
  store.clearRules(ctx.chat.id);
  await ctx.reply("Rules have been cleared.");
});

adminComposer.command("setrulesbutton", onlyGroups, adminsOnly, async (ctx) => {
  const args = ctx.message?.text?.replace(/^\/setrulesbutton(@\w+)?\s*/i, "").trim() || "";
  if (!args || args.toLowerCase() === "clear") {
    store.setRulesButton(ctx.chat.id, undefined);
    await ctx.reply("Cleared rules button.");
    return;
  }

  const btn = parseButton(args);
  if (!btn) {
    await ctx.reply("Invalid button format. Use: <code>Label|https://example.com</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  store.setRulesButton(ctx.chat.id, btn);
  await ctx.reply(`Rules button set to [${escapeHtml(btn.text)}](${escapeHtml(btn.url)})`);
});

// ── Notes Submodule ─────────────────────────────────────────────

/** Extract markdown buttons from note content, e.g. [Click Here](https://example.com). */
function extractButtonsFromText(text: string): { cleanText: string; buttons: InlineUrlButton[] } {
  const buttons: InlineUrlButton[] = [];
  const btnRe = /\[([^\]]+)\]\((https?:\/\/[^\)]+|buttonurl:\/\/([^\)]+))\)/gi;
  let cleanText = text;

  let m: RegExpExecArray | null;
  while ((m = btnRe.exec(text)) !== null) {
    const label = m[1]?.trim();
    let url = m[2]?.trim();
    if (url?.startsWith("buttonurl://")) {
      url = "https://" + url.replace("buttonurl://", "");
    }
    if (label && url) {
      buttons.push({ text: label, url });
    }
  }

  cleanText = cleanText.replace(btnRe, "").trim();
  return { cleanText, buttons };
}

adminComposer.command("save", onlyGroups, adminsOnly, async (ctx) => {
  const raw = ctx.message?.text?.replace(/^\/save(@\w+)?\s*/i, "").trim() || "";
  if (!raw) {
    await ctx.reply("Usage: <code>/save &lt;notename&gt; &lt;content&gt;</code> or reply to a message with <code>/save &lt;notename&gt;</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  const firstSpace = raw.indexOf(" ");
  let name = "";
  let content = "";

  if (firstSpace === -1) {
    name = raw.toLowerCase();
    if (ctx.message?.reply_to_message?.text) {
      content = ctx.message.reply_to_message.text;
    }
  } else {
    name = raw.slice(0, firstSpace).toLowerCase();
    content = raw.slice(firstSpace + 1).trim();
  }

  if (!name || !content) {
    await ctx.reply("Please provide both a note name and content.");
    return;
  }

  const { cleanText, buttons } = extractButtonsFromText(content);
  const note: Note = {
    name,
    text: cleanText || content,
    buttons: buttons.length > 0 ? buttons : undefined,
    private: store.isNotesPrivate(ctx.chat.id),
  };

  store.saveNote(ctx.chat.id, note);
  await ctx.reply(`Saved note <code>#${escapeHtml(name)}</code>.`, { parse_mode: "HTML" });
});

adminComposer.command("get", onlyGroups, async (ctx) => {
  const name = ctx.message?.text?.replace(/^\/get(@\w+)?\s*/i, "").trim().toLowerCase();
  if (!name) {
    await ctx.reply("Usage: /get <notename>");
    return;
  }
  await sendNote(ctx, name);
});

adminComposer.command("notes", onlyGroups, async (ctx) => {
  const notes = store.getNotes(ctx.chat.id);
  const keys = Object.keys(notes);
  if (keys.length === 0) {
    await ctx.reply("No notes saved in this chat.");
    return;
  }

  const list = keys.map((k) => `• <code>#${escapeHtml(k)}</code>`).join("\n");
  await ctx.reply(`<b>Notes in ${escapeHtml(ctx.chat.title)}:</b>\n\n${list}`, {
    parse_mode: "HTML",
  });
});

adminComposer.command("clear", onlyGroups, adminsOnly, async (ctx) => {
  const name = ctx.message?.text?.replace(/^\/clear(@\w+)?\s*/i, "").trim().toLowerCase();
  if (!name) {
    await ctx.reply("Usage: /clear <notename>");
    return;
  }

  const removed = store.deleteNote(ctx.chat.id, name);
  if (removed) {
    await ctx.reply(`Deleted note <code>#${escapeHtml(name)}</code>.`, { parse_mode: "HTML" });
  } else {
    await ctx.reply(`Note <code>#${escapeHtml(name)}</code> does not exist.`, { parse_mode: "HTML" });
  }
});

adminComposer.command("removeall", onlyGroups, adminsOnly, async (ctx) => {
  store.clearAllNotes(ctx.chat.id);
  await ctx.reply("All notes have been removed from this chat.");
});

adminComposer.command("private", onlyGroups, adminsOnly, async (ctx) => {
  const args = ctx.message?.text?.replace(/^\/private(@\w+)?\s*/i, "").trim().toLowerCase();
  if (args !== "on" && args !== "off") {
    const isPriv = store.isNotesPrivate(ctx.chat.id);
    await ctx.reply(`Private notes are currently <b>${isPriv ? "on" : "off"}</b>. Use /private on|off to toggle.`, {
      parse_mode: "HTML",
    });
    return;
  }

  const isPriv = args === "on";
  store.setNotesPrivate(ctx.chat.id, isPriv);
  await ctx.reply(`Private notes are now <b>${isPriv ? "enabled (sent to PM)" : "disabled (sent to chat)"}</b>.`, {
    parse_mode: "HTML",
  });
});

async function sendNote(ctx: Context, noteName: string): Promise<void> {
  const note = store.getNote(ctx.chat!.id, noteName);
  if (!note) return;

  const kb = new InlineKeyboard();
  if (note.buttons) {
    for (const b of note.buttons) {
      kb.url(b.text, b.url).row();
    }
  }

  const isPrivate = store.isNotesPrivate(ctx.chat!.id);
  if (isPrivate && ctx.from) {
    try {
      await ctx.api.sendMessage(ctx.from.id, `<b>#${escapeHtml(note.name)}:</b>\n\n${note.text}`, {
        parse_mode: "HTML",
        reply_markup: note.buttons && note.buttons.length > 0 ? kb : undefined,
      });
      await ctx.reply(`I have sent the note <code>#${escapeHtml(note.name)}</code> to your PM.`, {
        parse_mode: "HTML",
      });
    } catch {
      await ctx.reply("I couldn't send you a PM. Please start a private chat with me first.");
    }
  } else {
    await ctx.reply(`<b>#${escapeHtml(note.name)}:</b>\n\n${note.text}`, {
      parse_mode: "HTML",
      reply_markup: note.buttons && note.buttons.length > 0 ? kb : undefined,
      reply_parameters: ctx.message ? { message_id: ctx.message.message_id } : undefined,
    });
  }
}

// ── Handle #notename hashtag invocation ───────────────────────────
adminComposer.on("message:entities:hashtag", async (ctx, next) => {
  const text = ctx.message.text || "";
  const entities = ctx.message.entities || [];
  for (const ent of entities) {
    if (ent.type === "hashtag") {
      const tag = text.slice(ent.offset + 1, ent.offset + ent.length).toLowerCase();
      const note = store.getNote(ctx.chat.id, tag);
      if (note) {
        await sendNote(ctx, tag);
        return;
      }
    }
  }
  return next();
});

// ── Admin Submodule ─────────────────────────────────────────────

adminComposer.command("promote", onlyGroups, adminsOnly, async (ctx) => {
  if (!(await botCanPromote(ctx))) {
    await ctx.reply("I need the **Promote Members** right to do this.");
    return;
  }

  const target = await resolveTarget(ctx);
  const targetErr = await assertTarget(ctx, target, { allowAdmin: true });
  if (targetErr) {
    await ctx.reply(targetErr);
    return;
  }

  try {
    await ctx.api.promoteChatMember(ctx.chat.id, target.userId!, {
      can_change_info: true,
      can_delete_messages: true,
      can_invite_users: true,
      can_restrict_members: true,
      can_pin_messages: true,
      can_manage_topics: true,
    });
    const info = await getDisplayInfo(ctx, target);
    await ctx.reply(`Successfully promoted ${userLink(info)} to administrator.`, {
      parse_mode: "HTML",
    });
  } catch (err) {
    await ctx.reply("Failed to promote user. Check bot permissions.");
  }
});

adminComposer.command("demote", onlyGroups, adminsOnly, async (ctx) => {
  if (!(await botCanPromote(ctx))) {
    await ctx.reply("I need the **Promote Members** right to do this.");
    return;
  }

  const target = await resolveTarget(ctx);
  if (target.userId === null) {
    if (target.username) {
      await ctx.reply(`I haven't seen @${target.username} yet. Please reply to their message or provide their numeric user ID.`);
    } else {
      await ctx.reply("I don't know who you're referring to — reply to their message, @mention them, or give their user ID.");
    }
    return;
  }

  try {
    await ctx.api.promoteChatMember(ctx.chat.id, target.userId, {
      can_change_info: false,
      can_delete_messages: false,
      can_invite_users: false,
      can_restrict_members: false,
      can_pin_messages: false,
      can_manage_topics: false,
      can_post_messages: false,
      can_edit_messages: false,
      can_promote_members: false,
    });
    const info = await getDisplayInfo(ctx, target);
    await ctx.reply(`Successfully demoted ${userLink(info)}.`, { parse_mode: "HTML" });
  } catch {
    await ctx.reply("Failed to demote administrator.");
  }
});

adminComposer.command("adminlist", onlyGroups, async (ctx) => {
  try {
    const admins = await ctx.api.getChatAdministrators(ctx.chat.id);
    for (const a of admins) {
      if (a.user) (await import("../../core/resolver.js")).cacheUser(a.user);
    }
    const creator = admins.find((a) => a.status === "creator");
    const moderators = admins.filter((a) => a.status === "administrator" && !a.user.is_bot);
    const bots = admins.filter((a) => a.user.is_bot);

    const lines: string[] = [`<b>Administrators for ${escapeHtml(ctx.chat.title)}:</b>\n`];
    if (creator) {
      const creatorTitle = creator.custom_title ? ` (<i>${escapeHtml(creator.custom_title)}</i>)` : "";
      lines.push(`<b>Owner:</b> ${userLink(creator.user)}${creatorTitle}`);
    }

    if (moderators.length > 0) {
      lines.push(`\n<b>Admins:</b>`);
      for (const m of moderators) {
        const title = m.custom_title ? ` (<i>${escapeHtml(m.custom_title)}</i>)` : "";
        lines.push(`• ${userLink(m.user)}${title}`);
      }
    }

    if (bots.length > 0) {
      lines.push(`\n<b>Bots:</b>`);
      for (const b of bots) {
        lines.push(`• ${userLink(b.user)}`);
      }
    }

    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  } catch {
    await ctx.reply("Failed to load admin list.");
  }
});

adminComposer.command("title", onlyGroups, adminsOnly, async (ctx) => {
  if (!(await botCanPromote(ctx))) {
    await ctx.reply("I need the **Promote Members** right to do this.");
    return;
  }

  const target = await resolveTarget(ctx);
  if (target.userId === null) {
    if (target.username) {
      await ctx.reply(`I haven't seen @${target.username} yet. Please reply to their message or provide their numeric user ID.`);
    } else {
      await ctx.reply("I don't know who you're referring to — reply to their message, @mention them, or give their user ID.");
    }
    return;
  }

  if (!target.reason) {
    await ctx.reply("Please provide a title, e.g. <code>/title @user Moderator</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  const title = target.reason.slice(0, 16); // Telegram limits custom titles to 16 chars
  try {
    await ctx.api.setChatAdministratorCustomTitle(ctx.chat.id, target.userId, title);
    const info = await getDisplayInfo(ctx, target);
    await ctx.reply(`Custom title for ${userLink(info)} set to <i>${escapeHtml(title)}</i>.`, {
      parse_mode: "HTML",
    });
  } catch {
    await ctx.reply("Failed to set admin custom title. Ensure the bot promoted this admin.");
  }
});

/** Register the admin module on a bot instance. */
export function registerAdmin(bot: { use: (c: Composer<Context>) => void }): void {
  bot.use(adminComposer);
}
