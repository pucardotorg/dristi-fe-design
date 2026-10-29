"use client";

/**
 * Sign the complaint — the document in the column, and one rail beside it carrying both
 * who has signed and what you can do about it (stacked above the document below `xl`).
 *
 * It keeps the filing's Sections rail like every other step: the old two-rail layout ate
 * the width the rail needed, which left Sign the one screen you could not navigate out of
 * the way the rest of the flow had taught you.
 *
 * Committing to a mode is its own step, not a click on the rail: the rail carries one
 * "Continue to signing" button ("Sign and take your oath" when you sign for a complainant
 * in a state that asks for an oath, since the oath follows the signature in the same
 * window — advocates never take one, `OTH-3`), which opens a dialog naming
 * both paths and what each one does to the *other* signatories — before either is
 * clickable, not after. Nothing here is a private action; every party on the complaint
 * signs the one way that was chosen.
 *
 * The paying half of the flow lives here too: fees → process and address → payment →
 * the case file number. The document itself is the shared court sheet Preview renders.
 *
 * Signing and payment are the one part of this flow with no real system behind them yet.
 * They are wired to the draft (who signed, in what mode, what was chosen, what was
 * "paid") and every screen that stands in for a real service says so in place.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notify, OutcomeAmount, OutcomeHeader, OutcomeSummary } from "@/components/feedback";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  BellIcon,
  CheckIcon,
  CopyIcon,
  FlaskConicalIcon,
  PrinterIcon,
  SignatureIcon,
  UploadIcon,
  PenOffIcon,
  SendIcon,
  FileXIcon,
  LockIcon,
} from "lucide-react";

import { signingRules } from "@/lib/filing/config";
import { getRepository, newCaseFileNumber, newPaymentRef } from "@/lib/filing/data";
import { forgetFile } from "@/lib/filing/files";
import { money, toLongDate } from "@/lib/filing/format";
import {
  CHANNEL_FEE,
  COURT,
  DELIVERY_CHANNEL,
  DELIVERY_MIN_ROUNDS,
  PROCESS_OPTIONS,
} from "@/lib/filing/options";
import { useProfile } from "@/lib/filing/profile";
import {
  confirmationComplete,
  confirmerSlot,
  feeBill,
  isOutstanding,
  isYourConfirmation,
  phoneConfirmers,
  processPlan,
  signatories,
  type AccusedPlan,
  type BilledLine,
} from "@/lib/filing/selectors";
import { FILINGS_HOME, neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { useTasks } from "@/lib/tasks/store";
import { refile } from "@/lib/tasks/transitions";
import type { Signatory } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useSourceDock } from "@/hooks/use-min-width";
import { TOP_BAR_HEIGHT } from "@/components/filing/chrome";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { SectionNotice } from "@/components/filing/notices";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain, useSourceRailSlot } from "@/components/filing/filing-shell";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { useLeaveGuard } from "@/components/filing/leave-guard";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import {
  SignFlowDialog,
  type SignFlowStart,
} from "@/components/filing/sign-flow-dialog";
import { CourtDocument } from "@/components/filing/sections/preview/court-document";
import { useFilePicker } from "@/components/filing/use-file-picker";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Identifier } from "@/components/chrome/identifier";
import { useCourt, useCourtText } from "@/components/court/court-provider";

type ModalKey =
  | "esign"
  | "dsc"
  | "upload"
  | "payment"
  | "procaddr"
  | "processing"
  | "success"
  | null;

/* ───────────────────────────── Signature rail ──────────────────────── */


/**
 * Who must sign, and where each of them has got to.
 *
 * A row states only what has actually happened. Before the requests go out there is no
 * "Pending" chip on anybody, because nobody has been asked — a roster that shows a case
 * waiting on signatures the system was never told to collect is the screen describing a
 * state it never entered (owner's colleague, 2026-09-23).
 */
/** One row's status, as its one chip: done, oath still due, or waiting on them. */
function rowChip(s: Signatory, requested: boolean) {
  if (s.status === "signed" && s.oathTaken === false) {
    return <Badge variant="secondary">Oath due</Badge>;
  }
  if (s.status === "signed") {
    return (
      <Badge variant="success">
        <CheckIcon aria-hidden />
        Done
      </Badge>
    );
  }
  return requested ? <Badge variant="secondary">Waiting</Badge> : null;
}

/**
 * One group of signatories — the complainants, or the advocates — as a section that
 * folds. The fold is the group, not the person: a closed group still says how far it has
 * got ("1 of 3 done"), and every row inside is one line of who and one chip of where,
 * with nothing to open. With every advocate signing, the list can run long; folding a
 * finished group keeps the rest in view without a scroll box (owner, 2026-10-09).
 */
