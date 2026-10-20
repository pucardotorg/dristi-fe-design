/**
 * What the filer does to a batch: fix a flagged value, skip a soft flag, declare an
 * accused's contacts unknown, sign, pay. Each returns the batch as it now stands.
 */

import { NextResponse } from "next/server";

import {
  applyFix,
  batchView,
  editable,
  payCases,
  roundsFor,
  signable,
  signCases,
} from "@/lib/bulk/actions.server";
import { caseFlags } from "@/lib/bulk/scrutiny";
import { listBatches, updateBatch } from "@/lib/bulk/store.server";
import type { BulkSignMethod } from "@/lib/bulk/types";

type Action =
  | { action: "fix"; caseId: string; path: string; value: string; everyCase?: boolean }
  | { action: "skip"; caseId: string; flagId: string }
  | { action: "unskip"; caseId: string; flagId: string }
  | { action: "skip-rule"; rule: string }
  | { action: "declare-no-contact"; caseId: string; accusedId: string }
  | { action: "sign"; caseIds: string[]; method: BulkSignMethod; round?: number }
  | { action: "pay"; caseIds: string[] };

const METHODS: BulkSignMethod[] = ["mobile-otp", "dsc", "aadhaar", "upload"];

export async function POST(req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  const body = (await req.json()) as Action;
  let problem: string | null = null;

  // Fixes may need a lookup (IFSC, pincode), so they are prepared before the write.
  const saved = await updateBatch(batchId, (batch, all) => {
    if (batch.clubbedInto) {
      problem = "This batch was clubbed into another and is closed.";
      return null;
    }
    const others = all.filter((b) => b.id !== batch.id);
    const at = new Date().toISOString();
    switch (body.action) {
      case "skip":
      case "unskip": {
        const bc = batch.cases.find((c) => c.id === body.caseId);
        if (!bc) return null;
        bc.skipped = body.action === "skip"
          ? [...new Set([...bc.skipped, body.flagId])]
          : bc.skipped.filter((id) => id !== body.flagId);
        return batch;
      }
      case "skip-rule": {
        for (const bc of batch.cases) {
          if (bc.draft.status === "filed" || bc.signedWith) continue;
          const ids = caseFlags(bc, { batch, others })
            .filter((f) => f.level === "soft" && f.rule === body.rule)
            .map((f) => f.id);
          bc.skipped = [...new Set([...bc.skipped, ...ids])];
        }
        return batch;
      }
      case "declare-no-contact": {
        const bc = batch.cases.find((c) => c.id === body.caseId);
        if (!bc) return null;
        bc.noContactDeclared = [...new Set([...bc.noContactDeclared, body.accusedId])];
        return batch;
      }
      case "sign": {
        if (!METHODS.includes(body.method)) {
          problem = "Unknown signing method.";
          return null;
        }
        const ready = signable(batch, all).filter((c) => body.caseIds.includes(c.id));
        if (ready.length === 0) {
          problem = "None of these cases can be signed now.";
          return null;
        }
        signCases(ready, body.method, at);
        batch.signings.push({ method: body.method, at, caseIds: ready.map((c) => c.id), rounds: roundsFor(body.method, ready.length) });
        return batch;
      }
      case "pay": {
        const cases = batch.cases.filter((c) => body.caseIds.includes(c.id) && c.signedWith && c.draft.status !== "filed");
        if (cases.length === 0) {
          problem = "None of these cases is signed and unpaid.";
          return null;
        }
        payCases(batch, cases, at);
        return batch;
      }
      default:
        return null;
    }
  }).catch((e: Error) => {
    problem = e.message;
    return null;
  });

  if (body.action === "fix") {
    if (!editable(body.path)) return NextResponse.json({ error: "That field cannot be changed here." }, { status: 400 });
    const all = await listBatches();
    const batch = all.find((b) => b.id === batchId);
    if (!batch) return NextResponse.json({ error: "No such batch." }, { status: 404 });
    const targets = body.everyCase
      ? batch.cases.filter((c) => c.draft.status !== "filed" && !c.signedWith)
      : batch.cases.filter((c) => c.id === body.caseId);
    // Work out the fixed drafts first (lookups are async), then write them in one go.
    const fixed = new Map<string, typeof targets[number]["draft"]>();
    for (const bc of targets) {
      const d = structuredClone(bc.draft);
      await applyFix(d, body.path, body.value);
      fixed.set(bc.id, d);
    }
    const out = await updateBatch(batchId, (b) => {
      for (const bc of b.cases) {
        const d = fixed.get(bc.id);
        // An edit voids signatures (LIFE-13); only unsigned cases are offered for fixing.
        if (d && !bc.signedWith) bc.draft = d;
      }
      return b;
    });
    const after = await listBatches();
    return NextResponse.json(batchView(out!, after));
  }

  if (problem) return NextResponse.json({ error: problem }, { status: 409 });
  if (!saved) return NextResponse.json({ error: "No such batch or case." }, { status: 404 });
  const all = await listBatches();
  return NextResponse.json(batchView(saved, all));
}
