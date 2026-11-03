#!/usr/bin/env node
/**
 * Enforce Pucar typography roles in product composition.
 *
 * Synced DS primitives are intentionally excluded: compact control chrome uses
 * Tailwind's text-sm/text-xs internally. Product screens must use the named DS
 * scale so those implementation details do not leak into citizen-facing copy.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { isNotDristi } from "./not-dristi.mjs";
import { APP_ROOT } from "./resolve-ds.mjs";

const SRC = join(APP_ROOT, "src");
const UI_PRIMITIVES = join(SRC, "components", "ui") + sep;
const ALLOW = "ds-typography-allow";
const RAW_TYPE_SIZE =
  /\btext-(?:xs|sm|base|lg|xl|[2-9]xl|\[[^\]]+\])(?![\w-])/g;
const HEADING_TYPE =
  /\btext-(?:display(?:-s)?|title(?:-l|-s)?)\b/;

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return isNotDristi(full) ? [] : sourceFiles(full);
    return entry.endsWith(".tsx") && !full.startsWith(UI_PRIMITIVES)
      ? [full]
      : [];
  });
}

const findings = [];

for (const file of sourceFiles(SRC)) {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    if (line.includes(ALLOW) || lines[index - 1]?.includes(ALLOW)) return;

    for (const match of line.matchAll(RAW_TYPE_SIZE)) {
      findings.push({
        file: relative(APP_ROOT, file),
        line: index + 1,
        rule: "use a named DS type token in product composition",
        match: match[0],
      });
    }

    if (HEADING_TYPE.test(line) && !line.includes("font-semibold")) {
      findings.push({
        file: relative(APP_ROOT, file),
        line: index + 1,
        rule: "DS display/title styles require font-semibold",
        match: line.match(HEADING_TYPE)?.[0] ?? "heading token",
      });
    }
  });

  if (
    source.includes("Noto_Sans_Malayalam") &&
    !/[\"']600[\"']/.test(source)
  ) {
    findings.push({
      file: relative(APP_ROOT, file),
      line: lines.findIndex((line) => line.includes("weight:")) + 1,
      rule: "Malayalam font loading must include the DS title weight",
      match: "missing weight 600",
    });
  }
}

if (findings.length) {
  console.error("Typography check failed:\n");
  for (const finding of findings) {
    console.error(
      `${finding.file}:${finding.line}  ${finding.rule}: ${finding.match}`
    );
  }
  console.error(
    "\nUse text-body for citizen copy, text-title-* + font-semibold for headings. " +
      `Keep ${ALLOW} for reviewed exceptions only.`
  );
  process.exit(1);
}

console.log(
  "Typography check passed (named DS roles used outside synced primitives)."
);
