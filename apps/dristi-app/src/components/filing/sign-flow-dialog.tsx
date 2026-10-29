"use client";

/**
 * **Signing, as one window with stages — the act, not a menu beside it.**
 *
 * Everything the filer *does* about signatures happens here: the decision that sends this
 * complaint out to the other parties, their own signature on it, and the paper path for a
 * complaint that will be signed by hand instead. The Sign step's rail keeps the roster
 * and nothing else, because a decision that puts work in other people's queues does not
 * belong in side navigation (owner, 2026-09-23: *"I feel a little uncomfortable with the
 * fact that all of this is driven by a side tab"*).
 *
 * It is built on the product's staged-overlay pattern (`components/chrome/staged-overlay`)
 * — the same frame the court-side acts use — so the chrome holds still, the stage travels,
 * and an outcome resolves in the scene it happened in rather than in a second window.
 *
 * ## One choice, one press
 *
 * Every question here is asked as a card that *does the thing*: the card names the route
 * and what it costs everyone else, and pressing it commits to that route. A radio group
 * plus a separate button below asks the same question twice, which is what the owner read
 * as overcomplicated (2026-09-23) — and the cards were the shape that was right in the
 * first place.
 *
 * ## The stages
 *
 * `choose` — e-signing, as the one card, saying what it does to the other parties; paper
 *   is a link beneath it for when e-signing has not worked (owner, 2026-10-06).
 * `fallback` — what went wrong with e-signing, one reason, then continue to the upload.
 *   Nothing changes until they continue, so looking costs nothing.
 * `sign` — the link is out; now the filer's own instrument, Aadhaar OTP or their DSC.
 * `otp` / `dsc` — that instrument, doing its one job.
 * `done` — what just happened, resolving in the same scene as the act.
 * `paper` — the printed copy coming back. Each complainant (or their PoA holder or
 *   representative) confirms by OTP on their own device, through a link sent by SMS, and
 *   records their oath there where the state asks for one (`SIG-05`, `OTH-3`). The OTP is
 *   never entered here — unless the person at this keyboard is that complainant, on their
 *   own device already.
 * `uploaded` — the same, settled.
 * `oath` — a complainant's oath, with their e-signature or their own confirmation
 *   (`oath-capture`). Advocates never take one.
 * `sworn` — the oath, settled.
 *
 * Signing here writes to the draft and nothing else: no e-sign provider is called, no
 * message is sent, and every screen that stands in for a real service says so in place.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  FileTextIcon,
  SignatureIcon,
  UploadIcon,
} from "lucide-react";

import {
  StagedOverlay,
  useStagedFlow,
} from "@/components/chrome/staged-overlay";
import { signingRules } from "@/lib/filing/config";
import { getRepository, storeUpload } from "@/lib/filing/data";
import { forgetFile, formatBytes } from "@/lib/filing/files";
import { useProfile } from "@/lib/filing/profile";
import {
  confirmationComplete,
  confirmerSlot,
  isOutstanding,
  isYourConfirmation,
  oathTakerName,
  phoneConfirmed,
  phoneConfirmers,
  signatories,
} from "@/lib/filing/selectors";
import { useFiling } from "@/lib/filing/store";
import type {
  OathVideo,
  PaperFallbackReason,
  PhoneConfirmer,
  SignInstrument,
  StoredFileRef,
} from "@/lib/filing/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { SectionNotice } from "@/components/filing/notices";
import { OathCapture } from "@/components/filing/oath-capture";
import {
  PaperFallbackLink,
  PaperFallbackQuestion,
  paperFallbackReasons,
} from "@/components/filing/paper-fallback";
import {
  ChoiceCard,
  DscLookup,
  InstrumentChoice,
  OtpEntry,
  SettledCard,
  StageColumn,
  StepTrail,
  type TrailStep,
} from "@/components/filing/sign-stages";
import { pickErrorMessage, useFilePicker } from "@/components/filing/use-file-picker";

/** Where the window opens, decided by what has happened to the complaint so far. */
export type SignFlowStart = "choose" | "sign" | "fallback" | "paper" | "oath" | "status";

type Stage =
  | "choose"
  | "sign"
  | "otp"
  | "dsc"
  | "done"
  | "fallback"
  | "paper"
  | "uploaded"
  | "oath"
  | "sworn";

/**
 * Every stage, in the order the act moves through them — read by `useStagedFlow` for the
 * direction a stage travels. One list per starting point, because the window opens where
 * the complaint already is: a filer coming back to add their own signature has no use for
 * the decision that was made before they left, and the stage they land on has to be the
 * first in its own order.
 */
