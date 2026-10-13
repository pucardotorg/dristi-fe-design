#!/usr/bin/env node
/**
 * ds:bump — move the whole repo to a newer design system, in one reviewable commit.
 *
 * This is the only sanctioned way the pinned version changes. It is deliberately a
 * command someone runs and commits, not something that happens quietly on install:
 * a DS bump changes how every screen looks, and that belongs in the history where the
 * team can see it, discuss it, and revert it.
 *
 *   npm run ds:bump              # move to the DS's latest main
 *   npm run ds:bump -- <commit>  # move to a specific commit
 *   npm run ds:bump -- --dry-run # show what would change, touch nothing
 *
 * Run it on a dedicated upgrade branch from `origin/main`, reviewed by PR into `main` —
 * never folded into a feature branch. A pin that differs per branch is the problem this
 * file exists to end.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const {
  DS_LOCK_PATH,
  VENDOR_DS_PATH,
  readDsLock,
  resolveDsRoot,
  dsResolveHint,
  REPO_ROOT,
} = await import("../apps/dristi-app/scripts/resolve-ds.mjs");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const target = args.find((a) => !a.startsWith("--"));

const ds = resolveDsRoot();
if (!ds) {
  console.error(dsResolveHint());
  process.exit(1);
}
if (ds !== VENDOR_DS_PATH) {
  console.error(
    `Refusing to bump from ${ds}.\nThe pin must be set from the vendored clone, not a PUCAR_DS_ROOT override —\notherwise you pin the repo to a commit that only exists on your machine.`
  );
  process.exit(1);
}

const lock = readDsLock();
const from = lock?.commit ?? null;

function git(...a) {
  return execFileSync("git", ["-C", ds, ...a], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  }).trim();
}

try {
  git("fetch", "--quiet", "origin");
} catch {
  console.error("Could not reach the DS remote. A bump needs the network — try again when online.");
  process.exit(1);
}

let to;
try {
  to = git("rev-parse", target ?? "origin/main");
} catch {
  console.error(`"${target}" is not a commit in ${ds}.`);
  process.exit(1);
}

if (from === to) {
  console.log(`Already pinned to ${to.slice(0, 12)} — nothing to bump.`);
  process.exit(0);
}

/* Show the range first. A bump nobody read is a bump nobody can review. */
const range = from ? `${from}..${to}` : null;
console.log(`\nDesign system bump\n  from  ${from ? from.slice(0, 12) : "(unpinned)"}\n  to    ${to.slice(0, 12)}\n`);

if (range) {
  const logOf = (r) => {
    try {
      return git("log", "--format=  %h %s", r);
    } catch {
      return "";
    }
  };

  const forward = logOf(range);
  if (forward) {
    console.log(`Commits being adopted:\n${forward}\n`);
  } else {
    // `to` is behind `from`: a revert of an earlier bump. `log from..to` is empty for
    // that, which would otherwise print nothing and read as "no changes".
    const backward = logOf(`${to}..${from}`);
    if (backward) {
      console.log(`DOWNGRADE — giving up these commits:\n${backward}\n`);
    }
  }

  const touched = (() => {
    try {
      return git("diff", "--name-only", range);
    } catch {
      return "";
    }
  })().split("\n").filter(Boolean);

  const primitives = touched.filter((f) => f.startsWith("src/components/ui/"));
  const tokens = touched.includes("src/app/globals.css");
  console.log(
    `Affects this app: ${primitives.length} primitive${primitives.length === 1 ? "" : "s"}${tokens ? " + the token file" : ""}`
  );
  if (primitives.length) {
    for (const f of primitives) console.log(`  ${f.replace("src/components/ui/", "")}`);
  }
  console.log(
    "\nRead the changelog for this range before committing — a token whose *meaning*\nchanged shows up in no file diff:\n  " +
      join(ds, "CHANGELOG.md") +
      "\n"
  );
}

if (dryRun) {
  console.log("--dry-run: nothing written.");
  process.exit(0);
}

/* 1. move the vendored clone */
git("checkout", "--quiet", "--detach", to);

/* 2. rewrite the pin */
const next = {
  _comment:
    "The one design-system version this repo builds against. Everyone gets this exact commit; npm install checks it out. Change it only via `npm run ds:bump`, on a dedicated upgrade branch into `main`, never by hand on a feature branch.",
  remote: lock?.remote ?? "pucardotorg/dristi-design-system",
  commit: to,
  bumpedOn: new Date().toISOString().slice(0, 10),
};
writeFileSync(DS_LOCK_PATH, `${JSON.stringify(next, null, 2)}\n`);
console.log(`ds.lock.json → ${to.slice(0, 12)}`);

/* 3. re-sync every primitive the app already carries, plus tokens */
const appUi = join(REPO_ROOT, "apps/dristi-app/src/components/ui");
const names = existsSync(appUi)
  ? readdirSync(appUi)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => f.replace(/\.tsx$/, ""))
  : [];

execFileSync(
  "node",
  [join(REPO_ROOT, "apps/dristi-app/scripts/sync-ui-from-ds.mjs"), "--tokens", ...names],
  { stdio: "inherit", cwd: join(REPO_ROOT, "apps/dristi-app") }
);

console.log(
  [
    "",
    "Bumped. Now, in this order:",
    "  1. npm run check:ui-sync     confirm the app matches the new DS",
    "  2. look at the screens       the checks cannot judge a layout",
    "  3. commit ds.lock.json with the synced files on an upgrade branch from origin/main, and open a PR into main",
    "",
    "Then tell the others. They pick it up on their next pull — the pin means",
    "nobody is dragged onto it mid-feature.",
  ].join("\n")
);
