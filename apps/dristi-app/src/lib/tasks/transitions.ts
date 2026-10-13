/**
 * The task state machine — pure functions from (task, actor, case) to a new task.
 *
 * Every transition checks the from-state and the actor's permission, and throws a
 * `TransitionError` otherwise; every transition appends a history line, so the panel's
 * timeline is the audit trail. Nothing here touches storage — the store applies the
 * result and writes it.
 *
 *   open · draft · ready ──saveDraft──▶ draft            (anyone on the case)
 *   open · draft ──markReady──▶ ready                    (anyone on the case)
 *   open · draft · ready ──sign──▶ done                  (signatory; event)
 *   open · draft · ready ──recordPayment──▶ done · payment-confirming · (failed) same state
 *   open · draft · ready ──file──▶ awaiting-court        (signatory)
 *   open · draft · ready ──refile──▶ awaiting-court      (signatory; every defect resolved)
 *   open · draft ──resolveDefect──▶ draft                (anyone on the case)
 *   payment-confirming ──confirmPayment──▶ done          (event)
 *   awaiting-court ──courtAccepted──▶ done               (event)
 *   awaiting-court ──courtReturned(defects)──▶ obsolete + a new open `returned` task
 *   open · draft · ready ──markDone──▶ done              (anyone on the case; manual)
 *   any non-closed state ──archive──▶ archived           (anyone on the case)
 *   archived ──unarchive──▶ the state it left            (anyone on the case)
 *   any open state ──redate · expire · obsolete──▶ …
 *
 * When a signatory completes work someone else prepared, the history says so:
 * "Completed by X — prepared by Y".
 */

import { resolutionSatisfies } from "./defects";
import { canArchive, canComplete, canMarkDone, canView, TERMINAL } from "./permissions";
import type {
  Case,
  Defect,
  DocTarget,
  PaymentResult,
  Person,
  PersonId,
  Resolution,
  StoredFileRef,
  Task,
  TaskStatus,
} from "./types";

export type TransitionErrorCode = "illegal-state" | "forbidden" | "invalid";

export class TransitionError extends Error {
  code: TransitionErrorCode;
  constructor(code: TransitionErrorCode, message: string) {
    super(message);
    this.name = "TransitionError";
    this.code = code;
  }
}

/** Who is acting, on which case, and when. `now` defaults to the wall clock. */
export type Ctx = {
  actor: Person;
  kase: Case;
  now?: string;
  /** For naming other people in history lines. */
  people?: Person[];
};

/** A transition either changes one task or changes one and creates another. */
export type Transition = (task: Task, ctx: Ctx) => Task | { task: Task; created: Task };

function nowOf(ctx: Ctx): string {
  return ctx.now ?? new Date().toISOString();
}

function nameOf(ctx: Ctx, id?: PersonId): string {
  if (!id) return "someone";
  if (id === ctx.actor.id) return ctx.actor.name;
  return ctx.people?.find((p) => p.id === id)?.name ?? id;
}

function assertState(task: Task, from: TaskStatus[], what: string): void {
  if (!from.includes(task.status)) {
    throw new TransitionError(
      "illegal-state",
      `Cannot ${what} a task that is ${task.status} (needs ${from.join(" or ")}).`
    );
  }
}

function assertAllowed(ok: boolean, what: string): void {
  if (!ok) throw new TransitionError("forbidden", `You are not allowed to ${what} this task.`);
}

function withHistory(task: Task, ctx: Ctx, text: string, by: PersonId | undefined = ctx.actor.id): Task {
  return { ...task, history: [...task.history, { at: nowOf(ctx), by, text }] };
}

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Stand-in reference the shape a gateway or registry returns, generated locally. */
export function newRef(prefix: string, seed?: number): string {
  let out = "";
  let x = seed ?? Math.floor(Math.random() * 2 ** 31);
  for (let i = 0; i < 10; i += 1) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out += REF_ALPHABET[x % REF_ALPHABET.length];
  }
  return `${prefix}-${out}`;
}

/* ─────────────────────────── preparing ─────────────────────────── */

const PREPARABLE: TaskStatus[] = ["open", "draft", "ready"];

/**
 * Save what has been filled or uploaded so far. Anyone on the case; the task becomes
 * (or stays) a draft in their name. A ready task saved again goes back to draft — the
 * preparation is being reworked.
 */
