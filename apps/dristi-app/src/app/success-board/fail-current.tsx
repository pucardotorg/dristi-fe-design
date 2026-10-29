"use client";

import * as React from "react";
import {
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  FileTextIcon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { DialogBox, FauxPage, Screen, ToastScreen } from "./frames";

/* Faithful redraws of today's failure, error and warning states (main @ 90bbc31).
   Copy is the product's own; markup and classes follow the source file on each card. */

/* ---------------------------------------------------------------- toasts */

/** Sonner's error box with the AppToaster fills (destructive-muted on destructive-7). */
function ErrorToastBox({ title, description }: { title: string; description?: string }) {
  return (
    <div
      className="flex w-[356px] items-center gap-1.5 border p-4 text-[13px]"
      style={{
        background: "var(--destructive-muted)",
        color: "var(--destructive-muted-foreground)",
        borderColor: "var(--destructive-7)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-overlay)",
      }}
    >
      <span className="mr-1 flex size-4 shrink-0 items-center justify-center self-start pt-0.5"><OctagonXIcon className="size-4" /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="leading-normal font-medium">{title}</div>
        {description ? <div className="leading-[1.4] opacity-90">{description}</div> : null}
      </div>
    </div>
  );
}

function PlainToastBox({ title }: { title: string }) {
  return (
    <div
      className="flex w-[356px] items-center border p-4 text-[13px]"
      style={{
        background: "var(--surface-sunken)",
        color: "var(--popover-foreground)",
        borderColor: "var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-overlay)",
      }}
    >
      <div className="leading-normal font-medium">{title}</div>
    </div>
  );
}

export const ErrToastToday = () => (
  <ToastScreen><ErrorToastBox title="Something went wrong — nothing was changed." /></ToastScreen>
);
export const ErrToastDescToday = () => (
  <ToastScreen><ErrorToastBox title="The case file could not be prepared" description="Try again. Nothing was downloaded." /></ToastScreen>
);
export const BlockToastToday = () => (
  <ToastScreen><PlainToastBox title="Type the order before sending it for signing." /></ToastScreen>
);
export const GateToastToday = () => (
  <ToastScreen><PlainToastBox title="The court fee opens once every signature and oath is in." /></ToastScreen>
);

/* ------------------------------------------------ failure drawn as success */

export function NothingSignedToday() {
  return (
    <Screen height={460}>
      <DialogBox width={448} close={false} className="gap-4 p-6">
        <div className="flex flex-col items-center gap-4 rounded-lg bg-success p-6 text-center">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-title-s font-semibold tabular-nums text-success-foreground">Nothing was signed</h2>
            <p className="text-body-compact text-pretty text-success-foreground">
              One OTP covered the set, the same as signing one at a time. A filing still waiting on another party stays on this tab until they sign.
            </p>
          </div>
          <span className="flex size-10 items-center justify-center rounded-full bg-success-foreground">
            <CheckIcon className="size-6 text-success" />
          </span>
        </div>
        <div className="flex justify-end"><Button>Done</Button></div>
      </DialogBox>
    </Screen>
  );
}

/* ------------------------------------------------------ red strip on card */

const TaskRow = ({ title, note, tone }: { title: string; note: string; tone: "fail" | "wait" }) => (
  <li className="flex min-w-0 items-center gap-3 border-b border-hairline py-3 last:border-b-0">
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <p className="text-body-compact font-medium">{title}</p>
      <p className="truncate text-body-compact text-muted-foreground">Suresh Kumar vs. Rajan Traders · ST/0412/2026</p>
    </div>
    <span className={"shrink-0 text-right text-body-compact " + (tone === "fail" ? "text-destructive-ink" : "text-warning-ink")}>{note}</span>
  </li>
);

export function RedStripToday() {
  return (
    <Screen height={560}>
      <DialogBox width={672}>
        <div className="flex shrink-0 flex-col gap-2 border-b border-hairline p-6 pr-16">
          <h2 className="text-title-s font-semibold tabular-nums">Nothing was paid</h2>
        </div>
        <div className="bg-muted p-6 dark:bg-background">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-hairline bg-card shadow-raised">
              <div className="flex items-center gap-2 bg-destructive-muted px-4 py-2.5 text-body-compact text-destructive-muted-foreground">
                <CircleAlertIcon className="size-4 shrink-0" />
                <span className="font-medium">Nothing was paid</span>
              </div>
              <ul className="flex flex-col px-4">
                <TaskRow title="Pay court fee" note="Not paid — the gateway declined it" tone="fail" />
                <TaskRow title="Pay process fee" note="Not paid — the gateway declined it" tone="fail" />
              </ul>
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-hairline bg-card p-6"><Button>Done</Button></div>
      </DialogBox>
    </Screen>
  );
}

export function RejectedStripToday() {
  return (
    <Screen height={700}>
      <DialogBox width={672}>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline p-6 pr-16">
          <h2 className="text-title-s font-semibold">Advocate registration rejected</h2>
          <Badge variant="destructive">Rejected</Badge>
        </div>
        <div className="flex flex-col items-center bg-muted p-6 dark:bg-background">
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-hairline bg-card shadow-raised">
            <div className="flex items-center gap-2 bg-destructive-muted px-4 py-2.5 text-body-compact text-destructive-muted-foreground">
              <CircleXIcon className="size-4 shrink-0" />
              <span className="font-medium">Account rejected</span>
            </div>
            <div className="flex flex-col items-start gap-1 px-4 py-4">
              <Badge variant="secondary">Advocate</Badge>
              <p className="text-title-s font-semibold">Meera Nair</p>
              <p className="font-mono text-body-compact text-muted-foreground">KL-ADV-123456-2026</p>
            </div>
            <div className="border-t border-hairline bg-surface-sunken p-3">
              <div className="mx-auto h-28 w-44 rounded-md border border-hairline bg-card" />
            </div>
            <div className="border-t border-hairline px-4 py-4">
              <div className="min-h-24 rounded-lg bg-surface-sunken p-3 text-body-compact">
                The name entered does not match the Bar Council record. Please check and submit again.
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-hairline bg-card p-6">
          <Button variant="outline">Close</Button>
          <Button>View next application</Button>
        </div>
      </DialogBox>
    </Screen>
  );
}

/* --------------------------------------------- partly failed in a success */

export function PartialCalloutToday() {
  return (
    <Screen height={420}>
      <DialogBox width={360} close={false} className="gap-4 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">3 processes signed</h2>
          <p className="flex items-start gap-2 rounded-lg bg-success px-4 py-3 text-body text-success-foreground">
            <CircleCheckIcon className="mt-0.5 size-5 shrink-0" />
            <span>2 are now in Sent in Service.</span>
          </p>
          <p className="flex items-start gap-2 text-body-compact text-warning-ink">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            1 could not be sent and is in Errored in Issuance.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline">Download 3 documents</Button>
          <Button>Done</Button>
        </div>
      </DialogBox>
    </Screen>
  );
}

export function PartialFooterToday() {
  return (
    <Screen height={480}>
      <DialogBox width={760}>
        <div className="flex shrink-0 border-b border-hairline p-6 pr-16"><h2 className="text-title-s font-semibold">Summons · ST/0412/2026</h2></div>
        <div className="flex h-64 items-center justify-center bg-card"><div className="h-56 w-44 rounded border border-hairline bg-surface-sunken" /></div>
        <div className="flex items-center gap-2 border-t border-hairline bg-card p-6">
          <p className="mr-auto flex items-start gap-2 text-body-compact text-warning-ink">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <span><span className="font-medium">Process signed.</span> 1 could not be sent and is in Errored in Issuance.</span>
          </p>
          <Button variant="outline">Download</Button>
          <Button>Done</Button>
        </div>
      </DialogBox>
    </Screen>
  );
}

/* ----------------------------------------------------------- inline error */

export function InlineErrorsToday() {
  return (
    <div className="w-[820px] shrink-0 rounded-lg border border-hairline bg-background p-8">
      <div className="flex flex-col gap-5">
        <Banner variant="error">The payment did not go through. Nothing was paid; try again.</Banner>
        <Alert variant="destructive" className="py-3 pl-3">
          <CircleAlertIcon />
          <AlertTitle>Last attempt failed</AlertTitle>
          <AlertDescription>Ref PAY-55102 on 24-08-2026, 11:40. Nothing was paid; try again.</AlertDescription>
        </Alert>
        <Banner variant="error" action={<Button variant="outline" size="sm">Try again</Button>}>
          Cases could not be loaded. Nothing has been changed — try again in a moment.
        </Banner>
        <Alert variant="destructive">
          <AlertDescription>No case rows were found in this file.</AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- inline warning */

export function InlineWarningsToday() {
  return (
    <div className="w-[820px] shrink-0 rounded-lg border border-hairline bg-background p-8">
      <div className="flex flex-col gap-5">
        <Banner variant="warning">
          You are offline. The table is read-only until the connection returns — nothing is queued, so payments and signatures are never sent twice.
        </Banner>
        <Alert variant="warning" className="py-3 pl-3">
          <TriangleAlertIcon />
          <AlertTitle>12 days beyond the one-month limit</AlertTitle>
          <AlertDescription>The court can still take this on file, but it must be asked to condone the delay.</AlertDescription>
        </Alert>
        {/* AI unavailable: Banner draws its own icon and the caller adds a second. */}
        <div className="relative flex min-h-11 w-full items-center gap-2.5 border-s-3 border-warning bg-warning-muted px-4 py-3 text-sm text-warning-muted-foreground">
          <CircleAlertIcon className="size-4 shrink-0" />
          <TriangleAlertIcon className="size-4 shrink-0" />
          <div className="min-w-0 flex-1 leading-snug">AI review unavailable. Documents are not compared with the cases; check them manually.</div>
        </div>
        <Banner variant="warning" className="items-start">
          No case matches this number. Check your summons, or the case may not be in the system yet.
        </Banner>
      </div>
    </div>
  );
}

/** The floating warning on the documents step: an Alert pinned bottom-right for 3.5s. */
export function FloatingWarningToday() {
  return (
    <div className="relative h-[420px] w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background">
      <FauxPage />
      <div className="absolute right-6 bottom-16 w-72">
        <Alert variant="warning" className="shadow-overlay">
          <TriangleAlertIcon />
          <AlertDescription>2 required documents still needed</AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- confirm dialogs */

function AlertBox({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <DialogBox width={360} close={false} className="gap-4 p-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-balance text-muted-foreground">{body}</p>
      </div>
      <div className="-mx-6 -mb-6 flex justify-end gap-2 rounded-b-xl border-t bg-muted p-6">{children}</div>
    </DialogBox>
  );
}

export const ConfirmRemoveToday = () => (
  <Screen height={420}>
    <AlertBox title="Remove Rahul from your office?" body="They will lose access to 14 cases immediately and leave your office. You can add them again at any time.">
      <Button variant="outline">Cancel</Button>
      <Button variant="destructive">Remove from office</Button>
    </AlertBox>
  </Screen>
);

export const ConfirmDiscardToday = () => (
  <Screen height={420}>
    <AlertBox title="Discard this draft?" body="Its text and order data are removed, and it leaves Pending orders. Nothing is issued or recorded on the case. This cannot be undone.">
      <Button variant="outline">Keep the draft</Button>
      <Button>Discard draft</Button>
    </AlertBox>
  </Screen>
);

export const ConfirmSignToday = () => (
  <Screen height={420}>
    <AlertBox title="Sign 8 orders?" body="Your signature issues each order. Its order data is triggered once it is complete — at once, for any the steno has already completed. This cannot be reversed.">
      <Button variant="outline">Back</Button>
      <Button>Sign</Button>
    </AlertBox>
  </Screen>
);

/* ------------------------------------------------------------- field errors */

export function FieldErrorsToday() {
  return (
    <div className="flex w-[820px] shrink-0 flex-col gap-6 rounded-lg border border-hairline bg-background p-8">
      <Field data-invalid>
        <FieldLabel>Full name <span className="text-destructive">*</span></FieldLabel>
        <Input aria-invalid defaultValue="" />
        <FieldError>Enter your name as it appears on your ID.</FieldError>
      </Field>
      <Field data-invalid>
        <FieldLabel className="text-body-compact font-medium">Why are you sending this back?</FieldLabel>
        <Textarea aria-invalid className="min-h-24 text-body-compact" />
        <FieldError>Write a reason first.</FieldError>
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">PIN code</span>
        <Input defaultValue="6820" />
        <p className="text-body-compact text-destructive-ink">PIN codes are 6 digits.</p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- dead ends, pages */

export function DeadEndToday() {
  return (
    <Screen height={480} scrim={false}>
      <div className="absolute inset-0 bg-background" />
      <div className="relative w-full max-w-xl rounded-xl border border-hairline bg-card py-12 shadow-raised">
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted text-foreground"><FileTextIcon className="size-5" /></span>
          <p className="text-lg font-medium">This task is not here</p>
          <p className="text-sm text-muted-foreground">It may have been reset with the sandbox, or the link is wrong.</p>
          <Button variant="outline" className="mt-4">Back to tasks</Button>
        </div>
      </div>
    </Screen>
  );
}

export function LinkDeadToday() {
  return (
    <Screen height={480} scrim={false}>
      <div className="absolute inset-0 flex flex-col bg-background">
        <div className="flex h-14 items-center border-b border-hairline px-6"><div className="h-6 w-28 rounded bg-surface-sunken" /></div>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-12">
          <h1 className="text-title font-semibold text-balance">This link is no longer active</h1>
          <p className="text-body text-muted-foreground">
            The complaint may have been changed and sent again, or the request recalled. Ask the advocate filing it to send you a new link.
          </p>
        </div>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------ failures in a quiet tone */

export function QuietFailuresToday() {
  return (
    <div className="flex w-[820px] shrink-0 flex-col gap-6 rounded-lg border border-hairline bg-background p-8">
      <Alert variant="info">
        <CircleAlertIcon />
        <AlertTitle>We could not load your case</AlertTitle>
        <AlertDescription>Your case number and hearing date are on your summons.</AlertDescription>
      </Alert>
      <div className="rounded-lg border border-hairline bg-card">
        <p className="p-6 text-body-compact text-muted-foreground">This document could not be shown. Try downloading it instead.</p>
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-title font-semibold text-balance">Your registration was not approved</h1>
        <p className="text-body text-muted-foreground">Correct your details and resubmit for approval.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ warning marks */

export function WarnMarksToday() {
  return (
    <div className="flex w-[820px] shrink-0 flex-wrap items-center gap-4 rounded-lg border border-hairline bg-background p-8">
      <Badge variant="destructive">Overdue</Badge>
      <Badge variant="warning">Due today</Badge>
      <Badge variant="warning"><CircleAlertIcon data-icon="inline-start" />Pending review</Badge>
      <Badge variant="warning"><TriangleAlertIcon />3 actions to take</Badge>
      <span className="text-body-compact font-medium text-destructive-ink">4 days overdue</span>
      <span className="flex flex-col text-body-compact"><span className="font-medium text-warning-ink">Errored</span><span className="text-muted-foreground">No response from ICOPS</span></span>
      <span className="flex items-center gap-1 text-caption font-medium text-warning-ink"><TriangleAlertIcon className="size-3.5" />Incomplete</span>
      <span className="flex items-center gap-1.5 text-body-compact"><TriangleAlertIcon className="size-4 text-destructive-ink" /><span className="text-destructive-ink">Couldn&apos;t save. Retrying</span></span>
      <span className="flex size-6 items-center justify-center rounded-full bg-destructive-muted text-destructive-muted-foreground"><XIcon className="size-3.5" /></span>
    </div>
  );
}

/* Re-exported so the proposed side can reuse the same facts list. */
export const FactRows = ({ rows }: { rows: [string, string][] }) => (
  <DescriptionList>
    {rows.map(([t, v]) => (
      <DescriptionRow key={t} className="border-hairline">
        <DescriptionTerm>{t}</DescriptionTerm>
        <DescriptionDetails className="tabular-nums">{v}</DescriptionDetails>
      </DescriptionRow>
    ))}
  </DescriptionList>
);

/* ------------------------------------------------- states missing today */

/** What happens today where a failure state should be. */
export function MissingToday({ what, children }: { what: string; children: React.ReactNode }) {
  return (
    <div className="flex h-[420px] w-[820px] shrink-0 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-background p-10 text-center">
      <span className="rounded-full bg-surface-sunken px-3 py-1 text-body-compact font-semibold text-muted-foreground ring-1 ring-hairline">Does not exist today</span>
      <p className="text-title-s font-semibold">{what}</p>
      <p className="max-w-md text-body text-muted-foreground">{children}</p>
    </div>
  );
}
