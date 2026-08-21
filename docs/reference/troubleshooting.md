# Troubleshooting

Common problems and their fixes. If something is not covered here, check the [Release notes](../project/release-notes.md) for recent changes that may affect behavior.

## @username mentions do not resolve

**Symptom:** `/ban @username` (and any command using an @mention) fails with a message that the user could not be resolved, while replies and numeric IDs work.

**Cause:** The Telegram Bot API has no method to look up a user by username. HyperGriot can only act on an @username if it has previously observed that user and cached the mapping.

> [!IMPORTANT]
> `getChat("@username")` resolves only public channels and groups, never individual users. The only API that can resolve any username is MTProto (a userbot), which HyperGriot deliberately does not use.

**Fix:** Use a reply or a numeric user ID instead. The cache persists to disk and accumulates every user the bot observes, so the more active the bot is in your groups, the more usernames resolve over time.

## 409 Conflict: terminated by other getUpdates

**Symptom:** Updates are dropped or split, and Telegram returns a 409 error.

**Cause:** More than one process is long-polling the same bot token. Long polling supports exactly one instance.

> [!WARNING]
> Do not run two long-polling instances of the same bot. To scale past one process, switch to webhooks. See [Deployment](../deployment/deployment.md).

## Webhook receives no updates

**Symptom:** The bot runs, but Telegram never delivers updates to the webhook.

**Check, in order:**

1. Run `getWebhookInfo` and read `last_error_message`.
2. Confirm the public URL uses a valid TLS certificate (self-signed certificates are rejected unless uploaded).
3. Confirm the public port is one of 443, 80, 88, or 8443 (Telegram only accepts these for webhooks).
4. Confirm the reverse proxy forwards the configured path to the local webhook port.
5. Confirm `WEBHOOK_SECRET` matches on both sides if you set one.

## Moderation commands fail with a missing-right error

**Symptom:** The bot replies that it needs a specific right (for example, "I need the Ban Users right to do this").

**Fix:** Grant the bot the corresponding admin right in the group. See the [Permissions](../concepts/permissions.md) table for which right powers which command.

> [!NOTE]
> The bot reports the exact right it needs, so this error is always actionable.

## Short durations seem permanent

**Symptom:** A short temp ban or mute (for example, `10s`) appears to last forever.

**Cause:** Telegram treats an `until_date` within 30 seconds of the current time as permanent. HyperGriot enforces a 30-second minimum on all durations, so very short tokens are clamped, not treated as permanent.

> [!TIP]
> Use durations of at least one minute (`1m`) for predictable temp actions.

## Federation ban does not reach a linked group

**Symptom:** `/fban` succeeds for the caller, but the user remains in one of the linked groups.

**Cause:** Either the bot lacks the Ban Users right in that group, or a fan-out API call was throttled (HTTP 429).

**Fix:** Ensure the bot is an admin with Ban Users rights in every linked group. Fan-out retries with backoff, but very large federations may need a shared queue for reliability.

## HTTP 429 Too Many Requests

**Symptom:** Telegram throttles the bot, especially during federation fan-out or large purges.

**Fix:** HyperGriot already batches where possible (bulk deletion via `deleteMessages`, batched federation removals) and respects `Retry-After`. For high-traffic deployments, run multiple webhook workers behind a load balancer.

## Settings disappear after restart

**Symptom:** Group configuration (welcome, rules, notes, locks) is lost when the process restarts.

**Cause:** `DATA_DIR` is not on a persistent volume.

> [!CAUTION]
> In any deployment where the process or container may be recreated, mount `DATA_DIR` on a persistent volume. Otherwise all per-group configuration is lost.

## Rules or notes show raw tags instead of formatting

This should not happen in v0.5.0-beta and later. Rules and notes are stored as raw HTML and rendered with full HTML parse mode, so formatting tags work and are not double-escaped. If you see raw tags, confirm you are running v0.5.0-beta or later.

Next: [Release notes](../project/release-notes.md).