const ORDER: Record<SignFlowStart, readonly Stage[]> = {
  /* Reopened where signing stands: the roster, for a complaint already out for
     signature (the scrutiny correction screen reopens here). */
  status: ["done", "oath", "sworn", "choose", "sign", "otp", "dsc", "fallback", "paper", "uploaded"],
  choose: ["choose", "sign", "otp", "dsc", "done", "fallback", "paper", "uploaded", "oath", "sworn"],
  sign: ["sign", "otp", "dsc", "done", "fallback", "paper", "uploaded", "oath", "sworn", "choose"],
  fallback: ["fallback", "paper", "uploaded", "oath", "sworn", "choose", "sign", "otp", "dsc", "done"],
  paper: ["paper", "uploaded", "oath", "sworn", "choose", "sign", "otp", "dsc", "done", "fallback"],
  oath: ["oath", "sworn", "choose", "sign", "otp", "dsc", "done", "fallback", "paper", "uploaded"],
};

/**
 * Which scene each stage is looked at in. The two instruments and the outcome share one:
 * an act and its outcome are one beat, so the signature settles where it was made instead
 * of sliding in as a new question.
 */
const SCENES: Record<Stage, string> = {
  choose: "choose",
  sign: "sign",
  otp: "act",
  dsc: "act",
  done: "act",
  fallback: "fallback",
  paper: "paper",
  uploaded: "paper",
  oath: "oath",
  sworn: "oath",
};

/** How a signature names what made it — the whole line, not a fragment. */
const INSTRUMENT_LABEL: Record<SignInstrument, string> = {
  aadhaar: "Signed with Aadhaar OTP",
  dsc: "Signed with a DSC",
  paper: "Signed on paper",
  otp: "Signed with mobile OTP",
};

export function SignFlowDialog({
  open,
  start,
  onOpenChange,
  onPrint,
  statusActions,
  completeNote,
  unlocks,
  outcome,
}: {
  open: boolean;
  /** Where to open — computed by the step from the draft, once, as the window opens. */
  start: SignFlowStart;
  onOpenChange: (open: boolean) => void;
  onPrint: () => void;
  /** The status stage's footer, in place of Done — a host's own controls (the scrutiny
   *  correction screen: reminder, sandbox, then the send). */
  statusActions?: React.ReactNode;
  /** The roster's footnote once everyone has signed, where "pay the court fee" is not
   *  what comes next (a corrected complaint goes back to scrutiny). */
  completeNote?: string;
  /** What waits on the outstanding signatures, as the footnotes name it: the court fee
   *  in a filing, the send back to scrutiny in a correction. */
  unlocks?: string;
  /** What the host has done since, shown on the roster in place of the signing outcome —
   *  the corrections sent to scrutiny. */
  outcome?: { title: string; headline: string; footnote: string };
}) {
  /* A fresh opening is a fresh act: the body remounts so it starts on the stage the
     complaint is actually at, with nothing typed into it from last time. */
  const [opening, setOpening] = React.useState(0);
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current) setOpening((n) => n + 1);
    wasOpen.current = open;
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <SignFlowBody
          key={`${opening}:${start}`}
          start={start}
          onClose={() => onOpenChange(false)}
          onPrint={onPrint}
          statusActions={statusActions}
          completeNote={completeNote}
          unlocks={unlocks}
          outcome={outcome}
        />
      ) : null}
    </Dialog>
  );
}

