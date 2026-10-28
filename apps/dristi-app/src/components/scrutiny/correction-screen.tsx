"use client";

/**
 * Scrutiny return — the correction round.
 *
 * The filing came back from the Registry with defects; this is where the advocate sees
 * exactly what was flagged, fixes it *in the filing itself*, and submits the corrections.
 * It is the e-filing form re-entered in a correction posture (brief D2), not a second
 * form: same steps, same section components, same validation. Three panes — the sections,
 * the section, the resolution queue — with the queue as the spine (D5).
 *
 * The two rules that shape everything else:
 *
 *   · **Nothing unflagged can be edited** (D3, owner's answer to O5). A correction round
 *     is not an edit round, and the reason is stated as text in each section rather than
 *     hidden in a tooltip on a dead control.
 *   · **Resolved is derived, never certified** (D6). The screen reconciles each defect's
 *     recorded resolution against what the filing actually holds — see `lib/tasks/defects`
 *     — so nothing counts because someone ticked it.
 *
 * Derivation is live; the *record* is not. What the advocate sees — the frame's state, the
 * queue's count, the submit gate — recomputes on every keystroke from the draft. What the
 * task's history receives is written only when a human act finishes: focus leaves the
 * field, typing pauses, a value is kept as filed, or the corrections are submitted. A
 * history that gained a line per keystroke would be a log of the keyboard, not of the work.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BellIcon,
  CircleCheckIcon,
  ClockIcon,
  FlaskConicalIcon,
  ListChecksIcon,
  LockIcon,
  PanelLeftIcon,
  SendIcon,
} from "lucide-react";


import { dueCueOf, longDate } from "@/lib/tasks/format";
import {
  allResolved,
  countResolved,
  firstUnresolved,
  formOrder,
  intendedResolution,
  sameResolution,
  targetKey,
} from "@/lib/tasks/defects";
import { useRoomInRem } from "@/hooks/use-min-width";
import { cn } from "@/lib/utils";
import { useFiling } from "@/lib/filing/store";
import { intakeSlot, readTarget, writeTarget } from "@/lib/filing/targets";
import type { StepId, StoredFileRef } from "@/lib/filing/types";
import type { Ctx } from "@/lib/tasks/transitions";
import { refile, resolveDefect } from "@/lib/tasks/transitions";
import { useProfile } from "@/lib/filing/profile";
import { carryOverOaths, isOutstanding, signatories } from "@/lib/filing/selectors";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { SignFlowDialog, type SignFlowStart } from "@/components/filing/sign-flow-dialog";
import { signingRules } from "@/lib/filing/config";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Case, Defect, Resolution, Task } from "@/lib/tasks/types";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  FilingChromeContext,
  TOP_BAR_HEIGHT,
  type FilingChromeValue,
} from "@/components/filing/chrome";
import { Breadcrumbs } from "@/components/shell/chrome";
import { CorrectionProvider, type CorrectionValue } from "@/components/filing/posture";
import { DefectCard, type DefectActions } from "@/components/scrutiny/defect-card";
import {
  QueueProgress,
  ResolutionQueue,
  submitReason,
  type QueueDefect,
} from "@/components/scrutiny/resolution-queue";
import { SectionRail } from "@/components/scrutiny/section-rail";
import { SectionBody } from "@/components/scrutiny/section-body";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { Identifier } from "@/components/chrome/identifier";
import { useOrigin } from "@/components/shell/origin";
import { useCourt, useCourtText } from "@/components/court/court-provider";
import { localizeCourtText } from "@/lib/court/localize";

/** Where the correction round starts when nothing is flagged on a step yet. */
const FALLBACK_STEP: StepId = "cheque";

/**
 * The sections rail is sized in pixels, not rems, on purpose.
 *
 * Tailwind's breakpoints are viewport pixels and do not move with the root font size, but
 * `w-64` does — so at 200% text zoom the rail would double while the ladder stayed on three
 * panes, and the page would scroll sideways. `ACCESSIBILITY.md` §10 and `RESPONSIVE.md`
 * rule 9 both forbid that. Held in pixels, the rail keeps its width and the columns beside
 * it reflow, which is what zooming is for.
 *
 * The record and the corrections panel have no fixed width any more: they are a resizable
 * pair whose proportions the advocate sets (v3.2).
 */
const RAIL_W = 256;

/** Room the three-pane and two-pane layouts need, measured in the page's own text. */
const RAIL_REM = 80;
const QUEUE_REM = 64;

/** How long typing has to stop before the act is written to the task's history. */
const COMMIT_QUIET_MS = 700;

/** The one primary action, sized by its words rather than clipping them. */
const SUBMIT_CLASS = "h-auto min-h-11 w-full whitespace-normal py-2 text-center";

/**
 * Where the record / corrections handle was left, on this device.
 *
 * `react-resizable-panels` v4 dropped `autoSaveId` for an explicit
 * `defaultLayout` + `onLayoutChanged` pair, so the persistence is ours to do — which is
 * fine, and honest about the failure mode: a browser with storage denied simply opens on
 * the default split every time rather than throwing.
 */
const SPLIT_KEY = "dristi:scrutiny-return:split";

