"use client";

import * as React from "react";
import {
  CheckIcon,
  KeyRoundIcon,
  PenToolIcon,
  SmartphoneIcon,
  UploadIcon,
  UserCheckIcon,
  ClipboardListIcon,
} from "lucide-react";

import {
  AADHAAR_DOCS_PER_OTP,
  AADHAAR_LIMIT_SOURCE,
  type BulkSignMethod,
} from "@/lib/bulk/types";
import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { PaymentFacts } from "@/components/payment/payment-steps";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { bulkApi, type CaseView } from "./api";
import type { BatchCtx } from "./batch-screen";
import { FileDrop } from "./file-drop";
import { OutcomeHeader, StatusLine, StatusMark } from "@/components/feedback";

type Signer = { id: string; name: string; role: string; mobile?: string };

const METHODS: {
  id: BulkSignMethod;
  title: string;
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  /** One fixed line: what the method takes, never a count. */
  hint: string;
}[] = [
  {
    id: "mobile-otp",
    title: "Mobile OTP",
    tag: "Fastest",
    icon: SmartphoneIcon,
    hint: "One OTP to your mobile signs all cases.",
  },
  {
    id: "dsc",
    title: "Digital Signature Certificate (DSC)",
    tag: "More secure · needs a DSC token",
    icon: KeyRoundIcon,
    hint: "Each signer uses their DSC token and PIN.",
  },
  {
    id: "aadhaar",
    title: "Aadhaar eSign",
    tag: "Secure · slowest",
    icon: UserCheckIcon,
    // Only the rule; the Why link beside it gives the reason and its source.
    hint: `Aadhaar can sign only ${AADHAAR_DOCS_PER_OTP} cases at a time.`,
  },
  {
    id: "upload",
    title: "Upload signed copies",
    tag: "Most manual",
    icon: UploadIcon,
    hint: "Print, sign, scan and upload each complaint.",
  },
];

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

const tail = (m?: string) =>
  m ? `••••${m.slice(-4)}` : "their registered mobile";

