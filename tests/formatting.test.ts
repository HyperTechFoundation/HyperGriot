import { describe, expect, it } from "vitest";
import {
  buildBanCard,
  buildKickCard,
  buildMuteCard,
  escapeHtml,
} from "../src/core/formatting.js";
import type { UserInfo } from "../src/types/index.js";

const user: UserInfo = { id: 123456789, firstName: "Carol", username: "carol" };
const admin: UserInfo = { id: 1, firstName: "Admin" };

describe("escapeHtml", () => {
  it("escapes dangerous characters", () => {
    expect(escapeHtml(`<b>"x"</b>`)).toBe("&lt;b&gt;&quot;x&quot;&lt;/b&gt;");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });
});

describe("moderation cards", () => {
  it("builds a permanent ban card", () => {
    const card = buildBanCard({ user, admin, reason: "spam" });
    expect(card).toContain('<a href="tg://user?id=123456789">Carol</a> got banned from the group.');
    expect(card).toContain("User ID: 123456789");
    expect(card).toContain("Username: @carol");
    expect(card).toContain("Reason: spam");
    expect(card).toContain("Banned By: Admin");
  });

  it("shows a temp ban header with duration", () => {
    const card = buildBanCard({ user, admin, reason: "raid", durationLabel: "2 hours" });
    expect(card).toContain("got banned for 2 hours.");
    expect(card).toContain("Reason: raid");
  });

  it("defaults an empty reason to None", () => {
    const card = buildBanCard({ user, admin, reason: "" });
    expect(card).toContain("Reason: None");
  });

  it("omits username line when absent", () => {
    const card = buildMuteCard({ user: { id: 5, firstName: "NoHandle" }, admin, reason: "" });
    expect(card).not.toContain("Username:");
    expect(card).toContain("got muted.");
  });

  it("builds a kick card", () => {
    const card = buildKickCard({ user, admin, reason: "off-topic" });
    expect(card).toContain("got kicked!");
    expect(card).toContain("Kicked By: Admin");
  });

  it("escapes user-controlled reason text", () => {
    const card = buildBanCard({ user, admin, reason: "<script>alert(1)</script>" });
    expect(card).toContain("Reason: &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(card).not.toContain("<script>");
  });
});
