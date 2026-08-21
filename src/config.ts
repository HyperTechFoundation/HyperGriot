import { config as loadEnv } from "dotenv";

// Load variables from .env into process.env (no-op if .env is absent).
loadEnv();

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.length === 0) {
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      return "000000000:TEST_MOCK_BOT_TOKEN";
    }
    throw new Error(
      `Missing required environment variable: ${key}. Copy .env.example to .env and configure it.`,
    );
  }
  return value;
}

function csv(value: string | undefined): number[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

export const config = {
  botToken: requiredEnv("BOT_TOKEN"),
  owners: new Set(csv(process.env.OWNERS)),
  dataDir: process.env.DATA_DIR ?? "./data",
  debug: process.env.DEBUG === "1",
  webhook: {
    domain: process.env.WEBHOOK_DOMAIN ?? "",
    port: process.env.WEBHOOK_PORT ? Number(process.env.WEBHOOK_PORT) : undefined,
    path: process.env.WEBHOOK_PATH ?? "/hypergriot",
  },
} as const;

/** True when this Telegram user ID is a configured global owner. */
export function isOwner(userId: number): boolean {
  return config.owners.has(userId);
}