export function saveDraft(task: Task, ctx: Ctx, note?: string, files?: StoredFileRef[]): Task {
  assertState(task, PREPARABLE, "save");
  assertAllowed(canView(ctx.actor, ctx.kase), "work on");
  if (task.kind === "hearing") throw new TransitionError("invalid", "A hearing task has nothing to draft.");
  if (task.kind === "review") throw new TransitionError("invalid", "A request is answered, not drafted.");
  const at = nowOf(ctx);
  return withHistory(
    {
      ...task,
      status: "draft",
      statusNote: undefined,
      draft: { by: ctx.actor.id, savedAt: at, note: note?.trim() || task.draft?.note },
      prepared: undefined,
      files: files ?? task.files,
    },
    ctx,
    `${ctx.actor.name} saved a draft`
  );
}

/** The same move, named for the first save. */
export const startDraft = saveDraft;

/**
 * The preparation is complete: hand it to a signatory. Anyone on the case — a
 * signatory rarely needs to, since they can complete it directly, but the move is not
 * refused. The status note names the preparer so the row says so at a glance.
 */
export function markReady(task: Task, ctx: Ctx, note?: string, files?: StoredFileRef[]): Task {
  assertState(task, ["open", "draft"], "mark ready");
  assertAllowed(canView(ctx.actor, ctx.kase), "prepare");
  if (task.kind === "hearing") throw new TransitionError("invalid", "A hearing task is done in court, not prepared.");
  if (task.kind === "review") throw new TransitionError("invalid", "A request is answered, not prepared.");
  const at = nowOf(ctx);
  const allFiles = files ?? task.files;
  const text = note?.trim() || task.draft?.note;
  return withHistory(
    {
      ...task,
      status: "ready",
      statusNote: `Prepared by ${ctx.actor.name}`,
      draft: undefined,
      prepared: { by: ctx.actor.id, at, note: text, files: allFiles },
      files: allFiles,
    },
    ctx,
    `${ctx.actor.name} marked this ready${text ? ` — “${text}”` : ""}`
  );
}

/** What the correction screen writes back when a defect's resolution changes. */
const RESOLUTION_WORD: Record<Resolution["how"], string> = {
  edited: "corrected",
  kept: "kept the filed value for",
  replaced: "replaced the document for",
};

/**
 * Record (or clear) what was done about a defect. Anyone on the case.
 *
 * The screen calls this as the filing changes — it is a record of an act, not a claim
 * that the defect is cured: whether it counts is derived in `defects.ts` from the value
 * now in the filing. Passing `undefined` clears the record (an undo, or a value put back).
 */
export function resolveDefect(task: Task, ctx: Ctx, n: number, resolution: Resolution | undefined): Task {
  if (task.kind !== "returned") throw new TransitionError("invalid", "Not a returned filing.");
  assertState(task, PREPARABLE, "resolve defects on");
  assertAllowed(canView(ctx.actor, ctx.kase), "edit");
  const before = task.returned?.defects ?? [];
  if (!before.some((d) => d.n === n)) {
    throw new TransitionError("invalid", `This return has no defect ${n}.`);
  }
  const defects = before.map((d) => (d.n === n ? { ...d, resolution } : d));
  const at = nowOf(ctx);
  // Working a defect is preparation: an open task becomes this person's draft; a ready
  // task stays ready (a signatory revising on review is not a rework).
  const status: TaskStatus = task.status === "open" ? "draft" : task.status;
  const line = resolution
    ? `${ctx.actor.name} ${RESOLUTION_WORD[resolution.how]} defect ${n}`
    : `${ctx.actor.name} undid the correction for defect ${n}`;
  return withHistory(
    {
      ...task,
      status,
      returned: task.returned ? { ...task.returned, defects } : task.returned,
      draft: status === "draft" ? { by: ctx.actor.id, savedAt: at, note: task.draft?.note } : task.draft,
    },
    ctx,
    line
  );
}

/* ─────────────────────────── completing ─────────────────────────── */

/** Who prepared the work the signatory is completing, if it was someone else. */
function preparerOf(task: Task, ctx: Ctx): PersonId | undefined {
  const who = task.prepared?.by ?? task.draft?.by;
  return who && who !== ctx.actor.id ? who : undefined;
}

/**
 * The gate every completing step passes: a legal from-state and a signatory. Returns
 * the history line for the step: "X did it" — or, when someone else prepared the work,
 * "Completed by X — prepared by Y · did it".
 */
