/**
 * HyperGriot entry point.
 *
 * Supports both Long-Polling (development / default) and Webhook Server (production)
 * transports, plus a `/health` endpoint for load balancers.
 * See docs/TRD.md §12 (Phase P8 of the implementation plan).
 */

import { createServer } from "node:http";
import { webhookCallback, Bot } from "grammy";
import { createBot } from "./bot.js";
import { config } from "./config.js";
import { store, flushSync } from "./repository/store.js";

async function main(): Promise<void> {
  store.init();

  const bot = createBot();

  bot.catch(({ error }) => {
    console.error("[hypergriot] unhandled error:", error);
  });

  const isWebhook = Boolean(config.webhook.domain || config.webhook.port);
  let serverInst: any;

  function setupShutdown(botInstance: Bot, isWebhookMode: boolean, getServer?: () => any): void {
    let shuttingDown = false;
    const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`[hypergriot] ${signal} received, shutting down...`);
      try {
        if (!isWebhookMode) {
          botInstance.stop();
        }
        const server = getServer?.();
        if (server) {
          server.close();
        }
        flushSync();
        console.log("[hypergriot] shutdown complete.");
      } catch (err) {
        console.error("[hypergriot] error during shutdown:", err);
      }
      process.exit(0);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  }

  setupShutdown(bot, isWebhook, () => serverInst);

  if (isWebhook) {
    const port = config.webhook.port ?? 8080;
    const path = config.webhook.path.startsWith("/") ? config.webhook.path : `/${config.webhook.path}`;
    const secretToken = config.webhook.secret || undefined;
    const handleWebhook = webhookCallback(bot, "http", undefined, undefined, secretToken);

    serverInst = createServer((req, res) => {
      if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", uptime: process.uptime(), timestamp: Date.now() }));
        return;
      }

      if (req.url === path) {
        handleWebhook(req, res);
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    serverInst.listen(port, async () => {
      console.log(`[hypergriot] webhook server listening on port ${port} (path: ${path})`);
      if (config.webhook.domain) {
        const webhookUrl = `https://${config.webhook.domain}${path}`;
        try {
          await bot.api.setWebhook(webhookUrl, {
            allowed_updates: ["message", "edited_message", "chat_member", "callback_query"],
            secret_token: secretToken,
          });
          console.log(`[hypergriot] webhook set to ${webhookUrl}`);
        } catch (err) {
          console.error("[hypergriot] failed to set webhook:", err);
        }
      }
    });
  } else {
    await bot.start({
      allowed_updates: ["message", "edited_message", "chat_member", "callback_query"],
      onStart: (info) => {
        console.log(`HyperGriot started as @${info.username} (long-polling)`);
        if (config.debug) console.log(`Owners configured: ${config.owners.size}`);
      },
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
