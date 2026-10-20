"use client";

import * as React from "react";
import { ExternalLinkIcon, InfoIcon, KeyRoundIcon, PenToolIcon, SmartphoneIcon, UploadIcon, UserCheckIcon } from "lucide-react";

import { AADHAAR_DOCS_PER_OTP, AADHAAR_LIMIT_SOURCE, type BulkSignMethod } from "@/lib/bulk/types";
import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";

import { bulkApi, type CaseView } from "./api";
import type { BatchCtx } from "./batch-screen";
import { FileDrop } from "./file-drop";

type Signer = { id: string; name: string; role: string; mobile?: string };

const METHODS: {
  id: BulkSignMethod;
  title: string;
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: (n: number, signers: number) => string;
}[] = [
  {
    id: "mobile-otp",
    title: "Mobile OTP",
    tag: "Fastest",
    icon: SmartphoneIcon,
    hint: () => "One OTP to the advocate's mobile signs every case, for the advocate and the complainant.",
  },
  {
    id: "dsc",
    title: "Digital Signature Certificate (DSC)",
    tag: "More secure · needs a DSC token",
    icon: KeyRoundIcon,
    hint: (_n, s) => `Each signer plugs in their DSC token and enters its PIN once: ${s} PINs in all.`,
  },
  {
    id: "aadhaar",
    title: "Aadhaar eSign",
    tag: "Secure · slowest",
    icon: UserCheckIcon,
    hint: (n, s) => {
      const r = Math.ceil(n / AADHAAR_DOCS_PER_OTP);
      return `${AADHAAR_DOCS_PER_OTP} cases per OTP: ${r} OTP${r === 1 ? "" : "s"} per signer, ${r * s} in all for ${n} case${n === 1 ? "" : "s"}.`;
    },
  },
  {
    id: "upload",
    title: "Upload signed copies",
    tag: "Most manual",
    icon: UploadIcon,
    hint: (n) => `Print each complaint, sign it by hand, scan it, and upload all ${n}.`,
  },
];

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

const tail = (m?: string) => (m ? `••••${m.slice(-4)}` : "their registered mobile");