function readSplit(): Record<string, number> | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(SPLIT_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    const layout = parsed as Record<string, unknown>;
    /* Only take it if it is the shape we wrote — a stale or hand-edited value should fall
       back to the default rather than laying the screen out from nonsense. */
    return Object.values(layout).every((v) => typeof v === "number" && v > 0)
      ? (layout as Record<string, number>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Move focus to the thing that answers the defect.
 *
 * Not the flagged control any more — that one is read-only now (§15.2), and landing a
 * keyboard user on a field they cannot type in is the trap R12 warns about. The target is
 * the inset's primary action: Accept where scrutiny offered a correction, otherwise the
 * value control or the Replace button the inset nominates with `data-defect-focus`. D5's
 * rule is unchanged — move focus, do not merely scroll; only its target moves.
 */
function focusTheAction(scope: HTMLElement): void {
  const control =
    scope.querySelector<HTMLElement>("[data-defect-focus]:not([disabled])") ??
    scope.querySelector<HTMLElement>(
      "input:not([disabled]):not([type=hidden]), textarea:not([disabled]), select:not([disabled])"
    ) ??
    scope.querySelector<HTMLElement>("button:not([disabled])");
  control?.focus({ preventScroll: true });
}

export function CorrectionScreen({ task, kase }: { task: Task; kase: Case }) {
  const courtText = useCourtText();
  const { court } = useCourt();
  const router = useRouter();
  const { draft, update } = useFiling();
  const { act, busy, online } = useTaskActions();

  /* In form order, not the officer's numbering: the queue is an index of the form, so it
     reads the way the form's pages turn — Documents, Complainant, Cheque 1, Cheque 2 —
     and the screen opens on the first unresolved defect *of the form*, not of the memo. */
  /*
   * What scrutiny saw, in the selected court's terms. The filing store opens the draft
   * re-voiced for the court (`localizeDeep`), so a Kerala value like the IFSC
   * "KLGB0040231" reads "GJ…" in Gujarat; compared with the Kerala baseline it looked
   * already corrected before anyone touched it (owner's demo, 2026-10-12).
   */
  const recorded = React.useMemo(
    () =>
      [...(task.returned?.defects ?? [])]
        .map((d) =>
          d.target.kind === "field" && d.valueAtReturn
            ? { ...d, valueAtReturn: localizeCourtText(d.valueAtReturn, court) }
            : d
        )
        .sort(formOrder),
    [task.returned, court]
  );
  const valueOf = React.useCallback(
    (defect: Defect) => readTarget(draft, defect.target),
    [draft]
  );

  /**
   * "Keep as filed", by defect number — set by the advocate's click, cleared the moment
   * they edit the value instead. It overrides the recorded resolution until the record
   * catches up on commit.
   */
  const [keeps, setKeeps] = React.useState<Record<number, boolean>>({});
  /** The reason typed with each keep, by defect number — recorded with it. */
  const [reasons, setReasons] = React.useState<Record<number, string>>({});
  const reasonOf = (defect: Defect) => reasons[defect.n] ?? defect.resolution?.reason;

  /**
   * The defects as the screen sees them: the task's record, with any keep not yet
   * committed folded in. Every derivation below — the frames, the queue, the count, the
   * gate — reads this. `intendedResolution` is the same function the commit uses, so what
   * is shown and what will be recorded can never disagree.
   */
  const defects = React.useMemo(
    () =>
      recorded.map((d) => {
        const keep = keeps[d.n];
        if (keep === undefined) return d;
        const next = intendedResolution(
          d,
          readTarget(draft, d.target),
          keep,
          d.resolution?.at ?? "",
          reasons[d.n] ?? d.resolution?.reason
        );
        return sameResolution(d.resolution, next) ? d : { ...d, resolution: next };
      }),
    [recorded, keeps, reasons, draft]
  );

  /* ── Where we are ────────────────────────────────────────────────── */

  const [step, setStep] = React.useState<StepId>(
    () => firstUnresolved(recorded, (d) => readTarget(draft, d.target))?.target.step ?? FALLBACK_STEP
  );
  const [activeDefect, setActiveDefect] = React.useState<number | null>(
    () => firstUnresolved(recorded, (d) => readTarget(draft, d.target))?.n ?? null
  );
  const [instanceRequest, setInstanceRequest] = React.useState<
    CorrectionValue["instanceRequest"]
  >(null);
  const [railOpen, setRailOpen] = React.useState(false);
  /**
   * The D11 ladder, measured in the page's own text rather than in viewport pixels: three
   * panes need ~80rem of room, the queue alone needs ~64rem. At 200% text zoom a 1280px
   * window is forty rem wide, so the rails fold to their sheet and the form keeps the
   * width — which is what stops "Case documents" becoming "Cas…".
   */
  const railColumn = useRoomInRem(RAIL_REM);
  const queueColumn = useRoomInRem(QUEUE_REM);
  const [queueOpen, setQueueOpen] = React.useState(false);
  /**
   * Whether the record shows the whole filing or only what scrutiny flagged. Off by
   * default — eight flagged fields scattered through thirteen sections is a
   * needle-in-haystack read; the toggle in the header brings the rest back, receded,
   * for the advocate who wants the surrounding context (owner, 2026-08-21).
   */
  const [showAll, setShowAll] = React.useState(false);
  const nonce = React.useRef(0);

  /** Has the advocate chosen to keep the filed value — now, or on the record? */
  const keepOf = (defect: Defect) =>
    keeps[defect.n] ?? defect.resolution?.how === "kept";

  /* ── Recording what was done ─────────────────────────────────────── */

  /**
   * The gap between what the task's record says and what the filing (plus any reason
   * typed) actually shows. Empty on every render where nothing has been done — which is
   * most of them, including every keystroke that only retypes the same conclusion.
   */
  const pending = React.useMemo<{ n: number; resolution: Resolution | undefined }[]>(() => {
    if (task.status === "awaiting-court") return [];
    const at = new Date().toISOString();
    const changes: { n: number; resolution: Resolution | undefined }[] = [];
    for (const defect of recorded) {
      let next: Resolution | undefined;
      if (defect.target.kind === "doc") {
        /* A replacement upload is the resolution; putting the original back undoes it. */
        const slot = intakeSlot(draft, defect.target.slotKey);
        const replaced = !!slot?.file && slot.file.id !== defect.valueAtReturn;
        next = replaced ? { how: "replaced", at, replacement: slot!.file! } : undefined;
      } else {
        const value = valueOf(defect);
        /* A target this draft cannot resolve is not evidence that nothing was done. */
        if (value === undefined) continue;
        next = intendedResolution(defect, value, keepOf(defect), at, reasonOf(defect));
      }
      if (!sameResolution(defect.resolution, next)) changes.push({ n: defect.n, resolution: next });
    }
    return changes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorded, draft, keeps, reasons, valueOf, task.status]);

  /**
   * Write the gap to the task — one dispatch, and one history line per defect actually
   * decided. Folding the writes into a single transition also keeps them consistent: each
   * `resolveDefect` is pure, so they compose on the same task rather than racing to
   * overwrite one another.
   */
  const commit = React.useCallback(() => {
    if (pending.length === 0) return;
    void act(task.id, (t, c: Ctx) =>
      pending.reduce((acc, ch) => resolveDefect(acc, c, ch.n, ch.resolution), t)
    );
  }, [act, pending, task.id]);

  /* So a timer and a blur handler both reach the latest one without re-subscribing. */
  const commitRef = React.useRef(commit);
  React.useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  /**
   * Set by an explicit action — keep, undo — which is a finished act the moment it is
   * clicked. It still waits for the next render, because the draft has to settle before
   * there is anything true to write.
   */
  const commitSoon = React.useRef(false);

  /**
   * Commit when typing stops. Blur commits too (see `onFrameBlur`), which is the usual
   * path; this catches the advocate who types a value and then reaches for the mouse
   * without leaving the field, and it is what keeps the record honest if the tab is closed.
   */
  React.useEffect(() => {
    if (pending.length === 0) return;
    /* A replaced document is a finished act the moment the upload lands — no typing to
       wait out — so it is recorded at once and its card settles without a pause. */
    const docLanded = pending.some(
      (ch) => recorded.find((d) => d.n === ch.n)?.target.kind === "doc",
    );
    const wait = commitSoon.current || docLanded ? 0 : COMMIT_QUIET_MS;
    commitSoon.current = false;
    const id = window.setTimeout(() => commitRef.current(), wait);
    return () => window.clearTimeout(id);
  }, [pending, recorded]);

  /**
   * Focus leaving a defect — its field *and* its inset, which the layer works out — ends
   * the act, so the record is written now rather than on the quiet timer.
   */
  const onFrameBlur = React.useCallback(() => commitRef.current(), []);

  /* ── Navigating to a defect ──────────────────────────────────────── */

  const openDefect = React.useCallback(
    (n: number) => {
      const defect = defects.find((d) => d.n === n);
      if (!defect) {
        setActiveDefect(null);
        return;
      }
      setActiveDefect(n);
      setStep(defect.target.step);
      setQueueOpen(false);
      if (defect.target.kind === "field" && defect.target.instance !== undefined) {
        nonce.current += 1;
        setInstanceRequest({
          step: defect.target.step,
          instance: defect.target.instance,
          nonce: nonce.current,
        });
      }
      /*
       * Two things move, each inside its own scroller — nothing else on the screen moves
       * (owner, 2026-08-21: the loose-scrolls round).
       *
       * The *record pane* scrolls to the field, so the value under discussion is in view —
       * but focus does not go there: that control is read-only, and landing a keyboard user
       * on a field they cannot type in is the trap R12 warns about. The *panel's* scroller
       * brings the opened card to its top, and focus goes to the card's primary action.
       * Both are scoped `scrollTo` calls on the pane itself; `scrollIntoView` is used only
       * below the fold, where the page is the one scroller there is — on the three-pane
       * layout it would walk the ancestors and drag the held viewport around, which is
       * exactly the "random scrolls" this fixes.
       */
      window.setTimeout(() => {
        const group = document.getElementById(`defect-${n}`);
        if (group) {
          const pane = group.closest("main");
          if (queueColumn && pane) {
            const top = pane.scrollTop + group.getBoundingClientRect().top -
              pane.getBoundingClientRect().top - 24;
            pane.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          } else if (!queueColumn) {
            group.scrollIntoView({ block: "start", behavior: "smooth" });
          }
        }
        const card = document.querySelector<HTMLElement>("[data-defect-card]");
        if (card) {
          const viewport = card.closest<HTMLElement>("[data-slot=scroll-area-viewport]");
          if (viewport) {
            const top = viewport.scrollTop + card.getBoundingClientRect().top -
              viewport.getBoundingClientRect().top - 12;
            viewport.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          }
          focusTheAction(card);
        }
      }, 120);
    },
    [defects, queueColumn]
  );

  /* ── Progress and the gate ───────────────────────────────────────── */

  const { resolved, total } = countResolved(defects, valueOf);
  const complete = allResolved(defects, valueOf);
  const items: QueueDefect[] = defects.map((defect) => ({ defect, value: valueOf(defect) }));
  const countFor = React.useCallback(
    (id: StepId) => defects.filter((d) => d.target.step === id).length,
    [defects]
  );

  /* ── What the panel's card can do ────────────────────────────────── */

  /**
   * Pickers lent by the document slots on screen (v3.2). The card holds the Replace action
   * but the slot owns the upload, so it registers its own `onChoose` here.
   */
  const replacers = React.useRef(new Map<string, () => void>());
  /* A Replace pressed while the document's section was not on screen: opened when its
     slot mounts and lends its picker. */
  const replaceWhenReady = React.useRef<string | null>(null);
  /* The copy scrutiny saw, kept when it is replaced, so Undo can put it back. Before,
     Undo on a replaced document only cleared the mark (owner, 2026-10-12). */
  const originals = React.useRef(new Map<string, StoredFileRef>());
  const originalsKey = `dristi:scrutiny-originals:${draft.id}`;
  /* Kept with the draft (it lives in local storage too), so Undo still works after a
     reload. Storage refused: it holds for this visit only. */
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(originalsKey);
      if (saved) {
        for (const [k, f] of Object.entries(JSON.parse(saved) as Record<string, StoredFileRef>)) {
          if (!originals.current.has(k)) originals.current.set(k, f);
        }
      }
    } catch {
      /* nothing to restore */
    }
  }, [originalsKey]);
  const rememberOriginal = (slotKey: string, file: StoredFileRef) => {
    originals.current.set(slotKey, file);
    try {
      window.localStorage.setItem(
        originalsKey,
        JSON.stringify(Object.fromEntries(originals.current)),
      );
    } catch {
      /* storage refused */
    }
  };
  const registerReplace = React.useCallback((slotKey: string, choose: () => void) => {
    replacers.current.set(slotKey, choose);
    if (replaceWhenReady.current === slotKey) {
      replaceWhenReady.current = null;
      choose();
    }
    return () => {
      if (replacers.current.get(slotKey) === choose) replacers.current.delete(slotKey);
    };
  }, []);
  const replaceFor = React.useCallback(
    (slotKey: string) => replacers.current.get(slotKey),
    []
  );

  /* ── Where the handle was left ───────────────────────────────────── */

  /**
   * Read once, on the client. Reading during render would hand the server a different
   * layout from the browser's and hydrate mismatched; reading in an effect would lay the
   * panes out at the default and then jump. `useState`'s initialiser runs on the client's
   * first render only, which is the moment that has both the storage and no paint yet.
   */
  const [savedLayout] = React.useState<Record<string, number> | undefined>(readSplit);
  const rememberLayout = React.useCallback((layout: Record<string, number>) => {
    try {
      window.localStorage.setItem(SPLIT_KEY, JSON.stringify(layout));
    } catch {
      /* Storage denied (private mode, quota): the split still works, it just forgets. */
    }
  }, []);

  const setKeep = (n: number, keep: boolean) =>
    setKeeps((prev) => (prev[n] === keep ? prev : { ...prev, [n]: keep }));

  /**
   * Every write in a correction round goes through here — there is no other route. The
   * form's control is read-only, so the card's own value control is the only thing that
   * can change a filed value, and *Keep as filed* the only way to leave it standing.
   */
  const defectActions = (defect: Defect): DefectActions => ({
    setValue: (value) => {
      update((d) => writeTarget(d, defect.target, value));
      setKeep(defect.n, false);
      setActiveDefect(defect.n);
    },
    keep:
      defect.target.kind === "field"
        ? (reason) => {
            setReasons((prev) => ({ ...prev, [defect.n]: reason }));
            setKeep(defect.n, true);
            setActiveDefect(defect.n);
            commitSoon.current = true;
          }
        : undefined,
    undo: defect.resolution
      ? () => {
          const target = defect.target;
          if (target.kind === "field") {
            update((d) => writeTarget(d, target, defect.valueAtReturn ?? ""));
          } else {
            /* The filed copy back if it was kept; otherwise the replacement comes off
               and the card asks for a document again. Either way Undo visibly undoes. */
            const original = originals.current.get(target.slotKey) ?? null;
            update((d) => {
              const slot = intakeSlot(d, target.slotKey);
              if (slot) slot.file = original;
            });
          }
          setKeep(defect.n, false);
          setReasons((prev) => ({ ...prev, [defect.n]: "" }));
          commitSoon.current = true;
        }
      : undefined,
    /* Looked up when pressed, not when the card renders: the picker belongs to the
       document's slot, which is only mounted while its section is on screen. Before,
       Replace did nothing from any other section (owner, 2026-10-12). */
    replace:
      defect.target.kind === "doc"
        ? () => {
            const target = defect.target;
            if (target.kind !== "doc") return;
            const current = intakeSlot(draft, target.slotKey)?.file;
            if (current && current.id === defect.valueAtReturn) {
              rememberOriginal(target.slotKey, current);
            }
            const choose = replacers.current.get(target.slotKey);
            if (choose) {
              choose();
              return;
            }
            replaceWhenReady.current = target.slotKey;
            setActiveDefect(defect.n);
            setStep(target.step);
          }
        : undefined,
  });

  const correction: CorrectionValue = {
    step,
    defectAt: (s, instance, field) =>
      defects.find(
        (d) =>
          d.target.kind === "field" &&
          d.target.step === s &&
          (d.target.instance ?? 0) === instance &&
          d.target.field === field
      ) ?? null,
    defectForSlot: (s, slotKey) =>
      defects.find(
        (d) => d.target.kind === "doc" && d.target.step === s && d.target.slotKey === slotKey
      ) ?? null,
    valueOf,
    activeDefect,
    setActiveDefect,
    instanceRequest,
    showAll,
    registerReplace,
    replaceFor,
  };

  /* ── Submitting ──────────────────────────────────────────────────── */

  /*
   * The way back is the door, when one was recorded — the filings queue on the tab and
   * page the advocate left it on, say. The task's own detail is the fallback, which is
   * right for someone who arrived from the task list and wrong for everyone else.
   */
  const origin = useOrigin();
  const back = origin?.href ?? `/tasks?task=${encodeURIComponent(task.id)}`;

  /*
   * Sending back, in windows over this screen (owner, 2026-10-12: it used to jump to the
   * e-filing Sign page, which changed the whole screen). Every edit invalidates every
   * signature (`LIFE-13`), so the corrected complaint is signed again first (`SIG-07`):
   *
   *   1. a confirmation says so;
   *   2. e-filing's own signing window (`SignFlowDialog`) opens on top;
   *   3. once every signature and oath is in, the send itself is confirmed, as on Sign.
   *
   * If others still have to sign, the window closes and this button reopens it; their
   * signatures arrive through their links as at e-filing.
   */
  const { profile } = useProfile();
  const everyoneSigning = React.useMemo(() => {
    const { complainants, advocates } = signatories(draft, profile);
    return [...complainants, ...advocates];
  }, [draft, profile]);
  const signaturesComplete =
    everyoneSigning.length > 0 && !everyoneSigning.some(isOutstanding);
  const [confirmSignOpen, setConfirmSignOpen] = React.useState(false);
  const [signOpen, setSignOpen] = React.useState(false);
  /** The old signatures are already off: this round is being signed. */
  const signing = !!draft.scrutinyReturn && draft.lastStep === "sign";

  /**
   * Oaths scrutiny flagged as an error, by complainant signatory id — the only ones
   * recorded again (`OTH-5`). A defect cannot name an oath yet (`lib/tasks/types`), so
   * nothing is flagged here.
   */
  const flaggedOaths: string[] = [];

  /** Record what was fixed on the task and take the old signatures off. */
  const prepareSigning = async () => {
    if (pending.length > 0) {
      const done = await act(task.id, (t, c: Ctx) =>
        pending.reduce((acc, ch) => resolveDefect(acc, c, ch.n, ch.resolution), t)
      );
      if (!done) return false;
    }
    const now = new Date().toISOString();
    update((d) => {
      d.sign.requestedAt = null;
      d.sign.notified = {};
      d.sign.signed = {};
      d.sign.signedCopy = null;
      d.sign.confirmed = {};
      // The oath is not recorded again unless scrutiny flagged it (`OTH-5`). This
      // return's defects are fields and documents only, so every oath carries over.
      d.sign.oaths = carryOverOaths(d.sign.oaths, flaggedOaths);
      d.scrutinyReturn = { resubmittedAt: null, signingFrom: now };
      d.lastStep = "sign";
    });
    return true;
  };

  /*
   * Coming back to a round already being signed opens where it stands, not at the start
   * (owner, 2026-10-13): your own signature if it is still owed, then your oath, else the
   * roster of who is still to sign — with a reminder for them and, in the sandbox, a way
   * to mark them done.
   */
  const yous = everyoneSigning.filter((s) => s.you);
  const othersWaiting = everyoneSigning.filter((s) => !s.you && isOutstanding(s));
  const signStart: SignFlowStart = !signing || !draft.sign.requestedAt
    ? "choose"
    : yous.some((s) => s.status === "pending")
      ? "sign"
      : yous.some((s) => s.oathTaken === false)
        ? "oath"
        : "status";

  /* Fixed when the window opens. Recomputed live, it changed the moment an oath was
     saved, and the window restarted on the roster mid-oath (owner, 2026-10-13). */
  /** The send happened in the signing window, which then says so and stays open. */
  const [sent, setSent] = React.useState(false);
  const [openedAt, setOpenedAt] = React.useState<SignFlowStart>("choose");
  const openSigning = (start: SignFlowStart) => {
    setOpenedAt(start);
    setSent(false);
    setSignOpen(true);
  };

  const submit = async () => {
    if (signing) openSigning(signStart);
    else setConfirmSignOpen(true);
  };

  /** Ask again, for everyone still waiting. The link itself does not change. */
  const [reminded, setReminded] = React.useState(false);
  const remindOthers = () => {
    const now = new Date().toISOString();
    update((d) => {
      for (const s of othersWaiting) d.sign.notified[s.id] = now;
    });
    setReminded(true);
    toast.success(
      othersWaiting.length === 1
        ? `Reminder sent to ${othersWaiting[0].name}`
        : `Reminder sent to ${othersWaiting.length} people`,
    );
  };

  /**
   * Sandbox only: the other parties' links go nowhere, so this stands in for them signing
   * (and, where the court asks for one and it did not carry over, recording the oath). With everyone done, the send
   * is the next act, so its confirmation follows at once.
   */
  const sandboxEveryoneDone = () => {
    const at = new Date().toISOString();
    update((d) => {
      for (const s of everyoneSigning) {
        if (!d.sign.signed[s.id]) d.sign.signed[s.id] = { at, with: "aadhaar" };
        if (s.oathTaken === false) d.sign.oaths[s.id] = { at, video: null };
      }
    });
    // The window stays: the roster turns to everyone signed and offers the send.
  };

  /* The flask's menu item unmounts with the footer it sat in, so focus would fall to the
     page; it lands on the send instead, which is the next act. */
  const sendRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (signOpen && signaturesComplete && !sent) sendRef.current?.focus();
  }, [signOpen, signaturesComplete, sent]);

  const sendBack = async () => {
    const done = await act(task.id, refile, "Corrections sent to scrutiny");
    if (!done) return;
    update((d) => {
      d.scrutinyReturn = { resubmittedAt: new Date().toISOString() };
    });
    /* No jump: the window says it went, and the advocate leaves when they choose
       (owner, 2026-10-13). */
    setSent(true);
  };

  /* The roster's footer: while others are still to sign, the sandbox and a reminder;
     once everyone has, the send itself — in this same window. */
  /* The window's own close stays for staying here; the one act is the way out. */
  const statusActions = sent ? (
    <Button type="button" onClick={() => router.push(back)}>
      Back to dashboard
    </Button>
  ) : signaturesComplete ? (
    <>
      <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => setSignOpen(false)}>
        Not yet
      </Button>
      <Button ref={sendRef} type="button" disabled={!online || !!busy} onClick={() => void sendBack()}>
        <SendIcon data-icon="inline-start" aria-hidden />
        Send to scrutiny
      </Button>
    </>
  ) : (
    <>
      <div className="flex items-center gap-2 sm:mr-auto">
        {/* Not modal: a modal menu inside the dialog left the page pointer-locked after
            its item was chosen, so the next click went nowhere. */}
        <DropdownMenu modal={false}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Sandbox: mark the other signatures"
                  className="text-muted-foreground"
                >
                  <FlaskConicalIcon aria-hidden />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Sandbox: mark the other signatures</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>No link is sent in the sandbox</DropdownMenuLabel>
            <DropdownMenuItem onSelect={sandboxEveryoneDone}>
              {signingRules().oath ? "Mark everyone as signed and sworn" : "Mark everyone as signed"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {othersWaiting.length ? (
          <Button type="button" variant="outline" disabled={reminded} onClick={remindOthers}>
            <BellIcon data-icon="inline-start" aria-hidden />
            {reminded ? "Reminder sent" : "Send a reminder"}
          </Button>
        ) : null}
      </div>
      <Button type="button" onClick={() => setSignOpen(false)}>
        Done
      </Button>
    </>
  );


  const reason = submitReason(resolved, total, online);
  /* Closing the window after the send leaves the advocate here; the screen says it went. */
  const isSent = sent || task.status === "awaiting-court";
  const submitLabel = isSent ? (
    <>
      <CircleCheckIcon data-icon="inline-start" aria-hidden />
      Sent to scrutiny
    </>
  ) : (
    <>
      <SendIcon data-icon="inline-start" aria-hidden />
      Send corrections back
    </>
  );

  /*
   * The correction screen is a filing chrome host in its own right: it owns the sections
   * rail's open state, and the source rail (rendered deep inside a section) reads this
   * context. Nothing here folds the main nav — that rail is not part of this screen.
   */
  const chrome: FilingChromeValue = React.useMemo(
    () => ({
      sectionsOpen: true,
      setSectionsOpen: () => undefined,
      sectionsSheetOpen: railOpen,
      setSectionsSheetOpen: setRailOpen,
      draftLabel: null,
      setDraftLabel: () => undefined,
    }),
    [railOpen]
  );

  /* ── The panes ───────────────────────────────────────────────────── */

  /**
   * The panel splits into a pinned head and a scrolling run: the counter and the
   * all-corrected banner never scroll away with the list, so "where am I" has one fixed
   * home (owner, 2026-08-21 — the loose scrolls round).
   */
  const queueHead = (
    <div className="flex flex-col gap-3">
      <QueueProgress resolved={resolved} total={total} />
      {complete ? (
        <p className="flex items-center gap-2 rounded-lg bg-success-muted px-4 py-3 text-body-compact font-medium text-success-muted-foreground">
          <CircleCheckIcon className="size-4 shrink-0" aria-hidden />
          {`All ${total} corrected.`}
        </p>
      ) : null}
    </div>
  );

  /**
   * The run, and the card for whichever defect is open. Nothing regroups as work is done:
   * a corrected row keeps its place and gains a tick, so the list never shuffles under the
   * cursor of someone working down it (v3.2).
   */
  const queueList = (
    <ResolutionQueue
      items={items}
      activeDefect={activeDefect}
      onOpenDefect={openDefect}
      renderOpen={(item, index) => (
        <DefectCard
          key={targetKey(item.defect.target)}
          defect={item.defect}
          value={item.value}
          actions={defectActions(item.defect)}
          file={
            item.defect.target.kind === "doc"
              ? intakeSlot(draft, item.defect.target.slotKey)?.file ?? undefined
              : undefined
          }
          index={index}
          total={total}
          onFocusCapture={() => setActiveDefect(item.defect.n)}
          onBlurCapture={onFrameBlur}
        />
      )}
    />
  );

  const submitBlock = (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        size="lg"
        /* The label wraps rather than clipping: at 200% text zoom it does not fit one line
           in any pane this screen has, and a clipped label is the loss of content
           `ACCESSIBILITY.md` §10 forbids. Height follows the words. */
        className={SUBMIT_CLASS}
        disabled={!complete || !online || !!busy || isSent}
        onClick={() => void submit()}
      >
        {submitLabel}
      </Button>
      {complete ? null : <p className="text-caption text-muted-foreground">{reason}</p>}
    </div>
  );

  /*
   * The page header: one slim identity strip. Getting *back* is the top bar's breadcrumb
   * (`<Breadcrumbs>` below publishes Tasks › the task › Scrutiny return), so no second
   * back affordance lives here, and the clock and the counter both live in the queue
   * (§15.6) — what remains is the return's name and whose case it is, in two lines that
   * cost the form almost no height.
   *
   * Where the queue is a column the header is chrome and stays put. Where the queue has
   * folded away, the header rides *inside* the centre pane and scrolls with it — at
   * 1280 × 200% text zoom a pinned header is more than half the window, which would leave
   * a hand's width of form to work in (`ACCESSIBILITY.md` §10).
   */
  /* The deadline is the return's one urgent fact, so it rides in the page's own header
     (owner, 2026-08-21) — the panel keeps the counter, and the two numbers cannot be
     confused for each other. The absolute date rides in a `<time dateTime>` because the
     five-day window is still an assumption (O7), and an assumption should be inspectable. */
  const due = task.dueAt ? dueCueOf(task) : null;

  const pageHeader = (
  <header className="z-30 flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-hairline bg-card px-4 py-3 sm:px-6">
    <div className="flex min-w-0 flex-col gap-0.5">
      <h1 className="text-title-s font-semibold tracking-tight text-foreground">
        Scrutiny return
      </h1>
      <p className="text-caption text-muted-foreground">
        {kase.parties}
        {kase.stNumber ? (
          <>
            {" · "}
            <Identifier value={kase.stNumber} label="case number" />
          </>
        ) : (
          " · Not yet numbered"
        )}
        {" · "}
        {courtText(kase.court)}
        {" · "}
        <span className="tabular-nums">
          Returned {task.returned ? longDate(task.returned.at) : "—"}
        </span>
      </p>
    </div>
    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
      {due ? (
        <p className="flex items-center gap-1.5 text-caption font-medium tabular-nums">
          <ClockIcon
            aria-hidden
            className={cn(
              "size-4 shrink-0",
              due.overdue ? "text-destructive-ink" : "text-warning-ink"
            )}
          />
          <span className={due.overdue ? "text-destructive-ink" : "text-warning-ink"}>
            {due.primary}
          </span>
          <span aria-hidden className="font-normal text-muted-foreground">
            ·
          </span>
          <time dateTime={task.dueAt} className="font-normal text-muted-foreground">
            {due.date}
          </time>
        </p>
      ) : null}
      {/* The record shows only what was flagged; this brings the rest back for context.
          A switch rather than a button: it is a reading mode, not an action. */}
      <div className="flex items-center gap-2">
        <Switch id="show-full-filing" checked={showAll} onCheckedChange={setShowAll} />
        <Label
          htmlFor="show-full-filing"
          className="text-caption font-medium text-muted-foreground"
        >
          Show full filing
        </Label>
      </div>
      {railColumn ? null : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setRailOpen(true)}
          aria-haspopup="dialog"
          className="shrink-0"
        >
          <PanelLeftIcon data-icon="inline-start" aria-hidden />
          Sections
        </Button>
      )}
    </div>
  </header>
  );

  return (
    <FilingChromeContext.Provider value={chrome}>
    <CorrectionProvider value={correction}>
      {/*
       * The way back lives in the top bar. Reached from the task list it reads
       * Tasks › the task › here; reached through a door in another area it reads that
       * area › here, and the task crumb goes — it is a place this person never stood,
       * and offering it as the step back would move them rather than return them.
       */}
      <Breadcrumbs
        root={origin}
        crumbs={
          origin
            ? [{ label: "Scrutiny return" }]
            : [{ label: task.title, href: back }, { label: "Scrutiny return" }]
        }
      />
      {/*
       * With room for the queue, the screen holds the viewport and each pane scrolls
       * inside it: panes that scrolled away with the page would leave the queue — the
       * critical action — off screen exactly when the form is long.
       *
       * Once the queue has folded into its drawer there is nothing to hold in place, and
       * holding the viewport becomes the bug: at 1280 × 200% text zoom the page header
       * alone is more than half the window, so a pinned header would leave a hand's width
       * of form to work in. Below the fold the page scrolls as a page and only the bar
       * with the submit action stays (`ACCESSIBILITY.md` §10, `RESPONSIVE.md` rule 9).
       */}
      <div
        style={queueColumn ? { height: `calc(100svh - ${TOP_BAR_HEIGHT})` } : undefined}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        {queueColumn ? pageHeader : null}

        <div className="flex min-h-0 min-w-0 flex-1">
          {/* Left — every section, with the defect counts. A column where there is room
              for one; the same list in a sheet where there is not. */}
          {railColumn ? (
            <aside
              aria-label="Sections"
              style={{ width: RAIL_W }}
              className="flex shrink-0 flex-col overflow-y-auto border-r border-hairline bg-sidebar py-4"
            >
              <SectionRail
                step={step}
                countFor={countFor}
                onSelect={setStep}
                onlyFlagged={!showAll}
              />
            </aside>
          ) : null}

          {/*
           * Record and workbench, with a handle between them (owner, 2026-08-21).
           *
           * How much room the evidence needs is not ours to decide once and for all: a
           * cropped cheque line wants width, a long section of the record wants width, and
           * which one matters changes defect by defect. So the split is the DS `Resizable`
           * with the proportions v3.1 settled as the default (roughly 632/560 at 1440),
           * the last drag remembered on this device, and minimums that keep either side
           * from being dragged into uselessness. The handle is keyboard-operable — it is
           * the primitive's separator, not a bare div.
           */}
          <ResizablePanelGroup
            orientation="horizontal"
            defaultLayout={savedLayout}
            onLayoutChanged={rememberLayout}
            className="min-h-0 min-w-0 flex-1"
          >
            {/* Centre — the section, as the record.

                The `[&_…]` utilities neutralise the DS's own `disabled:opacity-50`
                ghosting so that receding is decided in *one* place instead of compounding:
                `FormField` steps a whole untouched field back to 45% and the controls
                inside it render normally at that one opacity (owner, 2026-08-21). The
                sunken fill is kept per control shape, so a locked segmented answer or
                checkbox still shows its chosen state — the choice *is* the value there.
                The `!`s are owed to the primitives' `disabled:` rules tying at equal
                specificity; noted as upstream DS feedback. */}
            {/* `h-full overflow-hidden` on both panels is what makes each pane its own
                scroller: the primitive puts this className on a *nested* div that is
                otherwise content-sized, so without it the record grew to its content and
                the page itself scrolled — the "random scrolls" bug's root. */}
            <ResizablePanel
              id="record"
              defaultSize="53"
              minSize="30"
              className="flex h-full min-w-0 flex-col overflow-hidden"
            >
              <main
                className={cn(
                  "flex min-w-0 flex-1 flex-col overflow-y-auto pb-8",
                  "[&_:disabled]:opacity-100! [&_:disabled]:text-muted-foreground",
                  "[&_:has(:disabled):not([data-slot=field])]:opacity-100! [&_[data-slot=input-group-addon]]:opacity-100!",
                  "[&_input:disabled]:bg-surface-sunken! [&_textarea:disabled]:bg-surface-sunken!",
                  "[&_:has(>input:disabled)]:bg-surface-sunken! [&_[data-slot=select-trigger]:disabled]:bg-surface-sunken!",
                  /* An input inside a group (+91, ₹, a date's calendar button) stays clear:
                     the group carries the fill. Painted itself, its square box ran over the
                     group's rounded right edge (owner, 2026-10-13). */
                  "[&_[data-slot=input-group]_input:disabled]:bg-transparent!",
                  /* Full filing: every field scrutiny did not flag steps back, so the
                     flagged ones are what the eye finds. One rule here rather than in each
                     section, because only some sections build their fields with
                     `FormField` — the rest stayed at full strength (owner, 2026-10-13). */
                  showAll && "[&_[data-slot=field]]:opacity-45!",
                  // A field inside another field is already receded with it: no second step.
                  showAll && "[&_[data-slot=field]_[data-slot=field]]:opacity-100!",
                  // A flagged field, or a field holding one, stays at full strength.
                  showAll && "[&_[data-defect]_[data-slot=field]]:opacity-100!",
                  showAll && "[&_[data-slot=field]:has([data-defect])]:opacity-100!",
                  /* Flagged-only mode: the fields hide themselves (`FormField` returns
                     null), and these rules retire what they leave behind — section cards
                     none of them are in, and group headings ("The parties") whose every
                     card just went. An empty white panel is not a shorter form. */
                  !showAll && "[&_[data-slot=card]:not(:has([data-defect]))]:hidden",
                  !showAll && "[&_section:not(:has([data-defect]))]:hidden",
                  queueColumn && "px-4 pt-6 sm:px-6"
                )}
              >
                {queueColumn ? null : pageHeader}
                <div
                  className={cn(
                    "flex w-full min-w-0 max-w-4xl flex-col gap-4",
                    queueColumn ? null : "px-4 pt-4 sm:px-6"
                  )}
                >
                  {/* What this pane *is*, in one caption — not a rule about what may not
                      be done. The corrections happen in the panel, and saying so once
                      here is cheaper than a banner over an unchanged e-filing form. */}
                  <p className="flex items-start gap-2 text-caption text-muted-foreground">
                    <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {showAll
                      ? "The filing as scrutiny received it."
                      : "The flagged parts of the filing, as scrutiny received them."}
                  </p>
                  {/* With only the flagged fields shown, the groups whose fields are all
                      hidden are left empty, and each still took the form's gap — the
                      blank band above "Drawer's bank details" (owner, 2026-10-12). */}
                  <div className="[&_div.grid:empty]:hidden [&_div.w-full:empty]:hidden">
                    <SectionBody step={step} />
                  </div>
                </div>
              </main>
            </ResizablePanel>

            {/* Right — the workbench. A column where it fits; a drawer and a sticky bar
                below. */}
            {queueColumn ? (
              <>
                <ResizableHandle
                  withHandle
                  aria-label="Resize the record and the corrections panel"
                  className="bg-hairline"
                />
                <ResizablePanel
                  id="corrections"
                  defaultSize="47"
                  minSize="26"
                  className="flex h-full min-w-0 flex-col overflow-hidden bg-sidebar"
                >
                  <section aria-label="Corrections" className="flex min-h-0 flex-1 flex-col">
                    {/* The head is pinned; only the run scrolls. One scroller per pane is
                        the whole scroll model of this screen — see the layout comment. */}
                    <div className="flex shrink-0 flex-col gap-3 p-5 pb-4">
                      <h2 className="text-title-s font-semibold text-foreground">Corrections</h2>
                      {queueHead}
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                      <div className="px-3 pb-4">{queueList}</div>
                    </ScrollArea>
                    <div className="shrink-0 border-t border-hairline p-4">{submitBlock}</div>
                  </section>
                </ResizablePanel>
              </>
            ) : null}
          </ResizablePanelGroup>
        </div>

        {/* With the queue folded away it is still the critical action, so it keeps a
            persistent bar — RESPONSIVE.md rule 7: never hide a critical action. */}
        <div
          className={cn(
            "z-30 shrink-0 flex-col gap-3 border-t border-hairline bg-card p-4",
            queueColumn ? "hidden" : "sticky bottom-0 flex"
          )}
        >
          <div className="flex items-center gap-3">
            <QueueProgress resolved={resolved} total={total} className="min-w-0 flex-1" />
            <Button type="button" variant="outline" onClick={() => setQueueOpen(true)}>
              <ListChecksIcon data-icon="inline-start" aria-hidden />
              Corrections
            </Button>
          </div>
          <Button
            type="button"
            size="lg"
            className={SUBMIT_CLASS}
            disabled={!complete || !online || !!busy || isSent}
            onClick={() => void submit()}
          >
            {submitLabel}
          </Button>
          <p className="text-caption text-muted-foreground">{reason}</p>
        </div>
      </div>

      <Sheet open={railOpen} onOpenChange={setRailOpen}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-sm">
          <SheetHeader>
            <SheetTitle className="text-title-s font-semibold">Sections</SheetTitle>
            <SheetDescription className="text-body-compact">
              {showAll
                ? "Every part of this filing. The count shows what scrutiny flagged there."
                : "The parts of the filing scrutiny flagged, and how many corrections each carries."}
            </SheetDescription>
          </SheetHeader>
          <div className="pb-6">
            <SectionRail
              step={step}
              countFor={countFor}
              onlyFlagged={!showAll}
              onSelect={(id) => {
                setStep(id);
                setRailOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Drawer open={queueOpen} onOpenChange={setQueueOpen}>
        <DrawerContent className="max-h-[85svh]">
          <DrawerHeader>
            <DrawerTitle className="text-title-s font-semibold">Corrections</DrawerTitle>
            {/* The progress line below is the count; §6 cut the second counter that can
                disagree with the first, so this says what to do, not how many. */}
            <DrawerDescription className="text-body-compact">
              Open one to see what scrutiny asked for.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <div className="flex flex-col gap-4">
              {queueHead}
              {queueList}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Sending back: confirm, sign over this screen, then send ── */}
      <ConfirmDialog
        open={confirmSignOpen}
        onOpenChange={setConfirmSignOpen}
        title="Sign the corrected complaint?"
        description="Corrections change the complaint, so its signatures are taken off. It is signed again here before it goes back to scrutiny."
        confirmLabel="Continue to sign"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={() => {
          setConfirmSignOpen(false);
          void prepareSigning().then((ok) => {
            if (ok) openSigning("choose");
          });
        }}
      />
      <SignFlowDialog
        open={signOpen}
        start={openedAt}
        statusActions={statusActions}
        completeNote="The corrected complaint can go back to scrutiny."
        unlocks="It can go back to scrutiny"
        outcome={
          sent
            ? {
                title: "Sent to scrutiny",
                headline: "Corrections sent",
                footnote: "The scrutiny officer reviews the corrected complaint next.",
              }
            : undefined
        }
        onOpenChange={setSignOpen}
        onPrint={() => window.print()}
      />


    </CorrectionProvider>
    </FilingChromeContext.Provider>
  );
}