/** Bulk signing: everyone who must sign each case (`SIG-03`), by one method for all (`SIG-04`). */
export function SignTab({ batch, setBatch, go }: BatchCtx) {
  const clear = batch.cases.filter(
    (c) => c.stage === "ready" && c.flags.length === 0,
  );
  const [picked, setPicked] = React.useState<Set<string>>(
    () => new Set(clear.map((c) => c.id)),
  );
  const [method, setMethod] = React.useState<BulkSignMethod>("mobile-otp");
  const justSigned = React.useRef<string[]>([]);
  const [flowOpen, setFlowOpen] = React.useState(false);

  // Re-select everything when the set on offer changes — adjusted during render, not in
  // an effect, since it derives from props (the pattern BatchFilingDialog uses).
  const offerKey = clear.map((c) => c.id).join();
  const [offered, setOffered] = React.useState(offerKey);
  if (offerKey !== offered) {
    setOffered(offerKey);
    setPicked(new Set(clear.map((c) => c.id)));
  }

  const chosen = clear.filter((c) => picked.has(c.id));
  const signers: Signer[] = [
    ...(batch.representative
      ? [
          {
            id: "rep",
            name: batch.representative.name,
            role: `For ${batch.client}, ${batch.representative.designation}`,
            mobile: batch.representative.mobile,
          },
        ]
      : []),
    ...batch.advocates.map((a, i) => ({
      id: `adv-${i}`,
      name: a.name || a.barNumber,
      role: `Advocate, ${a.barNumber}`,
    })),
  ];
  const held = batch.cases.filter((c) => c.stage === "held").length;
  const unanswered = batch.cases.filter(
    (c) => c.stage === "ready" && c.flags.length > 0,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {held || unanswered ? (
        /* A gate, not a warning: the step is not open yet (owner rule). */
        <StatusLine
          tone="neutral"
          icon={ClipboardListIcon}
          still
          title={
            <span className="tabular-nums">
              {held + unanswered} case
              {held + unanswered === 1 ? " isn't" : "s aren't"} ready to sign yet
            </span>
          }
        >
            Finish the case details first:{" "}
            {[
              held ? `${held} need${held === 1 ? "s" : ""} fixing` : "",
              unanswered ? `${unanswered} to check` : "",
            ]
              .filter(Boolean)
              .join(", ")}
            .{" "}
            <button
              type="button"
              className="underline"
              onClick={() => go("scrutiny")}
            >
              Go to Case details
            </button>
        </StatusLine>
      ) : null}

      {clear.length === 0 ? (
        <Card className={PANEL_CLASS}>
          <CardContent className="text-body-compact text-muted-foreground">
            Nothing to sign yet. Finish the documents and case details first.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className={cn(PANEL_CLASS, "lg:col-span-2")}>
            <CardHeader>
              <CardTitle className="text-body font-semibold">
                Cases to sign
              </CardTitle>
              <CardDescription className="tabular-nums">
                {chosen.length} of {clear.length} chosen
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <label className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-accent">
                <Checkbox
                  aria-label="All clear cases"
                  checked={
                    chosen.length === clear.length
                      ? true
                      : chosen.length
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(v) =>
                    setPicked(
                      v === true ? new Set(clear.map((c) => c.id)) : new Set(),
                    )
                  }
                />
                <span className="text-body-compact font-medium">
                  All clear cases
                </span>
              </label>
              {clear.map((c) => (
                <label
                  key={c.id}
                  id={`bulk-case-${c.id}`}
                  className="flex min-h-10 scroll-mt-20 items-center gap-3 rounded-lg px-2 hover:bg-accent"
                >
                  <Checkbox
                    aria-label={`${c.reference}, ${c.accused}`}
                    checked={picked.has(c.id)}
                    onCheckedChange={(v) =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (v === true) next.add(c.id);
                        else next.delete(c.id);
                        return next;
                      })
                    }
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-compact tabular-nums">
                      {c.reference}
                    </span>
                    <span className="truncate text-caption text-muted-foreground">
                      {c.accused}
                    </span>
                  </span>
                  <span className="text-caption tabular-nums text-muted-foreground">
                    {money(c.amount)}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card className={cn(PANEL_CLASS, "lg:col-span-3")}>
            <CardHeader>
              <CardTitle className="text-body font-semibold">
                How to sign
              </CardTitle>
              <CardDescription>
                Every case needs {signers.map((s) => s.name).join(" and ")}. One
                method for all of them.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RadioGroup
                value={method}
                onValueChange={(v) => setMethod(v as BulkSignMethod)}
                className="gap-2"
                aria-label="Signing method"
              >
                {METHODS.filter((m) => m.id !== "upload").map((m) => {
                  const Icon = m.icon;
                  return (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline p-4 transition-colors hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent-strong"
                    >
                      <RadioGroupItem
                        value={m.id}
                        id={`sign-${m.id}`}
                        className="mt-1"
                        aria-labelledby={`sign-${m.id}-title`}
                        aria-describedby={`sign-${m.id}-hint`}
                      />
                      <Icon
                        className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            id={`sign-${m.id}-title`}
                            className="text-body-compact font-medium"
                          >
                            {m.title}
                          </span>
                          <Badge
                            variant={
                              m.id === "mobile-otp"
                                ? "success"
                                : m.id === "aadhaar"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {m.tag}
                          </Badge>
                        </span>
                        <span
                          id={`sign-${m.id}-hint`}
                          className="text-caption text-muted-foreground"
                        >
                          {m.hint}
                        </span>
                        {/* The reason, and its source, on demand: a Why link with the citation in its tooltip. */}
                        {m.id === "aadhaar" ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={AADHAAR_LIMIT_SOURCE.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-fit text-caption text-primary underline"
                                >
                                  Why?
                                  <span className="sr-only">
                                    {" "}
                                    (opens the specification in a new tab)
                                  </span>
                                </a>
                              </TooltipTrigger>
                              <TooltipContent
                                side="bottom"
                                className="max-w-xs text-left"
                              >
                                <span className="flex flex-col gap-2">
                                  <span>
                                    The government&apos;s rules for Aadhaar
                                    eSign let one OTP sign at most{" "}
                                    {AADHAAR_DOCS_PER_OTP} documents. So each
                                    person signing gets one OTP for every{" "}
                                    {AADHAAR_DOCS_PER_OTP} cases: 12 cases means
                                    3 OTPs each.
                                  </span>
                                  <span>
                                    Source: {AADHAAR_LIMIT_SOURCE.publisher},{" "}
                                    {AADHAAR_LIMIT_SOURCE.title}.
                                  </span>
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
                {/* The manual route, kept but not offered as an equal: one quiet line. */}
                <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-4 text-body-compact text-muted-foreground hover:bg-accent has-[[data-state=checked]]:text-foreground">
                  <RadioGroupItem
                    value="upload"
                    id="sign-upload"
                    aria-label="Upload signed copies (print, sign by hand, scan)"
                  />
                  <span>
                    Or upload signed copies (print, sign by hand, scan)
                  </span>
                </label>
              </RadioGroup>

              <Button
                size="lg"
                disabled={chosen.length === 0 || !!batch.clubbedInto}
                onClick={() => setFlowOpen(true)}
              >
                <PenToolIcon data-icon="inline-start" aria-hidden />
                Sign {chosen.length} case{chosen.length === 1 ? "" : "s"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <SignFlow
        open={flowOpen}
        method={method}
        cases={chosen}
        signers={signers}
        onClose={() => setFlowOpen(false)}
        onDone={async () => {
          justSigned.current = chosen.map((c) => c.id);
          const next = await bulkApi.act(batch.id, {
            action: "sign",
            method,
            caseIds: chosen.map((c) => c.id),
          });
          setBatch(next);
        }}
        // Pay opens on the cases just signed, not every signed case in the batch.
        onPay={() => {
          setFlowOpen(false);
          go("pay", justSigned.current.join(","));
        }}
      />
    </div>
  );
}

type Step = {
  signer: Signer;
  cases: CaseView[];
  round: number;
  rounds: number;
};

/**
 * The signing itself, step by step: per signer, one OTP or PIN for the batch, or — for
 * Aadhaar — one OTP per five cases. Sandbox: any 6 digits is accepted.
 */
function SignFlow({
  open,
  method,
  cases,
  signers,
  onClose,
  onDone,
  onPay,
}: {
  open: boolean;
  method: BulkSignMethod;
  cases: CaseView[];
  signers: Signer[];
  onClose: () => void;
  onDone: () => Promise<void>;
  onPay: () => void;
}) {
  const steps: Step[] = React.useMemo(() => {
    if (method === "upload") return [];
    // Mobile OTP: one OTP, to the filing advocate, for everyone on every case (owner,
    // 2026-10-20). The others still go signer by signer.
    if (method === "mobile-otp") {
      const advocate = signers.find((s) => s.id === "adv-0") ?? signers[0];
      return advocate ? [{ signer: advocate, cases, round: 1, rounds: 1 }] : [];
    }
    const groups =
      method === "aadhaar" ? chunk(cases, AADHAAR_DOCS_PER_OTP) : [cases];
    return signers.flatMap((s) =>
      groups.map((g, i) => ({
        signer: s,
        cases: g,
        round: i + 1,
        rounds: groups.length,
      })),
    );
  }, [method, cases, signers]);

  const [at, setAt] = React.useState(0);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [signedAt, setSignedAt] = React.useState(() => new Date());
  const [signed, setSigned] = React.useState<CaseView[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [uploads, setUploads] = React.useState<Record<string, string>>({});
  const [signedFiles, setSignedFiles] = React.useState<File[]>([]);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAt(0);
      setCode("");
      setDone(false);
      setError(null);
      setUploads({});
      setSignedFiles([]);
    }
  }

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      // Kept as they were signed: the batch refreshes and they leave the list to sign.
      setSigned(cases);
      await onDone();
      setSignedAt(new Date());
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    setCode("");
    if (at + 1 < steps.length) setAt(at + 1);
    else await finish();
  };

  const step = steps[at];
  // The people signing, in the order the steps take them, and who is signing now.
  const signerOrder = steps.reduce<Signer[]>(
    (acc, x) =>
      acc.some((y) => y.id === x.signer.id) ? acc : [...acc, x.signer],
    [],
  );
  const signerAt = step
    ? signerOrder.findIndex((x) => x.id === step.signer.id)
    : 0;
  const matchedAll = cases.every((c) => uploads[c.id]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <ChromeDialogContent
        mobileSheet
        showCloseButton={!done}
        className={cn(
          "flex max-h-[90dvh] flex-col sm:max-w-lg",
          // The outcome is the payment's success window, case for case.
          done ? "gap-0 overflow-hidden p-0" : "overflow-y-auto",
        )}
      >
        {done ? (
          <>
            {/* The signing's outcome takes the window over (skill `feedback-states`). */}
            <OutcomeHeader
              compact
              titleFrom="dialog"
              focusTitle
              title="Signing complete"
              body={
                <>
                  <span className="tabular-nums">{signed.length}</span> case
                  {signed.length === 1 ? " is" : "s are"} signed and ready to pay.
                </>
              }
            />

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
              <PaymentFacts
                rows={[
                  { label: "Signed with", value: METHODS.find((m) => m.id === method)?.title ?? "" },
                  { label: "Signed by", value: signers.map((x) => x.name).join(", ") },
                  {
                    label: "Signed on",
                    value: (
                      <span className="tabular-nums">
                        {signedAt.toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        IST
                      </span>
                    ),
                  },
                ]}
              />
              <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline">
                {signed.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-2 text-body-compact"
                  >
                    <StatusMark size={16} still />
                    <span className="min-w-0 flex-1 truncate">
                      {c.accused || c.title}
                    </span>
                    <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
                      {c.reference}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {money(c.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* The warm band every outcome closes on; it stays put while the list scrolls. */}
            <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-hairline bg-surface-sunken px-6 pt-4 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))] sm:flex-row">
              <Button variant="outline" size="lg" className="sm:flex-1" onClick={onClose}>
                Back to signing
              </Button>
              <Button size="lg" className="sm:flex-1" onClick={onPay}>
                Pay for {signed.length} case{signed.length === 1 ? "" : "s"}
              </Button>
            </footer>
          </>
        ) : method === "upload" ? (
          <>
            <DialogHeader>
              <DialogTitle>Upload signed copies</DialogTitle>
              <DialogDescription>
                One file per case, named{" "}
                <span className="font-mono">reference_signed.pdf</span>. Each
                must carry every signature.
              </DialogDescription>
            </DialogHeader>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="signed-copies">Signed copies</FieldLabel>
              <FileDrop
                id="signed-copies"
                accept=".pdf"
                multiple
                files={signedFiles}
                onFiles={(picked) => {
                  setSignedFiles((prev) => [...prev, ...picked]);
                  const map: Record<string, string> = { ...uploads };
                  for (const f of picked) {
                    const c = cases.find((x) =>
                      f.name
                        .toLowerCase()
                        .startsWith(`${x.reference.toLowerCase()}_signed`),
                    );
                    if (c) map[c.id] = f.name;
                  }
                  setUploads(map);
                }}
                prompt="Drag the signed copies here"
                hint="PDF, one per case"
              />
            </Field>
            <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto text-body-compact">
              {cases.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="tabular-nums">{c.reference}</span>
                  {uploads[c.id] ? (
                    <Badge variant="success">Matched</Badge>
                  ) : (
                    <Badge variant="outline">Waiting</Badge>
                  )}
                </li>
              ))}
            </ul>
            {error ? (
              <p className="text-body-compact text-destructive-ink">{error}</p>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                disabled={!matchedAll || busy}
                onClick={() => void finish()}
              >
                {busy ? <Spinner data-icon="inline-start" /> : null}
                Submit {cases.length} signed copies
              </Button>
            </DialogFooter>
          </>
        ) : step ? (
          <>
            {/* The window is about the people signing: each signs every case, one after
                another, so each is a row; the one signing now holds the code field. */}
            <DialogHeader>
              <DialogTitle>
                Sign {cases.length} case{cases.length === 1 ? "" : "s"} with{" "}
                {method === "dsc"
                  ? "DSC"
                  : method === "aadhaar"
                    ? "Aadhaar eSign"
                    : "mobile OTP"}
              </DialogTitle>
              <DialogDescription className="tabular-nums">
                {cases
                  .slice(0, 3)
                  .map((c) => c.reference)
                  .join(", ")}
                {cases.length > 3 ? ` and ${cases.length - 3} more` : ""}
              </DialogDescription>
            </DialogHeader>

            <ol
              className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline"
              aria-live="polite"
            >
              {(() => {
                const list =
                  method === "mobile-otp"
                    ? [
                        step.signer,
                        ...signers.filter((x) => x.id !== step.signer.id),
                      ]
                    : signerOrder;
                return list.map((x, k) => {
                  const covered =
                    method === "mobile-otp" && x.id !== step.signer.id;
                  const state = covered
                    ? "covered"
                    : k < signerAt
                      ? "done"
                      : k === signerAt
                        ? "now"
                        : "next";
                  return (
                    <li
                      key={x.id}
                      className={cn(
                        "relative flex flex-col gap-3 p-4",
                        state === "now" && "bg-accent",
                      )}
                    >
                      {/* The thread from one signer to the next, green once they have signed. */}
                      {k < list.length - 1 ? (
                        <span
                          aria-hidden
                          className={cn(
                            "absolute top-12 bottom-0 left-8 w-0.5 -translate-x-1/2 translate-y-4",
                            state === "done" ? "bg-success" : "bg-hairline",
                          )}
                        />
                      ) : null}
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className={cn(
                            "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-body-compact font-semibold tabular-nums",
                            state === "done" &&
                              "bg-success text-success-foreground",
                            state === "now" &&
                              "bg-primary text-primary-foreground",
                            (state === "next" || state === "covered") &&
                              "border border-hairline bg-card text-muted-foreground",
                          )}
                        >
                          {state === "done" ? (
                            <CheckIcon className="size-4" />
                          ) : (
                            k + 1
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span
                            className={cn(
                              "text-body-compact",
                              state === "now" ? "font-semibold" : "font-medium",
                              state === "next" && "text-muted-foreground",
                            )}
                          >
                            {x.name}
                          </span>
                          <span className="truncate text-caption text-muted-foreground">
                            {x.role}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-caption",
                            state === "done"
                              ? "text-success-ink"
                              : state === "now"
                                ? "font-medium text-foreground"
                                : "text-muted-foreground",
                          )}
                        >
                          {state === "done"
                            ? "Signed"
                            : state === "now"
                              ? "Signing now"
                              : state === "covered"
                                ? "Signed by the same OTP"
                                : "Next"}
                        </span>
                      </div>
                      {state === "now" ? (
                        // ds-spacing-allow: 44px is the 32px step marker plus its 12px gap, so the field lines up under the signer's name.
                        <div className="flex flex-col gap-1.5 pl-11">
                          {method === "dsc" ? (
                            <Field className="gap-1.5">
                              <FieldLabel htmlFor="dsc-pin">
                                {x.name}&apos;s DSC token PIN
                              </FieldLabel>
                              <Input
                                id="dsc-pin"
                                type="password"
                                inputMode="numeric"
                                autoComplete="off"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="max-w-56"
                              />
                            </Field>
                          ) : (
                            <Field className="gap-1.5">
                              <FieldLabel>
                                {method === "aadhaar"
                                  ? `OTP sent to ${x.name}'s Aadhaar-linked mobile`
                                  : `OTP sent to ${tail(x.mobile)}`}
                              </FieldLabel>
                              <InputOTP
                                maxLength={6}
                                value={code}
                                onChange={setCode}
                              >
                                <InputOTPGroup>
                                  {Array.from({ length: 6 }, (_, i) => (
                                    <InputOTPSlot key={i} index={i} />
                                  ))}
                                </InputOTPGroup>
                              </InputOTP>
                            </Field>
                          )}
                          {step.rounds > 1 ? (
                            <span className="text-caption text-muted-foreground tabular-nums">
                              OTP {step.round} of {step.rounds}:{" "}
                              {step.cases.length} case
                              {step.cases.length === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                });
              })()}
            </ol>
            {error ? (
              <p className="text-body-compact text-destructive-ink">{error}</p>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                disabled={code.replace(/\D/g, "").length < 6 || busy}
                onClick={() => void next()}
              >
                {busy ? <Spinner data-icon="inline-start" /> : null}
                Sign as {step.signer.name.split(" ")[0]}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </ChromeDialogContent>
    </Dialog>
  );
}