function SignFlowBody({
  start,
  onClose,
  onPrint,
  statusActions,
  completeNote,
  unlocks = "The court fee opens",
  outcome,
}: {
  start: SignFlowStart;
  onClose: () => void;
  onPrint: () => void;
  statusActions?: React.ReactNode;
  completeNote?: string;
  unlocks?: string;
  outcome?: { title: string; headline: string; footnote: string };
}) {
  const { draft, update, hrefFor } = useFiling();
  const { profile } = useProfile();
  const router = useRouter();
  const { pick, input } = useFilePicker();
  const flow = useStagedFlow<Stage>({
    order: ORDER[start],
    scene: SCENES,
    /* The window is already rising; a stage that rises inside it is one gesture twice. */
    arrival: "forward",
  });

  const sign = draft.sign;

  /* ── who signs ─────────────────────────────────────────────────────────── */
  const { complainants, advocates } = React.useMemo(
    () => signatories(draft, profile),
    [draft, profile]
  );
  const everyone = React.useMemo(
    () => [...complainants, ...advocates],
    [complainants, advocates]
  );
  const yous = everyone.filter((s) => s.you);
  const youSigned = yous.length > 0 && yous.every((s) => s.status === "signed");
  const pending = everyone.filter((s) => s.status === "pending").length;
  /** Signatures and oaths still to come — what the court fee waits on. */
  const outstanding = everyone.filter(isOutstanding).length;

  /*
   * The second act, after the signature — a complainant's, where the state asks for one
   * (`OTH-3`); an advocate's slot carries none. One person can stand for more than one
   * complainant; one oath is recorded for each slot they sign in.
   */
  const yourOathSlots = yous.filter((s) => s.oathTaken !== undefined);
  const oathYours = signingRules().oath && yourOathSlots.length > 0;
  const oathOwed = oathYours && yourOathSlots.some((s) => !s.oathTaken);
  const yourOath: OathVideo | null =
    yourOathSlots.map((s) => sign.oaths[s.id]?.video).find(Boolean) ?? null;
  /** Who is recording: the person the complaint names for the slot, else the account. */
  const oathName =
    (yourOathSlots[0] ? oathTakerName(draft, yourOathSlots[0].id) : "") ||
    profile?.name.trim() ||
    "";
  /** A PoA holder swears for someone else, and the step says whom. */
  const oathFor = (() => {
    const c = draft.complainants.find((x) => `sig-c-${x.id}` === yourOathSlots[0]?.id);
    return c && c.type === "individual" && c.poa === "yes" ? c.name.trim() || undefined : undefined;
  })();
  const onPaperPath = start === "paper" || sign.mode === "upload";
  /** The two acts, named for an advocate before the first one starts. */
  const trail = (current: "sign" | "oath"): TrailStep[] => [
    { label: onPaperPath ? "Confirm by OTP" : "E-sign", state: current === "sign" ? "current" : "done" },
    { label: "Oath", state: current === "oath" ? "current" : "next" },
  ];
  const otherSigners = Math.max(0, everyone.length - yous.length);
  const others =
    otherSigners === 1 ? "The other party" : `The other ${otherSigners} parties`;
  const have = otherSigners === 1 ? "has" : "have";

  /* ── the filer's own signature ─────────────────────────────────────────── */
  const [otp, setOtp] = React.useState("");
  const [resent, setResent] = React.useState(false);
  const [dscFound, setDscFound] = React.useState(false);
  const [signedWith, setSignedWith] = React.useState<SignInstrument | null>(null);
  const resendTimer = React.useRef<number | null>(null);

  /* ── turning to paper ──────────────────────────────────────────────────── */
  /* A filer who already gave a reason and stepped back sees it picked, not a blank —
     unless it is one the list no longer offers. */
  const fallbackReasons = paperFallbackReasons(otherSigners);
  const [fallbackReason, setFallbackReason] = React.useState<PaperFallbackReason | "">(() => {
    const saved = sign.paperFallback?.reason;
    return saved && fallbackReasons.some((r) => r.id === saved) ? saved : "";
  });
  /** Requests already out on the digital path, which turning to paper withdraws. */
  const requested = sign.mode === "digital" && sign.requestedAt !== null;
  const anySigned = sign.mode === "digital" && everyone.some((s) => s.status === "signed");

  /* ── the uploaded copy ─────────────────────────────────────────────────── */
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [otpFor, setOtpFor] = React.useState<string | null>(null);
  const [rowOtp, setRowOtp] = React.useState("");
  const [rowResent, setRowResent] = React.useState<string | null>(null);
  const rowResendTimer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (resendTimer.current) window.clearTimeout(resendTimer.current);
      if (rowResendTimer.current) window.clearTimeout(rowResendTimer.current);
    },
    []
  );

  /*
   * A DSC is read off the signer's own machine, not from us, and the utility takes a
   * beat to answer. The stage says it is looking rather than presenting a certificate it
   * never went to find.
   */
  React.useEffect(() => {
    if (flow.stage !== "dsc" || dscFound) return;
    const timer = window.setTimeout(() => setDscFound(true), 1100);
    return () => window.clearTimeout(timer);
  }, [flow.stage, dscFound]);

  /** Whether this opening of the window sent the links out — `choose` was passed through. */
  const [sentThisOpening, setSentThisOpening] = React.useState(false);

  const mobileTail = (profile?.mobile ?? "").replace(/\D/g, "").slice(-4);
  const certHolder = (profile?.name ?? "").trim();

  const confirmRows = React.useMemo(() => phoneConfirmers(draft), [draft]);
  /** OTP and, where the state asks for one, the oath — a confirmation is both. */
  const isConfirmed = React.useCallback(
    (person: PhoneConfirmer) => confirmationComplete(draft, person),
    [draft]
  );
  const confirmedCount = confirmRows.filter(isConfirmed).length;
  const allConfirmed =
    confirmRows.length > 0 && confirmedCount === confirmRows.length;
  /** The confirmer at this keyboard, if the uploader is one of the complainants. */
  const isYouRow = React.useCallback(
    (person: PhoneConfirmer) => isYourConfirmation(person, profile),
    [profile]
  );

  /* ── acts ──────────────────────────────────────────────────────────────── */

  /**
   * The commitment, made by pressing the card that describes it. The draft stops being
   * private here: every other signatory is asked, by link, to sign this exact document.
   */
  const chooseDigital = () => {
    if (everyone.length === 0) return;
    const now = new Date().toISOString();
    update((d) => {
      d.sign.mode = "digital";
      d.sign.paperFallback = null;
      d.sign.requestedAt = now;
      // Everyone but the people at this keyboard — "you" sign here, not by link.
      d.sign.notified = Object.fromEntries(
        everyone.filter((s) => !s.you).map((s) => [s.id, now])
      );
    });
    setSentThisOpening(true);
    flow.go(yous.length > 0 ? "sign" : "done");
  };

  /**
   * Paper instead, once the filer has said why. Nothing is sent to anyone, and anything
   * already outstanding is recalled — the printed copy has to carry every signature by
   * hand regardless. A draft already on paper (one from before this question existed)
   * only gains the reason; its copy and confirmations stay where they are.
   */
  const continueToPaper = () => {
    if (!fallbackReason) return;
    const now = new Date().toISOString();
    const paperFallback = { reason: fallbackReason, at: now };
    const alreadyOnPaper = sign.mode === "upload";
    update((d) => {
      d.sign.paperFallback = paperFallback;
      if (alreadyOnPaper) return;
      d.sign.mode = "upload";
      d.sign.requestedAt = null;
      d.sign.signed = {};
      d.sign.confirmed = {};
      // Each other complainant confirms on their own device, through a link (`SIG-05`).
      d.sign.notified = Object.fromEntries(
        confirmRows.filter((p) => !isYouRow(p)).map((p) => [confirmerSlot(p.id), now])
      );
    });
    setSentThisOpening(false);
    setUploadError(null);
    setOtpFor(null);
    setRowOtp("");
    flow.go("paper");
  };

  /** One person's own signature, by the instrument in their own hands. */
  const signYou = (instrument: "aadhaar" | "dsc") => {
    if (yous.length === 0) return;
    const at = new Date().toISOString();
    update((d) => {
      for (const s of yous) d.sign.signed[s.id] = { at, with: instrument };
    });
    setSignedWith(instrument);
    flow.go("done");
  };

  const resendOtp = () => {
    setResent(true);
    if (resendTimer.current) window.clearTimeout(resendTimer.current);
    resendTimer.current = window.setTimeout(() => setResent(false), 2500);
  };

  const receiveSignedCopy = async (file: File) => {
    const previous = sign.signedCopy;
    let ref: StoredFileRef;
    try {
      ref = await storeUpload(file);
    } catch {
      setUploadError("We couldn't store that file in this browser. Please try again.");
      return;
    }
    update((d) => {
      d.sign.signedCopy = ref;
    });
    if (previous) {
      forgetFile(previous.id);
      void getRepository().deleteFile(previous.id);
    }
  };

  const chooseSignedCopy = () => {
    setUploadError(null);
    pick((file, error) => {
      if (error) {
        setUploadError(pickErrorMessage(error));
        return;
      }
      if (file) void receiveSignedCopy(file);
    });
  };

  /** Send one party's confirmation link again. The link itself does not change. */
  const [linkResent, setLinkResent] = React.useState<string | null>(null);
  const resendLink = (person: PhoneConfirmer) => {
    update((d) => {
      d.sign.notified[confirmerSlot(person.id)] = new Date().toISOString();
    });
    setLinkResent(person.id);
  };

  const sendRowOtp = (id: string) => {
    setOtpFor(id);
    setRowOtp("");
    setRowResent(null);
  };

  const resendRowOtp = (id: string) => {
    setRowResent(id);
    if (rowResendTimer.current) window.clearTimeout(rowResendTimer.current);
    rowResendTimer.current = window.setTimeout(() => setRowResent(null), 2500);
  };

  const confirmRow = (person: PhoneConfirmer) => {
    const tail = person.mobile.replace(/\D/g, "").slice(-4);
    if (rowOtp.length < 6 || !tail) return;
    update((d) => {
      d.sign.confirmed[person.id] = {
        mobileTail: tail,
        at: new Date().toISOString(),
      };
    });
    setOtpFor(null);
    setRowOtp("");
    setRowResent(null);
    // The oath goes with the confirmation, on the same device (`OTH-3`).
    if (signingRules().oath && !sign.oaths[confirmerSlot(person.id)]) flow.go("oath");
  };

  /**
   * An uploaded copy is the complaint *after* every party has signed it, so it settles
   * the whole sheet rather than the uploader's own row — and each complainant has
   * confirmed by OTP on their own device, with their oath where the state asks for one,
   * before this can be pressed.
   */
  const submitSignedCopy = () => {
    if (!sign.signedCopy || !allConfirmed) return;
    const at = new Date().toISOString();
    update((d) => {
      for (const s of everyone) d.sign.signed[s.id] = { at, with: "paper" };
      d.sign.mode = "upload";
    });
    flow.go("uploaded");
  };

  /** One oath, written to every complainant slot this person signs in. */
  const saveOath = (video: OathVideo) => {
    const at = new Date().toISOString();
    update((d) => {
      for (const s of yourOathSlots) {
        d.sign.oaths[s.id] = { at, video, by: oathTakerName(draft, s.id, oathName) };
      }
    });
  };
  /** On paper the oath is part of the confirmation, so it returns to the upload. */
  const afterOath = () => flow.go(onPaperPath && !youSigned ? "paper" : "sworn");

  /* ── the window ────────────────────────────────────────────────────────── */

  const baseTitle = {
    choose: "How will this complaint be signed?",
    sign: "Add your e-signature",
    otp: "Enter the OTP",
    dsc: "Sign with your DSC",
    /* Reopened with everyone in, nothing was just added or sent out. */
    done: signedWith
      ? "Signature added"
      : outstanding === 0
        ? "Everyone has signed"
        : youSigned
          ? "Signature added"
          : "Out for signature",
    fallback: "Unable to e-sign?",
    paper: "Upload the signed complaint",
    uploaded: "Signed copy accepted",
    oath: "Take your oath",
    sworn: "Oath recorded",
  }[flow.stage];
  /* Once the host has acted (sent to scrutiny), the roster stages say so. */
  const settledStage = flow.stage === "done" || flow.stage === "sworn";
  const title = outcome && settledStage ? outcome.title : baseTitle;

  const description = {
    choose:
      everyone.length > 1
        ? `All ${everyone.length} signatories sign the same way.`
        : "Choose how this complaint is signed.",
    sign: "Either one is your own signature — use whichever you have.",
    otp: mobileTail
      ? `Sent to your Aadhaar-linked mobile ending ${mobileTail}.`
      : "Sent to your Aadhaar-linked mobile.",
    dsc: "Your certificate has to be plugged in, with the signing utility running on this computer.",
    done: null,
    fallback:
      "E-signing is quicker for everyone. On paper, every party signs by hand and each complainant confirms by OTP.",
    paper: null,
    uploaded: null,
    oath: "Record yourself reading the oath. It is kept with the case file.",
    sworn: null,
  }[flow.stage];

  const footer = {
    choose: null,
    sign: (
      <Button type="button" variant="ghost" onClick={onClose}>
        I&rsquo;ll sign later
      </Button>
    ),
    otp: (
      <>
        <Button type="button" variant="outline" onClick={() => flow.go("sign")}>
          Back
        </Button>
        <Button type="button" disabled={otp.length < 6} onClick={() => signYou("aadhaar")}>
          Verify and sign
        </Button>
      </>
    ),
    dsc: (
      <>
        <Button type="button" variant="outline" onClick={() => flow.go("sign")}>
          Back
        </Button>
        <Button type="button" disabled={!dscFound} onClick={() => signYou("dsc")}>
          Sign with this certificate
        </Button>
      </>
    ),
    done:
      youSigned && oathOwed ? (
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            I&rsquo;ll take it later
          </Button>
          <Button type="button" onClick={() => flow.go("oath")}>
            Continue to the oath
          </Button>
        </>
      ) : statusActions ? (
        statusActions
      ) : (
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      ),
    fallback: (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={() => (start === "fallback" ? onClose() : flow.go("choose"))}
        >
          Keep e-signing
        </Button>
        <Button type="button" disabled={!fallbackReason} onClick={continueToPaper}>
          Continue to upload
        </Button>
      </>
    ),
    paper: (
      <>
        <Button type="button" variant="outline" onClick={() => flow.go("choose")}>
          Choose another way
        </Button>
        <Button
          type="button"
          disabled={!sign.signedCopy || !allConfirmed}
          onClick={submitSignedCopy}
        >
          Submit as fully signed
        </Button>
      </>
    ),
    uploaded: statusActions ?? (
      <Button type="button" onClick={onClose}>
        Done
      </Button>
    ),
    oath: (
      <>
        <Button type="button" variant="ghost" onClick={onClose}>
          I&rsquo;ll take it later
        </Button>
        <Button type="button" disabled={!yourOath} onClick={afterOath}>
          Submit oath
        </Button>
      </>
    ),
    // The oath settles on the same roster, so the host's controls follow it here too.
    sworn: statusActions ?? (
      <Button type="button" onClick={onClose}>
        Done
      </Button>
    ),
  }[flow.stage];

  return (
    <>
      {input}
      <StagedOverlay mobileSheet
        className="sm:max-w-2xl"
        title={title}
        titleRef={flow.titleRef}
        titleAside={
          flow.stage === "done" || flow.stage === "uploaded" || flow.stage === "sworn" ? (
            <Badge variant="success">
              <CheckIcon aria-hidden />
              {everyone.length - pending} of {everyone.length} signed
            </Badge>
          ) : null
        }
        description={description}
        sceneKey={flow.sceneKey}
        motion={flow.motion}
        footer={footer}
      >
        {flow.stage === "choose" ? (
          <StageColumn>
            <ChoiceCard
              title="Sign digitally"
              tone="bg-brand-muted text-brand-muted-foreground"
              icon={<SignatureIcon className="size-5" />}
              onClick={chooseDigital}
            >
              You sign the complaint with your DSC or Aadhaar e-sign.
              {otherSigners > 0 ? (
                <>
                  {" "}
                  {others} {have === "has" ? "gets" : "get"} a link on the mobile number
                  given in the complaint.
                </>
              ) : null}
            </ChoiceCard>

            <PaperFallbackLink onClick={() => flow.go("fallback")} />
          </StageColumn>
        ) : flow.stage === "fallback" ? (
          <StageColumn>
            {/* Said before the act, in the window that does it: other people already
                hold a request against this complaint, and paper takes it back. */}
            {requested || anySigned ? (
              <SectionNotice variant="warning" title="This withdraws the e-sign requests">
                {otherSigners === 0
                  ? "Your e-signature is voided. The PDF you upload has to carry your signature by hand instead."
                  : `${others} ${have} been asked to e-sign. Continuing withdraws ${
                      otherSigners === 1 ? "that request" : "those requests"
                    }${
                      anySigned ? " and voids the signatures already collected" : ""
                    } — the PDF you upload has to carry every signature by hand.`}
              </SectionNotice>
            ) : null}
            <PaperFallbackQuestion
              reasons={fallbackReasons}
              value={fallbackReason}
              onChange={setFallbackReason}
            />
          </StageColumn>
        ) : flow.stage === "sign" ? (
          <StageColumn>
            {/* Only as the outcome of "Sign digitally" in this same opening. Opened
                straight on this stage, the request went out on an earlier visit and the
                line would be stale — and could be false, if the other party has signed. */}
            {sentThisOpening && otherSigners > 0 ? (
              <SectionNotice variant="success" announce="polite" title="Sent for signature">
                {others} {have} a link on the mobile number given in the complaint.
              </SectionNotice>
            ) : null}

            {oathYours ? <StepTrail steps={trail("sign")} /> : null}

            <InstrumentChoice
              onAadhaar={() => {
                setOtp("");
                flow.go("otp");
              }}
              onDsc={() => {
                setDscFound(false);
                flow.go("dsc");
              }}
            />
          </StageColumn>
        ) : flow.stage === "otp" ? (
          <StageColumn>
            <OtpEntry
              id="esign-otp"
              value={otp}
              onChange={setOtp}
              resent={resent}
              onResend={resendOtp}
            />
          </StageColumn>
        ) : flow.stage === "dsc" ? (
          <StageColumn>
            <DscLookup found={dscFound} holder={certHolder} />
          </StageColumn>
        ) : flow.stage === "done" ? (
          <StageColumn>
            <SettledCard
              /* Only sent out, others still to sign: sent, not decided. */
              tone={!outcome && !(youSigned && signedWith) && outstanding !== 0 ? "info" : "success"}
              headline={
                outcome
                  ? outcome.headline
                  : youSigned && signedWith
                    ? INSTRUMENT_LABEL[signedWith]
                    : outstanding === 0
                      ? signingRules().oath
                        ? "Every signature and oath is in"
                        : "Every signature is in"
                      : "Sent for signature"
              }
              rows={everyone}
              footnote={
                outcome
                  ? outcome.footnote
                  : youSigned && oathOwed
                  ? `Your oath is next. ${unlocks} once every signature and oath is in.`
                  : outstanding === 0
                    ? completeNote ?? "You can pay the court fee now."
                    : `It waits under Take action until every signature${signingRules().oath ? " and oath" : ""} is in.`
              }
            />
          </StageColumn>
        ) : flow.stage === "paper" ? (
          <PaperStage
            file={sign.signedCopy}
            error={uploadError}
            onChoose={chooseSignedCopy}
            rows={confirmRows}
            confirmedCount={confirmedCount}
            isConfirmed={isConfirmed}
            isOtpIn={(person) => phoneConfirmed(draft, person)}
            isYou={isYouRow}
            oathOn={signingRules().oath}
            linkResent={linkResent}
            onResendLink={resendLink}
            onRecordOath={() => flow.go("oath")}
            linkFor={(person) =>
              `/sign?draft=${encodeURIComponent(draft.id)}&as=${encodeURIComponent(confirmerSlot(person.id))}`
            }
            otpFor={otpFor}
            rowOtp={rowOtp}
            rowResent={rowResent}
            onOpenRow={sendRowOtp}
            onRowOtp={setRowOtp}
            onResendRow={resendRowOtp}
            onConfirmRow={confirmRow}
            /* No number on file is a gap in the party's own section, so that is where
               it is fixed. */
            onAddNumber={() => {
              onClose();
              router.push(hrefFor("complainant"));
            }}
            onPrint={onPrint}
          />
        ) : flow.stage === "uploaded" ? (
          <StageColumn>
            <SettledCard
              headline="Signed copy accepted"
              rows={everyone}
              footnote={
                outstanding === 0
                  ? completeNote ?? "You can pay the court fee now."
                  : `${unlocks} once every signature is in.`
              }
            />
          </StageColumn>
        ) : flow.stage === "oath" ? (
          <StageColumn>
            <StepTrail steps={trail("oath")} />
            <OathCapture name={oathName} forWhom={oathFor} value={yourOath} onChange={saveOath} />
          </StageColumn>
        ) : (
          <StageColumn>
            <SettledCard
              headline={outcome ? outcome.headline : "Oath recorded"}
              rows={everyone}
              footnote={
                outcome
                  ? outcome.footnote
                  : outstanding === 0
                  ? completeNote ?? "You can pay the court fee now."
                  : `It waits under Take action until every signature${signingRules().oath ? " and oath" : ""} is in.`
              }
            />
          </StageColumn>
        )}
      </StagedOverlay>
    </>
  );
}

