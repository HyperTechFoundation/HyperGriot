# Security policy

HyperGriot is a Telegram group-management bot that handles permissions and moderation actions,
so security is taken seriously. This document explains how to report a vulnerability and what
to expect.

## Reporting a vulnerability

> [!IMPORTANT]
> Please do not open a public GitHub issue for a security problem. Public issues can be exploited
> before a fix is available.

Report vulnerabilities through one of these private channels, in order of preference:

1. **GitHub Private Vulnerability Reporting** - on the repository, open the **Security** tab and
   choose **Report a vulnerability**. This keeps the report private to maintainers.
2. **Email** - send details to `security@example.com` (replace with your monitored address).

Include the following so we can reproduce and fix the issue quickly:

- HyperGriot version (for example, `0.5.0-beta`).
- Node.js version and deployment method (long polling or webhook).
- A clear description of the issue and its impact.
- Steps to reproduce, with the minimal command or payload that triggers it.
- Any relevant logs (with tokens, user IDs, and secrets redacted).

## Scope

In scope:

- Permission bypass (a non-admin running admin commands, or the bot acting on the wrong user).
- Input injection through user-controlled text (names, reasons, notes, rules).
- Secrets exposure (bot token, webhook secret, environment variables).
- Federation or fan-out abuse.

Out of scope:

- Issues in Telegram itself or the Telegram Bot API.
- Self-hosted misconfiguration (for example, an exposed port or a leaked `.env` you committed).
- Spam or abuse of a group the bot moderates.

## Response expectations

- We acknowledge reports within 72 hours.
- We aim to provide a fix or mitigation for confirmed issues in a timely manner and to credit
  reporters in the release notes (unless you prefer to remain anonymous).

## Hardening you can apply now

- Never commit `.env`; it is gitignored. Revoke and rotate the bot token immediately if it leaks
  (BotFather, `/revoke`).
- Set a `WEBHOOK_SECRET` and an unguessable `WEBHOOK_PATH` when running webhooks.
- Run the bot as a non-root user and keep `DATA_DIR` on a persistent, backed-up volume.
- Grant the bot only the admin rights it needs in each group.

See the [Deployment guide](docs/deployment/deployment.md) for the full operations runbook.