function beginComplete(task: Task, ctx: Ctx, what: string): (detail: string) => string {
  assertState(task, PREPARABLE, what);
  assertAllowed(canComplete(ctx.actor, ctx.kase), what);
  const preparer = preparerOf(task, ctx);
  return (detail) =>
    preparer
      ? `Completed by ${ctx.actor.name} — prepared by ${nameOf(ctx, preparer)} · ${detail}`
      : `${ctx.actor.name} ${detail}`;
}

/** E-sign applied. Signatories only. */
export function sign(task: Task, ctx: Ctx): Task {
  if (task.kind !== "sign") throw new TransitionError("invalid", "Not a signature task.");
  const line = beginComplete(task, ctx, "sign");
  const at = nowOf(ctx);
  const ref = newRef("ESIGN");
  return withHistory(
    {
      ...task,
      status: "done",
      statusNote: undefined,
      draft: undefined,
      completion: { by: ctx.actor.id, at, how: "event", receipt: ref },
    },
    ctx,
    line(`signed with Aadhaar e-Sign — ${ref}`)
  );
}

/** Record the gateway's answer. Payment is completing — signatories only. */
export function recordPayment(task: Task, ctx: Ctx, result: PaymentResult): Task {
  if (task.kind !== "pay") throw new TransitionError("invalid", "Not a payment task.");
  const line = beginComplete(task, ctx, "pay");
  const at = nowOf(ctx);
  const ref = newRef("TXN");
  const lastPayment = { result, ref, at };
  switch (result) {
    case "success":
      return withHistory(
        {
          ...task,
          status: "done",
          statusNote: undefined,
          draft: undefined,
          lastPayment,
          completion: { by: ctx.actor.id, at, how: "event", receipt: ref },
        },
        ctx,
        line(`paid — receipt ${ref}`)
      );
    case "pending":
      return withHistory(
        {
          ...task,
          status: "payment-confirming",
          statusNote: `Gateway ref ${ref}`,
          draft: undefined,
          lastPayment,
        },
        ctx,
        line(`paid — gateway is confirming (ref ${ref})`)
      );
    case "failed":
      // Nothing moved: the task keeps its state (open stays open, a draft stays a draft,
      // a ready item stays ready) and says why.
      return withHistory(
        { ...task, statusNote: "Payment failed — try again", lastPayment },
        ctx,
        `Payment failed (ref ${ref}) — nothing was paid`
      );
  }
}

/** File with the court. Signatories only. */
export function file(task: Task, ctx: Ctx, files?: StoredFileRef[]): Task {
  if (task.kind !== "file" && task.kind !== "draft") {
    throw new TransitionError("invalid", "Not a filing task.");
  }
  const line = beginComplete(task, ctx, "file");
  return withHistory(
    {
      ...task,
      status: "awaiting-court",
      statusNote: undefined,
      draft: undefined,
      files: files ?? task.files,
    },
    ctx,
    line("filed with the court — awaiting scrutiny")
  );
}

/**
 * Send the corrections back to scrutiny, once every defect is addressed. Signatories only.
 *
 * The gate reads the recorded resolutions rather than a tick: a field counts once its
 * value has changed or the advocate kept it as filed, a document once it is replaced.
 */
export function refile(task: Task, ctx: Ctx): Task {
  if (task.kind !== "returned") throw new TransitionError("invalid", "Not a returned filing.");
  const line = beginComplete(task, ctx, "re-file");
  const defects = task.returned?.defects ?? [];
  if (!defects.length || !defects.every(resolutionSatisfies)) {
    throw new TransitionError("invalid", "Every defect must be resolved before the corrections go back.");
  }
  return withHistory(
    { ...task, status: "awaiting-court", statusNote: undefined, draft: undefined },
    ctx,
    line("submitted the corrections to scrutiny")
  );
}

/**
 * Answer a request addressed to this advocate: accept it or decline it. The addressee
 * only. The decision closes the task either way — what happens next (the removal goes
 * ahead, or the requester routes it to the magistrate) is the requester's move, on
 * their own screens.
 */
