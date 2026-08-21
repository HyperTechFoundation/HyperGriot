# Quickstart

This guide takes you from a clean checkout to a running bot in a few minutes.

## Prerequisites

- Node.js 18 or newer (verify with `node -v`)
- npm (ships with Node)
- A bot token from [@BotFather](https://t.me/BotFather)

> [!IMPORTANT]
> You need a bot token before the bot will start. Create one by messaging @BotFather, running `/newbot`, choosing a name and username, and copying the token.

## Step 1: Install dependencies

```bash
npm install
```

## Step 2: Configure the environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

At minimum, set the following two variables:

```ini
BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
OWNERS=123456789
```

`OWNERS` is a comma-separated list of Telegram user IDs who bypass every permission check. To find your own user ID, message a bot like @userinfobot, or run HyperGriot's `/id` command in a chat.

> [!TIP]
> Leave `WEBHOOK_DOMAIN` unset to run in long-polling mode, which needs no public URL and is ideal for local testing.

See [Configuration](configuration.md) for the full variable reference.

## Step 3: Build and run

```bash
npm run build
npm start
```

For development with hot reload, use:

```bash
npm run dev
```

When the bot starts, it logs a line such as `HyperGriot started as @YourBot`.

## Step 4: Add the bot to a group and grant admin rights

1. Add the bot to your group.
2. Open the group, edit its settings, go to Administrators, and add the bot.
3. Grant it the required rights (see [Permissions](../concepts/permissions.md)).

> [!WARNING]
> Moderation commands will not work until the bot is granted the Ban Users right in the group. The bot will reply with a clear error explaining which right is missing.

## Step 5: Verify

In the group, run:

```
/ping
/id
/help
```

Then try a moderation command by replying to a test message:

```
/ban test reason
```

> [!CAUTION]
> Only test moderation commands in a group where you are willing to remove the target account, or use a dedicated test group with a second account you control.

Next: [Configuration](configuration.md).
