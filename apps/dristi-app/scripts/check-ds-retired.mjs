#!/usr/bin/env node
/**
 * check:ds-retired — patterns the design system now owns, kept from coming back.
 *
 * Each rule below was a product-side patch over a DS primitive or a private copy of a DS
 * piece. The DS bump to 2a3ce00 made the primitive do it itself, and the copies were
 * removed after the screens measured identical. A copy that agrees with the primitive
 * today is still a fork: the next DS change lands in one place and not the other, and no
 * other gate can see the drift. So this gate flags the copy, not its look.
 *
 * Escape hatch: `ds-retired-allow` on the offending line or the one above it, for a
 * reviewed exception.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { isNotDristi } from "./not-dristi.mjs";
import { APP_ROOT } from "./resolve-ds.mjs";

const SRC = join(APP_ROOT, "src");
const UI_PRIMITIVES = join(SRC, "components", "ui") + sep;
const ALLOW = "ds-retired-allow";

const RULES = [
  {
    re: /\bBADGE_WITH_MARK\b/,
    rule: "BADGE_WITH_MARK is retired",
    fix: "Put the StatusMark inside the Badge with no class: Badge sets its own inset for a mark.",
  },
  {
    re: /\bAppToaster\b|components\/shell\/app-toaster/,
    rule: "AppToaster is retired",
    fix: "Mount FeedbackToaster from @/components/ui/feedback-toaster.",
  },
  {
    re: /@\/components\/feedback\/(mark|outcome|inline|confirm|notify)\b/,
    rule: "the app's own feedback files are gone",
    fix: "Import from @/components/feedback; the pieces are the DS's, synced into components/ui.",
  },
  {
    re: /\[data-slot=stepper-connector\]/,
    rule: "stepper connector patched by hand",
    fix: "The DS Stepper centres each circle over its name and joins circle to circle itself.",
  },
  {
    re: /group-data-horizontal\/tabs:after:-bottom-px/,
    rule: "line-tab underline restated",
    fix: "Line tabs draw the underline on the rule (and the list's height and padding) themselves.",
  },
  {
    re: /--tw-enter-opacity/,
    rule: "sheet or dialog motion set inline",
    fix: "The DS Sheet slides in full with no fade, and the DS confirm rises as a phone sheet. Other phone motion belongs in components/chrome/flow-window.ts.",
    skip: (file) => file === join(SRC, "components", "chrome", "flow-window.ts"),
  },
];

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return isNotDristi(full) ? [] : sourceFiles(full);
    if (full.startsWith(UI_PRIMITIVES)) return [];
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

const findings = [];
for (const file of sourceFiles(SRC)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, i) => {
    if (text.includes(ALLOW) || lines[i - 1]?.includes(ALLOW)) return;
    for (const r of RULES) {
      if (r.skip?.(file)) continue;
      if (r.re.test(text)) findings.push({ rel: relative(APP_ROOT, file), line: i + 1, ...r });
    }
  });
}

if (findings.length) {
  console.error("DS-retired check failed:\n");
  for (const f of findings) console.error(`${f.rel}:${f.line}  ${f.rule}\n    ${f.fix}`);
  console.error(`\nKeep ${ALLOW} for reviewed exceptions only.`);
  process.exit(1);
}
console.log(`DS-retired check passed (${RULES.length} retired patterns).`);