export function respond(task: Task, ctx: Ctx, accepted: boolean, note?: string): Task {
  if (task.kind !== "review") throw new TransitionError("invalid", "Not a request to review.");
  assertState(task, ["open"], "respond to");
  const addressee = task.review?.of;
  assertAllowed(
    canView(ctx.actor, ctx.kase) && (!addressee || ctx.actor.id === addressee),
    "respond to"
  );
  const at = nowOf(ctx);
  const text = note?.trim() || undefined;
  return withHistory(
    {
      ...task,
      status: "done",
      statusNote: undefined,
      review: task.review
        ? { ...task.review, decision: { by: ctx.actor.id, at, accepted, note: text } }
        : task.review,
      completion: { by: ctx.actor.id, at, how: "event" },
    },
    ctx,
    `${ctx.actor.name} ${accepted ? "accepted" : "declined"} the request${text ? ` — “${text}”` : ""}`
  );
}

/**
 * By hand — the escape hatch for work completed outside DRISTI: at the counter, in
 * court, on paper. Anyone on the case, from any open state; the record says how.
 */
export function markDone(task: Task, ctx: Ctx): Task {
  assertState(task, PREPARABLE, "mark done");
  assertAllowed(canMarkDone(ctx.actor, task, ctx.kase), "mark done");
  const at = nowOf(ctx);
  return withHistory(
    {
      ...task,
      status: "done",
      statusNote: undefined,
      draft: undefined,
      completion: { by: ctx.actor.id, at, how: "manual" },
    },
    ctx,
    `${ctx.actor.name} marked this done — completed outside DRISTI`
  );
}

/* ─────────────────────────── archiving ─────────────────────────── */

/**
 * Put a task away without closing it. Anyone on the case, from any state that is not
 * already closed; the state it left is kept so unarchive can restore it.
 */
export function archive(task: Task, ctx: Ctx): Task {
  if (TERMINAL.has(task.status) || task.status === "archived") {
    throw new TransitionError("illegal-state", "Only a task that is not closed can be archived.");
  }
  assertAllowed(canArchive(ctx.actor, task, ctx.kase), "archive");
  return withHistory(
    {
      ...task,
      status: "archived",
      archived: { by: ctx.actor.id, at: nowOf(ctx), from: task.status },
    },
    ctx,
    `${ctx.actor.name} archived this`
  );
}

/** Bring an archived task back to the state it left. Anyone on the case. */
export function unarchive(task: Task, ctx: Ctx): Task {
  assertState(task, ["archived"], "restore");
  assertAllowed(canView(ctx.actor, ctx.kase), "restore");
  const from = task.archived?.from ?? "open";
  return withHistory(
    { ...task, status: from, archived: undefined },
    ctx,
    `${ctx.actor.name} restored this from the archive`
  );
}

/* ─────────────────────────── the gateway and the court ─────────────────────────── */

/** The gateway confirms a pending payment. System event; anyone on the case may record it. */
export function confirmPayment(task: Task, ctx: Ctx): Task {
  assertState(task, ["payment-confirming"], "confirm payment on");
  assertAllowed(canView(ctx.actor, ctx.kase), "confirm payment on");
  const at = nowOf(ctx);
  const ref = task.lastPayment?.ref ?? newRef("TXN");
  const payer = [...task.history].reverse().find((h) => h.by && /paid/.test(h.text))?.by;
  return withHistory(
    {
      ...task,
      status: "done",
      statusNote: undefined,
      lastPayment: { result: "success", ref, at },
      completion: { by: payer, at, how: "event", receipt: ref },
    },
    ctx,
    `Payment confirmed — receipt ${ref}`,
    undefined
  );
}

/** Registry accepted the filing. System event. */
export function courtAccepted(task: Task, ctx: Ctx): Task {
  assertState(task, ["awaiting-court"], "accept");
  assertAllowed(canView(ctx.actor, ctx.kase), "record acceptance on");
  const at = nowOf(ctx);
  const ref = newRef("ACK");
  const filer = [...task.history].reverse().find((h) => h.by && /filed/.test(h.text))?.by;
  return withHistory(
    {
      ...task,
      status: "done",
      completion: { by: filer, at, how: "event", receipt: ref },
    },
    ctx,
    `Accepted by the registry — acknowledgement ${ref}`,
    undefined
  );
}

/**
 * Registry returned the filing for compliance. The filed task is superseded and a
 * `returned` task takes its place, carrying the defects and the same deadline shape.
 */
