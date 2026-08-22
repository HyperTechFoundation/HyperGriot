# Contributing to HyperGriot

Thanks for your interest in contributing to HyperGriot. This document explains how to set up the
project, the standards we follow, and how to submit changes.

## Before you start

- Read the [documentation home](docs/README.md), the [Architecture overview](docs/architecture/overview.md),
  and the [Command resolution](docs/concepts/command-resolution.md) page. The command-resolution
  engine and the permission guard sequence are the backbone of every command; do not bypass them.
- For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development setup

Requirements: Node.js 18 or newer and npm.

```bash
git clone <repository-url>
cd hypergriot
npm install
cp .env.example .env   # set BOT_TOKEN and OWNERS for local testing
npm run dev            # hot-reload development run
```

## Common scripts

| Script | What it does |
| --- | --- |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Type-check without emitting (`tsc --noEmit`) |
| `npm test` | Run the vitest suite |
| `npm run dev` | Run with hot reload |
| `npm start` | Run the compiled bot (`node dist/index.js`) |

## Code standards

- **TypeScript strict mode.** No `any` in public surfaces. New code must pass `npm run typecheck`
  with zero errors.
- **Tests required.** Add or update tests for any behavior change. Every pull request must keep
  `npm test` green. Use golden tests for moderation message formats.
- **One engine, many commands.** Reuse `resolveTarget` and the guard sequence; never re-implement
  target parsing in a module.
- **Clean text.** All user-facing messages are plain, professional, and emoji-free. HTML-escape
  every user-controlled value before rendering.
- **Match the docs.** Behavior must match [docs/design](docs/reference/command-index.md) and the
  message formats defined in the guides.

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short imperative summary

Optional body explaining why.
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`. Scope is usually the
module or area (for example, `feat(moderation):`, `fix(core):`).

## Pull request checklist

Before opening a PR, confirm:

- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes, and you added tests for new behavior.
- [ ] The change matches the documented behavior and message formats.
- [ ] No secrets, `.env`, `data/`, or build output are committed.
- [ ] Commit messages follow Conventional Commits.
- [ ] Documentation is updated if behavior changed.

## Project layout

```
src/
  core/         command-resolution engine, guards, formatting, pipeline
  repository/   persistent per-group store
  modules/      moderation, onboarding, governance, protection, network, hygiene, help
  bot.ts        pipeline wiring and module registration
  index.ts      entry point
tests/          vitest specs
docs/           documentation tree
```

See [docs/architecture/overview.md](docs/architecture/overview.md) for the full breakdown.

## Reporting bugs and requesting features

Open a GitHub issue and include the HyperGriot version, Node version, deployment method, steps to
reproduce, and expected versus actual behavior. Redact tokens and user IDs from any logs.
