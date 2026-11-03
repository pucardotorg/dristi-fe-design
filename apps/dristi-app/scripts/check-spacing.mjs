#!/usr/bin/env node
/**
 * Enforce the Pucar spacing ladder in product composition.
 *
 * The ladder is `0.5 · 1 · 1.5 · 2 · 2.5 · 3 · 4 · 6 · 8 · 12 · 16`. Anything else —
 * `p-5`, `gap-10`, `mt-7` — is valid Tailwind and therefore invisible to eslint, and
 * `check-tokens` only catches arbitrary raw units (`p-[13px]`), never an off-ladder
 * rung. So the one rule stated in CLAUDE.md, in the always-on DS rule, and again in the
 * ui-designer role was the one rule nothing checked. It drifted, as ungated rules do.
 *
 * Synced DS primitives are excluded for the same reason `check-typography` excludes
 * them: control chrome legitimately uses its own internal steps (`px-5` in button,
 * `gap-5` in field), those values arrive from the DS, and editing them locally would be
 * destroyed by the next `sync:ui` anyway.
 *
 * ## Baseline
 *
 * This gate was introduced against a codebase that already had ~136 off-ladder values
 * spread across areas owned by different people. Failing all of them on day one would
 * have meant one enormous diff touching everybody's work at once — so existing
 * violations are recorded in `spacing-baseline.json` and tolerated.
 *
 * The gate therefore answers one question: *did this change add a new one?* Existing
 * entries get cleaned up per area, by whoever owns that area, on their own schedule.
 * Fixing one is always safe — the gate reports a shrunken baseline as good news and
 * tells you to re-run with `--update`.
 *
 *   node scripts/check-spacing.mjs             # check
 *   node scripts/check-spacing.mjs --update    # re-record the baseline
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { isNotDristi } from "./not-dristi.mjs";
import { APP_ROOT } from "./resolve-ds.mjs";

const SRC = join(APP_ROOT, "src");
const UI_PRIMITIVES = join(SRC, "components", "ui") + sep;
const BASELINE = join(APP_ROOT, "scripts", "spacing-baseline.json");
const ALLOW = "ds-spacing-allow";
const UPDATE = process.argv.includes("--update");

/** CLAUDE.md: `0.5 · 1 · 1.5 · 2 · 2.5 · 3 · 4 · 6 · 8 · 12 · 16`, plus Tailwind's own
 *  zero/hairline/auto, which are not rungs and never were the problem. */
const LADDER = new Set([
  "0", "px", "auto",
  "0.5", "1", "1.5", "2", "2.5", "3", "4", "6", "8", "12", "16",
]);

/** Padding, margin, gap and space only. Sizing (`w-`, `h-`, `size-`) is a different
 *  rule with different exceptions — `h-10` controls are governed by the Laws, not here.
 *  Longer prefixes come first so `gap-x` is not eaten by `gap`. */
const UTILITY =
  /(?<![\w-])-?(gap-x|gap-y|space-x|space-y|px|py|pt|pb|pl|pr|ps|pe|mx|my|mt|mb|ml|mr|ms|me|gap|p|m)-(\d+(?:\.\d+)?|auto|px)(?![\w-])/g;

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return isNotDristi(full) ? [] : sourceFiles(full);
    return entry.endsWith(".tsx") && !full.startsWith(UI_PRIMITIVES) ? [full] : [];
  });
}

/** file → sorted list of the off-ladder utilities it contains, e.g. ["gap-10", "p-5"].
 *  Deliberately line-number free: a baseline keyed by line goes stale the moment
 *  anyone adds an import, and a stale baseline silently stops catching things. */
function collect() {
  const byFile = new Map();
  for (const file of sourceFiles(SRC)) {
    const lines = readFileSync(file, "utf8").split("\n");
    const hits = [];
    lines.forEach((line, index) => {
      if (line.includes(ALLOW) || lines[index - 1]?.includes(ALLOW)) return;
      for (const [match, , value] of line.matchAll(UTILITY)) {
        if (LADDER.has(value)) continue;
        hits.push({ utility: match, line: index + 1 });
      }
    });
    if (hits.length) byFile.set(relative(APP_ROOT, file), hits);
  }
  return byFile;
}

const current = collect();

if (UPDATE) {
  const baseline = {};
  for (const [file, hits] of [...current].sort(([a], [b]) => a.localeCompare(b))) {
    baseline[file] = hits.map((hit) => hit.utility).sort();
  }
  const total = Object.values(baseline).reduce((n, list) => n + list.length, 0);
  writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(
    `Spacing baseline updated: ${total} tolerated in ${Object.keys(baseline).length} files.`
  );
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
} catch {
  console.error(
    `No spacing baseline at ${relative(APP_ROOT, BASELINE)}.\n` +
      "Create one with: npm run check:spacing -- --update"
  );
  process.exit(1);
}

/** Compare as multisets so swapping `p-5` for `gap-10` in a baselined file is still
 *  caught — the count is unchanged but the violation is new. */
const added = [];
const cleaned = [];

for (const [file, hits] of current) {
  const tolerated = [...(baseline[file] ?? [])];
  for (const hit of hits) {
    const at = tolerated.indexOf(hit.utility);
    if (at === -1) added.push({ file, ...hit });
    else tolerated.splice(at, 1);
  }
  if (tolerated.length) cleaned.push({ file, count: tolerated.length });
}
for (const file of Object.keys(baseline)) {
  if (!current.has(file)) cleaned.push({ file, count: baseline[file].length });
}

if (added.length) {
  console.error("Spacing check failed — new off-ladder values:\n");
  for (const { file, line, utility } of added) {
    console.error(`${file}:${line}  off the spacing ladder: ${utility}`);
  }
  console.error(
    "\nThe ladder is 0.5 · 1 · 1.5 · 2 · 2.5 · 3 · 4 · 6 · 8 · 12 · 16 — snap to the " +
      "nearest rung (controls h-10/rounded-lg, containers p-6/rounded-xl).\n" +
      `Keep ${ALLOW} for reviewed exceptions only.`
  );
  process.exit(1);
}

const tolerated = Object.values(baseline).reduce((n, list) => n + list.length, 0);

if (cleaned.length) {
  const fixed = cleaned.reduce((n, entry) => n + entry.count, 0);
  console.log(
    `Spacing check passed — and ${fixed} baselined value(s) are gone. ` +
      "Lock that in: npm run check:spacing -- --update"
  );
} else {
  console.log(`Spacing check passed (${tolerated} pre-existing values baselined).`);
}
