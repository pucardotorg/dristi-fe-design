#!/usr/bin/env node
/**
 * Bulk filing demo: starts SARAS 2.0 (the DRISTI app, Gujarat) and the Provakil mock
 * together, wired to each other. Ctrl+C stops both.
 *
 *   npm run demo            SARAS 2.0 on http://localhost:3000, Provakil on http://localhost:3100
 *   npm run demo -- --reset  same, after clearing every batch, push and assignment
 *
 * Ports can be moved with DRISTI_PORT and PROVAKIL_PORT.
 */

import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const dristiPort = process.env.DRISTI_PORT ?? "3000";
const provakilPort = process.env.PROVAKIL_PORT ?? "3100";

const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
  console.error(`Node.js 22 or later is needed (this is ${process.versions.node}).`);
  process.exit(1);
}

if (process.argv.includes("--reset")) {
  rmSync(join(root, "apps/dristi-app/.data"), { recursive: true, force: true });
  rmSync(join(root, "apps/provakil-mock/.data"), { recursive: true, force: true });
  console.log("Cleared demo data.");
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (name, args, env) => {
  const child = spawn(npm, args, { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
  const tag = (line) => line && process.stdout.write(`[${name}] ${line}\n`);
  child.stdout.on("data", (d) => String(d).split("\n").forEach(tag));
  child.stderr.on("data", (d) => String(d).split("\n").forEach(tag));
  child.on("exit", (code) => {
    console.log(`[${name}] stopped (${code ?? "signal"})`);
    process.exit(code ?? 0);
  });
  return child;
};

const children = [
  run("saras", ["run", "dev", "-w", "@pucar/dristi-app", "--", "-p", dristiPort], {}),
  run("provakil", ["run", "dev", "-w", "@pucar/provakil-mock", "--", "-p", provakilPort], {
    DRISTI_URL: `http://localhost:${dristiPort}`,
    PROVAKIL_URL: `http://localhost:${provakilPort}`,
  }),
];

const stop = () => children.forEach((c) => c.kill("SIGINT"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

setTimeout(() => {
  console.log("\n  Provakil:  http://localhost:" + provakilPort + "/collections/litigation");
  console.log("  SARAS 2.0: http://localhost:" + dristiPort + "/filings/bulk\n");
}, 4000);
