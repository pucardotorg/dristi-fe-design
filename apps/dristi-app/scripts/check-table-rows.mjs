#!/usr/bin/env node
/**
 * check:table-rows — one table treatment, owned in one place.
 *
 * The panel-inset queues (the ones on `border-separate`, so the header strip can round
 * itself into a well) had grown sixteen private copies of the same four class strings.
 * Then one copy learned something the other fifteen did not: how to round a hovered
 * row. The register went on painting a square band under a rounded header for weeks and
 * every gate stayed green, because duplicated constants that agree today are not a
 * drift any of them can see.
 *
 * So this gate does not check appearance. It checks that the treatment is still owned
 * by `components/chrome/table-plate.ts` — the one file where fixing it fixes the
 * product. Its rules are derived from that module's own exports, so retuning the plate
 * never means retuning the gate.
 *
 * Scope is deliberately the `border-separate` family. A table clipped by a rounded card
 * (`tasks-table`, via `overflow-clip`) solves the corner problem a different and equally
 * correct way, and the full-bleed tables inside a case file have no corner to cut.
 * Widening this to every `<Table>` would flag both as broken.
 *
 * Escape hatch: `table-plate-allow` on the offending line or the one above it, for a
 * reviewed exception. It is not a licence to re-fork the treatment.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { isNotDristi } from "./not-dristi.mjs";
import { APP_ROOT } from "./resolve-ds.mjs";

const SRC = join(APP_ROOT, "src");
const UI_PRIMITIVES = join(SRC, "components", "ui") + sep;
const PLATE = join(SRC, "components", "chrome", "table-plate.ts");
const PLATE_IMPORT = "@/components/chrome/table-plate";
const ALLOW = "table-plate-allow";

/**
 * The plate's own exported strings, read from the plate. A copy of one of these
 * anywhere else is the duplication this gate exists to stop, whatever it is named.
 */
function plateConstants() {
  const source = readFileSync(PLATE, "utf8");
  /* `\s*` spans the newline, so this covers both the one-line and wrapped forms. */
  const found = [
    ...source.matchAll(/export const (TABLE_[A-Z_]+) =\s*"([^"]+)";/g),
  ];
  if (!found.length) {
    console.error(
      "check:table-rows could not read any exported class string from\n  " +
        relative(APP_ROOT, PLATE) +
        "\nThe gate derives its rules from those exports, so it cannot run. If the " +
        "plate\nnow builds them differently, teach this script the new shape."
    );
    process.exit(1);
  }
  return found.map(([, name, value]) => ({ name, value }));
}

/** The tells of a hand-rolled row band: the plate's mechanism, written out by hand. */
const HAND_ROLLED = [
  /\[&>td\]:bg-/,
  /\[&>td:first-child\]:rounded-/,
  /\[&>td:last-child\]:rounded-/,
  /\[&>th:first-child\]:rounded-/,
  /\[&>th:last-child\]:rounded-/,
];

/** A background utility written into a row's own className. */
const ROW_FILL = /\bbg-[a-z]/;

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return isNotDristi(full) ? [] : sourceFiles(full);
    if (full === PLATE || full.startsWith(UI_PRIMITIVES)) return [];
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/**
 * The text of every `<Name ...>` opening tag, brace- and quote-aware so a `>` inside
 * `{cn(...)}` or a string does not end the tag early.
 */
function openingTags(source, name) {
  const tags = [];
  const re = new RegExp(`<${name}(?=[\\s/>])`, "g");
  let match;
  while ((match = re.exec(source))) {
    let i = match.index + match[0].length;
    let depth = 0;
    let quote = null;
    while (i < source.length) {
      const ch = source[i];
      if (quote) {
        if (ch === quote && source[i - 1] !== "\\") quote = null;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
      } else if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
      } else if (ch === ">" && depth === 0) {
        break;
      }
      i += 1;
    }
    tags.push({ index: match.index, text: source.slice(match.index, i) });
  }
  return tags;
}

const constants = plateConstants();
const findings = [];

for (const file of sourceFiles(SRC)) {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  const rel = relative(APP_ROOT, file);
  const lineAt = (index) => source.slice(0, index).split("\n").length;
  const allowed = (line) =>
    lines[line - 1]?.includes(ALLOW) || lines[line - 2]?.includes(ALLOW);

  const add = (line, rule, detail) => {
    if (!allowed(line)) findings.push({ rel, line, rule, detail });
  };

  // 1. A plate constant, copied.
  for (const { name, value } of constants) {
    const at = source.indexOf(value);
    if (at !== -1) {
      add(
        lineAt(at),
        `import ${name} from the table plate instead of restating it`,
        `${value.slice(0, 44)}…`
      );
    }
  }

  // 2. The plate's mechanism, hand-rolled.
  lines.forEach((line, index) => {
    for (const pattern of HAND_ROLLED) {
      if (pattern.test(line)) {
        add(
          index + 1,
          "row/header banding belongs to the table plate",
          line.trim().slice(0, 60)
        );
        break;
      }
    }
  });

  // The remaining rules are about the panel-inset family only.
  if (!source.includes("border-separate") || !source.includes("<TableRow")) {
    continue;
  }

  if (!source.includes(PLATE_IMPORT)) {
    add(
      lineAt(source.indexOf("<TableRow")),
      `a border-separate table takes its treatment from ${PLATE_IMPORT}`,
      "no table-plate import"
    );
  }

  // 3. A fill on the row itself, which can never have corners.
  for (const tag of openingTags(source, "TableRow")) {
    for (const literal of tag.text.matchAll(/"([^"]*)"/g)) {
      if (ROW_FILL.test(literal[1])) {
        add(
          lineAt(tag.index),
          "a row's fill must go on its cells (tableRowClass), never the <tr>",
          literal[1].slice(0, 60)
        );
      }
    }
  }

  // 4. The body half carries the rules that need a row's neighbours.
  for (const tag of openingTags(source, "TableBody")) {
    if (!tag.text.includes("tableBodyClass")) {
      add(
        lineAt(tag.index),
        "pair the rows with tableBodyClass(), or the rule above a lit row cuts its corners",
        tag.text.replace(/\s+/g, " ").slice(0, 60)
      );
    }
  }
}

if (findings.length) {
  console.error("Table-row check failed:\n");
  for (const f of findings) {
    console.error(`${f.rel}:${f.line}  ${f.rule}\n    ${f.detail}`);
  }
  console.error(
    "\nThe treatment lives in src/components/chrome/table-plate.ts: TABLE_HEAD, " +
      "TABLE_CELL,\nTABLE_HEAD_ROW, tableRowClass() and tableBodyClass(). A row fill on " +
      "the <tr> cannot\nbe rounded — `border-radius` is ignored on a table row — which is " +
      `why the plate\nputs it on the cells. Keep ${ALLOW} for reviewed exceptions only.`
  );
  process.exit(1);
}

console.log(
  `Table-row check passed (one treatment, ${constants.length} shared strings).`
);