/* ───────────────────────────── Stages ──────────────────────────────────── */

/**
 * The paper path: one file that already carries every signature, and each complainant's
 * own confirmation that the signature against their name is theirs.
 */
function PaperStage({
  file,
  error,
  onChoose,
  rows,
  confirmedCount,
  isConfirmed,
  isOtpIn,
  isYou,
  oathOn,
  linkResent,
  onResendLink,
  onRecordOath,
  linkFor,
  otpFor,
  rowOtp,
  rowResent,
  onOpenRow,
  onRowOtp,
  onResendRow,
  onConfirmRow,
  onAddNumber,
  onPrint,
}: {
  file: StoredFileRef | null;
  error: string | null;
  onChoose: () => void;
  rows: PhoneConfirmer[];
  confirmedCount: number;
  isConfirmed: (person: PhoneConfirmer) => boolean;
  /** The OTP alone is in — the oath may still be owed. */
  isOtpIn: (person: PhoneConfirmer) => boolean;
  isYou: (person: PhoneConfirmer) => boolean;
  oathOn: boolean;
  linkResent: string | null;
  onResendLink: (person: PhoneConfirmer) => void;
  onRecordOath: () => void;
  /** Sandbox: the link this person would get by SMS. */
  linkFor: (person: PhoneConfirmer) => string;
  otpFor: string | null;
  rowOtp: string;
  rowResent: string | null;
  onOpenRow: (id: string) => void;
  onRowOtp: (value: string) => void;
  onResendRow: (id: string) => void;
  onConfirmRow: (person: PhoneConfirmer) => void;
  onAddNumber: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SectionNotice variant="warning" title="Every party's signature should be on the PDF">
        Each complainant, and their advocate on record.
      </SectionNotice>

      {file ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-card p-4">
          <FileTextIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-compact font-medium">{file.name}</p>
            <p className="text-body-compact text-muted-foreground tabular-nums">
              {file.ext}
              {formatBytes(file.size) ? ` · ${formatBytes(file.size)}` : ""}
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onChoose}>
            Replace
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onChoose}
          className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-input bg-card p-6 text-center outline-none transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <UploadIcon className="size-8 text-muted-foreground" aria-hidden />
          <span className="text-body-compact text-muted-foreground">
            Choose the signed file from{" "}
            <span className="font-medium text-primary underline underline-offset-2">
              my files
            </span>
          </span>
        </button>
      )}

      {error ? (
        <SectionNotice
          variant="destructive"
          announce="assertive"
          title="That file wasn’t added"
        >
          {error}
        </SectionNotice>
      ) : null}

      <p className="text-body-compact text-muted-foreground">
        Upload .jpg, .png, .jpeg, .webp or .pdf. Maximum upload size of 15 MB.
      </p>

      {/* The rows carry their own dividers, so the header keeps the card's padding and
          the list sits inside it — a `gap` between the two left the first row 20px from
          the sentence above it and the last one 28px from the edge (owner, 2026-09-24). */}
      <div className="rounded-xl border border-hairline bg-card">
        <div className="flex flex-col gap-1 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-body font-semibold">Confirm each complainant</h3>
            <span className="text-body-compact font-medium text-muted-foreground tabular-nums">
              {confirmedCount} of {rows.length} confirmed
            </span>
          </div>
          <p className="text-body-compact text-muted-foreground">
            {oathOn
              ? "Each one gets a link by SMS, confirms with the OTP on their own device that they signed this copy, and records their oath there."
              : "Each one gets a link by SMS and confirms with the OTP on their own device that they signed this copy."}
          </p>
        </div>
        <ul className="border-t border-hairline px-4">
          {rows.map((person, i) => (
            <ConfirmRow
              key={person.id}
              person={person}
              index={i}
              confirmed={isConfirmed(person)}
              otpIn={isOtpIn(person)}
              you={isYou(person)}
              oathOn={oathOn}
              linkResent={linkResent === person.id}
              onResendLink={() => onResendLink(person)}
              onRecordOath={onRecordOath}
              linkHref={linkFor(person)}
              open={otpFor === person.id}
              otp={otpFor === person.id ? rowOtp : ""}
              resent={rowResent === person.id}
              onOpen={() => onOpenRow(person.id)}
              onOtp={onRowOtp}
              onResend={() => onResendRow(person.id)}
              onConfirm={() => onConfirmRow(person)}
              onAddNumber={onAddNumber}
            />
          ))}
        </ul>
      </div>

      <p className="flex flex-wrap items-center gap-1 text-body-compact">
        Need the unsigned document to sign on paper?
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 underline"
          onClick={onPrint}
        >
          Print or save as PDF
        </Button>
      </p>
    </div>
  );
}

