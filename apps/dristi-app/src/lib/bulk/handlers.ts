/**
 * What each bulk endpoint does, apart from where it keeps things. The routes under
 * `app/api/bulk/` call these with the server's store; where the server cannot write, the
 * screens call the same functions in the browser with the browser's store
 * (`components/bulk/api.ts`, `bulkFetch`). One set of rules either way.
 */

import { documentText } from "./doc-text";
import { caseDocText, extractCase } from "./case-doc";
import {
  applyFix,
  attachToSlot,
  batchView,
  changePart,
  clubBatches,
  draftForScreen,
  editable,
  payCases,
  replaceDraft,
  roundsFor,
  signable,
  signCases,
  summarise,
  type Part,
} from "./actions.server";
import { aiModeFrom } from "./ai-review";
import type { ApiBatchRequest, ApiBatchResponse, ApiDocument } from "./contract";
import { localizeCaseNumber } from "@/lib/court/localize";
import { buildBatch, validateRequest } from "./intake";
import { caseFlags } from "./scrutiny";
import type { BulkStore, FileMeta } from "./store";
import type { BulkSignMethod } from "./types";
import type { FilingDraft, StoredFileRef } from "@/lib/filing/types";

/** A handler's answer: JSON with a status, or a stored file. */
export type Reply =
  | { status: number; json: unknown }
  | { status: number; file: { bytes: Uint8Array; meta: FileMeta } };

const ok = (json: unknown, status = 200): Reply => ({ status, json });
const fail = (error: string, status: number, details?: string[]): Reply => ({
  status,
  json: details ? { error, details } : { error },
});

/* ───────────────────────────── Batches ───────────────────────────── */

