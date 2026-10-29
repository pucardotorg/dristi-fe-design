"use client";

/**
 * **`/sign` — where a signing link lands.**
 *
 * When a complaint is sent for signature, every party not at the filer's keyboard gets a
 * link by SMS. This is the other end of it. The person arriving did not start this
 * filing and may never have used DRISTI, so the page explains itself before it asks for
 * anything: who is filing, against whom, in which court, what they are named as, and what
 * they are about to do.
 *
 * Then, in one window of stages (the product's staged-overlay pattern, as the filer's own
 * signing window is):
 *
 * 1. **Why you got this link** — the case, their part in it, and the steps ahead.
 * 2. **Sign in** — signing and the oath are tied to an account, so a person who is not
 *    signed in does that first, and someone new registers through the same flow as
 *    everywhere else (`SignInBlock`).
 * 3. **E-sign** — Aadhaar OTP or DSC, the same cards as the filer's. On a complaint signed
 *    on paper there is no e-signature: the person confirms by the OTP sent to their own
 *    number that they signed the copy being uploaded (`SIG-05`) — here, on their own
 *    device, never on the uploader's screen.
 * 4. **The oath** — a complainant's, where the state asks for one, recorded by whoever
 *    signs for them: the complainant, their PoA holder or an Institution's representative
 *    (`OathCapture`, `OTH-3`). Advocates never record one.
 *
 * Both acts are shown from the start ("E-sign" or "Confirm by OTP", then "Oath") so the
 * second never arrives as a surprise.
 *
 * **A complainant goes into File a case.** Once a litigant has signed in or registered,
 * the complaint opens inside the product's shell, under File a case
 * (`/filings/sign-request`, `inShell`), with the signing window over it — not on this
 * standalone page — and their home lists it among their cases (`linked-complaints.ts`).
 * An advocate's link goes the same way, into their own File a case.
 *
 * Sandbox: no SMS is sent and no session is real. The filer opens this from the Sign
 * step, and signing in here only marks this tab as signed in. The page reads and writes
 * the same draft the filer has, so what is done here shows on the filer's Sign step.
 */

import { setNewAccountShell } from "@/lib/filing/linked-complaints";
import * as React from "react";

import { PageOutcome } from "@/components/feedback";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LogInIcon,
  SignatureIcon,
  VideoIcon,
  LinkIcon,
} from "lucide-react";

import { useStagedFlow, StagedOverlay } from "@/components/chrome/staged-overlay";
import { BrandLockup } from "@/components/brand-lockup";
import { SignInBlock } from "@/components/sign-in-block";
import { signingRules } from "@/lib/filing/config";
import { money } from "@/lib/filing/format";
import { COURT } from "@/lib/filing/options";
import {
  confirmerSlot,
  draftTitle,
  oathTakerName,
  phoneConfirmed,
  phoneConfirmers,
  signatories,
} from "@/lib/filing/selectors";
import { useLocalStorageValue } from "@/hooks/use-local-storage-value";
import { ensureSampleDrafts } from "@/lib/filing/sample-drafts";
import { FilingProvider, useFiling } from "@/lib/filing/store";
import type {
  OathVideo,
  SignInstrument,
  Signatory,
} from "@/lib/filing/types";
import type { Locale } from "@/lib/onboarding/content";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionNotice } from "@/components/filing/notices";
import { OathCapture } from "@/components/filing/oath-capture";
import { CourtDocument } from "@/components/filing/sections/preview/court-document";
import {
  DscLookup,
  InstrumentChoice,
  OtpEntry,
  SettledCard,
  StageColumn,
  StepTrail,
  type TrailStep,
} from "@/components/filing/sign-stages";
import { useCourtText } from "@/components/court/court-provider";
import { Breadcrumbs } from "@/components/shell/chrome";
import {
  ACCOUNT_NAME_KEY,
  ADVOCATE_AVAILABLE_KEY,
  PROFILE_ROLE_KEY,
} from "@/components/shell/profile";
import {
  linkedComplaintHref,
  rememberLinkedComplaint,
} from "@/lib/filing/linked-complaints";