export function courtReturned(task: Task, ctx: Ctx, defects: string[]): { task: Task; created: Task } {
  assertState(task, ["awaiting-court"], "return");
  assertAllowed(canView(ctx.actor, ctx.kase), "record a return on");
  const list = defects.map((d) => d.trim()).filter(Boolean);
  if (!list.length) throw new TransitionError("invalid", "At least one defect is needed.");
  const at = nowOf(ctx);
  const n = list.length;
  const plural = `${n} defect${n === 1 ? "" : "s"}`;
  const superseded = withHistory(
    {
      ...task,
      status: "obsolete",
      statusNote: `Returned by scrutiny with ${plural} — replaced by a re-filing task`,
    },
    ctx,
    `Returned by scrutiny with ${plural}`,
    undefined
  );
  const object = objectOf(task.title);
  const created: Task = {
    id: `${task.id}-ret-${at.slice(0, 10).replace(/-/g, "")}`,
    caseId: task.caseId,
    kind: "returned",
    title: `Fix ${plural} and re-file ${object}`,
    why: { event: `Scrutiny returned ${object} for compliance with ${plural}`, at },
    whatToDo: "Fix each defect, attach the corrected document where one is needed, and re-file.",
    documentsNeeded: task.documentsNeeded,
    dueAt: task.dueAt,
    dueKind: task.dueKind,
    deadlineNote: task.deadlineNote,
    hearingAt: task.hearingAt,
    isBlocking: task.isBlocking,
    createdAt: at,
    systemObservable: true,
    status: "open",
    returned: {
      by: "scrutiny",
      at,
      defects: list.map((note, i): Defect => ({ n: i + 1, note, target: filedBundleTarget(i) })),
    },
    files: task.files,
    history: [{ at, text: `Created — scrutiny returned ${object} with ${plural}` }],
  };
  return { task: superseded, created };
}

/**
 * Where a defect raised by the *sandbox* registry control points. That control takes free
 * text — it stands in for a registry we do not have — so the defect lands on the filed
 * bundle rather than pretending to know which field the officer meant. A real scrutiny
 * service sends the target with the remark (see `DefectTarget`).
 */
function filedBundleTarget(index: number): DocTarget {
  return {
    kind: "doc",
    step: "documents",
    slotKey: `filed-bundle-${index + 1}`,
    label: "The filed bundle",
    sectionLabel: "Documents",
  };
}

/** "File the proof affidavit…" → "the proof affidavit…"; "Continue the draft X" → "the X". */
function objectOf(title: string): string {
  const stripped = title
    .replace(/^(File|Upload|Submit|Produce|Re-file|Sign|Pay|Continue)\s+/i, "")
    .replace(/^the draft\s+/i, "the ")
    .replace(/\s+—.*$/, "");
  return /^the\s/i.test(stripped) ? stripped : `the ${stripped}`;
}

/* ─────────────────────────── housekeeping ─────────────────────────── */

/** The window closed. System event. */
export function expire(task: Task, ctx: Ctx, reason: string): Task {
  assertState(task, PREPARABLE, "expire");
  return withHistory({ ...task, status: "expired", statusNote: reason }, ctx, `Expired — ${reason}`, undefined);
}

/** No longer needed — order withdrawn, case disposed. System event or a person. */
export function obsolete(task: Task, ctx: Ctx, reason: string): Task {
  if (TERMINAL.has(task.status)) {
    throw new TransitionError("illegal-state", "A closed task cannot be made obsolete.");
  }
  return withHistory({ ...task, status: "obsolete", statusNote: reason }, ctx, `No longer needed — ${reason}`);
}

/** A due date moved (a hearing was adjourned). Keeps the old date for the cue. */
export function redate(task: Task, ctx: Ctx, newDue: string, reason: string, newHearing?: string): Task {
  if (TERMINAL.has(task.status)) {
    throw new TransitionError("illegal-state", "A closed task cannot be re-dated.");
  }
  const at = nowOf(ctx);
  const from = task.dueAt ?? task.hearingAt ?? at;
  return withHistory(
    {
      ...task,
      dueAt: newDue,
      hearingAt: newHearing ?? task.hearingAt,
      redate: { from, to: newDue, reason, at },
      statusNote: `Moved from ${shortDate(from)} — ${reason}`,
    },
    ctx,
    `Due date moved from ${shortDate(from)} to ${shortDate(newDue)} — ${reason}`,
    undefined
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
