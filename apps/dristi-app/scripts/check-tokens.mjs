#!/usr/bin/env node
/**
 * Product-app token gate (ported from pucar-design-system check-tokens).
 * Enforces: no literal colours, raw greys, named white/black, raw-unit spacing/radius;
 * every --color-* theme alias resolves in :root and .dark.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { isNotDristi } from "./not-dristi.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const TOKEN_SOURCE = join(ROOT, "src/app/globals.css");
const IGNORE = "ds-tokens-ignore";

const COLOR_UTILITIES =
  "bg|text|border|ring|outline|fill|stroke|shadow|from|via|to|decoration|accent|caret|divide|placeholder";
const LITERAL_COLOR = new RegExp(
  `\\b(?:${COLOR_UTILITIES})-\\[[^\\]]*(?:#[0-9a-fA-F]{3,8}|oklch\\(|rgba?\\(|hsla?\\()`,
  "g"
);
const RAW_GREY = /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline)-neutral-\d/g;
const NAMED_PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline)-(?:white|black)(?:\/[\d.]+)?\b/g;
const ARBITRARY_METRIC =
  /\b(?:rounded(?:-[trblxyse]{1,2})?|p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|space-[xy])-\[(?![^\]]*var\()([0-9]+\.?[0-9]*(?:px|rem|em))\]/g;

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return isNotDristi(full) ? [] : sourceFiles(full);
    return /\.(tsx?|css)$/.test(entry) && full !== TOKEN_SOURCE ? [full] : [];
  });
}

function scan(file, findings) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (line.includes(IGNORE) || lines[index - 1]?.includes(IGNORE)) return;
    for (const [rule, pattern] of [
      ["literal colour in an arbitrary value", LITERAL_COLOR],
      ["raw grey ladder utility", RAW_GREY],
      ["default palette colour (use a token)", NAMED_PALETTE],
      ["raw-unit arbitrary spacing or radius", ARBITRARY_METRIC],
    ]) {
      for (const match of line.matchAll(pattern)) {
        findings.push({
          file: relative(ROOT, file),
          line: index + 1,
          rule,
          match: match[0],
        });
      }
    }
  });
}

function ruleBody(css, selector) {
  const at = css.search(
    new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m")
  );
  if (at === -1) throw new Error(`No \`${selector}\` rule in globals.css`);
  const open = css.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`Unterminated \`${selector}\` rule in globals.css`);
}

function declarations(body) {
  const decls = new Map();
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, name, value] of withoutComments.matchAll(
    /(--[\w-]+)\s*:\s*([^;]+);/g
  )) {
    decls.set(name, value.trim());
  }
  return decls;
}

function findModeGaps(css) {
  const theme = declarations(ruleBody(css, "@theme inline"));
  const light = declarations(ruleBody(css, ":root"));
  const dark = declarations(ruleBody(css, ".dark"));
  const gaps = [];
  for (const [name, value] of theme) {
    if (!name.startsWith("--color-")) continue;
    const alias = value.match(/^var\((--[\w-]+)\)$/)?.[1];
    if (!alias) continue;
    const missing = [
      !light.has(alias) && ":root",
      !dark.has(alias) && ".dark",
    ].filter(Boolean);
    if (missing.length) gaps.push({ token: name, alias, missing });
  }
  return gaps;
}

const findings = [];
for (const file of sourceFiles(SRC)) scan(file, findings);

for (const { file, line, rule, match } of findings) {
  console.error(`${file}:${line}  ${rule} — ${match}`);
}

let failed = findings.length > 0;
const css = readFileSync(TOKEN_SOURCE, "utf8");
for (const { token, alias, missing } of findModeGaps(css)) {
  console.error(
    `src/app/globals.css  ${token} → ${alias} is missing from ${missing.join(" and ")}`
  );
  failed = true;
}

if (failed) {
  console.error("\nToken check failed. Follow pucar-design-system AGENTS.md.");
  process.exit(1);
}
console.log("Token check passed.");
