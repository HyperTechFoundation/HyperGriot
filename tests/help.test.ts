import { describe, expect, it, vi } from "vitest";
import { Context } from "grammy";
import {
  CATEGORIES,
  INTRO,
  rootKb,
  backKb,
  catText,
  helpComposer,
} from "../src/modules/help/index.js";

const CHAT_ID = -100123456789;
const USER = { id: 10001, first_name: "TestUser", username: "testuser", is_bot: false };
const BOT_USER = { id: 99999, first_name: "HyperGriotBot", username: "hypergriotbot", is_bot: true };

describe("Miss Rose-style help menu", () => {
  it("defines 18 detailed categories matching Miss Rose layout", () => {
    expect(CATEGORIES.length).toBe(18);
    for (const cat of CATEGORIES) {
      expect(cat.label.length).toBeGreaterThan(0);
      expect(cat.description.length).toBeGreaterThan(0);
      expect(cat.cmds.length).toBeGreaterThan(0);
      for (const cmd of cat.cmds) {
        expect(cmd.name).toMatch(/^\/[a-z0-9]+$/);
        expect(cmd.desc.length).toBeGreaterThan(0);
      }
    }
  });

  it("builds a 3-column inline button grid with a Close button", () => {
    const kb = rootKb();
    const rows = kb.inline_keyboard;
    expect(rows.length).toBe(7); // 18 categories in 6 rows (3 per row) + 1 Close row
    expect(rows[0]?.length).toBe(3);
    expect(rows[0]?.[0]?.text).toBe("Admin");
    expect(rows[0]?.[0]?.callback_data).toBe("h:admin");
    expect(rows[0]?.[1]?.text).toBe("Antiflood");
    expect(rows[0]?.[1]?.callback_data).toBe("h:flood");
    expect(rows[0]?.[2]?.text).toBe("Approval");
    expect(rows[0]?.[2]?.callback_data).toBe("h:approval");
    expect(rows[6]?.[0]?.text).toBe("Close");
    expect(rows[6]?.[0]?.callback_data).toBe("h:close");
  });

  it("renders a deeply detailed category page with overview, commands, and extra notes", () => {
    const adminCat = CATEGORIES.find((c) => c.id === "admin")!;
    const rendered = catText(adminCat);
    expect(rendered).toContain("<b>Admin</b>");
    expect(rendered).toContain("Make it easy to promote and demote users with the admin module!");
    expect(rendered).toContain("<b>Admin commands:</b>");
    expect(rendered).toContain("- <code>/promote &lt;reply/username/mention/userid&gt;</code>: Promote a user.");
    expect(rendered).toContain("admin status is cached locally.");
  });

  it("escapes usage signatures containing < and > in HTML mode", () => {
    const bansCat = CATEGORIES.find((c) => c.id === "bans")!;
    const rendered = catText(bansCat);
    expect(rendered).toContain("<b>Bans</b>");
    expect(rendered).toContain("<code>/tban &lt;reply/username/mention/userid&gt; &lt;time&gt; [reason]</code>: Temporarily ban a user");
    expect(rendered).not.toContain("<code>/tban <reply");
  });

  it("handles /help command by replying with root intro and keyboard", async () => {
    const replies: any[] = [];
    const update = {
      update_id: 1,
      message: {
        message_id: 10,
        date: Math.floor(Date.now() / 1000),
        chat: { id: CHAT_ID, type: "supergroup" },
        from: USER,
        text: "/help",
        entities: [{ type: "bot_command", offset: 0, length: 5 }],
      },
    };

    const ctx = new Context(update as any, {} as any, BOT_USER);
    ctx.reply = vi.fn(async (text: string, extra?: any) => {
      replies.push({ text, extra });
      return {} as any;
    });

    await helpComposer.middleware()(ctx, async () => {});

    expect(replies.length).toBe(1);
    expect(replies[0].text).toBe(INTRO);
    expect(replies[0].extra.reply_markup).toBeDefined();
  });

  it("handles category callback query (h:admin) and edits message", async () => {
    let answered = false;
    let editedText = "";
    let editedMarkup: any = null;

    const update = {
      update_id: 2,
      callback_query: {
        id: "cb-1",
        from: USER,
        chat_instance: "123",
        data: "h:admin",
        message: {
          message_id: 50,
          date: Math.floor(Date.now() / 1000),
          chat: { id: CHAT_ID, type: "supergroup" },
          text: INTRO,
        },
      },
    };

    const ctx = new Context(update as any, {} as any, BOT_USER);
    ctx.answerCallbackQuery = vi.fn(async () => {
      answered = true;
    });
    ctx.editMessageText = vi.fn(async (text: string, extra?: any) => {
      editedText = text;
      editedMarkup = extra?.reply_markup;
      return {} as any;
    });

    await helpComposer.middleware()(ctx, async () => {});

    expect(answered).toBe(true);
    expect(editedText).toContain("<b>Admin</b>");
    expect(editedText).toContain("<code>/promote &lt;reply/username/mention/userid&gt;</code>: Promote a user.");
    expect(editedMarkup.inline_keyboard[0][0].text).toBe("Back");
    expect(editedMarkup.inline_keyboard[0][0].callback_data).toBe("h:root");
  });

  it("handles h:root callback query to return to root view", async () => {
    let answered = false;
    let editedText = "";

    const update = {
      update_id: 3,
      callback_query: {
        id: "cb-2",
        from: USER,
        chat_instance: "123",
        data: "h:root",
        message: {
          message_id: 50,
          date: Math.floor(Date.now() / 1000),
          chat: { id: CHAT_ID, type: "supergroup" },
          text: "Some category text",
        },
      },
    };

    const ctx = new Context(update as any, {} as any, BOT_USER);
    ctx.answerCallbackQuery = vi.fn(async () => {
      answered = true;
    });
    ctx.editMessageText = vi.fn(async (text: string) => {
      editedText = text;
      return {} as any;
    });

    await helpComposer.middleware()(ctx, async () => {});

    expect(answered).toBe(true);
    expect(editedText).toBe(INTRO);
  });

  it("handles h:close callback query to delete the help message", async () => {
    let answered = false;
    let deleted = false;

    const update = {
      update_id: 4,
      callback_query: {
        id: "cb-3",
        from: USER,
        chat_instance: "123",
        data: "h:close",
        message: {
          message_id: 50,
          date: Math.floor(Date.now() / 1000),
          chat: { id: CHAT_ID, type: "supergroup" },
          text: INTRO,
        },
      },
    };

    const ctx = new Context(update as any, {} as any, BOT_USER);
    ctx.answerCallbackQuery = vi.fn(async () => {
      answered = true;
    });
    ctx.deleteMessage = vi.fn(async () => {
      deleted = true;
      return true as any;
    });

    await helpComposer.middleware()(ctx, async () => {});

    expect(answered).toBe(true);
    expect(deleted).toBe(true);
  });

  it("ensures INTRO has valid HTML entities with no unsupported raw tags", () => {
    expect(INTRO).not.toContain("<target>");
    expect(INTRO).not.toContain("<time>");
  });
});
