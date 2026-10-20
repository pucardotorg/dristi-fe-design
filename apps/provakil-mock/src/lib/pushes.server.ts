/** What this workspace has sent to DRISTI, kept in `.data/pushes.json` (git-ignored). */

import { promises as fs } from "node:fs";
import path from "node:path";

export type PushRecord = {
  /** The advocate whose account the batch went to. */
  advocate?: string;
  pushId: string;
  at: string;
  by: string;
  matterIds: string[];
  batchId: string;
  batchNumber: string;
  url: string;
};

const FILE = path.join(process.cwd(), ".data", "pushes.json");

export async function readPushes(): Promise<PushRecord[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as PushRecord[];
  } catch {
    return [];
  }
}

export async function addPush(p: PushRecord): Promise<void> {
  const all = await readPushes();
  all.push(p);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

/* ─────────────────────────────── Advocate assignments ─────────────────────────────── */

const ASSIGN = path.join(process.cwd(), ".data", "assignments.json");

export async function readAssignments(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await fs.readFile(ASSIGN, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function assign(matterIds: string[], enrolment: string): Promise<void> {
  const all = await readAssignments();
  for (const id of matterIds) all[id] = enrolment;
  await fs.mkdir(path.dirname(ASSIGN), { recursive: true });
  await fs.writeFile(ASSIGN, JSON.stringify(all, null, 2));
}
