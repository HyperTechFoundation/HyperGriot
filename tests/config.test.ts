import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("config parsing", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("handles empty OWNERS gracefully", async () => {
    process.env.OWNERS = undefined;
    const { config, isOwner } = await import("../src/config.js");
    
    expect(config.owners.size).toBe(0);
    expect(isOwner(123456789)).toBe(false);
  });

  it("parses CSV OWNERS correctly", async () => {
    process.env.OWNERS = "123456789, 987654321, invalid, ";
    const { config, isOwner } = await import("../src/config.js");
    
    expect(config.owners.size).toBe(2);
    expect(config.owners.has(123456789)).toBe(true);
    expect(config.owners.has(987654321)).toBe(true);
    expect(isOwner(123456789)).toBe(true);
    expect(isOwner(111111111)).toBe(false);
  });
});
