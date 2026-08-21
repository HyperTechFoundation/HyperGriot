/**
 * HyperGriot entry point.
 *
 * Supports both Long-Polling (development / default) and Webhook Server (production)
 * transports, plus a `/health` endpoint for load balancers.
 * See docs/TRD.md §12 (Phase P8 of the implementation plan).
 */

import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { createBot } from "./bot.js";
import { config } from "./config.js";
import { store } from "./repository/store.js";

async function main(): Promise<void> {
  store.init();

  const bot = createBot();

  bot.catch(({ error }) => {
    console.error("[hypergriot] unhandled error:", error);
  });

  const isWebhook = Boolean(config.webhook.domain || config.webhook.port);

  if (isWebhook) {
    const port = config.webhook.port ?? 8080;
    const path = config.webhook.path.startsWith("/") ? config.webhook.path : `/${config.webhook.path}`;
    const handleWebhook = webhookCallback(bot, "http");

    const server = createServer((req, res) => {
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

    server.listen(port, async () => {
      console.log(`[hypergriot] webhook server listening on port ${port} (path: ${path})`);
      if (config.webhook.domain) {
        const webhookUrl = `https://${config.webhook.domain}${path}`;
        try {
          await bot.api.setWebhook(webhookUrl, {
            allowed_updates: ["message", "edited_message", "chat_member", "callback_query"],
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
