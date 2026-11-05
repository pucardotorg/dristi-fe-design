"use client";

/**
 * **Sign: the single filing's model, for N complaints at once** (owner's v8; e-filing's
 * `sign-flow-dialog`).
 *
 * The page holds who signs and what is being signed: a "Who signs" roster with each
 * party's own status, and the complaints, which can be reviewed and unticked. The act
 * happens in one staged window built from e-filing's own parts (`sign-stages`): one card
 * that signs digitally, with paper only as a link beneath it; then your own e-signature,
 * Aadhaar OTP or DSC; then what happened. Every other party signs on their own device,
 * through the link sent to the mobile number in Common details: nobody's OTP signs for
 * anyone else (round-2 audit; the build's one "Mobile OTP" for both parties is retired).
 *
 * The batch's cases are marked signed once every party has signed, through the same
 * `sign` action as before. Until then who has signed is kept in this browser, so it
 * survives a reload or a second tab, and the batch list can say who is still to sign
 * (sandbox: the other party's signature is marked by hand, as v8 does). Keeping it on the
 * server, for a second device, is the backend's.
 */

import * as React from "react";
import { ClipboardListIcon, DownloadIcon, FileUpIcon, SignatureIcon } from "lucide-react";

import { DiscardQuestion, useDiscardGuard } from "@/components/chrome/discard-guard";
import { StagedOverlay, useStagedFlow } from "@/components/chrome/staged-overlay";
import { SectionNotice } from "@/components/filing/notices";
import { PaperFallbackLink, PaperFallbackQuestion } from "@/components/filing/paper-fallback";
import { FilingFooter } from "@/components/filing/filing-footer";
import {
  ChoiceCard,
  DscLookup,
  InstrumentChoice,
  OtpEntry,
  SettledCard,
  StageColumn,
} from "@/components/filing/sign-stages";
import { AADHAAR_DOCS_PER_OTP, AADHAAR_LIMIT_SOURCE, type BulkSignMethod } from "@/lib/bulk/types";
import { money } from "@/lib/filing/format";
import type { PaperFallbackReason, Signatory } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { StatusLine } from "@/components/feedback";

import { buildPrintPack } from "@/lib/bulk/print-pack";

import { bulkApi, type CaseView } from "./api";
import { BatchFooter } from "./batch-footer";
import { batchTallies } from "./batch-marks";
import { readRound, writeRound, type Round } from "./signing-round";
import type { BatchCtx } from "./batch-screen";
import { FileDrop } from "./file-drop";

type Signer = { id: string; name: string; role: string; initials: string; you?: boolean; mobile?: string };