/** Bulk signing: everyone who must sign each case (`SIG-03`), by one method for all (`SIG-04`). */
export function SignTab({ batch, setBatch, go }: BatchCtx) {
  const clear = batch.cases.filter((c) => c.stage === "ready" && c.flags.length === 0);
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set(clear.map((c) => c.id)));
  const [method, setMethod] = React.useState<BulkSignMethod>("mobile-otp");
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
      ? [{ id: "rep", name: batch.representative.name, role: `For ${batch.client}, ${batch.representative.designation}`, mobile: batch.representative.mobile }]
      : []),
    ...batch.advocates.map((a, i) => ({ id: `adv-${i}`, name: a.name || a.barNumber, role: `Advocate, ${a.barNumber}` })),
  ];
  const held = batch.cases.filter((c) => c.stage === "held").length;
  const unanswered = batch.cases.filter((c) => c.stage === "ready" && c.flags.length > 0).length;

  return (
    <div className="flex flex-col gap-6">
      {held || unanswered ? (
        <Alert variant="warning">
          <InfoIcon aria-hidden />
          <AlertTitle className="tabular-nums">
            {held + unanswered} case{held + unanswered === 1 ? " isn't" : "s aren't"} ready to sign yet
          </AlertTitle>
          <AlertDescription>
            Finish scrutiny first:{" "}
            {[held ? `${held} need${held === 1 ? "s" : ""} fixing` : "", unanswered ? `${unanswered} to check` : ""].filter(Boolean).join(", ")}.{" "}
            <button type="button" className="underline" onClick={() => go("scrutiny")}>
              Go to Scrutiny
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      {clear.length === 0 ? (
        <Card className={PANEL_CLASS}>
          <CardContent className="text-body-compact text-muted-foreground">Nothing to sign yet. Finish documents and scrutiny first.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className={cn(PANEL_CLASS, "lg:col-span-2")}>
            <CardHeader>
              <CardTitle className="text-body font-semibold">Cases to sign</CardTitle>
              <CardDescription className="tabular-nums">
                {chosen.length} of {clear.length} chosen
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <label className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-accent">
                <Checkbox
                  aria-label="All clear cases"
                  checked={chosen.length === clear.length ? true : chosen.length ? "indeterminate" : false}
                  onCheckedChange={(v) => setPicked(v === true ? new Set(clear.map((c) => c.id)) : new Set())}
                />
                <span className="text-body-compact font-medium">All clear cases</span>
              </label>
              {clear.map((c) => (
                <label key={c.id} id={`bulk-case-${c.id}`} className="flex min-h-10 scroll-mt-20 items-center gap-3 rounded-lg px-2 hover:bg-accent">
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
                    <span className="text-body-compact tabular-nums">{c.reference}</span>
                    <span className="truncate text-caption text-muted-foreground">{c.accused}</span>
                  </span>
                  <span className="text-caption tabular-nums text-muted-foreground">{money(c.amount)}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card className={cn(PANEL_CLASS, "lg:col-span-3")}>
            <CardHeader>
              <CardTitle className="text-body font-semibold">How to sign</CardTitle>
              <CardDescription>
                Every case needs {signers.map((s) => s.name).join(" and ")}. One method for all of them.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RadioGroup value={method} onValueChange={(v) => setMethod(v as BulkSignMethod)} className="gap-2" aria-label="Signing method">
                {METHODS.map((m) => {
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
                      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span id={`sign-${m.id}-title`} className="text-body-compact font-medium">
                            {m.title}
                          </span>
                          <Badge variant={m.id === "mobile-otp" ? "success" : m.id === "aadhaar" ? "warning" : "secondary"}>{m.tag}</Badge>
                        </span>
                        <span id={`sign-${m.id}-hint`} className="text-caption text-muted-foreground">
                          {m.hint(Math.max(chosen.length, 1), signers.length)}
                        </span>
                        {m.id === "aadhaar" ? (
                          <span className="text-caption text-muted-foreground">
                            Why {AADHAAR_DOCS_PER_OTP}: an eSign request carries one document hash per document, and the
                            specification allows at most {AADHAAR_DOCS_PER_OTP} per request.{" "}
                            <a href={AADHAAR_LIMIT_SOURCE.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
                              {AADHAAR_LIMIT_SOURCE.publisher.split(",")[0]}, {AADHAAR_LIMIT_SOURCE.title}
                              <ExternalLinkIcon className="size-3" aria-hidden />
                              <span className="sr-only">(opens in a new tab)</span>
                            </a>
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>

              {method === "aadhaar" && chosen.length > AADHAAR_DOCS_PER_OTP ? (
                <Alert variant="warning">
                  <InfoIcon aria-hidden />
                  <AlertTitle>
                    {signers.length * Math.ceil(chosen.length / AADHAAR_DOCS_PER_OTP)} OTPs, one after another
                  </AlertTitle>
                  <AlertDescription>
                    Each signer enters {Math.ceil(chosen.length / AADHAAR_DOCS_PER_OTP)} Aadhaar OTPs, {AADHAAR_DOCS_PER_OTP} cases at a
                    time. Mobile OTP or DSC signs the same {chosen.length} cases with one each.
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button size="lg" disabled={chosen.length === 0 || !!batch.clubbedInto} onClick={() => setFlowOpen(true)}>
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
          const next = await bulkApi.act(batch.id, { action: "sign", method, caseIds: chosen.map((c) => c.id) });
          setBatch(next);
        }}
        onPay={() => {
          setFlowOpen(false);
          go("pay");
        }}
      />
    </div>
  );
}

type Step = { signer: Signer; cases: CaseView[]; round: number; rounds: number };

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
    const groups = method === "aadhaar" ? chunk(cases, AADHAAR_DOCS_PER_OTP) : [cases];
    return signers.flatMap((s) => groups.map((g, i) => ({ signer: s, cases: g, round: i + 1, rounds: groups.length })));
  }, [method, cases, signers]);

  const [at, setAt] = React.useState(0);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
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
      await onDone();
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
  const total = method === "upload" ? 1 : steps.length;
  const matchedAll = cases.every((c) => uploads[c.id]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <ChromeDialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {cases.length} case{cases.length === 1 ? "" : "s"} signed
              </DialogTitle>
              <DialogDescription>Every required signature is on each case. Payment files them.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={onPay}>Go to payment</Button>
            </DialogFooter>
          </>
        ) : method === "upload" ? (
          <>
            <DialogHeader>
              <DialogTitle>Upload signed copies</DialogTitle>
              <DialogDescription>
                One file per case, named <span className="font-mono">reference_signed.pdf</span>. Each must carry every signature.
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
                    const c = cases.find((x) => f.name.toLowerCase().startsWith(`${x.reference.toLowerCase()}_signed`));
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
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <span className="tabular-nums">{c.reference}</span>
                  {uploads[c.id] ? <Badge variant="success">Matched</Badge> : <Badge variant="outline">Waiting</Badge>}
                </li>
              ))}
            </ul>
            {error ? <p className="text-body-compact text-destructive-ink">{error}</p> : null}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button disabled={!matchedAll || busy} onClick={() => void finish()}>
                {busy ? <Spinner data-icon="inline-start" /> : null}
                Submit {cases.length} signed copies
              </Button>
            </DialogFooter>
          </>
        ) : step ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {method === "dsc" ? "Sign with DSC" : method === "aadhaar" ? "Aadhaar eSign" : "Sign with mobile OTP"}
              </DialogTitle>
              <DialogDescription>
                {step.signer.name} · {step.signer.role}
                {method === "mobile-otp" && signers.length > 1
                  ? `. Signs for ${signers.filter((s) => s.id !== step.signer.id).map((s) => s.name).join(" and ")} too.`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1" aria-live="polite">
              <Progress value={(at / total) * 100} aria-label="Signing progress" />
              <span className="text-caption text-muted-foreground tabular-nums">
                Step {at + 1} of {total}
                {method === "aadhaar" ? ` · round ${step.round} of ${step.rounds} for this signer` : ""}
              </span>
            </div>
            <div className="rounded-lg border border-hairline bg-surface-sunken p-4 text-body-compact">
              <div className="mb-2 font-medium">
                {method === "aadhaar" ? `These ${step.cases.length} cases` : `All ${step.cases.length} cases`}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {step.cases.slice(0, 12).map((c) => (
                  <Badge key={c.id} variant="outline" className="tabular-nums">
                    {c.reference}
                  </Badge>
                ))}
                {step.cases.length > 12 ? <Badge variant="outline">+{step.cases.length - 12} more</Badge> : null}
              </div>
            </div>
            {method === "dsc" ? (
              <Field className="gap-1.5">
                <FieldLabel htmlFor="dsc-pin">DSC token PIN</FieldLabel>
                <Input id="dsc-pin" type="password" inputMode="numeric" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
                <span className="text-caption text-muted-foreground">Sandbox: any 6 digits. Token detected: ePass 2003 Auto.</span>
              </Field>
            ) : (
              <Field className="gap-1.5">
                <FieldLabel>
                  {method === "aadhaar" ? "OTP sent to the Aadhaar-linked mobile" : `OTP sent to ${tail(step.signer.mobile)}`}
                </FieldLabel>
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {Array.from({ length: 6 }, (_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <span className="text-caption text-muted-foreground">Sandbox: any 6 digits.</span>
              </Field>
            )}
            {error ? <p className="text-body-compact text-destructive-ink">{error}</p> : null}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button disabled={code.replace(/\D/g, "").length < 6 || busy} onClick={() => void next()}>
                {busy ? <Spinner data-icon="inline-start" /> : null}
                {method === "aadhaar" ? `Sign these ${step.cases.length}` : `Sign all ${step.cases.length}`}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </ChromeDialogContent>
    </Dialog>
  );
}
