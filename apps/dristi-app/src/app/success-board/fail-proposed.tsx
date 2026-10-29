"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { FactRows } from "./fail-current";
import { DialogBox, FauxPage, Screen } from "./frames";
import { ConfirmToast, Facts, Footer, Hero, Rail, SuccessMark, Summary, type Tone } from "./proposed";

/* Proposed failure and warning language: the same mark and the same three weights as
   success, in two more tones.
   - Error (red, drawn cross, a small shake): the act did not happen, or was refused.
   - Warning (amber, drawn "!"): it happened with a catch, or something needs a look.
   Error toasts stay until closed; warning toasts keep today's 4s. */

function ToastOnPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[420px] w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background">
      <FauxPage />
      <div className="absolute inset-x-0 bottom-[56px] flex justify-center pl-44">{children}</div>
    </div>
  );
}

/** Same white line as the success one, in a tone, with an optional title and action. */
export function InlineNote({
  tone,
  title,
  children,
  action,
}: {
  tone: Exclude<Tone, "info">;
  title?: string;
  children: React.ReactNode;
  action?: string;
}) {
  return (
    <div className="sb-rise relative flex items-center gap-3 overflow-hidden rounded-lg bg-card py-3 pr-3 pl-4 ring-1 ring-hairline">
      <Rail tone={tone} />
      <span className={title ? "mt-[1px] self-start" : "self-center"}><SuccessMark size={22} tone={tone} /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title ? <p className="text-body-compact font-semibold">{title}</p> : null}
        <p className={"text-body-compact " + (title ? "text-muted-foreground" : "font-semibold")}>{children}</p>
      </div>
      {action ? <Button size="sm" variant="outline">{action}</Button> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- toasts */

export const ErrToastNext = () => (
  <ToastOnPage><ConfirmToast tone="error" title="Something went wrong — nothing was changed." /></ToastOnPage>
);
export const ErrToastDescNext = () => (
  <ToastOnPage><ConfirmToast tone="error" title="The case file could not be prepared" description="Try again. Nothing was downloaded." /></ToastOnPage>
);

/** A blocked press points at what is missing, on the field itself (Submit points at missing). */
export function BlockToastNext() {
  return (
    <Screen height={420} scrim={false}>
      <div className="absolute inset-0 bg-background" />
      <div className="relative flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        <Field data-invalid>
          <FieldLabel className="text-body font-semibold">Order text</FieldLabel>
          <Textarea aria-invalid className="min-h-40 text-body ring-3 ring-destructive/20" />
          <FieldError>Type the order before sending it for signing.</FieldError>
        </Field>
        <div className="flex justify-end"><Button>Send for signing</Button></div>
      </div>
    </Screen>
  );
}

export const GateToastNext = () => (
  <ToastOnPage><ConfirmToast tone="warning" title="The court fee opens once every signature and oath is in." /></ToastOnPage>
);

/* ------------------------------------------------------ failure takeovers */

export function NothingSignedNext() {
  return (
    <Screen height={460}>
      <DialogBox width={448} close={false}>
        <Hero
          compact
          tone="error"
          title="Nothing was signed"
          body="One OTP covered the set, the same as signing one at a time. A filing still waiting on another party stays on this tab until they sign."
        />
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

const NoteRow = ({ title, note }: { title: string; note: string }) => (
  <li className="flex min-w-0 items-center gap-3 border-b border-hairline py-3 last:border-b-0">
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <p className="text-body-compact font-medium">{title}</p>
      <p className="truncate text-body-compact text-muted-foreground">Suresh Kumar vs. Rajan Traders · ST/0412/2026</p>
    </div>
    <span className="shrink-0 text-right text-body-compact text-destructive-ink">{note}</span>
  </li>
);

export function RedStripNext() {
  return (
    <Screen height={560}>
      <DialogBox width={672}>
        <Hero tone="error" title="Nothing was paid" />
        <Facts>
          <Summary>
            <ul className="flex flex-col">
              <NoteRow title="Pay court fee" note="Not paid — the gateway declined it" />
              <NoteRow title="Pay process fee" note="Not paid — the gateway declined it" />
            </ul>
          </Summary>
        </Facts>
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function RejectedNext() {
  return (
    <Screen height={640}>
      <DialogBox width={672}>
        <Hero compact tone="error" title="Advocate registration rejected" />
        <Facts>
          <Summary tone="error" label="Account rejected">
            <div className="flex flex-col items-start gap-1 py-3">
              <Badge variant="secondary">Advocate</Badge>
              <p className="text-title-s font-semibold">Meera Nair</p>
              <p className="font-mono text-body-compact text-muted-foreground">KL-ADV-123456-2026</p>
            </div>
          </Summary>
          <div className="mt-3 rounded-lg bg-surface-sunken p-3 text-body-compact">
            The name entered does not match the Bar Council record. Please check and submit again.
          </div>
        </Facts>
        <Footer>
          <Button variant="outline">Close</Button>
          <Button>View next application</Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

/* --------------------------------------------- partly failed in a success */

export function PartialCalloutNext() {
  return (
    <Screen height={480}>
      <DialogBox width={400} close={false}>
        <Hero compact title="3 processes signed" body="2 are now in Sent in Service." />
        <Facts>
          <InlineNote tone="warning">1 could not be sent and is in Errored in Issuance.</InlineNote>
        </Facts>
        <Footer>
          <Button variant="outline">Download 3 documents</Button>
          <Button>Done</Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

export function PartialFooterNext() {
  return (
    <Screen height={480}>
      <DialogBox width={760}>
        <div className="flex shrink-0 border-b border-hairline p-6 pr-16"><h2 className="text-title-s font-semibold">Summons · ST/0412/2026</h2></div>
        <div className="flex h-64 items-center justify-center bg-card"><div className="h-56 w-44 rounded border border-hairline bg-surface-sunken" /></div>
        <div className="sb-band flex items-center gap-3 border-t px-6 py-4" style={{ borderColor: "var(--warning-7)", background: "var(--warning-muted)" }}>
          <SuccessMark size={36} tone="warning" />
          <p className="sb-rise mr-auto flex flex-col" style={{ animationDelay: "180ms" }}>
            <span className="text-body font-semibold text-foreground">Process signed.</span>
            <span className="text-body-compact text-muted-foreground">1 could not be sent and is in Errored in Issuance.</span>
          </p>
          <Button variant="outline">Download</Button>
          <Button>Done</Button>
        </div>
      </DialogBox>
    </Screen>
  );
}

/* ---------------------------------------------------------------- inline */

export function InlineErrorsNext() {
  return (
    <div className="w-[820px] shrink-0 rounded-lg border border-hairline bg-background p-8">
      <div className="flex flex-col gap-5">
        <InlineNote tone="error">The payment did not go through. Nothing was paid; try again.</InlineNote>
        <InlineNote tone="error" title="Last attempt failed">Ref PAY-55102 on 24-08-2026, 11:40. Nothing was paid; try again.</InlineNote>
        <InlineNote tone="error" action="Try again">Cases could not be loaded. Nothing has been changed — try again in a moment.</InlineNote>
        <InlineNote tone="error">No case rows were found in this file.</InlineNote>
      </div>
    </div>
  );
}

export function InlineWarningsNext() {
  return (
    <div className="w-[820px] shrink-0 rounded-lg border border-hairline bg-background p-8">
      <div className="flex flex-col gap-5">
        <InlineNote tone="warning">
          You are offline. The table is read-only until the connection returns — nothing is queued, so payments and signatures are never sent twice.
        </InlineNote>
        <InlineNote tone="warning" title="12 days beyond the one-month limit">
          The court can still take this on file, but it must be asked to condone the delay.
        </InlineNote>
        <InlineNote tone="warning">AI review unavailable. Documents are not compared with the cases; check them manually.</InlineNote>
        <InlineNote tone="warning">No case matches this number. Check your summons, or the case may not be in the system yet.</InlineNote>
      </div>
    </div>
  );
}

export const FloatingWarningNext = () => (
  <ToastOnPage><ConfirmToast tone="warning" title="2 required documents still needed" /></ToastOnPage>
);

/* --------------------------------------------------------- confirm dialogs */

/** Same words; a small mark names the risk, and the confirm button follows one rule:
    removes or destroys → solid red; irreversible but not destructive → primary. */
function ConfirmBox({
  tone,
  title,
  body,
  children,
}: {
  tone: "error" | "warning";
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <DialogBox width={400} close={false}>
      <div className="flex items-start gap-4 p-6">
        <SuccessMark size={40} tone={tone} />
        <div className="flex min-w-0 flex-col gap-1.5 pt-1">
          <h2 className="text-body font-semibold text-balance">{title}</h2>
          <p className="text-body-compact text-pretty text-muted-foreground">{body}</p>
        </div>
      </div>
      <Footer>{children}</Footer>
    </DialogBox>
  );
}

export const ConfirmRemoveNext = () => (
  <Screen height={420}>
    <ConfirmBox tone="error" title="Remove Rahul from your office?" body="They will lose access to 14 cases immediately and leave your office. You can add them again at any time.">
      <Button variant="outline">Cancel</Button>
      <Button variant="destructive-solid">Remove from office</Button>
    </ConfirmBox>
  </Screen>
);

export const ConfirmDiscardNext = () => (
  <Screen height={420}>
    <ConfirmBox tone="error" title="Discard this draft?" body="Its text and order data are removed, and it leaves Pending orders. Nothing is issued or recorded on the case. This cannot be undone.">
      <Button variant="outline">Keep the draft</Button>
      <Button variant="destructive-solid">Discard draft</Button>
    </ConfirmBox>
  </Screen>
);

export const ConfirmSignNext = () => (
  <Screen height={420}>
    <ConfirmBox tone="warning" title="Sign 8 orders?" body="Your signature issues each order. Its order data is triggered once it is complete — at once, for any the steno has already completed. This cannot be reversed.">
      <Button variant="outline">Back</Button>
      <Button>Sign</Button>
    </ConfirmBox>
  </Screen>
);

/* ------------------------------------------------------------- field errors */

const ErrLine = ({ children }: { children: React.ReactNode }) => (
  <FieldError className="flex items-start gap-1.5 text-destructive-ink">
    <span className="mt-[3px]"><SuccessMark size={14} tone="error" /></span>
    <span>{children}</span>
  </FieldError>
);

export function FieldErrorsNext() {
  return (
    <div className="flex w-[820px] shrink-0 flex-col gap-6 rounded-lg border border-hairline bg-background p-8">
      <Field data-invalid>
        <FieldLabel>Full name <span className="text-destructive">*</span></FieldLabel>
        <Input aria-invalid defaultValue="" />
        <ErrLine>Enter your name as it appears on your ID.</ErrLine>
      </Field>
      <Field data-invalid>
        <FieldLabel className="text-body-compact font-medium">Why are you sending this back?</FieldLabel>
        <Textarea aria-invalid className="min-h-24 text-body-compact" />
        <ErrLine>Write a reason first.</ErrLine>
      </Field>
      <Field data-invalid>
        <FieldLabel>PIN code</FieldLabel>
        <Input aria-invalid defaultValue="6820" />
        <ErrLine>PIN codes are 6 digits.</ErrLine>
      </Field>
    </div>
  );
}

/* --------------------------------------------------------- dead ends, pages */

export function DeadEndNext() {
  return (
    <Screen height={480} scrim={false}>
      <div className="absolute inset-0 bg-background" />
      <div className="relative w-full max-w-xl rounded-xl border border-hairline bg-card py-12 shadow-raised">
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <SuccessMark size={56} tone="warning" />
          <p className="sb-rise text-title-s font-semibold" style={{ animationDelay: "180ms" }}>This task is not here</p>
          <p className="sb-rise text-body text-muted-foreground" style={{ animationDelay: "240ms" }}>It may have been reset with the sandbox, or the link is wrong.</p>
          <Button variant="outline" className="mt-3">Back to tasks</Button>
        </div>
      </div>
    </Screen>
  );
}

export function LinkDeadNext() {
  return (
    <Screen height={480} scrim={false}>
      <div className="absolute inset-0 flex flex-col bg-background">
        <div className="flex h-14 items-center border-b border-hairline px-6"><div className="h-6 w-28 rounded bg-surface-sunken" /></div>
        <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-12">
          <SuccessMark size={56} tone="warning" />
          <h1 className="sb-rise text-title font-semibold text-balance" style={{ animationDelay: "180ms" }}>This link is no longer active</h1>
          <p className="sb-rise text-body text-muted-foreground" style={{ animationDelay: "240ms" }}>
            The complaint may have been changed and sent again, or the request recalled. Ask the advocate filing it to send you a new link.
          </p>
        </div>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------ failures in a quiet tone */

export function QuietFailuresNext() {
  return (
    <div className="flex w-[820px] shrink-0 flex-col gap-6 rounded-lg border border-hairline bg-background p-8">
      <InlineNote tone="warning" title="We could not load your case">Your case number and hearing date are on your summons.</InlineNote>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-hairline bg-card p-6 text-center">
        <SuccessMark size={40} tone="error" />
        <p className="text-body-compact text-muted-foreground">This document could not be shown. Try downloading it instead.</p>
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <SuccessMark size={56} tone="warning" />
        <h1 className="text-title font-semibold text-balance">Your registration was not approved</h1>
        <p className="text-body text-muted-foreground">Correct your details and resubmit for approval.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ warning marks */

/** One small mark per tone, the same shape as the success dot. */
const Dot = ({ tone }: { tone: "error" | "warning" }) => <SuccessMark size={14} tone={tone} />;

export function WarnMarksNext() {
  return (
    <div className="flex w-[820px] shrink-0 flex-wrap items-center gap-4 rounded-lg border border-hairline bg-background p-8">
      <Badge variant="destructive" className="sb-chip"><Dot tone="error" />Overdue</Badge>
      <Badge variant="warning" className="sb-chip"><Dot tone="warning" />Due today</Badge>
      <Badge variant="warning" className="sb-chip"><Dot tone="warning" />Pending review</Badge>
      <Badge variant="warning" className="sb-chip"><Dot tone="warning" />3 actions to take</Badge>
      <span className="inline-flex items-center gap-1.5 text-body-compact font-medium text-destructive-ink"><Dot tone="error" />4 days overdue</span>
      <span className="flex items-center gap-2 text-body-compact"><Badge variant="warning"><Dot tone="warning" />Errored</Badge><span className="text-muted-foreground">No response from ICOPS</span></span>
      <span className="flex items-center gap-1.5 text-caption font-medium text-warning-ink"><Dot tone="warning" />Incomplete</span>
      <span className="flex items-center gap-1.5 text-body-compact text-destructive-ink"><Dot tone="error" />Couldn&apos;t save. Retrying</span>
    </div>
  );
}

export { FactRows };
