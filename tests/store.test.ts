import { describe, expect, it, beforeEach } from "vitest";
import { store } from "../src/repository/store.js";

const CHAT_ID = 1001;

beforeEach(() => {
  store.resetForTests();
});

describe("store repository", () => {
  it("manages welcome and goodbye configuration", () => {
    expect(store.getWelcome(CHAT_ID).enabled).toBe(true);
    store.setWelcomeText(CHAT_ID, "Hello {mention}");
    expect(store.getWelcome(CHAT_ID).text).toBe("Hello {mention}");
    store.setWelcomeEnabled(CHAT_ID, false);
    expect(store.getWelcome(CHAT_ID).enabled).toBe(false);
    store.setCleanWelcome(CHAT_ID, true);
    expect(store.getWelcome(CHAT_ID).clean).toBe(true);
    store.setWelcomeMute(CHAT_ID, 3600000);
    expect(store.getWelcome(CHAT_ID).muteDurationMs).toBe(3600000);

    store.setGoodbyeText(CHAT_ID, "Bye {first}");
    store.setGoodbyeEnabled(CHAT_ID, true);
    expect(store.getGoodbye(CHAT_ID).text).toBe("Bye {first}");
    expect(store.getGoodbye(CHAT_ID).enabled).toBe(true);
  });

  it("manages rules", () => {
    expect(store.getRules(CHAT_ID).text).toContain("No rules");
    store.setRules(CHAT_ID, "1. Be polite");
    expect(store.getRules(CHAT_ID).text).toBe("1. Be polite");
    store.setRulesButton(CHAT_ID, { text: "Rules Link", url: "https://example.com" });
    expect(store.getRules(CHAT_ID).button?.text).toBe("Rules Link");
    store.clearRules(CHAT_ID);
    expect(store.getRules(CHAT_ID).text).toContain("No rules");
  });

  it("manages notes and buttons", () => {
    store.saveNote(CHAT_ID, {
      name: "faq",
      text: "Read our FAQ",
      buttons: [{ text: "FAQ", url: "https://example.com" }],
      private: false,
    });
    const note = store.getNote(CHAT_ID, "FAQ");
    expect(note).not.toBeNull();
    expect(note?.text).toBe("Read our FAQ");
    expect(note?.buttons?.[0]?.text).toBe("FAQ");
    expect(Object.keys(store.getNotes(CHAT_ID))).toHaveLength(1);

    expect(store.isNotesPrivate(CHAT_ID)).toBe(false);
    store.setNotesPrivate(CHAT_ID, true);
    expect(store.isNotesPrivate(CHAT_ID)).toBe(true);

    expect(store.deleteNote(CHAT_ID, "faq")).toBe(true);
    expect(store.getNote(CHAT_ID, "faq")).toBeNull();
  });

  it("manages locks", () => {
    expect(store.isLocked(CHAT_ID, "stickers")).toBe(false);
    store.lockType(CHAT_ID, "stickers");
    expect(store.isLocked(CHAT_ID, "stickers")).toBe(true);
    store.unlockType(CHAT_ID, "stickers");
    expect(store.isLocked(CHAT_ID, "stickers")).toBe(false);

    store.lockAll(CHAT_ID, ["messages", "stickers", "media"]);
    expect(store.getLocks(CHAT_ID).size).toBe(3);
    store.unlockAll(CHAT_ID);
    expect(store.getLocks(CHAT_ID).size).toBe(0);
  });

  it("manages filters", () => {
    store.addFilter(CHAT_ID, "hello", "World!");
    expect(store.getFilters(CHAT_ID)["hello"]).toBe("World!");
    expect(store.removeFilter(CHAT_ID, "hello")).toBe(true);
    expect(store.getFilters(CHAT_ID)["hello"]).toBeUndefined();
  });

  it("manages warnings", () => {
    expect(store.getWarnConfig(CHAT_ID).limit).toBe(3);
    store.setWarnLimit(CHAT_ID, 5);
    store.setWarnAction(CHAT_ID, "mute");
    expect(store.getWarnConfig(CHAT_ID).limit).toBe(5);
    expect(store.getWarnConfig(CHAT_ID).action).toBe("mute");

    const w1 = store.addWarning(CHAT_ID, 42, "Spamming");
    expect(w1.count).toBe(1);
    const w2 = store.addWarning(CHAT_ID, 42, "Swearing");
    expect(w2.count).toBe(2);
    expect(store.getWarnings(CHAT_ID, 42).reasons).toEqual(["Spamming", "Swearing"]);

    const rm = store.removeLatestWarning(CHAT_ID, 42);
    expect(rm.count).toBe(1);
    expect(rm.reasons).toEqual(["Spamming"]);

    store.resetWarnings(CHAT_ID, 42);
    expect(store.getWarnings(CHAT_ID, 42).count).toBe(0);
  });

  it("manages federations and bans", () => {
    const fed = store.createFed("fed1", "Crypto Fed", 999);
    expect(fed.name).toBe("Crypto Fed");
    expect(store.getFed("fed1")).not.toBeNull();

    store.addFedAdmin("fed1", 888);
    expect(store.getFed("fed1")?.admins).toContain(888);

    store.subscribeChatToFed(CHAT_ID, "fed1");
    expect(store.getChatFedId(CHAT_ID)).toBe("fed1");
    expect(store.getFed("fed1")?.chats).toContain(CHAT_ID);

    store.addFedBan("fed1", {
      userId: 555,
      reason: "Scammer",
      banner: 999,
      ts: Date.now(),
    });
    expect(store.getFedBan("fed1", 555)?.reason).toBe("Scammer");
    expect(store.getFedBans("fed1")).toHaveLength(1);

    store.removeFedBan("fed1", 555);
    expect(store.getFedBan("fed1", 555)).toBeNull();

    store.unsubscribeChatFromFed(CHAT_ID);
    expect(store.getChatFedId(CHAT_ID)).toBeNull();

    store.deleteFed("fed1");
    expect(store.getFed("fed1")).toBeNull();
  });
});