type Stage = "why" | "account" | "confirm" | "sign" | "otp" | "dsc" | "signed" | "oath" | "done";
type Start = "why" | "confirm" | "sign" | "oath" | "done";

/** One order per starting point: the window opens where this person actually is. */
const ORDER: Record<Start, readonly Stage[]> = {
  why: ["why", "account", "confirm", "sign", "otp", "dsc", "signed", "oath", "done"],
  confirm: ["confirm", "signed", "oath", "done", "why", "account", "sign", "otp", "dsc"],
  sign: ["sign", "otp", "dsc", "signed", "oath", "done", "why", "account", "confirm"],
  oath: ["oath", "done", "why", "account", "confirm", "sign", "otp", "dsc", "signed"],
  done: ["done", "why", "account", "confirm", "sign", "otp", "dsc", "signed", "oath"],
};

/** An act and its outcome share a scene, so the signature settles where it was made. */
const SCENES: Record<Stage, string> = {
  why: "why",
  account: "account",
  confirm: "act",
  sign: "sign",
  otp: "act",
  dsc: "act",
  signed: "act",
  oath: "oath",
  done: "done",
};

const INSTRUMENT_LABEL: Record<SignInstrument, string> = {
  aadhaar: "Signed with Aadhaar OTP",
  dsc: "Signed with a DSC",
  paper: "Signed on paper",
  otp: "Signed with mobile OTP",
};

/** Sandbox session: signing in on this page marks this tab, for this link, as signed in. */
const sessionKey = (draftId: string, signatoryId: string) =>
  `dristi:sign-link:${draftId}:${signatoryId}`;

function readSession(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.sessionStorage.getItem(key);
  } catch {
    return false;
  }
}

/**
 * `inShell` is the same complaint inside a signed-in litigant's home: the shell gives it
 * its frame and breadcrumb, and there is no sign-in step left to take.
 */
export function SignLinkScreen({ inShell = false }: { inShell?: boolean }) {
  const params = useSearchParams();
  const draftId = params.get("draft") ?? "";
  const signatoryId = params.get("as") ?? "";

  // Sandbox: a link to a sample opens in a browser that has not been to File a case yet.
  const [seeded, setSeeded] = React.useState(false);
  React.useEffect(() => {
    ensureSampleDrafts().finally(() => setSeeded(true));
  }, []);

  if (!draftId || !signatoryId) return <LinkUnavailable inShell={inShell} />;
  if (!seeded) return <LinkLoading />;
  return (
    <FilingProvider
      draftId={draftId}
      fallback={<LinkLoading />}
      notFound={<LinkUnavailable inShell={inShell} />}
    >
      <SignLinkBody draftId={draftId} signatoryId={signatoryId} inShell={inShell} />
    </FilingProvider>
  );
}

