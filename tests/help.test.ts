import { describe, expect, it, vi } from "vitest";
import { Context } from "grammy";
import {
  CATEGORIES,
  INTRO,
  LOCK_TYPE_DOCS,
  GREETING_VARS,
  rootKb,
  catKb,
  catCmdsKb,
  cmdKb,
  lockTypesKb,
  lockTypeKb,
  greetingsVarsKb,
  greetingVarKb,
  catOverviewText,
  catCmdsText,
  catExamplesText,
  catPermsText,
  catNotesText,
  cmdText,
  lockTypesText,
  lockTypeDocText,
  greetingsVarsText,
  greetingVarDocText,
  formattingDocText,
  findCategory,
  findCommandDoc,
  helpComposer,
} from "../src/modules/help/index.js";
import { ALL_LOCK_TYPES } from "../src/types/index.js";

const CHAT_ID = -100123456789;
const USER = { id: 10001, first_name: "TestUser", username: "testuser", is_bot: false };
const BOT_USER = { id: 99999, first_name: "HyperGriotBot", username: "hypergriotbot", is_bot: true };

describe("Miss Rose-style Interactive Documentation Help System", () => {
  it("defines 18 authentic categories matching actual implemented modules", () => {
    expect(CATEGORIES.length).toBe(18);
    for (const cat of CATEGORIES) {
      expect(cat.label.length).toBeGreaterThan(0);
      expect(cat.description.length).toBeGreaterThan(0);
      expect(cat.cmds.length).toBeGreaterThan(0);
      for (const cmd of cat.cmds) {
        expect(cmd.name).toMatch(/^\/[a-z0-9]+$/);
        expect(cmd.desc.length).toBeGreaterThan(0);
        expect(cmd.details?.length).toBeGreaterThan(0);
      }
    }
  });

  it("builds an authentic 3-column inline category grid with NO Close button", () => {
    const kb = rootKb();
    const rows = kb.inline_keyboard;
    expect(rows.length).toBe(6); // 18 categories in 6 rows of 3
    for (const row of rows) {
      expect(row.length).toBe(3);
    }
    // Verify NO close button exists
    const allButtons = rows.flat();
    const closeBtn = allButtons.find((b) => b.text.toLowerCase() === "close" || b.callback_data === "h:close");
    expect(closeBtn).toBeUndefined();
  });

  it("renders structured module overview page without dumping entire command list", () => {
    const locksCat = CATEGORIES.find((c) => c.id === "locks")!;
    const rendered = catOverviewText(locksCat);
    expect(rendered).toContain("<b>Locks</b>");
    expect(rendered).toContain("control which types of messages can be sent");
    expect(rendered).toContain("<b>Permissions:</b>");
    expect(rendered).toContain("• User: Group Administrator");
    expect(rendered).toContain("• Bot: Can Delete Messages");
    expect(rendered).toContain("Select a section below");
  });

  it("renders dedicated category commands page with command summaries", () => {
    const locksCat = CATEGORIES.find((c) => c.id === "locks")!;
    const rendered = catCmdsText(locksCat);
    expect(rendered).toContain("<b>Locks Commands</b>");
    expect(rendered).toContain("<code>/lock &lt;type&gt;</code>");
    expect(rendered).toContain("<code>/unlockall</code>");
  });

  it("builds clickable inline keyboard for each command in category commands view", () => {
    const locksCat = CATEGORIES.find((c) => c.id === "locks")!;
    const kb = catCmdsKb(locksCat);
    const rows = kb.inline_keyboard;
    const buttonTexts = rows.flat().map((b) => b.text);
    expect(buttonTexts).toContain("/lock");
    expect(buttonTexts).toContain("/unlock");
    expect(buttonTexts).toContain("/locks");
    expect(buttonTexts).toContain("/locktypes");
    expect(buttonTexts).toContain("/lockall");
    expect(buttonTexts).toContain("/unlockall");
    expect(buttonTexts).toContain("Back (Locks)");
    expect(buttonTexts).toContain("All Categories");
  });

  it("renders comprehensive command drilldown with syntax, arguments, permissions, examples, and limitations", () => {
    const locksCat = CATEGORIES.find((c) => c.id === "locks")!;
    const lockallCmd = locksCat.cmds.find((c) => c.name === "/lockall")!;
    const rendered = cmdText(locksCat, lockallCmd);

    expect(rendered).toContain("<b>/lockall</b>");
    expect(rendered).toContain("<b>Syntax:</b>");
    expect(rendered).toContain("<code>/lockall</code>");
    expect(rendered).toContain("<b>Arguments:</b>");
    expect(rendered).toContain("<b>Required User Permissions:</b>");
    expect(rendered).toContain("• Group Administrator");
    expect(rendered).toContain("<b>Required Bot Permissions:</b>");
    expect(rendered).toContain("• Can Delete Messages");
    expect(rendered).toContain("<b>Examples:</b>");
    expect(rendered).toContain("<b>Behaviour:</b>");
    expect(rendered).toContain("All 16 supported locks are enabled");
    expect(rendered).toContain("<b>Side Effects / Limitations:</b>");
    expect(rendered).toContain("Administrators and approved users remain exempt");
    expect(rendered).toContain("<b>Related Commands:</b>");
  });

  it("builds interactive 16 lock types inline keyboard with proper back navigation", () => {
    const kb = lockTypesKb();
    const rows = kb.inline_keyboard;
    const buttonTexts = rows.flat().map((b) => b.text);

    expect(ALL_LOCK_TYPES.length).toBe(16);
    for (const t of ALL_LOCK_TYPES) {
      expect(buttonTexts).toContain(t);
    }
    expect(buttonTexts).toContain("Locks Module");
    expect(buttonTexts).toContain("All Categories");
  });

  it("renders dedicated lock type drilldown for each implemented lock type", () => {
    for (const t of ALL_LOCK_TYPES) {
      const doc = LOCK_TYPE_DOCS[t];
      expect(doc).toBeDefined();
      const rendered = lockTypeDocText(doc);
      expect(rendered).toContain(`<b>Lock Type:</b> <code>${t}</code>`);
      expect(rendered).toContain(`<code>/lock ${t}</code>`);
      expect(rendered).toContain(`<code>/unlock ${t}</code>`);
      expect(rendered).toContain("<b>What it affects:</b>");
      expect(rendered).toContain("<b>What it does NOT affect:</b>");
      expect(rendered).toContain("Administrators and approved users are completely exempt");
    }
  });

  it("builds interactive greetings variables inline keyboard", () => {
    const kb = greetingsVarsKb();
    const rows = kb.inline_keyboard;
    const buttonTexts = rows.flat().map((b) => b.text);

    const expectedVars = ["first", "last", "fullname", "username", "mention", "id", "count", "chatname"];
    for (const v of expectedVars) {
      expect(buttonTexts).toContain(`{${v}}`);
    }
    expect(buttonTexts).toContain("Greetings Module");
  });

  it("renders dedicated greeting variable drilldown with sample output", () => {
    const mentionDoc = GREETING_VARS["mention"];
    const rendered = greetingVarDocText(mentionDoc);
    expect(rendered).toContain("<b>Variable:</b> <code>{mention}</code>");
    expect(rendered).toContain("<a href=");
    expect(rendered).toContain("<b>Sample Output:</b>");
  });

  it("handles /help with no args by replying with root INTRO and category grid", async () => {
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
    expect(replies[0].extra.reply_markup.inline_keyboard.length).toBe(6);
  });

  it("handles /help <category> by opening the structured category overview", async () => {
    const replies: any[] = [];
    const update = {
      update_id: 11,
      message: {
        message_id: 12,
        date: Math.floor(Date.now() / 1000),
        chat: { id: CHAT_ID, type: "supergroup" },
        from: USER,
        text: "/help locks",
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
    expect(replies[0].text).toContain("<b>Locks</b>");
    expect(replies[0].extra.reply_markup.inline_keyboard[0][0].text).toBe("Commands");
    expect(replies[0].extra.reply_markup.inline_keyboard[1][0].text).toBe("Lock Types");
  });

  it("handles /help <command> by opening the command drilldown directly", async () => {
    const replies: any[] = [];
    const update = {
      update_id: 21,
      message: {
        message_id: 22,
        date: Math.floor(Date.now() / 1000),
        chat: { id: CHAT_ID, type: "supergroup" },
        from: USER,
        text: "/help lockall",
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
    expect(replies[0].text).toContain("<b>/lockall</b>");
    expect(replies[0].text).toContain("<b>Syntax:</b>");
  });

  it("handles normalized command queries with slashes and exclamation marks (/help /tban, /help !setwelcome)", async () => {
    const testQueries = ["/tban", "!setwelcome", "fban"];
    for (const q of testQueries) {
      const replies: any[] = [];
      const update = {
        update_id: 31,
        message: {
          message_id: 32,
          date: Math.floor(Date.now() / 1000),
          chat: { id: CHAT_ID, type: "supergroup" },
          from: USER,
          text: `/help ${q}`,
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
      const cleanCmd = q.replace(/^[\/!]/, "");
      expect(replies[0].text).toContain(`/${cleanCmd}`);
    }
  });

  it("handles unknown query with friendly fallback and Browse Categories button", async () => {
    const replies: any[] = [];
    const update = {
      update_id: 41,
      message: {
        message_id: 42,
        date: Math.floor(Date.now() / 1000),
        chat: { id: CHAT_ID, type: "supergroup" },
        from: USER,
        text: "/help nonexistent_feature_123",
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
    expect(replies[0].text).toContain('No help entry found for "<code>nonexistent_feature_123</code>".');
    expect(replies[0].extra.reply_markup.inline_keyboard[0][0].text).toBe("Browse Categories");
  });

  it("handles full interactive navigation flow: category -> locktypes -> sticker -> back", async () => {
    let answered = false;
    let editedText = "";
    let editedMarkup: any = null;

    // Step 1: Open Lock Types menu
    const update1 = {
      update_id: 101,
      callback_query: {
        id: "cb-101",
        from: USER,
        chat_instance: "123",
        data: "h:locktypes",
        message: { message_id: 50, chat: { id: CHAT_ID, type: "supergroup" } },
      },
    };

    const ctx1 = new Context(update1 as any, {} as any, BOT_USER);
    ctx1.answerCallbackQuery = vi.fn(async () => { answered = true; });
    ctx1.editMessageText = vi.fn(async (text: string, extra?: any) => {
      editedText = text;
      editedMarkup = extra?.reply_markup;
      return {} as any;
    });

    await helpComposer.middleware()(ctx1, async () => {});
    expect(editedText).toContain("<b>Lock Types</b>");
    expect(editedMarkup.inline_keyboard.flat().map((b: any) => b.text)).toContain("stickers");

    // Step 2: Open Sticker Lock Type drilldown
    const update2 = {
      update_id: 102,
      callback_query: {
        id: "cb-102",
        from: USER,
        chat_instance: "123",
        data: "h:locktype:stickers",
        message: { message_id: 50, chat: { id: CHAT_ID, type: "supergroup" } },
      },
    };

    const ctx2 = new Context(update2 as any, {} as any, BOT_USER);
    ctx2.answerCallbackQuery = vi.fn(async () => {});
    ctx2.editMessageText = vi.fn(async (text: string, extra?: any) => {
      editedText = text;
      editedMarkup = extra?.reply_markup;
      return {} as any;
    });

    await helpComposer.middleware()(ctx2, async () => {});
    expect(editedText).toContain("<b>Lock Type:</b> <code>stickers</code>");
    expect(editedMarkup.inline_keyboard[0][0].text).toBe("Lock Types");
    expect(editedMarkup.inline_keyboard[0][0].callback_data).toBe("h:locktypes");

    // Step 3: Back to Lock Types
    await helpComposer.middleware()(ctx1, async () => {});
    expect(editedText).toContain("<b>Lock Types</b>");
  });

  it("handles interactive greetings variables navigation flow", async () => {
    let editedText = "";
    let editedMarkup: any = null;

    // Step 1: Open Variables menu
    const update1 = {
      update_id: 201,
      callback_query: {
        id: "cb-201",
        from: USER,
        chat_instance: "123",
        data: "h:vars:greetings",
        message: { message_id: 50, chat: { id: CHAT_ID, type: "supergroup" } },
      },
    };

    const ctx1 = new Context(update1 as any, {} as any, BOT_USER);
    ctx1.answerCallbackQuery = vi.fn(async () => {});
    ctx1.editMessageText = vi.fn(async (text: string, extra?: any) => {
      editedText = text;
      editedMarkup = extra?.reply_markup;
      return {} as any;
    });

    await helpComposer.middleware()(ctx1, async () => {});
    expect(editedText).toContain("<b>Greetings Variables</b>");

    // Step 2: Open {mention} variable drilldown
    const update2 = {
      update_id: 202,
      callback_query: {
        id: "cb-202",
        from: USER,
        chat_instance: "123",
        data: "h:var:mention",
        message: { message_id: 50, chat: { id: CHAT_ID, type: "supergroup" } },
      },
    };

    const ctx2 = new Context(update2 as any, {} as any, BOT_USER);
    ctx2.answerCallbackQuery = vi.fn(async () => {});
    ctx2.editMessageText = vi.fn(async (text: string, extra?: any) => {
      editedText = text;
      editedMarkup = extra?.reply_markup;
      return {} as any;
    });

    await helpComposer.middleware()(ctx2, async () => {});
    expect(editedText).toContain("<b>Variable:</b> <code>{mention}</code>");
    expect(editedMarkup.inline_keyboard[0][0].text).toBe("Variables");
    expect(editedMarkup.inline_keyboard[0][0].callback_data).toBe("h:vars:greetings");
  });

  it("handles dedicated sub-sections: Examples, Permissions, Notes, Formatting", async () => {
    let editedText = "";

    const testSections = [
      { data: "h:cat_ex:bans", expectText: "<b>Bans — Examples</b>" },
      { data: "h:cat_perms:admin", expectText: "<b>Admin — Permissions</b>" },
      { data: "h:cat_notes:flood", expectText: "<b>Antiflood — Behaviour & Notes</b>" },
      { data: "h:formatting:greetings", expectText: "<b>Welcome Formatting & Buttons</b>" },
      { data: "h:floodmodes", expectText: "<b>Antiflood Modes</b>" },
      { data: "h:warnactions", expectText: "<b>Warning Punishment Actions</b>" },
      { data: "h:fedroles", expectText: "<b>Federation Roles & Permissions</b>" },
    ];

    for (const s of testSections) {
      const update = {
        update_id: 300,
        callback_query: {
          id: "cb-300",
          from: USER,
          chat_instance: "123",
          data: s.data,
          message: { message_id: 50, chat: { id: CHAT_ID, type: "supergroup" } },
        },
      };

      const ctx = new Context(update as any, {} as any, BOT_USER);
      ctx.answerCallbackQuery = vi.fn(async () => {});
      ctx.editMessageText = vi.fn(async (text: string) => {
        editedText = text;
        return {} as any;
      });

      await helpComposer.middleware()(ctx, async () => {});
      expect(editedText).toContain(s.expectText);
    }
  });

  it("verifies command presence and no false claims across all categories", () => {
    const allCommands = new Set<string>();
    CATEGORIES.forEach((cat) => {
      cat.cmds.forEach((cmd) => {
        allCommands.add(cmd.name);
      });
    });

    expect(allCommands.has("/cleargoodbye")).toBe(true);
    expect(allCommands.has("/setrulesbutton")).toBe(true);
    expect(allCommands.has("/fedowner")).toBe(true);
    expect(CATEGORIES.length).toBe(18);

    const reportsCat = CATEGORIES.find((c) => c.id === "reports");
    expect(reportsCat?.extra).not.toContain("@admin");

    const filtersCat = CATEGORIES.find((c) => c.id === "filters");
    expect(filtersCat?.extra).not.toContain("quotes");
  });
});