const initialsOf = (name: string) =>
  name
    .replace(/^Adv\.\s*/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A mobile number as a link's destination is shown: only its last four digits. */
export const maskMobile = (m: string) => {
  const digits = m.replace(/\D/g, "");
  return digits.length >= 4 ? `•••••• ${digits.slice(-4)}` : "";
};

export function SignTab({ batch, setBatch, go }: BatchCtx) {
  const tallies = batchTallies(batch);
  const clear = tallies.completeCases;
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set(clear.map((c) => c.id)));
  const [listOpen, setListOpen] = React.useState(false);
  const [flowOpen, setFlowOpen] = React.useState(false);
  const [round, setRoundState] = React.useState<Round | null>(() => readRound(batch.id));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const setRound = (r: Round | null) => {
    setRoundState(r);
    writeRound(batch.id, r);
  };

  // A round whose cases are no longer on offer (signed elsewhere, removed) is over.
  if (round && !clear.some((c) => round.caseIds.includes(c.id))) setRoundState(null);

  // Re-select everything when the set on offer changes (derived from props, during render).
  const offerKey = clear.map((c) => c.id).join();
  const [offered, setOffered] = React.useState(offerKey);
  if (offerKey !== offered) {
    setOffered(offerKey);
    setPicked(new Set(clear.map((c) => c.id)));
  }

  // While a round is out, its cases are the ones being signed; they can't be changed.
  const inRound = round ? clear.filter((c) => round.caseIds.includes(c.id)) : null;
  const chosen = inRound ?? clear.filter((c) => picked.has(c.id));

  const signers: Signer[] = [
    ...batch.advocates.map((a, i) => ({
      id: `adv-${i}`,
      name: a.name || a.barNumber,
      role: `Advocate, ${a.barNumber}`,
      initials: initialsOf(a.name || "Adv"),
      you: i === 0,
    })),
    ...(batch.representative
      ? [
          {
            id: "rep",
            name: batch.representative.name,
            role: [
              `${batch.representative.designation}, ${batch.client}`,
              maskMobile(batch.representative.mobile)
                ? `signs by link on ${maskMobile(batch.representative.mobile)}`
                : "no mobile in Common details",
            ].join(" · "),
            initials: initialsOf(batch.representative.name),
            mobile: maskMobile(batch.representative.mobile),
          },
        ]
      : []),
  ];
  const you = signers.find((s) => s.you) ?? signers[0];
  const others = signers.filter((s) => s !== you);
  const signedIds = round?.signed ?? [];
  const allSigned = !!round && signers.every((s) => signedIds.includes(s.id));
  // Why the other open cases can't be signed yet, by cause, each with the step that fixes it.
  const { fixing, checking, docsMissing } = tallies;
  const waiting = fixing + checking + docsMissing;

  /** Every party has signed: the batch's cases are signed, by the method used, and pay opens. */
  const complete = async (r: Round) => {
    setBusy(true);
    setError(null);
    try {
      setBatch(await bulkApi.act(batch.id, { action: "sign", method: r.method, caseIds: r.caseIds }));
      setRound(null);
      go("pay", r.caseIds.join(","));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const statusOf = (s: Signer) =>
    signedIds.includes(s.id) ? (
      <Badge variant="success" className="text-body-compact">{round?.method === "upload" ? "Confirmed" : "Signed"}</Badge>
    ) : round?.sent && !s.you ? (
      <Badge variant="info" className="text-body-compact">Link sent</Badge>
    ) : (
      <Badge variant="secondary" className="text-body-compact">Not signed</Badge>
    );

  const allOn = chosen.length === clear.length;

  return (
    <div className="flex flex-col gap-6">
      {waiting ? (
        /* A gate, not a warning: these cases aren't open to sign yet. Each cause links to
           the step that clears it (round 3: a missing file was sent to Case details). */
        <StatusLine
          tone="neutral"
          icon={ClipboardListIcon}
          still
          title={
            <span className="tabular-nums">
              {waiting} case{waiting === 1 ? " isn't" : "s aren't"} ready to sign yet
            </span>
          }
        >
          <span className="flex flex-col gap-1">
            {fixing || checking ? (
              <span className="tabular-nums">
                {[fixing ? `${fixing} to fix` : "", checking ? `${checking} to check` : ""].filter(Boolean).join(" and ")}{" "}
                at{" "}
                <button type="button" className="underline" onClick={() => go("scrutiny")}>
                  Case details
                </button>
              </span>
            ) : null}
            {docsMissing ? (
              <span className="tabular-nums">
                {docsMissing} missing a document at{" "}
                <button type="button" className="underline" onClick={() => go("documents")}>
                  Documents
                </button>
              </span>
            ) : null}
          </span>
        </StatusLine>
      ) : null}

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      {clear.length === 0 ? (
        <>
          <Card variant="raised">
            <CardContent className="text-body-compact text-muted-foreground">
              Nothing to sign yet. Cases arrive here once their details and documents are complete.
            </CardContent>
          </Card>
          <BatchFooter>
            <FilingFooter
              showSaveState={false}
              onBack={() => go("documents")}
              continueLabel={batch.counts.signed ? `Pay for ${batch.counts.signed} signed` : "Continue to signing"}
              continueDisabled={!batch.counts.signed}
              onContinue={() => go("pay")}
            />
          </BatchFooter>
        </>
      ) : (
        <>
          <Card variant="raised">
            <CardHeader>
              <CardTitle className="text-body font-semibold">Who signs</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col">
                {signers.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 border-b border-hairline py-3 last:border-b-0">
                    <span
                      aria-hidden
                      className="flex size-9 items-center justify-center rounded-full bg-brand-muted text-caption font-semibold text-brand-muted-foreground"
                    >
                      {s.initials}
                    </span>
                    <span className="flex min-w-0 flex-1 basis-48 flex-col">
                      <span className="text-body-compact font-medium">
                        {s.name}
                        {s.you ? <span className="font-normal text-muted-foreground"> · you</span> : null}
                      </span>
                      <span className="text-body-compact text-muted-foreground">{s.role}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {/* Sandbox: the other party signs on their own device; here it is marked by hand. */}
                      {round?.sent && !s.you && !signedIds.includes(s.id) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRound({ ...round, signed: [...round.signed, s.id] })}
                        >
                          Sandbox: mark {round.method === "upload" ? "confirmed" : "signed"}
                        </Button>
                      ) : null}
                      {statusOf(s)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card variant="raised" className={cn(listOpen && "gap-4")}>
            <CardHeader>
              <CardTitle className="text-body font-semibold tabular-nums">
                {allOn ? `All ${plural(clear.length, "ready complaint")}` : `${chosen.length} of ${clear.length} complaints`}
              </CardTitle>
              <CardDescription>
                {inRound
                  ? "Being signed now, so the list is fixed until every party has signed."
                  : listOpen
                    ? "Untick any to sign later."
                    : "Read the list, or leave some to sign later."}
              </CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" onClick={() => setListOpen((v) => !v)}>
                  {listOpen ? "Hide the list" : "Review the list"}
                </Button>
              </CardAction>
            </CardHeader>
            {listOpen ? (
              <CardContent className="px-2">
                <div className="overflow-x-auto">
                  <Table className="border-separate border-spacing-0" aria-label="Complaints to sign">
                    <TableHeader>
                      <TableRow className={TABLE_HEAD_ROW}>
                        <TableHead className={cn(TABLE_HEAD, "w-10")}>
                          <Checkbox
                            aria-label="Every complaint"
                            disabled={!!inRound}
                            checked={allOn ? true : chosen.length ? "indeterminate" : false}
                            onCheckedChange={(v) => setPicked(v === true ? new Set(clear.map((c) => c.id)) : new Set())}
                          />
                        </TableHead>
                        <TableHead className={TABLE_HEAD}>Accused</TableHead>
                        <TableHead className={TABLE_HEAD}>Your reference</TableHead>
                        <TableHead className={cn(TABLE_HEAD, "text-right")}>Cheque amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className={tableBodyClass({ selectable: true })}>
                      {clear.map((c) => {
                        const on = inRound ? inRound.includes(c) : picked.has(c.id);
                        return (
                          <TableRow key={c.id} className={tableRowClass({ selectable: true })} data-state={on ? "selected" : undefined}>
                            <TableCell className={TABLE_CELL}>
                              <Checkbox
                                aria-label={`Sign ${c.reference}`}
                                disabled={!!inRound}
                                checked={on}
                                onCheckedChange={(v) =>
                                  setPicked((prev) => {
                                    const next = new Set(prev);
                                    if (v === true) next.add(c.id);
                                    else next.delete(c.id);
                                    return next;
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell className={TABLE_CELL}>{c.accused}</TableCell>
                            <TableCell className={cn(TABLE_CELL, "font-mono")}>{c.reference}</TableCell>
                            <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>{money(c.amount)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            ) : null}
          </Card>
        </>
      )}

      {clear.length ? (
        <BatchFooter>
          <FilingFooter
            showSaveState={false}
            onBack={() => go("documents")}
            status={
              <span className="text-body-compact text-muted-foreground tabular-nums">
                {allSigned
                  ? "Every signature is in"
                  : `${signedIds.length} of ${signers.length} parties have signed`}
              </span>
            }
            continueLabel={
              busy
                ? "Signing…"
                : allSigned
                  ? `Continue to pay for ${chosen.length}`
                  : round && signedIds.includes(you.id)
                    ? `Waiting for ${others.filter((o) => !signedIds.includes(o.id)).map((o) => o.name).join(" and ")}`
                    : "Continue to signing"
            }
            continueDisabled={
              busy || !!batch.clubbedInto || chosen.length === 0 || (!!round && signedIds.includes(you.id) && !allSigned)
            }
            onContinue={() => (allSigned && round ? void complete(round) : setFlowOpen(true))}
          />
        </BatchFooter>
      ) : null}

      <Dialog open={flowOpen} onOpenChange={(o) => !o && setFlowOpen(false)}>
        {flowOpen ? (
          <SignWindow
            cases={chosen}
            you={you}
            others={others}
            round={round}
            onRound={(r) => {
              setRound(r);
              // With nobody else to sign, the cases are signed the moment you are.
              if (signers.every((s) => r.signed.includes(s.id))) void complete(r);
            }}
            onClose={() => setFlowOpen(false)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

/* ───────────────────────────── The signing window ───────────────────────────── */

const STAGES = ["choose", "fallback", "sign", "otp", "dsc", "done", "paper", "uploaded"] as const;
type Stage = (typeof STAGES)[number];
const SCENES: Record<Stage, string> = {
  choose: "choose",
  fallback: "fallback",
  sign: "sign",
  otp: "otp",
  dsc: "dsc",
  done: "done",
  paper: "paper",
  uploaded: "done",
};

const names = (xs: Signer[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(xs.map((x) => x.name));

/**
 * The window: e-filing's stages, for N complaints at once. Choose (one card that signs
 * digitally, paper as a link) → your e-signature (Aadhaar OTP or DSC) → what happened.
 * Paper asks why first, then takes the signed copies, and each other party confirms them
 * on their own device.
 */
function SignWindow({
  cases,
  you,
  others,
  round,
  onRound,
  onClose,
}: {
  cases: CaseView[];
  you: Signer;
  others: Signer[];
  round: Round | null;
  onRound: (r: Round) => void;
  onClose: () => void;
}) {
  const n = cases.length;
  const rounds = Math.ceil(n / AADHAAR_DOCS_PER_OTP);
  const flow = useStagedFlow<Stage>({ order: STAGES, scene: SCENES, arrival: "forward" });
  const [otp, setOtp] = React.useState("");
  const [resent, setResent] = React.useState(false);
  const [otpRound, setOtpRound] = React.useState(1);
  const [dscFound, setDscFound] = React.useState(false);
  const [reason, setReason] = React.useState<PaperFallbackReason | "">("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [matched, setMatched] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [sentNow, setSentNow] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  /** Every complaint, one PDF each, to print and sign by hand. */
  const download = async () => {
    setDownloading(true);
    try {
      const blob = await buildPrintPack(
        cases.map((c) => ({ reference: c.reference, title: c.title, accused: c.accused, cheque: c.cheque, amount: money(c.amount) })),
        [you, ...others].map((s) => s.name),
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `complaints-to-sign-${cases.length}.zip`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } finally {
      setDownloading(false);
    }
  };

  const base: Round = round ?? { caseIds: cases.map((c) => c.id), method: "aadhaar", sent: false, signed: [] };
  const guard = useDiscardGuard(otp.length > 0 || files.length > 0 || (otpRound > 1 && flow.stage === "otp"), onClose);

  // A DSC is read off this computer, and the utility takes a beat to answer.
  React.useEffect(() => {
    if (flow.stage !== "dsc") return;
    const t = window.setTimeout(() => setDscFound(true), 1200);
    return () => window.clearTimeout(t);
  }, [flow.stage]);

  const chooseDigital = () => {
    if (others.length && !base.sent) setSentNow(true);
    onRound({ ...base, sent: others.length > 0 || base.sent });
    flow.go("sign");
  };

  const signAs = async (method: BulkSignMethod) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    onRound({ ...base, sent: others.length > 0 || base.sent, method, signed: [...new Set([...base.signed, you.id])] });
    flow.go("done");
  };

  const submitOtp = () => {
    if (otpRound < rounds) {
      setOtp("");
      setOtpRound(otpRound + 1);
      return;
    }
    void signAs("aadhaar");
  };

  const uploadCopies = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    onRound({ ...base, method: "upload", sent: others.length > 0, signed: [you.id] });
    flow.go("uploaded");
  };

  const roster = (r: Round): Signatory[] =>
    [you, ...others].map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      you: s.you,
      status: r.signed.includes(s.id) ? "signed" : "pending",
    }));
  const pending = others.filter((o) => !base.signed.includes(o.id));
  const matchedAll = cases.every((c) => matched[c.id]);
  const first = (otpRound - 1) * AADHAAR_DOCS_PER_OTP + 1;
  const last = Math.min(n, otpRound * AADHAAR_DOCS_PER_OTP);

  const copy: Record<Stage, { title: string; description?: string }> = {
    choose: { title: "How will these complaints be signed?", description: `${plural(n, "complaint")}, one way for all of them.` },
    fallback: { title: "Unable to e-sign?", description: "Tell us what went wrong. Nothing changes until you continue." },
    sign: { title: "Add your e-signature", description: "Either one is your own signature. Use whichever you have." },
    otp: {
      title: "Enter the OTP",
      description:
        rounds > 1
          ? `Sent to your Aadhaar-linked mobile. OTP ${otpRound} of ${rounds}: complaints ${first}–${last}.`
          : "Sent to your Aadhaar-linked mobile.",
    },
    dsc: { title: "Sign with your DSC", description: `Signs all ${plural(n, "complaint")} at once.` },
    done: { title: "Signature added" },
    paper: {
      title: "Upload the signed complaints",
      description: "Print each one, have every party sign it by hand, and upload the scans.",
    },
    uploaded: { title: "Signed copies accepted" },
  };

  const footer: React.ReactNode = {
    choose: null,
    fallback: (
      <>
        <Button variant="outline" onClick={() => flow.go("choose")}>
          Keep e-signing
        </Button>
        <Button disabled={!reason} onClick={() => flow.go("paper")}>
          Continue to upload
        </Button>
      </>
    ),
    // e-filing's own exit: nothing is signed yet, so it is a plain close.
    sign: (
      <Button variant="ghost" onClick={onClose}>
        I&rsquo;ll sign later
      </Button>
    ),
    otp: (
      <>
        <Button variant="outline" onClick={() => flow.go("sign")}>
          Back
        </Button>
        <Button disabled={otp.replace(/\D/g, "").length < 6 || busy} onClick={submitOtp}>
          {otpRound < rounds ? `Sign complaints ${first}–${last}` : "Sign"}
        </Button>
      </>
    ),
    dsc: (
      <>
        <Button variant="outline" onClick={() => flow.go("sign")}>
          Back
        </Button>
        <Button disabled={!dscFound || busy} onClick={() => void signAs("dsc")}>
          Sign {plural(n, "complaint")}
        </Button>
      </>
    ),
    done: <Button onClick={onClose}>Done</Button>,
    paper: (
      <>
        <Button variant="outline" onClick={() => flow.go("choose")}>
          Choose another way
        </Button>
        <Button disabled={!matchedAll || busy} onClick={() => void uploadCopies()}>
          Submit {plural(n, "signed copy", "signed copies")}
        </Button>
      </>
    ),
    uploaded: <Button onClick={onClose}>Done</Button>,
  }[flow.stage];

  const settled = flow.stage === "done" || flow.stage === "uploaded";

  return (
    <StagedOverlay
      mobileSheet
      {...guard.contentProps}
      {...guard.outsideProps}
      className="sm:max-w-2xl"
      title={copy[flow.stage].title}
      titleRef={flow.titleRef}
      outcome={settled}
      description={settled ? undefined : copy[flow.stage].description}
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
            You sign all {n} with your DSC or Aadhaar e-sign.
            {others.length
              ? ` ${others
                  .map((o) => (o.mobile ? `${o.name} gets a link on ${o.mobile}` : `${o.name} gets a link`))
                  .join("; ")}.`
              : null}
          </ChoiceCard>
          <PaperFallbackLink onClick={() => flow.go("fallback")} />
        </StageColumn>
      ) : flow.stage === "fallback" ? (
        <StageColumn>
          <PaperFallbackQuestion value={reason} onChange={setReason} />
        </StageColumn>
      ) : flow.stage === "sign" ? (
        <StageColumn>
          {sentNow && others.length ? (
            <SectionNotice variant="success" announce="polite" title="Sent for signature">
              {names(others)} {others.length === 1 ? "has" : "have"} been sent a link to sign all {n}.
            </SectionNotice>
          ) : null}
          <InstrumentChoice
            onAadhaar={() => {
              setOtp("");
              setOtpRound(1);
              flow.go("otp");
            }}
            onDsc={() => {
              setDscFound(false);
              flow.go("dsc");
            }}
          />
          {rounds > 1 ? (
            <p className="text-body-compact text-muted-foreground tabular-nums">
              Aadhaar e-sign takes one OTP for every {AADHAAR_DOCS_PER_OTP} complaints (
              <a href={AADHAAR_LIMIT_SOURCE.url} target="_blank" rel="noreferrer" className="underline">
                {AADHAAR_LIMIT_SOURCE.title}
              </a>
              ): {rounds} OTPs for these {n}. A DSC signs them all at once.
            </p>
          ) : null}
        </StageColumn>
      ) : flow.stage === "otp" ? (
        <StageColumn>
          <OtpEntry
            key={otpRound}
            id="bulk-esign-otp"
            value={otp}
            onChange={setOtp}
            resent={resent}
            onResend={() => setResent(true)}
          />
          {rounds > 1 ? (
            <p className="text-body-compact text-muted-foreground">
              This OTP signs{" "}
              <span className="font-mono">
                {cases
                  .slice(first - 1, last)
                  .map((c) => c.reference)
                  .join(", ")}
              </span>
              .
            </p>
          ) : null}
        </StageColumn>
      ) : flow.stage === "dsc" ? (
        <StageColumn>
          <DscLookup found={dscFound} holder={you.name} />
        </StageColumn>
      ) : flow.stage === "done" ? (
        <SettledCard
          title={copy.done.title}
          tone={pending.length ? "info" : "success"}
          headline={pending.length ? "Out for signature" : "Every signature is in"}
          rows={roster(base)}
          footnote={
            pending.length
              ? `You signed ${plural(n, "complaint")}. The court fee opens once ${names(pending)} ${pending.length === 1 ? "signs" : "sign"}.`
              : "You can pay the court fee now."
          }
        />
      ) : flow.stage === "paper" ? (
        <StageColumn>
          <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-sunken p-4 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 text-body-compact text-muted-foreground">
              Each is already named the way it is matched back. Keep the name when you scan it.
            </p>
            <Button variant="outline" className="w-fit shrink-0" disabled={downloading} onClick={() => void download()}>
              <DownloadIcon data-icon="inline-start" aria-hidden />
              Download {plural(n, "complaint")}
            </Button>
          </div>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="signed-copies">Signed copies</FieldLabel>
            <FileDrop
              id="signed-copies"
              accept=".pdf"
              multiple
              files={files}
              onFiles={(picked) => {
                setFiles((prev) => [...prev, ...picked]);
                const map: Record<string, string> = { ...matched };
                for (const f of picked) {
                  const c = cases.find((x) => f.name.toLowerCase().startsWith(`${x.reference.toLowerCase()}_signed`));
                  if (c) map[c.id] = f.name;
                }
                setMatched(map);
              }}
              prompt="Drag the signed PDFs here"
              hint={`One PDF per complaint, named reference_signed.pdf`}
            />
          </Field>
          <ul className="flex max-h-60 flex-col overflow-y-auto rounded-lg border border-hairline">
            {cases.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-b border-hairline px-3 py-2 text-body-compact last:border-b-0">
                <FileUpIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono">{c.reference}</span>
                {matched[c.id] ? (
                  <Badge variant="success" className="text-body-compact">Matched</Badge>
                ) : (
                  <Badge variant="secondary" className="text-body-compact">Waiting</Badge>
                )}
              </li>
            ))}
          </ul>
        </StageColumn>
      ) : (
        <SettledCard
          title={copy.uploaded.title}
          tone={others.length ? "info" : "success"}
          headline={others.length ? "Waiting for confirmation" : "Signed copies accepted"}
          rows={roster(base)}
          footnote={
            others.length
              ? `${plural(n, "signed copy", "signed copies")} are in. ${names(others)} ${others.length === 1 ? "confirms" : "confirm"} them by OTP through the link sent to ${others.length === 1 ? "their" : "each"} mobile.`
              : "You can pay the court fee now."
          }
        />
      )}
      <DiscardQuestion guard={guard} />
    </StagedOverlay>
  );
}
