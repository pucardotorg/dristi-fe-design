# Pucar Dristi 2.0

PUCAR's DRISTI platform for NI Act §138 (cheque-dishonour) cases through Indian courts —
shared national core, deployed per state.

This repository holds product orientation docs and the main app shell. UI look and feel
comes from [pucar-design-system](https://github.com/pucardotorg/dristi-design-system) —
fetched automatically into `vendor/` on install; this repo does not fork it.

## Get started

```bash
git clone <this-repo>
cd <this-repo>
npm install          # also fetches the design system into vendor/
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No sibling clones, no home-path config. `npm install` places the authoritative DS at
`vendor/pucar-design-system` (`pucardotorg` only) and refuses wrong-org trees.

## Branches

Work starts on `feature/<kebab-case>` from `origin/main` and returns by PR into `main`,
with the design owner's approval. Nothing lands on `main` except through a PR. The old
`design` branch is retired: do not branch from it or merge into it. The product repos
(`dristi-fe`, `dristi-fe-develop`) pull from this repo's `main`.

```bash
git checkout -b feature/<kebab-case> origin/main
```

## Layout

| Path | Role |
|---|---|
| [apps/dristi-app](apps/dristi-app) | Dristi App (main product) |
| [docs/](docs/README.md) | Product + design orientation |
| `vendor/pucar-design-system/` | Local DS (gitignored; created by `npm install`) |
| `.cursor/rules/`, `.claude/rules/` | Always-on guardrails (Cursor / Claude Code) |
| `.cursor/skills/`, `.claude/skills/` | On-demand skills |

## UI sync

```bash
npm run sync:ui -- button      # copy a primitive from vendor DS
npm run check:ui-sync          # primitives must match that DS
npm run check:spacing          # spacing stays on the ladder
```

## Docs

Start at **[docs/README.md](docs/README.md)**.

Domain detail source of truth: [DRISTI 2.0 — Domain Model](https://dristidomain.netlify.app/).

## Agent entrypoint

[CLAUDE.md](CLAUDE.md) — short shared entry for Cursor and Claude Code.
