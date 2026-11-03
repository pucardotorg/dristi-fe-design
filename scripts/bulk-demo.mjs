#!/usr/bin/env node
/**
 * Bulk filing demo: starts SARAS 2.0 (the DRISTI app, Gujarat), which also serves the
 * Provakil mock at /provakil. Ctrl+C stops it.
 *
 *   npm run demo            http://localhost:3000 (Provakil at /provakil)
 *   npm run demo -- --reset  same, after clearing every batch
 *
 * Provakil keeps its own records (assignments, what it has sent) in the browser, and
 * forgets a push once SARAS 2.0 no longer holds its batch, so a reset clears both sides.
 * The port can be moved with DRISTI_PORT.
 */

import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const port = process.env.DRISTI_PORT ?? "3000";

const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
  console.error(`Node.js 22 or later is needed (this is ${process.versions.node}).`);
  process.exit(1);
}

if (process.argv.includes("--reset")) {
  rmSync(join(root, "apps/dristi-app/.data"), { recursive: true, force: true });
  console.log("Cleared demo data.");
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npm, ["run", "dev", "-w", "@pucar/dristi-app", "--", "-p", port], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));

const stop = () => child.kill("SIGINT");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

setTimeout(() => {
  console.log("\n  Provakil:  http://localhost:" + port + "/provakil/collections/litigation");
  console.log("  SARAS 2.0: http://localhost:" + port + "/filings/bulk\n");
}, 4000);