export async function listSummaries(store: BulkStore): Promise<Reply> {
  const all = await store.listBatches();
  return ok(all.map((b) => summarise(b, all)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
}

export type CreateBody = {
  request: ApiBatchRequest;
  fileName: string;
  /** "documents": cases read from one document each, and reviewed (AI-assisted upload). */
  from?: "excel" | "documents";
  /** For case documents: each case's original file and its text, by case reference. */
  originals?: Record<string, { file: StoredFileRef; text: string | null }>;
};

/** An Excel upload, already parsed and mapped in the browser into the API's shape. */
export async function createBatch(store: BulkStore, body: CreateBody): Promise<Reply> {
  const { request, fileName, from, originals } = body;
  const errors = validateRequest(request);
  if (errors.length) return fail("Not a valid batch.", 422, errors);
  const source =
    from === "documents"
      ? { kind: "documents" as const, system: "Case documents", reference: fileName }
      : { kind: "excel" as const, system: "Excel upload", reference: fileName };
  const built = await buildBatch(request, source, async () => null);
  for (const bc of built.cases) {
    const o = originals?.[bc.reference];
    if (!o) continue;
    bc.original = o.file;
    bc.docText = { ...bc.docText, [o.file.id]: o.text };
  }
  const batch = await store.insertBatch(built);
  return ok({ batchId: batch.id, batchNumber: batch.number }, 201);
}

/* ───────────────────────────── Bulk Filing API v1 ───────────────────────────── */

/**
 * A litigation system's push (`POST /api/bulk/v1/batches`): validated, its documents
 * fetched from the sender and kept, and the cases held as one batch of drafts.
 */
export async function receivePush(store: BulkStore, body: unknown, origin: string): Promise<Reply> {
  const errors = validateRequest(body);
  if (errors.length) return fail("Not a valid batch.", 422, errors);
  const request = body as ApiBatchRequest;
  const fetchDocument = async (doc: ApiDocument) => {
    try {
      const res = await fetch(doc.url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      const type = (doc.contentType || res.headers.get("content-type") || "application/octet-stream").split(";")[0];
      const ref = await store.saveFile(bytes, doc.name, type);
      return { ...ref, text: documentText(bytes, type) };
    } catch {
      return null;
    }
  };
  const built = await buildBatch(
    request,
    { kind: "api", system: request.source.system, reference: request.source.reference, sentBy: request.source.sentBy },
    fetchDocument
  );
  const batch = await store.insertBatch(built);
  const response: ApiBatchResponse = {
    batchId: batch.id,
    batchNumber: batch.number,
    receivedAt: batch.createdAt,
    url: `${origin}/filings/bulk/${batch.id}`,
    cases: batch.cases.map((c) => ({ reference: c.reference, caseId: c.id, status: "draft" })),
  };
  return ok(response, 201);
}

/** The sender's view of what it has pushed (`GET /api/bulk/v1/batches`). */
export async function pushedBatches(store: BulkStore): Promise<Reply> {
  const all = await store.listBatches();
  return ok(
    all.map((b) => ({
      batchId: b.id,
      batchNumber: b.number,
      receivedAt: b.createdAt,
      source: b.source,
      clubbedInto: b.clubbedInto,
      cases: b.cases.map((c) => ({
        reference: c.reference,
        caseId: c.id,
        status: c.draft.status,
        // In the deployment's own numbering, as the court's screens show it.
        caseFileNumber: c.draft.sign.caseFileNumber ? localizeCaseNumber(c.draft.sign.caseFileNumber, "gujarat") : null,
      })),
    }))
  );
}

export async function getBatchView(store: BulkStore, batchId: string, aiRaw: string | null): Promise<Reply> {
  const ai = aiModeFrom(aiRaw);
  const all = await store.listBatches();
  let batch = all.find((b) => b.id === batchId);
  if (!batch) return fail("No such batch.", 404);
  // Opening a pushed batch is what clears its notification.
  if (batch.openedAt === null) {
    const at = new Date().toISOString();
    batch = (await store.updateBatch(batchId, (b) => (b.openedAt === null ? { ...b, openedAt: at } : null))) ?? batch;
  }
  return ok(batchView(batch, all, ai));
}

/** Every case's draft in a batch, at once. */
export async function batchDrafts(store: BulkStore, batchId: string): Promise<Reply> {
  const batch = await store.getBatch(batchId);
  if (!batch) return fail("No such batch.", 404);
  return ok({ drafts: Object.fromEntries(batch.cases.map((c) => [c.id, c.draft])) });
}

/** Club batches the filer chose into a new one; the originals close. */
export async function club(store: BulkStore, batchIds: string[]): Promise<Reply> {
  let problem: string | null = null;
  try {
    const result = await store.applyBatches((all) => {
      const out = clubBatches(all, batchIds, new Date().toISOString());
      if ("error" in out) {
        problem = out.error;
        throw new Error(out.error);
      }
      return out;
    });
    return ok({ batchId: result.id, batchNumber: result.number });
  } catch {
    return fail(problem ?? "Could not club these batches.", 409);
  }
}

/* ───────────────────────────── Actions ───────────────────────────── */

export type Action =
  | { action: "fix"; caseId: string; path: string; value: string; everyCase?: boolean }
  | { action: "skip"; caseId: string; flagId: string }
  | { action: "unskip"; caseId: string; flagId: string }
  | { action: "skip-rule"; rule: string }
  | { action: "declare-no-contact"; caseId: string; accusedId: string }
  | { action: "part"; caseId: string; op: "add" | "remove"; part: Part; accused?: number }
  | { action: "sign"; caseIds: string[]; method: BulkSignMethod; round?: number }
  | { action: "pay"; caseIds: string[] };

const METHODS: BulkSignMethod[] = ["mobile-otp", "dsc", "aadhaar", "upload"];


/** What the filer does to a batch: fix, skip, declare, add or remove a part, sign, pay. */
export async function act(store: BulkStore, batchId: string, body: Action & { ai?: string }): Promise<Reply> {
  // The AI setting of the screen that sent this (`?ai=`), returned with the batch.
  const ai = aiModeFrom(body.ai);
  let problem: string | null = null;

  // Fixes may need a lookup (IFSC, pincode), so they are prepared before the write.
  const saved = await store.updateBatch(batchId, (batch) => {
    if (batch.clubbedInto) {
      problem = "This batch was clubbed into another and is closed.";
      return null;
    }
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
          const ids = caseFlags(bc)
            .filter((f) => f.level === "soft" && f.rule === body.rule)
            .map((f) => f.id);
          bc.skipped = [...new Set([...bc.skipped, ...ids])];
        }
        return batch;
      }
      case "part": {
        const bc = batch.cases.find((c) => c.id === body.caseId);
        if (!bc) return null;
        // A change voids signatures (LIFE-13); signed and filed cases are not offered it.
        if (bc.signedWith || bc.draft.status === "filed") {
          problem = "A signed or filed case cannot be changed here.";
          return null;
        }
        problem = changePart(bc.draft, body.op, body.part, body.accused ?? 0);
        return problem ? null : batch;
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
        const ready = signable(batch).filter((c) => body.caseIds.includes(c.id));
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
    if (!editable(body.path)) return fail("That field cannot be changed here.", 400);
    const all = await store.listBatches();
    const batch = all.find((b) => b.id === batchId);
    if (!batch) return fail("No such batch.", 404);
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
    const out = await store.updateBatch(batchId, (b) => {
      for (const bc of b.cases) {
        const d = fixed.get(bc.id);
        // An edit voids signatures (LIFE-13); only unsigned cases are offered for fixing.
        if (d && !bc.signedWith) {
          bc.draft = d;
          // Stating the delivery answers the "not known yet" the sender left.
          const notice = /^notices\.(\d+)\.delivered$/.exec(body.path);
          if (notice) bc.unknownService = bc.unknownService.filter((i) => i !== Number(notice[1]));
          // Answering a yes/no the sender left out clears it.
          if (bc.unstated) bc.unstated = bc.unstated.filter((p) => p !== body.path);
          // A bar number fixed on one case is the batch's advocate on every case.
          if (/^advocates\./.test(body.path)) bc.unknownBar = [];
        }
      }
      return b;
    });
    const after = await store.listBatches();
    return ok(batchView(out!, after, ai));
  }

  if (problem) return fail(problem, 409);
  if (!saved) return fail("No such batch or case.", 404);
  const all = await store.listBatches();
  return ok(batchView(saved, all, ai));
}

/* ───────────────────────────── One case ───────────────────────────── */

/** One case of a batch, whole: its draft, for the single filing's sections. */
export async function getCase(store: BulkStore, batchId: string, caseId: string): Promise<Reply> {
  const batch = await store.getBatch(batchId);
  if (!batch) return fail("No such batch.", 404);
  const at = batch.cases.findIndex((c) => c.id === caseId);
  if (at < 0) return fail("No such case in this batch.", 404);
  const bc = batch.cases[at];
  return ok({
    batchNumber: batch.number,
    reference: bc.reference,
    draft: draftForScreen(bc),
    prev: batch.cases[at - 1]?.id ?? null,
    next: batch.cases[at + 1]?.id ?? null,
    index: at,
    total: batch.cases.length,
  });
}

/** Save the case's draft as the filing sections left it. */
export async function putCase(
  store: BulkStore,
  batchId: string,
  caseId: string,
  body: { draft?: FilingDraft } | null,
): Promise<Reply> {
  if (!body?.draft) return fail("No draft sent.", 400);
  let problem: string | null = "No such case in this batch.";
  const saved = await store.updateBatch(batchId, (batch) => {
    const bc = batch.cases.find((c) => c.id === caseId);
    if (!bc) return null;
    problem = replaceDraft(bc, body.draft!);
    return problem ? null : batch;
  });
  if (!saved) return fail("No such batch.", 404);
  if (problem) return fail(problem, 409);
  return ok({ ok: true });
}

/* ───────────────────────────── Files ───────────────────────────── */

export async function getFile(store: BulkStore, fileId: string): Promise<Reply> {
  const file = await store.readFile(fileId);
  return file ? { status: 200, file } : fail("Not found", 404);
}

/** An upload made in the filing sections, under the id the screen gave it. */
export async function putFile(store: BulkStore, fileId: string, file: File | null): Promise<Reply> {
  if (await store.readFile(fileId)) return fail("That file is already stored.", 409);
  if (!file) return fail("No file sent.", 400);
  try {
    return ok(await store.saveFileAs(fileId, new Uint8Array(await file.arrayBuffer()), file.name, file.type));
  } catch (e) {
    return fail((e as Error).message, 400);
  }
}

/** A document added on the batch's Documents screen, aimed at a case and its slot. */
export async function attach(
  store: BulkStore,
  batchId: string,
  input: { file: File | null; caseId: string; slotKey: string; ai: string | null },
): Promise<Reply> {
  if (!input.file) return fail("No file.", 400);
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const ref = await store.saveFile(bytes, input.file.name, input.file.type);
  const text = documentText(bytes, input.file.type);
  const ai = aiModeFrom(input.ai);
  let done = false;
  const saved = await store.updateBatch(batchId, (batch) => {
    const bc = batch.cases.find((c) => c.id === input.caseId);
    if (!bc || bc.signedWith || bc.draft.status === "filed") return null;
    done = attachToSlot(bc, input.slotKey, ref);
    if (done) bc.docText = { ...bc.docText, [ref.id]: text };
    return done ? batch : null;
  });
  if (!saved || !done) return fail("That case or document slot is not open.", 409);
  return ok(batchView(saved, await store.listBatches(), ai));
}

const MAX_FILES = 200;

/** Case documents for the AI-assisted upload, each read for the sheet's fields and kept. */
export async function extract(store: BulkStore, files: File[], aiRaw: string | null): Promise<Reply> {
  // Reading documents is AI: with AI off or unavailable it says so and does nothing.
  if (aiModeFrom(aiRaw) !== "on") return fail("AI reading is not available. Upload an Excel file instead.", 409);
  if (!files.length) return fail("No files were sent.", 400);
  if (files.length > MAX_FILES) return fail(`At most ${MAX_FILES} documents at a time.`, 413);
  const cases = await Promise.all(
    files.map(async (f) => {
      const bytes = new Uint8Array(await f.arrayBuffer());
      let text: string | null = null;
      try {
        text = await caseDocText(bytes, f.name, f.type);
      } catch {
        text = null;
      }
      const original = await store.saveFile(bytes, f.name, f.type);
      return { ...extractCase(f.name, text), original, text };
    }),
  );
  return ok({ cases });
}
