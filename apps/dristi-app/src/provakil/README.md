# Provakil mock (demo only)

A stand-in for Tata Capital's Provakil workspace (Legal Collections, Section 138 workflow),
built to show NPA cheque-bounce cases being filed on SARAS 2.0 through the court's Bulk
Filing API, or exported to Excel for upload. It is not Provakil's product and not part of
DRISTI. Tata Capital's name and registered office are public; the officers, borrowers and
cases are made up.

It is served by this app at `/provakil` (routes in `src/app/provakil/`), with its own look
and none of DRISTI's chrome, so one port and one deployment hold both sides of the demo.

| File | What it is |
|---|---|
| `lib/workspace.ts` | Provakil's back end, in the browser: its matters, the legal manager's advocate assignments and what it has sent, kept in localStorage |
| `lib/saras-link.ts` | Its only way into SARAS 2.0: Bulk Filing API v1. HTTP where the court's server can write; the same v1 handlers run in the browser where it cannot (a hosted deployment) |
| `lib/connector.ts` | The field mapping, which the connector settings page also shows |
| `src/app/provakil/api/documents/` | Each matter's documents, which SARAS 2.0 fetches during a push |
| `src/app/provakil/api/export/` | The Excel exports |

The design-system gates skip this folder (`scripts/not-dristi.mjs`). The decisions are in
`docs/design/features/bulk-filing.md`.