/* ──────────────────── Phone confirmation (paper path) ──────────────────── */

/** The tail of a number, for display — the row never repeats the whole thing back. */
function mobileTailOf(mobile: string): string {
  return mobile.replace(/\D/g, "").slice(-4);
}

/**
 * One party on the uploaded copy, and the confirmation that turns "someone says they all
 * signed" into that person's own word. The OTP only proves the handset; the sentence
 * beside it is what the person is actually answering, so the two never appear apart.
 *
 * Each party confirms on their own device, through the link sent to them by SMS — the
 * OTP is never entered on the uploader's screen (`SIG-05`, handover §18.3). The one
 * exception is the uploader's own row: this is already their device. Where the state asks
 * for an oath, it is recorded with the confirmation, on the same device (`OTH-3`).
 */
function ConfirmRow({
  person,
  index,
  confirmed,
  otpIn,
  you,
  oathOn,
  linkResent,
  onResendLink,
  onRecordOath,
  linkHref,
  open,
  otp,
  resent,
  onOpen,
  onOtp,
  onResend,
  onConfirm,
  onAddNumber,
}: {
  person: PhoneConfirmer;
  index: number;
  confirmed: boolean;
  otpIn: boolean;
  you: boolean;
  oathOn: boolean;
  linkResent: boolean;
  onResendLink: () => void;
  onRecordOath: () => void;
  linkHref: string;
  open: boolean;
  otp: string;
  resent: boolean;
  onOpen: () => void;
  onOtp: (value: string) => void;
  onResend: () => void;
  onConfirm: () => void;
  onAddNumber: () => void;
}) {
  const tail = mobileTailOf(person.mobile);
  const otpId = `confirm-otp-${person.id}`;

  return (
    <li className="border-b border-hairline py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-caption font-medium text-secondary-foreground tabular-nums"
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-compact font-semibold text-foreground">
            {person.name}
          </p>
          <p className="text-body-compact text-muted-foreground">
            {/* A party with no name of their own is already called "Complainant 1" above;
                repeating the role would say it twice in one row. */}
            {person.role.startsWith(person.name) ? null : `${person.role} · `}
            {tail ? (
              <span className="tabular-nums">•••• {tail}</span>
            ) : (
              "No number on file"
            )}
          </p>
        </div>
        {/* One action or one status per row, never both — the action replaces the cue. */}
        {confirmed ? (
          <Badge variant="success">
            <CheckIcon aria-hidden />
            Confirmed
          </Badge>
        ) : !tail ? (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 underline"
            onClick={onAddNumber}
          >
            Add number
          </Button>
        ) : you && otpIn && oathOn ? (
          <Button type="button" variant="outline" size="sm" onClick={onRecordOath}>
            Record your oath
          </Button>
        ) : you ? (
          open ? null : (
            <Button type="button" variant="outline" size="sm" onClick={onOpen}>
              Send OTP
            </Button>
          )
        ) : (
          <Badge variant="secondary">
            {otpIn && oathOn ? "Oath pending" : "Waiting"}
          </Badge>
        )}
      </div>

      {/* Someone else's confirmation happens on their device; this row only follows it. */}
      {!you && !confirmed && tail ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 ps-9 text-body-compact text-muted-foreground">
          <span>
            {linkResent ? "Link sent again" : "Link sent by SMS"} to{" "}
            <span className="tabular-nums">•••• {tail}</span>
          </span>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 underline"
            onClick={onResendLink}
          >
            Resend link
          </Button>
          <a
            href={linkHref}
            target="_blank"
            rel="noreferrer"
            className="text-body-compact font-medium text-primary underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Sandbox: open their link
          </a>
        </div>
      ) : null}

      {you && open && !otpIn && tail ? (
        <div className="mt-3 flex flex-col gap-3 rounded-lg bg-surface-sunken p-4">
          <p className="text-body-compact text-muted-foreground">
            In the live service, a 6-digit OTP goes to{" "}
            <strong className="font-semibold text-foreground tabular-nums">
              •••• {tail}
            </strong>
            . Entering it confirms that{" "}
            <strong className="font-semibold text-foreground">{person.name}</strong> has
            signed this complaint{oathOn ? ". Your oath is recorded next" : ""}.
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor={otpId} className="text-body-compact">
              Enter OTP
            </Label>
            <InputOTP
              id={otpId}
              maxLength={6}
              value={otp}
              onChange={onOtp}
              containerClassName="gap-2"
              // Opening a row reveals the field below the fold; focus follows the action
              // so it scrolls into view and a keyboard user lands on it.
              autoFocus
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="size-10 rounded-lg border border-input"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <p className="text-body-compact text-muted-foreground">
              Sandbox — any 6-digit code is accepted here.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 underline"
              onClick={onResend}
            >
              {resent ? "Sent again" : "Resend OTP"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={otp.length < 6}
              onClick={onConfirm}
            >
              Confirm
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
