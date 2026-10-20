# Provakil mock (demo only)

A stand-in for Tata Capital's Provakil workspace (Legal Collections, Section 138 workflow),
built to show NPA cheque-bounce cases being filed on SARAS 2.0 through the court's Bulk
Filing API, or exported to Excel for upload. It is not Provakil's product and not part of
DRISTI. Tata Capital's name and registered office are public; the officers, borrowers and
cases are made up.

Run it together with SARAS 2.0 from the repository root:

```bash
npm run demo
```

That starts SARAS 2.0 on http://localhost:3000 and this app on http://localhost:3100,
already connected. See `BULK-FILING-DEMO.md` at the root for the walkthrough.

Settings, if you run it alone (`npm run dev -w @pucar/provakil-mock -- -p 3100`):

| Variable | Default | What it is |
|---|---|---|
| `DRISTI_URL` | `http://localhost:3000` | Where SARAS 2.0 runs |
| `DRISTI_API_KEY` | `dristi-demo-key` | The push API's bearer key |
| `PROVAKIL_URL` | `http://localhost:3100` | Where SARAS 2.0 fetches this app's documents from |

Pushes and advocate assignments are kept in `.data/` (git-ignored). The field mapping is
`src/lib/connector.ts`; the decisions are in `docs/design/features/bulk-filing.md`.
