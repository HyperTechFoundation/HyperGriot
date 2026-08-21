import { describe, expect, it } from "vitest";
import { isTimeToken, parseTime } from "../src/core/time.js";

describe("time parser", () => {
  it("recognises time tokens", () => {
    expect(isTimeToken("1m")).toBe(true);
    expect(isTimeToken("2h30m")).toBe(true);
    expect(isTimeToken("1d12h")).toBe(true);
    expect(isTimeToken("1w")).toBe(true);
    // a user ID is not a time token
    expect(isTimeToken("123456789")).toBe(false);
    expect(isTimeToken("ban")).toBe(false);
  });

  it("parses single units", () => {
    expect(parseTime("1m")?.ms).toBe(60_000);
    expect(parseTime("2h")?.ms).toBe(2 * 3_600_000);
    expect(parseTime("1d")?.ms).toBe(86_400_000);
    expect(parseTime("1w")?.ms).toBe(604_800_000);
  });

  it("parses combined units", () => {
    expect(parseTime("1h30m")?.ms).toBe(3_600_000 + 30 * 60_000);
    expect(parseTime("1d12h")?.ms).toBe(86_400_000 + 12 * 3_600_000);
  });

  it("produces human labels", () => {
    expect(parseTime("2h")?.label).toBe("2 hours");
    expect(parseTime("1h")?.label).toBe("1 hour");
    expect(parseTime("1d")?.label).toBe("1 day");
    expect(parseTime("3m")?.label).toBe("3 minutes");
  });

  it("rejects invalid tokens", () => {
    expect(parseTime("abc")).toBeNull();
    expect(parseTime("0m")).toBeNull(); // zero duration
  });
});