function SignatureGroup({
  value,
  title,
  rows,
  requested,
}: {
  value: string;
  title: string;
  rows: Signatory[];
  requested: boolean;
}) {
  if (!rows.length) return null;
  const done = rows.filter((s) => !isOutstanding(s)).length;
  return (
    <AccordionItem value={value} className="border-hairline">
      <AccordionTrigger className="items-center gap-3 py-3 text-body-compact hover:no-underline">
        <span className="flex-1 font-medium text-foreground">{title}</span>
        <span className="font-normal text-muted-foreground tabular-nums">
          {done} of {rows.length} done
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        <ul className="flex flex-col">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 border-t border-hairline py-3"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-body-compact font-semibold text-foreground">
                    {s.name}
                  </span>
                  {/* "You" is a caption, not a second chip. */}
                  {s.you ? (
                    <span className="shrink-0 text-body-compact text-muted-foreground">You</span>
                  ) : null}
                </span>
                <span className="truncate text-body-compact text-muted-foreground">{s.role}</span>
              </span>
              <span className="shrink-0">{rowChip(s, requested)}</span>
            </li>
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * The state of the signing, as one chip.
 *
 * The rail's three states read the same until they are named and coloured, which is what
 * the owner found on the render (2026-09-24: *"it looks the same to me and does not
 * communicate one has committed to the signature mode"*). One chip, one meaning: grey
 * while nothing has been asked, blue while the court's system is waiting on somebody,
 * green when there is nothing left to collect.
 */
function stateChip(
  all: Signatory[],
  requested: boolean,
  onPaper: boolean
): { variant: "secondary" | "info" | "success"; label: string } {
  const signed = all.filter((s) => s.status === "signed").length;
  if (all.length > 0 && !all.some(isOutstanding)) {
    return { variant: "success", label: `${signed} of ${all.length} signed` };
  }
  // Every signature is in and an oath is not — not done, and not "signing".
  if (all.length > 0 && signed === all.length) return { variant: "info", label: "Oath pending" };
  if (onPaper) return { variant: "secondary", label: "Physical document" };
  if (!requested) return { variant: "secondary", label: "Not sent" };
  return { variant: "info", label: `${signed} of ${all.length} signed` };
}

const SIGNATURES_HEADING = "sign-signatures";

function SignatureSummary({
  complainants,
  advocates,
  requested,
  onPaper,
  action,
}: {
  complainants: Signatory[];
  advocates: Signatory[];
  requested: boolean;
  onPaper: boolean;
  /** A control beside the state chip — the sandbox's links menu. */
  action?: React.ReactNode;
}) {
  const all = [...complainants, ...advocates];
  const chip = stateChip(all, requested, onPaper);

  return (
    <div className="flex flex-col gap-4">
      {/* The block header the newer advocate screens use: the title, and the one fact
          about it opposite (`case-overview`'s `BlockHeader`). */}
      <div className="flex flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 id={SIGNATURES_HEADING} className="text-body font-semibold text-foreground">
            Signatures
          </h2>
          <span className="flex items-center gap-1">
            <Badge variant={chip.variant} className="tabular-nums">
              {chip.label}
            </Badge>
            {action}
          </span>
        </div>
        {/* Which way this complaint is being signed, once that has been settled. The
            count alone never said it, and the owner could not tell from the rail that a
            mode had been chosen at all (2026-09-24). */}
        {requested || onPaper ? (
          <p className="text-body-compact text-muted-foreground">
            {onPaper
              ? "One PDF carrying every party's signature"
              : "Each party e-signs with their own Aadhaar OTP or DSC"}
          </p>
        ) : null}
      </div>
      <Accordion
        type="multiple"
        defaultValue={["complainants", "advocates"]}
        // Ruled above and below, so the record ends on a line of its own and the acts
        // start under it — no separate divider and no gap between the two.
        className="border-y border-hairline"
      >
        <SignatureGroup
          value="complainants"
          title="Complainants"
          rows={complainants}
          requested={requested}
        />
        <SignatureGroup
          value="advocates"
          title="Advocates"
          rows={advocates}
          requested={requested}
        />
      </Accordion>
    </div>
  );
}

/* ───────────────────────────── Fees ────────────────────────────────── */

/**
 * One group of the bill: its lines, and what they come to.
 *
 * A line states its rate and its multiplier whenever it is charged more than once
 * ("₹49 × 3 addresses"), so the number on the right can always be accounted for. The
 * group is a well inside the dialog panel, and its total is the only bold thing in it.
 */
function FeeGroup({
  title,
  caption,
  lines,
  total,
  summary = false,
}: {
  title: React.ReactNode;
  caption?: string;
  lines: BilledLine[];
  total: number;
  /** One line — the group's name and its total, no breakdown. */
  summary?: boolean;
}) {
  if (!lines.length) return null;
  if (summary) {
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-sunken p-4">
        <h3 className="text-body-compact font-semibold text-foreground">{title}</h3>
        <span className="text-body-compact font-semibold tabular-nums">{money(total)}</span>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-lg bg-surface-sunken p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-body-compact font-semibold text-foreground">{title}</h3>
        <span className="text-body-compact font-semibold tabular-nums">
          {money(total)}
        </span>
      </div>
      {caption ? <p className="text-caption text-muted-foreground">{caption}</p> : null}
      <dl className="flex flex-col divide-y divide-hairline">
        {lines.map((line) => (
          <div key={line.key} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body-compact text-foreground">
                {line.label}
                {line.unitNote ? (
                  <span className="text-muted-foreground tabular-nums">
                    {" "}
                    · {money(line.rate)} × {line.unitNote}
                  </span>
                ) : null}
              </span>
              {/* What the charge is for — only where a source says so. */}
              {line.note ? (
                <span className="text-caption text-muted-foreground">{line.note}</span>
              ) : null}
            </dt>
            <dd className="shrink-0 text-body-compact font-medium tabular-nums">
              {money(line.amount)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function SignSection() {
  const courtText = useCourtText();
  const { draft, update, hrefFor, flush } = useFiling();
  const { profile } = useProfile();
  const { prev } = neighbours("sign");
  const { input } = useFilePicker();
  const router = useRouter();
  const docked = useSourceDock();
  const slot = useSourceRailSlot();

  const [modal, setModal] = React.useState<ModalKey>(null);
  /** The signing window, and the stage the complaint is actually at when it opens. */
  const [flowOpen, setFlowOpen] = React.useState(false);
  const [flowStart, setFlowStart] = React.useState<SignFlowStart>("choose");
  /** Where the person asked to go while this version is out for signature. */
  const [leaveTo, setLeaveTo] = React.useState<string | null>(null);
  /** The other way round, asked only when there is an uploaded copy to discard. */
  const [digitalSwitchOpen, setDigitalSwitchOpen] = React.useState(false);
  /** A reminder just went out — said once, then it goes quiet again. */
  const [reminded, setReminded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const remindTimer = React.useRef<number | null>(null);
  const payTimer = React.useRef<number | null>(null);
  const copyTimer = React.useRef<number | null>(null);
  React.useEffect(
    () => () => {
      if (payTimer.current) window.clearTimeout(payTimer.current);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      if (remindTimer.current) window.clearTimeout(remindTimer.current);
    },
    []
  );

  const filed = draft.status === "filed";
  const sign = draft.sign;

  /*
   * A filing scrutiny returned. After the corrections it comes back through this same
   * step, signed exactly as at e-filing (handover `SIG-07`), and is sent back to
   * scrutiny from here — no second court fee, so the footer's act is the send.
   */
  const returned = !!draft.scrutinyReturn;
  const resubmitted = !!draft.scrutinyReturn?.resubmittedAt;
  const { tasks } = useTasks();
  const { act, busy, online } = useTaskActions();
  const returnTask = returned
    ? tasks.find((t) => t.kind === "returned" && t.draftId === draft.id)
    : undefined;
  const [sendOpen, setSendOpen] = React.useState(false);
  /**
   * The one question the whole step turns on: has this complaint been sent for
   * signature? Until it has, nothing has left the building and everything here is still
   * the filer's own. After it has, other people hold tasks against this exact document.
   */
  const requested = sign.requestedAt !== null;
  const onPaper = sign.mode === "upload";

  /** The bill, derived from this draft — see `feeBill` for what makes it specific. */
  // The selected state's schedule (`CourtSwitch`); Kerala's is the default.
  const courtFees = useCourt().profile.fees;
  const bill = React.useMemo(() => feeBill(draft, courtFees), [draft, courtFees]);
  /** What each accused is having served — defaults applied, floors held (`PAY-10/11/15`). */
  const plans = React.useMemo(() => processPlan(draft), [draft]);

  // Who signs is derived from the parties, never stored: editing a party changes this list.
  const { complainants, advocates } = React.useMemo(
    () => signatories(draft, profile),
    [draft, profile]
  );
  const everyone = React.useMemo(
    () => [...complainants, ...advocates],
    [complainants, advocates]
  );
  // The same person can be both a complainant and the advocate — one signature covers
  // every capacity they sign in.
  const yous = everyone.filter((s) => s.you);
  const youSigned = yous.length > 0 && yous.every((s) => s.status === "signed");
  const allSigned = everyone.length > 0 && everyone.every((s) => s.status === "signed");
  /** Signatures *and* oaths — what the court fee actually waits on. */
  const complete = everyone.length > 0 && !everyone.some(isOutstanding);
  const anySigned = everyone.some((s) => s.status === "signed");
  const pending = everyone.filter((s) => s.status === "pending").length;
  /** Complainants who have signed and not yet sworn — advocates carry no oath (`OTH-3`). */
  const oathsOwed = everyone.filter((s) => s.status === "signed" && s.oathTaken === false);
  const yourOathOwed = oathsOwed.some((s) => s.you);
  /** Your oath follows your signature — one act, one CTA. */
  const yourOathAhead = yous.some((s) => s.oathTaken === false);
  /**
   * Other people with something still to do, by link. On paper that is the complainants
   * still to confirm on their own device (with their oath), not the signature rows: the
   * copy carries the signatures (`SIG-05`).
   */
  const paperOthers = React.useMemo(
    () =>
      onPaper && !allSigned
        ? phoneConfirmers(draft).filter(
            (p) => !isYourConfirmation(p, profile) && !confirmationComplete(draft, p)
          )
        : [],
    [onPaper, allSigned, draft, profile]
  );
  const othersOutstanding: Signatory[] = onPaper && !allSigned
    ? complainants.filter((s) => paperOthers.some((p) => confirmerSlot(p.id) === s.id))
    : everyone.filter((s) => !s.you && isOutstanding(s));
  /** Everyone the requests go out to — the signatories who are not at this keyboard. */
  const otherSigners = Math.max(0, everyone.length - yous.length);
  const others =
    otherSigners === 1 ? "The other party" : `The other ${otherSigners} parties`;
  const have = otherSigners === 1 ? "has" : "have";

  /** What the footer's act waits on — the court fee, or the send back to scrutiny. */
  const opens = returned ? "Sending back opens" : "The court fee opens";
  /** Why the court fee is not open yet — said on the button that is shut, not beside it. */
  const payGate = allSigned
    ? `${opens} once ${oathsOwed.length === 1 ? "the last oath is" : "every oath is"} in.`
    : onPaper
      ? `${opens} once the signed copy is in.`
      : requested
        ? `${opens} once ${pending === 1 ? "the last signature is" : `all ${everyone.length} signatures are`} in${signingRules().oath ? ", with every oath" : ""}.`
        : `${opens} once every signature${signingRules().oath ? " and oath is" : " is"} in.`;

  /**
   * Every signature on this screen belongs to *this* version of the complaint. Going back
   * to change the case means the sheet the parties signed no longer exists, so the
   * signatures cannot survive the trip — the question is asked before the move, not after.
   *
   * It is asked from the moment the requests go out, not from the first signature: once
   * other people are holding a task against this document, editing it makes them sign
   * something else. So the guard catches "asked but nobody has signed yet" too.
   */
  const guardLeaving = React.useCallback(
    (href: string) => {
      if (filed || (!anySigned && !requested)) return false;
      setLeaveTo(href);
      return true;
    },
    [filed, anySigned, requested, setLeaveTo]
  );
  useLeaveGuard(guardLeaving);

  /**
   * Take this version of the complaint out of signature: signatures void, requests
   * recalled, an uploaded copy forgotten. The mode itself survives — how this filing is
   * to be signed is a decision about the filing, not about the draft it was made on.
   */
  const discardSignatures = () => {
    const copy = sign.signedCopy;
    // Before filing, an oath affirms *this* draft, so it goes where the signatures go. In
    // a correction round it carries over unless scrutiny flagged it (`OTH-5`).
    const keepOaths = !!draft.scrutinyReturn;
    const oathFiles = keepOaths
      ? []
      : Object.values(sign.oaths).flatMap((o) => (o.video ? [o.video.file.id] : []));
    update((d) => {
      if (!keepOaths) d.sign.oaths = {};
      d.sign.signed = {};
      d.sign.requestedAt = null;
      d.sign.notified = {};
      d.sign.signedCopy = null;
      // Each party confirmed they had signed *this* sheet. A sheet that no longer
      // exists takes its confirmations with it.
      d.sign.confirmed = {};
    });
    if (copy) {
      forgetFile(copy.id);
      void getRepository().deleteFile(copy.id);
    }
    for (const id of oathFiles) {
      forgetFile(id);
      void getRepository().deleteFile(id);
    }
  };

  const confirmLeave = () => {
    const href = leaveTo;
    discardSignatures();
    setLeaveTo(null);
    if (href) router.push(href);
  };

  // A filed draft must reach storage even if the tab closes on the success screen.
  React.useEffect(() => {
    if (filed) void flush();
  }, [filed, flush]);

  const printFile = () => {
    if (typeof window !== "undefined") window.print();
  };

  const closeModal = () => setModal(null);

  /**
   * Open the signing window where the complaint actually is. Nobody reaches the upload
   * without having said they cannot e-sign, so a paper draft with no confirmation on it
   * (one from before the question existed) opens on the question first.
   */
  const openFlow = (at: SignFlowStart) => {
    setFlowStart(at === "paper" && !sign.paperFallback ? "fallback" : at);
    setFlowOpen(true);
  };

  /*
   * ── The question asks itself on arrival ──
   *
   * Walking Review → Sign is walking towards a decision, so the step shows the document
   * and then puts the decision in front of the reader rather than waiting to be asked
   * (owner, 2026-09-23). Three guards keep it from becoming a wall:
   *
   * - it only asks while nothing has been decided (`requestedAt === null`, still digital)
   *   and there is somebody to ask about, so a signed or paper-bound complaint is never
   *   interrupted;
   * - it asks once per visit to this step: closing it lets the reader read the complaint
   *   undisturbed, and arriving again asks again until a mode is chosen (owner,
   *   2026-10-08 — remembering a close for the whole session read as the popup vanishing);
   * - and the window itself sends nothing until a card is pressed, so dismissing it
   *   costs nothing.
   *
   * The short delay is the point of it: the screen paints, the reader sees where they
   * are, and then the question arrives over it.
   */
  const shouldAsk =
    !filed && !requested && !onPaper && everyone.length > 0 && !allSigned;
  /** Asked already on this visit — a close is not undone by a re-render. */
  const askedThisVisit = React.useRef(false);
  React.useEffect(() => {
    if (!shouldAsk || askedThisVisit.current) return;
    const timer = window.setTimeout(() => {
      askedThisVisit.current = true;
      setFlowStart("choose");
      setFlowOpen(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [shouldAsk]);

  /** Ask again, for everyone still waiting. The link itself does not change. */
  const remindAll = () => {
    const now = new Date().toISOString();
    update((d) => {
      for (const s of othersOutstanding) d.sign.notified[s.id] = now;
    });
    setReminded(true);
    if (remindTimer.current) window.clearTimeout(remindTimer.current);
    remindTimer.current = window.setTimeout(() => setReminded(false), 2500);
  };

  /**
   * Back to e-signing. Nothing goes out until the choice is made in the window, so this
   * only has something to undo when a copy was already uploaded or confirmed.
   */
  const backToDigital = () => {
    const copy = sign.signedCopy;
    update((d) => {
      d.sign.mode = "digital";
      d.sign.paperFallback = null;
      d.sign.signed = {};
      d.sign.confirmed = {};
      d.sign.signedCopy = null;
    });
    if (copy) {
      forgetFile(copy.id);
      void getRepository().deleteFile(copy.id);
    }
    setDigitalSwitchOpen(false);
    openFlow("choose");
  };

  /**
   * Sandbox only — the other parties' links go nowhere, so this stands in for them
   * opening theirs and signing. It is the one way to walk the rest of the flow here, and
   * it says what it is on the button.
   */
  const sandboxSignOthers = () => {
    const at = new Date().toISOString();
    update((d) => {
      if (onPaper) {
        // On paper the others confirm, and swear, on their own devices.
        for (const p of paperOthers) {
          d.sign.confirmed[p.id] = { mobileTail: p.mobile.replace(/\D/g, "").slice(-4), at };
          const slot = confirmerSlot(p.id);
          if (signingRules().oath && !d.sign.oaths[slot]) d.sign.oaths[slot] = { at, video: null };
        }
        return;
      }
      for (const s of everyone) {
        if (s.you) continue;
        if (!d.sign.signed[s.id]) d.sign.signed[s.id] = { at, with: "aadhaar" };
        // No recording stands behind this one, and the roster says so.
        if (s.oathTaken === false) d.sign.oaths[s.id] = { at, video: null };
      }
    });
  };

  /** Sandbox: what one signatory sees when they open their link. */
  const linkFor = (s: Signatory) =>
    `/sign?draft=${encodeURIComponent(draft.id)}&as=${encodeURIComponent(s.id)}`;

  /**
   * Write one accused's choice. Only the difference from the court's defaults is
   * stored — writing the resolved plan back would freeze the notice round at whatever
   * the delay looked like on the day, which is exactly what `PAY-11` forbids.
   */
  const editPlan = (
    plan: AccusedPlan,
    change: (draft: { rounds: Record<string, number>; delivery: number; addresses: number[] }) => void
  ) =>
    update((d) => {
      const next = {
        rounds: { ...plan.rounds },
        delivery: plan.delivery,
        addresses: [...plan.selected],
      };
      change(next);
      d.sign.process = { ...d.sign.process, [plan.accusedId]: next };
    });

  /**
   * How many rounds of one process this accused prepays. The floors are held here as
   * well as in the plan: the mandatory summons round is never offered as declinable,
   * and cutting summons rounds cuts the e-post that delivers them with it.
   */
  const setRounds = (plan: AccusedPlan, key: string, value: number) =>
    editPlan(plan, (next) => {
      const option = PROCESS_OPTIONS.find((p) => p.key === key);
      if (!option) return;
      next.rounds[key] = Math.min(option.maxRounds, Math.max(option.minRounds, value));
      if (key === "summons") {
        next.delivery = Math.min(
          next.rounds.summons,
          Math.max(DELIVERY_MIN_ROUNDS, next.delivery)
        );
      }
    });

  /** How many of this accused's summons rounds go by e-post — separately chosen. */
  const setDelivery = (plan: AccusedPlan, value: number) =>
    editPlan(plan, (next) => {
      next.delivery = Math.min(
        next.rounds.summons,
        Math.max(DELIVERY_MIN_ROUNDS, value)
      );
    });

  /** Where this accused's summons goes — at least one address stays selected. */
  const toggleAddress = (plan: AccusedPlan, index: number) =>
    editPlan(plan, (next) => {
      const chosen = next.addresses.includes(index)
        ? next.addresses.filter((i) => i !== index)
        : [...next.addresses, index].sort((a, b) => a - b);
      if (chosen.length) next.addresses = chosen;
    });

  const payNow = () => {
    setModal("processing");
    if (payTimer.current) window.clearTimeout(payTimer.current);
    payTimer.current = window.setTimeout(() => {
      const now = new Date().toISOString();
      const ref = newPaymentRef();
      const caseNumber = newCaseFileNumber();
      update((d) => {
        d.sign.paid = true;
        d.sign.paidAt = now;
        d.sign.paidAmount = bill.total;
        d.sign.paymentRef = ref;
        d.sign.caseFileNumber = caseNumber;
        d.status = "filed";
        d.filedAt = now;
        d.sign.deliveryChannel = DELIVERY_CHANNEL;
      });
      setModal("success");
    }, 2600);
  };

  const copyLink = () => {
    if (typeof window !== "undefined") {
      try {
        void navigator.clipboard?.writeText(
          `${window.location.origin}${hrefFor("preview")}`
        );
      } catch {
        /* clipboard blocked — the case number is on screen either way */
      }
    }
    setCopied(true);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  /**
   * What the rail carries once the filing is done — the record, not the actions. The rail
   * is a white panel in both places it appears (its own column, and the card it stacks
   * into below `xl`), so the record block is one layer in from it either way.
   */
  const filedRecord = () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-body font-semibold">Filed</h2>
        <p className="text-body-compact text-muted-foreground">
          This complaint has been submitted and paid for.
        </p>
      </div>

      <dl className="flex flex-col gap-3 rounded-lg bg-surface-sunken p-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-body-compact font-medium text-muted-foreground">
            Case file number
          </dt>
          <dd className="text-body font-semibold">
            {sign.caseFileNumber ? (
              <Identifier value={sign.caseFileNumber} label="case file number" />
            ) : (
              <span className="tabular-nums">—</span>
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-body-compact font-medium text-muted-foreground">Filed on</dt>
          <dd className="text-body-compact font-medium tabular-nums">
            {draft.filedAt ? toLongDate(draft.filedAt.slice(0, 10)) : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-body-compact font-medium text-muted-foreground">Amount paid</dt>
          <dd className="text-body-compact font-medium tabular-nums">
            {money(sign.paidAmount ?? bill.total)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-body-compact font-medium text-muted-foreground">
            Payment reference
          </dt>
          <dd className="text-body-compact font-medium break-all">
            {sign.paymentRef ? (
              <Identifier value={sign.paymentRef} label="payment reference" />
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" onClick={copyLink}>
          <CopyIcon data-icon="inline-start" aria-hidden />
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button type="button" variant="ghost" onClick={printFile}>
          <PrinterIcon data-icon="inline-start" aria-hidden />
          Print or save as PDF
        </Button>
      </div>

      <p className="text-caption text-muted-foreground">
        Sandbox: this filing has not been sent to a real court.
      </p>
    </div>
  );

  /**
   * ── What to do about the signatures ──
   *
   * It lives in the rail, under the roster it is about. It sat over the court document
   * for one pass and read as exactly that — a card on top of the complaint (owner,
   * 2026-09-24) — and the reason it left the rail in the first place, that the *decision*
   * was being made in side navigation, no longer holds: the decision is made in the
   * signing window now, and this is the handle that opens it.
   */
  const noSignatories = everyone.length === 0;

  /*
   * Sandbox — no link is actually sent, so each person's link can be opened here to walk
   * their side, or everyone else can be marked done in one go.
   */
  const sandboxLinks =
    othersOutstanding.length > 0 ? (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Sandbox: open the signing links"
                // 32px to sit quietly beside the chip; the inset widens the hit area to 40.
                className="relative text-muted-foreground after:absolute after:-inset-1"
              >
                <FlaskConicalIcon aria-hidden />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Sandbox: open the signing links</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>No link is sent — open one to see it</DropdownMenuLabel>
          {othersOutstanding.map((s) => (
            <DropdownMenuItem key={s.id} asChild>
              <a href={linkFor(s)} target="_blank" rel="noreferrer">
                {s.name}
              </a>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={sandboxSignOthers}>Mark the others as done</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  /** Where things stand, in one sentence, while something is still owed. */
  const waitingLine = !youSigned && yous.length > 0
    ? yourOathAhead
      ? "Your signature and oath are still needed."
      : "Your signature is still needed."
    : yourOathOwed
      ? "Your signature is in. Take your oath to finish."
      : yous.length === 0 && pending > 0
        ? /*
           * Nobody at this keyboard is a signatory — the clerk. An Aadhaar OTP or a DSC
           * is personal and cannot be used on someone else's behalf, so there is no
           * signing action here (owner's colleague, 2026-09-23).
           */
          `${others} ${have} the link; nobody here is a signatory.`
        : pending > 0
          ? `Waiting on ${pending === 1 ? "one more party" : `${pending} more parties`}.`
          : `Waiting on ${oathsOwed.length === 1 ? "one oath" : `${oathsOwed.length} oaths`}.`;

  const signActions = noSignatories ? (
    <p className="text-body-compact text-muted-foreground">
      Add a complainant or an advocate before sending this for signature.
    </p>
  ) : complete ? (
    /* ── Every signature and oath is in ── */
    <div className="flex flex-col gap-3">
      <SectionNotice variant="success" announce="polite">
        {onPaper ? "The uploaded copy carries every signature" : "Every party has signed"}
        {signingRules().oath ? ", and everyone has taken the oath." : "."}{" "}
        {returned ? "You can send the corrections to scrutiny now." : "You can pay the court fee now."}
      </SectionNotice>
      {onPaper ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => openFlow("paper")}
        >
          <UploadIcon data-icon="inline-start" aria-hidden />
          Replace signed copy
        </Button>
      ) : null}
    </div>
  ) : onPaper && !allSigned ? (
    /* ── A physical document ── */
    <div className="flex flex-col gap-3">
      <p className="text-body-compact text-muted-foreground">
        Print it, collect every signature, then upload the PDF.
      </p>
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => openFlow("paper")}
      >
        Upload signed copy
      </Button>
      {/* Either mode can be chosen from the other: a filer who picked paper and then
          found everyone can e-sign was stuck with the printer (owner, 2026-09-24). */}
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          /* Only worth a question when there is something to discard. */
          if (sign.signedCopy || anySigned) setDigitalSwitchOpen(true);
          else backToDigital();
        }}
      >
        <SignatureIcon data-icon="inline-start" aria-hidden />
        E-sign instead
      </Button>
    </div>
  ) : !requested && !onPaper ? (
    /* ── Nobody has been asked yet ── */
    <Button
      type="button"
      size="lg"
      className="w-full"
      onClick={() => openFlow("choose")}
    >
      {yourOathAhead ? "Sign and take your oath" : "Continue to signing"}
    </Button>
  ) : (
    /* ── Asked, and waiting — on a signature, or on an oath ── */
    <div className="flex flex-col gap-3">
      <p className="text-body-compact text-muted-foreground">{waitingLine}</p>

      {yous.length > 0 && !youSigned && !onPaper ? (
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => openFlow("sign")}
        >
          {yourOathAhead ? "E-sign and take your oath" : "Add your e-signature"}
        </Button>
      ) : yourOathOwed ? (
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => openFlow("oath")}
        >
          Take your oath
        </Button>
      ) : null}

      <div className="flex flex-col gap-2">
        {othersOutstanding.length > 0 ? (
          <Button
            type="button"
            variant={(yous.length > 0 && !youSigned) || yourOathOwed ? "ghost" : "outline"}
            className="w-full"
            onClick={remindAll}
            disabled={reminded}
          >
            <BellIcon data-icon="inline-start" aria-hidden />
            {reminded ? "Reminder sent" : "Send a reminder"}
          </Button>
        ) : null}
        {!onPaper && !allSigned ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            /* Paper after the requests are out withdraws them. The window says so on
               the same stage that asks why, rather than in a confirmation of its own. */
            onClick={() => openFlow("fallback")}
          >
            <UploadIcon data-icon="inline-start" aria-hidden />
            Upload a signed copy instead
          </Button>
        ) : null}
      </div>
    </div>
  );

  /**
   * The rail is the record: who must sign, and where each of them has got to. It used to
   * carry the acts as well, and that is what made the one consequential decision of the
   * step read as a side panel (owner, 2026-09-23). The acts are in the column now.
   */
  const railBody = filed ? (
    filedRecord()
  ) : (
    <section aria-labelledby={SIGNATURES_HEADING} className="flex flex-col gap-4">
      <SignatureSummary
        complainants={complainants}
        advocates={advocates}
        requested={requested}
        onPaper={onPaper}
        action={sandboxLinks}
      />
      {signActions}
    </section>
  );

  const fixHref = returnTask ? `/tasks/${encodeURIComponent(returnTask.id)}/fix` : null;
  const backHref = filed
    ? hrefFor("preview")
    : fixHref
      ? fixHref
      : prev
        ? hrefFor(prev)
        : hrefFor("preview");

  /** Send the re-signed corrections to scrutiny — the act `refile` records on the task. */
  const sendBack = async () => {
    setSendOpen(false);
    if (!returnTask) {
      notify.error("The scrutiny return for this filing could not be found.");
      return;
    }
    const done = await act(returnTask.id, refile, "Corrections sent to scrutiny");
    if (!done) return;
    update((d) => {
      d.scrutinyReturn = { resubmittedAt: new Date().toISOString() };
    });
    router.push(`/tasks?task=${encodeURIComponent(returnTask.id)}`);
  };

  return (
    <>
      {input}

      <FilingMain width="wide" sourceOpen={docked}>
        <FilingPageHeader
          title={
            filed
              ? "Complaint filed"
              : returned
                ? "Sign the corrected complaint"
                : "Sign the complaint"
          }
          description={
            filed
              ? `Filed in the ${courtText(COURT.name)} under S-138, Negotiable Instruments Act.`
              : resubmitted
                ? "The corrections have been sent back to scrutiny."
                : returned
                  ? "Scrutiny returned this complaint. Everyone signs the corrected version again, the same way as when it was filed, before it goes back."
                  : `A criminal complaint under S-138, Negotiable Instruments Act in the ${courtText(COURT.name)}.`
          }
        />

        {/* Below xl there is no width for a rail column, so the roster stacks here. */}
        <Card className={cn(PANEL_CLASS, "xl:hidden")}>
          <CardContent>{railBody}</CardContent>
        </Card>

        {/* Printing belongs to the document, not to the step: the footer carries the
            walk through the filing, and a control for the paper in the column was
            competing with it (owner, 2026-09-24). */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-body font-semibold text-foreground">The complaint</h2>
          <Button type="button" variant="outline" size="sm" onClick={printFile}>
            <PrinterIcon data-icon="inline-start" aria-hidden />
            Print or save as PDF
          </Button>
        </div>

        {/* Scrolls on its own, so it is focusable — a keyboard user must be able to
            reach the scroll region to read the document. */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Complaint document"
          className="max-h-[calc(100vh-18rem)] overflow-y-auto rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <CourtDocument draft={draft} />
        </div>
      </FilingMain>

      {/* From xl the rail takes the shell's third column, beside the document. */}
      {docked && slot
        ? createPortal(
            <aside
              aria-label={filed ? "Filing record" : "Signatures"}
              style={{ top: TOP_BAR_HEIGHT, height: `calc(100svh - ${TOP_BAR_HEIGHT})` }}
              className="sticky flex w-80 shrink-0 flex-col self-start overflow-y-auto border-l border-hairline bg-card p-6"
            >
              {railBody}
            </aside>,
            slot
          )
        : null}

      {filed ? (
        <FilingFooter
          backHref={backHref}
          continueHref={FILINGS_HOME}
          continueLabel="Back to dashboard"
          showSaveState={false}
        />
      ) : (
        <FilingFooter
          onBack={() => {
            if (!guardLeaving(backHref)) router.push(backHref);
          }}
          continueLabel={returned ? "Send corrections to scrutiny" : "Continue to pay fees"}
          /*
           * Nothing to pay for until the sheet is signed, so the step's one real action
           * stays dead until it is — and then it is the focal teal, as on every other
           * step. Blocked rather than disabled, so the reason can live on the control
           * instead of as a sentence taking a row of the footer beside it (owner,
           * 2026-09-24); pressing it says the same thing, for a reader who cannot hover.
           */
          continueBlocked={!complete || resubmitted || (returned && (!online || !!busy))}
          continueHint={complete ? undefined : payGate}
          showSaveState={false}
          onContinue={() => {
            if (resubmitted) {
              notify.neutral("These corrections have already been sent to scrutiny.", { icon: SendIcon });
              return;
            }
            if (!complete) {
              notify.neutral(payGate, { icon: LockIcon });
              return;
            }
            if (returned) {
              setSendOpen(true);
              return;
            }
            setModal("payment");
          }}
        />
      )}

      {/*
        ── Signing itself ──
        One window with stages: the decision that sends this out, the filer's own
        signature, the outcome, and the paper path. See `sign-flow-dialog`.
      */}
      <SignFlowDialog
        open={flowOpen}
        start={flowStart}
        onOpenChange={setFlowOpen}
        onPrint={printFile}
      />

      {/* ── Choose process & address ── */}
      {/*
        This comes *before* the bill, because it is what the bill adds up. The court's
        rule is not one blanket opt-out but a floor and a ceiling per process (handover
        §19.3): one round of summons is mandatory, its delivery included; warrants and
        further summons rounds go up to four; notice is a single optional round. So the
        choice is offered per process, and the round the court insists on is simply not
        offered as declinable rather than offered and then refused.
      */}
      <Dialog open={modal === "procaddr"} onOpenChange={(open) => !open && closeModal()}>
        <ChromeDialogContent mobileSheet className="grid-rows-[auto_minmax(0,1fr)_auto] max-h-[calc(100svh-2rem)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change process &amp; address</DialogTitle>
            <DialogDescription>
              What the court issues to the accused, how it is delivered, and where it
              goes. The total moves as you change it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-6 overflow-y-auto">
            {plans.map((plan) => {
              const rounds = plan.rounds;
              const line = bill.delivery.find((l) =>
                l.key.startsWith(`${plan.accusedId}:`)
              );
              /** 1 … summons rounds — e-post never falls below the mandatory round. */
              const deliveryChoices = Array.from(
                { length: Math.max(0, rounds.summons - DELIVERY_MIN_ROUNDS + 1) },
                (_, i) => DELIVERY_MIN_ROUNDS + i
              );
              return (
                <section
                  key={plan.accusedId}
                  className={cn(
                    "flex flex-col gap-4",
                    // One accused needs no dividing from itself; several do.
                    plans.length > 1 && "border-t border-hairline pt-6 first:border-t-0 first:pt-0"
                  )}
                >
                  <h3 className="text-body font-semibold text-foreground">
                    {plan.label}
                  </h3>

                  {/* Addresses first: they multiply the summons, so where comes before
                      how many — a round cannot be priced until you know how far it
                      travels. */}
                  <FieldSet className="gap-3">
                    <FieldLegend className="text-body-compact font-medium">
                      Where summons is served
                    </FieldLegend>
                    {plan.addresses.length ? (
                      <>
                        {plan.addresses.map((address) => {
                          const id = `addr-${plan.accusedId}-${address.index}`;
                          return (
                            <Field key={address.index} orientation="horizontal">
                              <Checkbox
                                id={id}
                                checked={plan.selected.includes(address.index)}
                                onCheckedChange={() =>
                                  toggleAddress(plan, address.index)
                                }
                              />
                              <FieldContent>
                                <Label
                                  htmlFor={id}
                                  className="text-body-compact font-medium"
                                >
                                  {address.label}
                                </Label>
                                <FieldDescription className="text-caption">
                                  {address.text}
                                </FieldDescription>
                              </FieldContent>
                            </Field>
                          );
                        })}
                        <p className="text-caption text-muted-foreground">
                          Summons is charged for each address selected, every round.
                        </p>
                      </>
                    ) : (
                      <p className="text-body-compact text-muted-foreground">
                        Add this accused’s address in the{" "}
                        <Link
                          href={hrefFor("accused")}
                          className="font-medium text-primary underline underline-offset-2"
                        >
                          Accused section
                        </Link>{" "}
                        to choose where summons is served.
                      </p>
                    )}
                  </FieldSet>

                  <FieldSet className="gap-3">
                    <FieldLegend className="text-body-compact font-medium">
                      Process to pay for now
                    </FieldLegend>
                    <div className="flex flex-col divide-y divide-hairline">
                      {PROCESS_OPTIONS.map((option) => {
                        const id = `process-${plan.accusedId}-${option.key}`;
                        const chosen = rounds[option.key] ?? option.minRounds;
                        const choices = Array.from(
                          { length: option.maxRounds - option.minRounds + 1 },
                          (_, i) => option.minRounds + i
                        );
                        const amount = bill.process
                          .filter((l) => l.key === `${plan.accusedId}:${option.key}`)
                          .reduce((t, l) => t + l.amount, 0);
                        return (
                          <div
                            key={option.key}
                            className="flex flex-wrap items-start justify-between gap-4 py-3 first:pt-0"
                          >
                            <div className="flex min-w-56 flex-1 flex-col gap-0.5">
                              <Label
                                htmlFor={id}
                                className="text-body-compact font-medium"
                              >
                                {option.label}
                                {option.minRounds > 0 ? (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · required
                                  </span>
                                ) : null}
                              </Label>
                              <p className="text-caption text-muted-foreground">
                                {option.note}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-4">
                              <NativeSelect
                                id={id}
                                className="w-40"
                                value={String(chosen)}
                                onChange={(e) =>
                                  setRounds(plan, option.key, Number(e.target.value))
                                }
                              >
                                {choices.map((n) => (
                                  <NativeSelectOption key={n} value={String(n)}>
                                    {n === 0
                                      ? "Not now"
                                      : n === 1
                                        ? "1 round"
                                        : `${n} rounds`}
                                  </NativeSelectOption>
                                ))}
                              </NativeSelect>
                              <span className="min-w-16 text-right text-body-compact font-medium tabular-nums">
                                {amount ? money(amount) : "—"}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/*
                        E-post is its own decision (`PAY-15`), not a consequence of the
                        summons count — you may prepay three rounds of summons and the
                        delivery of one. It only cannot go below the mandatory first
                        round, which is why "Not now" is absent here as it is above.
                      */}
                      <div className="flex flex-wrap items-start justify-between gap-4 py-3">
                        <div className="flex min-w-56 flex-1 flex-col gap-0.5">
                          <Label
                            htmlFor={`delivery-${plan.accusedId}`}
                            className="text-body-compact font-medium"
                          >
                            {CHANNEL_FEE.label}
                            <span className="text-muted-foreground"> · required</span>
                          </Label>
                          <p className="text-caption text-muted-foreground tabular-nums">
                            {money(CHANNEL_FEE.amount)} for each address, every round,
                            charged by the post office, not by the court.
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <NativeSelect
                            id={`delivery-${plan.accusedId}`}
                            className="w-40"
                            value={String(plan.delivery)}
                            onChange={(e) =>
                              setDelivery(plan, Number(e.target.value))
                            }
                          >
                            {deliveryChoices.map((n) => (
                              <NativeSelectOption key={n} value={String(n)}>
                                {n === 1 ? "1 round" : `${n} rounds`}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                          <span className="min-w-16 text-right text-body-compact font-medium tabular-nums">
                            {line ? money(line.amount) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </FieldSet>
                </section>
              );
            })}

            <p className="text-caption text-muted-foreground">
              Anything you leave out now is paid for later, if and when the court orders
              it. What you pay for now is issued without a second payment step.
            </p>
          </div>

          {/*
            The number the choices above are moving, kept in sight while they move —
            outside the scrolling list, so it cannot be scrolled past, and outside the
            footer, which stacks on a narrow screen and would carry it off the bottom.
          */}
          <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-4">
            <span className="text-body font-semibold">Payable now</span>
            <span className="text-title-s font-semibold tabular-nums">
              {money(bill.total)}
            </span>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setModal("payment")}>
              Back to fees
            </Button>
          </DialogFooter>
        </ChromeDialogContent>
      </Dialog>

      {/* ── Pay court fees ── */}
      {/*
        A bill, not a price tag. Two groups because the court treats them differently:
        court fees decide whether the complaint is registered at all, process fees buy
        delivery to the accused. Every line shows its rate and how many times it is
        charged, because the per-round and per-address ones move with the case and a
        total nobody can account for is a total nobody should be asked to pay. There is
        no switch here any more: what is being paid for was decided on the step before,
        process by process, and this screen only adds it up.
      */}
      <Dialog open={modal === "payment"} onOpenChange={(open) => !open && closeModal()}>
        <ChromeDialogContent mobileSheet className="grid-rows-[auto_minmax(0,1fr)_auto] max-h-[calc(100svh-2rem)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Pay court fees</DialogTitle>
            <DialogDescription>
              Payable to the {courtText(COURT.name)} for this complaint.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
            <FeeGroup
              title="Court fees"
              caption="Due before the complaint is registered."
              lines={bill.court}
              total={bill.courtTotal}
            />

            {/* One line, not itemised (owner, 2026-10-08): what was chosen per process is
                on Change process & address, below, for anyone who wants the detail. */}
            <FeeGroup
              title="Process fees"
              lines={bill.process}
              total={bill.processTotal}
              summary
            />

            <FeeGroup
              title={`Delivery of summons · ${DELIVERY_CHANNEL}`}
              lines={bill.delivery}
              total={bill.deliveryTotal}
              summary
            />
          </div>

          <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-4">
            <span className="text-body font-semibold">Payable now</span>
            <span className="text-title-s font-semibold tabular-nums">
              {money(bill.total)}
            </span>
          </div>

          <Button type="button" size="lg" className="w-full" onClick={payNow}>
            Pay {money(bill.total)} online
          </Button>

          <p className="text-caption text-muted-foreground">
            Sandbox payment. No money moves.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModal("procaddr")}
            >
              Change process &amp; address
            </Button>
          </DialogFooter>
        </ChromeDialogContent>
      </Dialog>

      {/* ── Processing ── */}
      <Dialog open={modal === "processing"}>
        <ChromeDialogContent mobileSheet
          className="sm:max-w-sm"
          showCloseButton={false}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Spinner className="size-8 text-primary" />
            <DialogTitle className="text-title-s font-semibold">
              Processing payment…
            </DialogTitle>
            <DialogDescription className="text-body-compact">
              Please don’t close or refresh this window while we confirm your payment.
            </DialogDescription>
            <p className="text-caption text-muted-foreground">
              Sandbox payment. No money moves.
            </p>
          </div>
        </ChromeDialogContent>
      </Dialog>

      {/* ── Payment successful ── */}
      <Dialog open={modal === "success"} onOpenChange={(open) => !open && closeModal()}>
        <ChromeDialogContent mobileSheet
          showCloseButton={false}
          className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          {/* The filing's outcome takes over the window (skill `feedback-states`). */}
          <OutcomeHeader
            compact
            titleFrom="dialog"
            title="Payment successful"
            body="Your case file is complete. This is a sandbox. Nothing has been sent to a real court."
          >
            <OutcomeAmount label="Amount paid" value={money(sign.paidAmount ?? bill.total)} />
          </OutcomeHeader>

          <div className="flex flex-col gap-4 p-6">
            <OutcomeSummary>
              <DescriptionList>
                <DescriptionRow className="items-center border-hairline">
                  <DescriptionTerm>Case file number</DescriptionTerm>
                  <DescriptionDetails className="flex flex-wrap items-center justify-end gap-2">
                    {sign.caseFileNumber ? (
                      <Identifier value={sign.caseFileNumber} label="case file number" />
                    ) : (
                      <span className="tabular-nums">—</span>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={copyLink}>
                      <CopyIcon data-icon="inline-start" aria-hidden />
                      {copied ? "Copied" : "Copy link"}
                    </Button>
                  </DescriptionDetails>
                </DescriptionRow>
                <DescriptionRow className="border-hairline">
                  <DescriptionTerm>Payment reference</DescriptionTerm>
                  <DescriptionDetails>
                    {sign.paymentRef ? (
                      <Identifier value={sign.paymentRef} label="payment reference" />
                    ) : (
                      "—"
                    )}
                  </DescriptionDetails>
                </DescriptionRow>
              </DescriptionList>
            </OutcomeSummary>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="outline" size="lg" className="flex-1">
                <Link href={FILINGS_HOME}>Back to dashboard</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={printFile}
              >
                <PrinterIcon data-icon="inline-start" aria-hidden />
                Print or save as PDF
              </Button>
            </div>
          </div>
        </ChromeDialogContent>
      </Dialog>

      {/* ── Leaving with signatures on the sheet ── */}
      <ConfirmDialog
        open={leaveTo !== null}
        onOpenChange={(open) => {
          if (!open) setLeaveTo(null);
        }}
        title={
          anySigned ? "Going back voids the signatures" : "Going back recalls the requests"
        }
        description={
          onPaper
            ? "The signed copy you uploaded was signed against this version of the complaint. Editing the case makes it a different document, so the copy is removed and every party has to sign again."
            : anySigned
              ? `The parties were asked to sign this version of the complaint. Editing the case makes it a different document, so ${
                  everyone.filter((s) => s.status === "signed").length === 1
                    ? "the signature already collected is"
                    : "the signatures already collected are"
                } discarded, the outstanding requests are withdrawn, and everyone is asked again.`
              : "The parties have already been asked to sign this version of the complaint. Editing the case makes it a different document, so those requests are withdrawn and everyone is asked again once you come back."
        }
        confirmLabel={anySigned ? "Go back and re-sign" : "Go back and recall"}
        cancelLabel="Stay here"
        icon={PenOffIcon}
        onConfirm={confirmLeave}
      />

      {/* ── Sending re-signed corrections back to scrutiny ── */}
      <ConfirmDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        title="Send these corrections to scrutiny?"
        description="The re-signed complaint goes back to the Registry. A re-submission cannot be recalled, and limitation runs from the Registry's receipt."
        confirmLabel="Send to scrutiny"
        cancelLabel="Not yet"
        destructive={false}
        icon={SendIcon}
        onConfirm={() => void sendBack()}
      />

      {/* ── And back the other way ── */}
      <ConfirmDialog
        open={digitalSwitchOpen}
        onOpenChange={setDigitalSwitchOpen}
        title="E-sign instead?"
        description={
          sign.signedCopy
            ? "The copy you uploaded is removed, and every confirmation taken against it goes with it. Each party e-signs with their own Aadhaar OTP or DSC."
            : "The signatures collected on the copy are discarded. Each party e-signs with their own Aadhaar OTP or DSC."
        }
        confirmLabel="E-sign instead"
        cancelLabel="Keep the physical document"
        icon={FileXIcon}
        onConfirm={backToDigital}
      />
    </>
  );
}