function SignLinkBody({
  draftId,
  signatoryId,
  inShell,
}: {
  draftId: string;
  signatoryId: string;
  inShell: boolean;
}) {
  const courtText = useCourtText();
  const router = useRouter();
  const { draft, update } = useFiling();
  const [locale, setLocale] = React.useState<Locale>("en");
  const accountName = useLocalStorageValue(ACCOUNT_NAME_KEY);

  const me: Signatory | undefined = React.useMemo(() => {
    const { complainants, advocates } = signatories(draft, null);
    return [...complainants, ...advocates].find((s) => s.id === signatoryId);
  }, [draft, signatoryId]);

  const key = sessionKey(draftId, signatoryId);
  // Read once, as the state is made: this page only ever renders in the browser (the link's
  // query bails it out of prerendering), so there is no server value to disagree with.
  // Inside the shell the person is already signed in — that is how they got there.
  const [signedIn] = React.useState(() => inShell || readSession(key));

  /** Signing in is a different page — the product's own sign-in and registration. */
  const [view, setView] = React.useState<"document" | "auth">("document");
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [start, setStart] = React.useState<Start>("why");
  const [opening, setOpening] = React.useState(0);

  const isAdvocate = !!me?.id.startsWith("sig-a-");
  const onPaper = draft.sign.mode === "upload";
  /** On paper, the complainant this link answers for confirms by phone (`SIG-05`). */
  const confirmer = React.useMemo(
    () => phoneConfirmers(draft).find((p) => confirmerSlot(p.id) === signatoryId),
    [draft, signatoryId]
  );
  const needsConfirm =
    onPaper && !!confirmer && me?.status !== "signed" && !phoneConfirmed(draft, confirmer);
  const needsSign = !!me && !onPaper && me.status !== "signed";
  /** Only a complainant's slot carries an oath, and only where the state asks for one. */
  const needsOath = !!me && me.oathTaken === false;
  const owed = needsConfirm || needsSign || needsOath;
  const filed = draft.status === "filed";

  // Opened inside the home, the complaint is the litigant's from now on.
  React.useEffect(() => {
    if (inShell && me) rememberLinkedComplaint({ draftId, signatoryId });
  }, [inShell, me, draftId, signatoryId]);

  const openAt = React.useCallback((at: Start) => {
    setStart(at);
    setOpening((n) => n + 1);
    setWizardOpen(true);
  }, []);

  /* The page explains itself on arrival — once, after it has painted. */
  // Marked only once it has actually opened: the draft re-saves just after loading, and
  // a greeting cancelled by that re-render must be able to try again.
  const greeted = React.useRef(false);
  const canGreet = !!me && !filed;
  React.useEffect(() => {
    if (greeted.current || !canGreet) return;
    const timer = window.setTimeout(() => {
      greeted.current = true;
      // Arriving from sign-in, the person has read why already; go to what is next.
      const act: Start = needsConfirm ? "confirm" : needsSign ? "sign" : needsOath ? "oath" : "done";
      openAt(owed ? (inShell ? act : "why") : "done");
    }, 500);
    return () => window.clearTimeout(timer);
  }, [canGreet, owed, openAt, inShell, needsConfirm, needsSign, needsOath]);

  if (!me) return <LinkUnavailable inShell={inShell} />;

  const nextAct: Start = needsConfirm
    ? "confirm"
    : needsSign
      ? "sign"
      : needsOath
        ? "oath"
        : "done";
  /** Whether this person has an oath at all — a complainant's slot, with the oath on. */
  const swears = me.oathTaken !== undefined;

  const finishSignIn = () => {
    try {
      window.sessionStorage.setItem(key, new Date().toISOString());
    } catch {
      /* private mode — this tab stays signed in until it is closed either way */
    }
    // Signed in, the person is in the product: the complaint opens under File a case,
    // in their own shell, with the signing window over it.
    try {
      window.localStorage.setItem(PROFILE_ROLE_KEY, isAdvocate ? "advocate" : "litigant");
      // A signing link brings the complaint back onto this account's home.
      setNewAccountShell(false);
      window.localStorage.setItem(ADVOCATE_AVAILABLE_KEY, isAdvocate ? "true" : "false");
      const name = oathTakerName(draft, me.id, accountName ?? "");
      if (name) window.localStorage.setItem(ACCOUNT_NAME_KEY, name);
    } catch {
      /* storage blocked — the shell still opens, under the demo account */
    }
    const link = { draftId, signatoryId };
    rememberLinkedComplaint(link);
    router.push(linkedComplaintHref(link));
  };

  if (view === "auth") {
    return (
      <SignInBlock
        locale={locale}
        onLocaleChange={setLocale}
        onSeekHelp={() => {
          setView("document");
          openAt("why");
        }}
        onSignedIn={finishSignIn}
        onRegistered={finishSignIn}
        toSign
      />
    );
  }

  const filer = draft.advocates[0]?.name.trim() || "An advocate";
  const parties = draftTitle(draft);
  /** The oath is read in the signer's own name; where the slot names no one, the account's. */
  const oathName = oathTakerName(draft, me.id, accountName ?? "");

  return (
    <div className={inShell ? "flex flex-1 flex-col" : "flex min-h-dvh flex-col bg-background"}>
      {inShell ? (
        <Breadcrumbs crumbs={[{ label: parties }]} />
      ) : (
        <header className="flex h-14 shrink-0 items-center border-b border-hairline px-4 md:px-6">
          <BrandLockup className="h-9" />
        </header>
      )}

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 md:py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-title text-balance font-semibold">
            {filed ? "This complaint has been filed" : "You have been asked to sign a complaint"}
          </h1>
          <p className="text-body text-pretty text-muted-foreground">
            {filer} is filing {parties} in the {courtText(COURT.name)}.
          </p>
        </div>

        {filed ? (
          <SectionNotice variant="neutral">
            Nothing more is needed from you. The complaint is with the court.
          </SectionNotice>
        ) : owed ? (
          <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-card p-4 shadow-raised sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body-compact text-muted-foreground">
              {needsConfirm
                ? needsOath
                  ? "You still need to confirm you signed, and record your oath."
                  : "You still need to confirm you signed."
                : needsSign && needsOath
                  ? "You still need to sign and record your oath."
                  : needsSign
                    ? "You still need to sign."
                    : "You still need to record your oath."}
            </p>
            <Button
              type="button"
              onClick={() => openAt(signedIn ? nextAct : "why")}
              className="shrink-0"
            >
              Continue
            </Button>
          </div>
        ) : (
          <SectionNotice variant="success" announce="polite">
            {swears
              ? "You have signed and recorded your oath. Nothing more is needed."
              : "You have signed. Nothing more is needed."}
          </SectionNotice>
        )}

        <section aria-labelledby="sign-link-document" className="flex flex-col gap-3">
          <h2 id="sign-link-document" className="text-body font-semibold">
            The complaint
          </h2>
          {/* Scrolls on its own, so it is focusable for a keyboard reader. */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Complaint document"
            className="max-h-[70vh] overflow-y-auto rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <CourtDocument draft={draft} />
          </div>
        </section>
      </main>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        {wizardOpen ? (
          <SignLinkWizard
            key={`${opening}:${start}`}
            start={start}
            me={me}
            filer={filer}
            parties={parties}
            chequeAmount={draft.cheques[0]?.amount ?? ""}
            signedIn={signedIn}
            needsSign={needsSign}
            needsConfirm={needsConfirm}
            confirmTail={(confirmer?.mobile ?? "").replace(/\D/g, "").slice(-4)}
            onPaper={onPaper}
            swears={swears}
            needsOath={needsOath}
            isAdvocate={isAdvocate}
            oath={draft.sign.oaths[me.id]?.video ?? null}
            oathName={oathName}
            onSign={(instrument) =>
              update((d) => {
                d.sign.signed[me.id] = { at: new Date().toISOString(), with: instrument };
              })
            }
            onConfirm={() => {
              if (!confirmer) return;
              const tail = confirmer.mobile.replace(/\D/g, "").slice(-4);
              update((d) => {
                d.sign.confirmed[confirmer.id] = { mobileTail: tail, at: new Date().toISOString() };
              });
            }}
            onOath={(video) =>
              update((d) => {
                d.sign.oaths[me.id] = { at: new Date().toISOString(), video, by: oathName };
              })
            }
            onSignIn={() => {
              setWizardOpen(false);
              setView("auth");
            }}
            onClose={() => setWizardOpen(false)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function SignLinkWizard({
  start,
  me,
  filer,
  parties,
  chequeAmount,
  signedIn,
  needsSign,
  needsConfirm,
  confirmTail,
  onPaper,
  swears,
  needsOath,
  isAdvocate,
  oath,
  oathName,
  onSign,
  onConfirm,
  onOath,
  onSignIn,
  onClose,
}: {
  oathName: string;
  start: Start;
  me: Signatory;
  filer: string;
  parties: string;
  chequeAmount: string;
  signedIn: boolean;
  needsSign: boolean;
  /** On paper: this person's own OTP confirmation is still to come (`SIG-05`). */
  needsConfirm: boolean;
  confirmTail: string;
  onPaper: boolean;
  /** This person records an oath — a complainant's slot, with the oath on. */
  swears: boolean;
  needsOath: boolean;
  isAdvocate: boolean;
  oath: OathVideo | null;
  onSign: (instrument: SignInstrument) => void;
  onConfirm: () => void;
  onOath: (video: OathVideo) => void;
  onSignIn: () => void;
  onClose: () => void;
}) {
  const courtText = useCourtText();
  const flow = useStagedFlow<Stage>({ order: ORDER[start], scene: SCENES, arrival: "forward" });
  /** Only a complainant records an oath (`OTH-3`), and only where the state asks for one. */
  const sworn = swears && signingRules().oath;

  const [otp, setOtp] = React.useState("");
  const [resent, setResent] = React.useState(false);
  const [dscFound, setDscFound] = React.useState(false);
  const [signedWith, setSignedWith] = React.useState<SignInstrument | null>(null);
  const resendTimer = React.useRef<number | null>(null);
  React.useEffect(
    () => () => {
      if (resendTimer.current) window.clearTimeout(resendTimer.current);
    },
    []
  );

  React.useEffect(() => {
    if (flow.stage !== "dsc" || dscFound) return;
    const timer = window.setTimeout(() => setDscFound(true), 1100);
    return () => window.clearTimeout(timer);
  }, [flow.stage, dscFound]);

  /*
   * Whether this opening includes the signature, read once as it opens. `needsSign` turns
   * false the moment the person signs, and read live it dropped the E-sign step — and with
   * it the whole trail — from the oath stage that follows, which is where "step 1 done"
   * is the point of showing it.
   */
  const [signsHere] = React.useState(
    needsSign || needsConfirm || start === "sign" || start === "confirm"
  );

  /* The steps this person has, in order — the trail and the "what happens next" list. */
  const acts: { key: "sign" | "oath"; label: string }[] = [
    ...(signsHere
      ? [{ key: "sign" as const, label: onPaper ? "Confirm by OTP" : "E-sign" }]
      : []),
    ...(sworn ? [{ key: "oath" as const, label: "Oath" }] : []),
  ];
  const trail = (current: "sign" | "oath"): TrailStep[] =>
    acts.map((act) => ({
      label: act.label,
      state:
        act.key === current
          ? "current"
          : current === "oath" && act.key === "sign"
            ? "done"
            : "next",
    }));

  const sign = (instrument: "aadhaar" | "dsc") => {
    onSign(instrument);
    setSignedWith(instrument);
    flow.go("signed");
  };

  const resendOtp = () => {
    setResent(true);
    if (resendTimer.current) window.clearTimeout(resendTimer.current);
    resendTimer.current = window.setTimeout(() => setResent(false), 2500);
  };

  /** After "why": sign in first, or go straight to the first act. */
  const proceed = () => {
    if (!signedIn) flow.go("account");
    else flow.go(needsConfirm ? "confirm" : needsSign ? "sign" : needsOath ? "oath" : "done");
  };

  /** Paper: the OTP on this person's own number confirms the signature on the copy. */
  const confirm = () => {
    onConfirm();
    flow.go(sworn ? "oath" : "signed");
  };


  const title = {
    why: "You have been asked to sign",
    account: "Sign in first",
    confirm: "Confirm you signed",
    sign: "Sign the complaint",
    otp: "Enter the OTP",
    dsc: "Sign with your DSC",
    signed: signedWith ? INSTRUMENT_LABEL[signedWith] : onPaper ? "Confirmed" : "Signed",
    oath: "Record your oath",
    done: "All done",
  }[flow.stage];

  const description = {
    why: null,
    account: null,
    confirm: confirmTail
      ? `Sent to your mobile ending ${confirmTail}.`
      : "Sent to your mobile.",
    sign: "Use whichever you have.",
    otp: "Sent to your Aadhaar-linked mobile.",
    dsc: "Plug in your certificate and keep the signing utility running.",
    signed: null,
    oath: "Read the words below on camera.",
    done: null,
  }[flow.stage];

  const footer = {
    why: (
      <>
        <Button type="button" variant="ghost" onClick={onClose}>
          Read the complaint
        </Button>
        <Button type="button" onClick={proceed}>
          {signedIn ? "Start" : "Sign in to start"}
        </Button>
      </>
    ),
    account: (
      <>
        <Button type="button" variant="outline" onClick={() => flow.go("why")}>
          Back
        </Button>
        <Button type="button" onClick={onSignIn}>
          Sign in
        </Button>
      </>
    ),
    confirm: (
      <>
        <Button type="button" variant="ghost" onClick={onClose}>
          I&rsquo;ll do it later
        </Button>
        <Button type="button" disabled={otp.length < 6} onClick={confirm}>
          Confirm
        </Button>
      </>
    ),
    sign: (
      <Button type="button" variant="ghost" onClick={onClose}>
        I&rsquo;ll do it later
      </Button>
    ),
    otp: (
      <>
        <Button type="button" variant="outline" onClick={() => flow.go("sign")}>
          Back
        </Button>
        <Button type="button" disabled={otp.length < 6} onClick={() => sign("aadhaar")}>
          Verify and sign
        </Button>
      </>
    ),
    dsc: (
      <>
        <Button type="button" variant="outline" onClick={() => flow.go("sign")}>
          Back
        </Button>
        <Button type="button" disabled={!dscFound} onClick={() => sign("dsc")}>
          Sign with this certificate
        </Button>
      </>
    ),
    signed: sworn ? (
      <Button type="button" onClick={() => flow.go("oath")}>
        Record my oath
      </Button>
    ) : (
      <Button type="button" onClick={onClose}>
        Done
      </Button>
    ),
    oath: (
      <>
        <Button type="button" variant="ghost" onClick={onClose}>
          I&rsquo;ll do it later
        </Button>
        <Button type="button" disabled={!oath} onClick={() => flow.go("done")}>
          Submit oath
        </Button>
      </>
    ),
    done: (
      <Button type="button" onClick={onClose}>
        Close
      </Button>
    ),
  }[flow.stage];

  const settledRow: Signatory = {
    ...me,
    status: "signed",
    oathTaken: sworn ? !!oath || me.oathTaken : undefined,
  };

  return (
    <StagedOverlay
      mobileSheet
      className="sm:max-w-2xl"
      title={title}
      titleRef={flow.titleRef}
      description={description}
      sceneKey={flow.sceneKey}
      motion={flow.motion}
      footer={footer}
    >
      {flow.stage === "why" ? (
        <StageColumn>
          <p className="text-body">
            {filer} is filing your cheque bounce case. Before it can go to court:
          </p>

          <ol className="flex flex-col gap-3">
            {[
              ...(signedIn ? [] : [{ icon: LogInIcon, title: "Sign in, or create an account" }]),
              ...(needsSign ? [{ icon: SignatureIcon, title: "Sign the complaint with Aadhaar OTP or DSC" }] : []),
              ...(needsConfirm
                ? [{ icon: SignatureIcon, title: "Confirm by OTP that you signed the paper copy" }]
                : []),
              ...(sworn && needsOath ? [{ icon: VideoIcon, title: "Record your oath on video" }] : []),
            ].map(({ icon: Icon, title: t }, i) => (
              <li key={t} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-muted-foreground"
                >
                  <Icon className="size-4" />
                </span>
                <span className="text-body-compact">
                  <span className="tabular-nums">{i + 1}.</span> {t}
                </span>
              </li>
            ))}
          </ol>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-hairline bg-surface-sunken p-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-body-compact text-muted-foreground">Case</dt>
              <dd className="text-body-compact font-medium">{parties}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-body-compact text-muted-foreground">Court</dt>
              <dd className="text-body-compact font-medium">{courtText(COURT.name)}</dd>
            </div>
            {chequeAmount ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-body-compact text-muted-foreground">Cheque amount</dt>
                <dd className="text-body-compact font-medium tabular-nums">
                  {money(Number(chequeAmount.replace(/[^\d.]/g, "")) || 0)}
                </dd>
              </div>
            ) : null}
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-body-compact text-muted-foreground">You sign as</dt>
              <dd className="text-body-compact font-medium">
                {isAdvocate ? me.name : me.role.split(" · ")[0]}
              </dd>
            </div>
          </dl>
        </StageColumn>
      ) : flow.stage === "account" ? (
        <StageColumn>
          <p className="text-body">
            Sign in, or create an account if you are new. You will come straight back to
            this complaint.
          </p>
        </StageColumn>
      ) : flow.stage === "confirm" ? (
        <StageColumn>
          {acts.length > 1 ? <StepTrail steps={trail("sign")} /> : null}
          <p className="text-body">
            Entering the OTP confirms that you signed the paper copy of this complaint that{" "}
            {filer} is uploading.
          </p>
          <OtpEntry id="link-confirm-otp" value={otp} onChange={setOtp} resent={resent} onResend={resendOtp} />
        </StageColumn>
      ) : flow.stage === "sign" ? (
        <StageColumn>
          {acts.length > 1 ? <StepTrail steps={trail("sign")} /> : null}
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
          <OtpEntry id="link-otp" value={otp} onChange={setOtp} resent={resent} onResend={resendOtp} />
        </StageColumn>
      ) : flow.stage === "dsc" ? (
        <StageColumn>
          <DscLookup found={dscFound} holder="" />
        </StageColumn>
      ) : flow.stage === "signed" ? (
        <StageColumn>
          <SettledCard
            headline={
              signedWith ? INSTRUMENT_LABEL[signedWith] : onPaper ? "Confirmed" : "Signature added"
            }
            rows={[{ ...me, status: "signed" }]}
            footnote={
              sworn ? "Next, record your oath." : "Nothing more is needed from you."
            }
          />
        </StageColumn>
      ) : flow.stage === "oath" ? (
        <StageColumn>
          {acts.length > 1 ? <StepTrail steps={trail("oath")} /> : null}
          <OathCapture name={oathName} value={oath} onChange={onOath} />
        </StageColumn>
      ) : (
        <StageColumn>
          <SettledCard
            headline={
              onPaper
                ? sworn
                  ? "Confirmed and oath recorded"
                  : "Confirmed"
                : sworn
                  ? "Signed and oath recorded"
                  : "Signed"
            }
            rows={[settledRow]}
            footnote={`Nothing more is needed from you. ${filer} will file the case.`}
          />
        </StageColumn>
      )}
    </StagedOverlay>
  );
}

function LinkLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

/** A link that no longer leads anywhere — expired, recalled, or mistyped. */
function LinkUnavailable({ inShell = false }: { inShell?: boolean }) {
  return (
    <div className={inShell ? "flex flex-1 flex-col" : "flex min-h-dvh flex-col bg-background"}>
      {inShell ? null : (
        <header className="flex h-14 shrink-0 items-center border-b border-hairline px-4 md:px-6">
          <BrandLockup className="h-9" />
        </header>
      )}
      <main className="mx-auto flex w-full max-w-2xl flex-col px-4 py-12">
        {/* A dead end, not bad news: neutral, with the link's own mark. */}
        <PageOutcome
          tone="neutral"
          icon={LinkIcon}
          align="start"
          className="px-0 py-0"
          title="This link is no longer active"
          body="The complaint may have been changed and sent again, or the request recalled. Ask the advocate filing it to send you a new link."
        />
      </main>
    </div>
  );
}
