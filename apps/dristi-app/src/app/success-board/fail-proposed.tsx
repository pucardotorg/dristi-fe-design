"use client";

import * as React from "react";
import {
  CircleXIcon,
  FileQuestionIcon,
  FileTextIcon,
  FileXIcon,
  LinkIcon,
  LockIcon,
  SearchXIcon,
  PenLineIcon,
  Trash2Icon,
  UserXIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { FactRows } from "./fail-current";
import { DialogBox, FauxPage, IdCard, Screen } from "./frames";
import { ConfirmToast, Facts, Footer, Hero, Rail, SuccessMark, Summary, type Tone } from "./proposed";

/* Proposed failure and warning language: the same mark and weights as success.
   - Error (red cross): the act did not happen, or was refused.
   - Warning (amber !): it happened with a catch, or something needs a look. Used only
     where today is already a warning.
   - Neutral (grey ring, the act's own icon): a gate, a question, a dead end. Not news.
   Error toasts stay until closed; warning and neutral toasts last 2.75s and go on any click. */

type Icon = React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;

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
  icon,
  title,
  children,
  action,
  still,
}: {
  tone: Tone;
  icon?: Icon;
  title?: string;
  children: React.ReactNode;
  action?: string;
  /** Every note after the first in a view arrives without motion. */
  still?: boolean;
}) {
  return (
    <div className={(still ? "" : "sb-rise ") + "relative flex items-center gap-3 overflow-hidden rounded-lg bg-card py-3 pr-3 pl-4 ring-1 ring-hairline"}>
      <Rail tone={tone} />
      {/* With a title: centred on the title and the first body line. */}
      <span className={title ? "mt-[7px] self-start" : "self-center"}><SuccessMark size={26} tone={tone} icon={icon} still={still} /></span>
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

/** The press points at what is missing, where it is missing (Submit points at missing). */
/** Press Send for signing to try it. First press: the field's red ring grows in and the
    line drops out from under it. Every press after that, while it is still empty, the
    field gives one small shake and the line plays again, so a repeat press is never
    met with nothing. */
export function BlockToastNext() {
  const [presses, setPresses] = React.useState(1);
  return (
    <Screen height={420} scrim={false}>
      <div className="absolute inset-0 bg-background" />
      <div className="relative flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        <Field data-invalid>
          <FieldLabel className="text-body font-semibold">Order text</FieldLabel>
          <div key={`f${presses}`} className={presses > 1 ? "sb-shake" : ""} style={presses > 1 ? { animationDelay: "0ms" } : undefined}>
            <Textarea aria-invalid className="sb-ringin min-h-40 rounded-lg text-body" />
          </div>
          <ErrLine key={`e${presses}`}>Type the order before sending it for signing.</ErrLine>
        </Field>
        <div className="flex items-center justify-end gap-3" onPointerDown={(e) => e.stopPropagation()}>
          <span className="text-caption text-muted-foreground">Press again to see the repeat</span>
          <Button onClick={() => setPresses((n) => n + 1)}>Send for signing</Button>
        </div>
      </div>
    </Screen>
  );
}

/** A gate is not a warning: nothing is wrong yet, the step just is not open. */
export const GateToastNext = () => (
  <ToastOnPage><ConfirmToast tone="neutral" icon={LockIcon} title="The court fee opens once every signature and oath is in." /></ToastOnPage>
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

/** The person and their ID side by side, so the card uses its width; reason under both. */
export function RejectedNext() {
  return (
    <Screen height={640}>
      <DialogBox width={672}>
        <Hero compact tone="error" title="Advocate registration rejected" />
        <Facts>
          <Summary tone="error" label="Account rejected">
            <div className="grid grid-cols-[1fr_auto] items-center gap-6 py-4">
              <div className="flex min-w-0 flex-col items-start gap-1">
                <Badge variant="secondary">Advocate</Badge>
                <p className="text-title-s font-semibold">Meera Nair</p>
                <p className="font-mono text-body-compact text-muted-foreground">KL-ADV-123456-2026</p>
              </div>
              <IdCard />
            </div>
            <div className="border-t border-hairline py-3">
              <p className="text-caption font-medium text-muted-foreground">Reason</p>
              <p className="text-body-compact">The name entered does not match the Bar Council record. Please check and submit again.</p>
            </div>
          </Summary>
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

/** One line per outcome, each with its own mark, and a tally bar that shows the split at a
    glance. The hero says only what fully happened (all three are signed). */
function Tally({ ok, bad, okLine, badLine, label }: { ok: number; bad: number; okLine: string; badLine: string; label: string }) {
  return (
    <Summary label={label} aside={<span className="text-body-compact tabular-nums text-muted-foreground">{ok} of {ok + bad}</span>}>
      <div className="flex gap-1 pt-3">
        {Array.from({ length: ok }).map((_, i) => <span key={`o${i}`} className="sb-fill h-2 flex-1 rounded-full bg-success" style={{ animationDelay: `${300 + i * 80}ms` }} />)}
        {/* The failed share carries fine stripes, so it does not rely on colour alone. */}
        {Array.from({ length: bad }).map((_, i) => (
          <span
            key={`b${i}`}
            className="sb-fill h-2 flex-1 rounded-full"
            style={{
              animationDelay: `${300 + (ok + i) * 80}ms`,
              background: "repeating-linear-gradient(45deg, var(--warning) 0 3px, color-mix(in oklab, var(--warning) 62%, var(--card)) 3px 5px)",
            }}
          />
        ))}
      </div>
      <ul className="flex flex-col py-1">
        <li className="flex items-center gap-2.5 border-b border-hairline py-2.5"><SuccessMark size={20} delay={520} /> <span className="text-body-compact">{okLine}</span></li>
        <li className="flex items-center gap-2.5 py-2.5"><SuccessMark size={20} tone="warning" delay={680} /> <span className="text-body-compact font-semibold">{badLine}</span></li>
      </ul>
    </Summary>
  );
}

export function PartialCalloutNext() {
  return (
    <Screen height={540}>
      <DialogBox width={448} close={false}>
        <Hero compact title="3 processes signed" />
        <Facts>
          <Tally label="Sent" ok={2} bad={1} okLine="2 are now in Sent in Service." badLine="1 could not be sent and is in Errored in Issuance." />
        </Facts>
        <Footer>
          <Button variant="outline">Download 3 documents</Button>
          <Button>Done</Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

/** The viewer stays open: the footer states both acts, each with its own mark. */
export function PartialFooterNext() {
  return (
    <Screen height={500}>
      <DialogBox width={760}>
        <div className="flex shrink-0 border-b border-hairline p-6 pr-16"><h2 className="text-title-s font-semibold">Summons · ST/0412/2026</h2></div>
        <div className="flex h-60 items-center justify-center bg-card"><div className="h-52 w-40 rounded border border-hairline bg-surface-sunken" /></div>
        <div className="flex items-center gap-4 border-t border-hairline bg-card px-6 py-4">
          <ul className="mr-auto flex flex-col gap-1.5">
            <li className="flex items-center gap-2.5"><SuccessMark size={20} /><span className="text-body-compact font-semibold">Process signed.</span></li>
            <li className="sb-rise flex items-center gap-2.5" style={{ animationDelay: "200ms" }}><SuccessMark size={20} tone="warning" delay={260} /><span className="text-body-compact font-semibold">1 could not be sent and is in Errored in Issuance.</span></li>
          </ul>
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
        <InlineNote tone="neutral" icon={SearchXIcon}>No case matches this number. Check your summons, or the case may not be in the system yet.</InlineNote>
      </div>
    </div>
  );
}

export const FloatingWarningNext = () => (
  <ToastOnPage><ConfirmToast tone="warning" title="2 required documents still needed" /></ToastOnPage>
);

/* --------------------------------------------------------- confirm dialogs */

/** A confirm is a question, not an outcome, so it never wears the cross or "!".
    The mark shows the act; the danger lives in the button, in today's soft red.
    "Cannot be undone / reversed" gets its own line with a lock, so it is read, not skimmed. */
function ConfirmBox({
  danger,
  icon,
  title,
  body,
  note,
  children,
}: {
  danger?: boolean;
  icon: Icon;
  title: string;
  body: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogBox width={420} close={false}>
      <div className="flex items-start gap-4 p-6">
        <SuccessMark size={40} tone={danger ? "danger" : "neutral"} icon={icon} />
        <div className="flex min-w-0 flex-col gap-1.5 pt-1">
          <h2 className="text-body font-semibold text-balance">{title}</h2>
          <p className="text-body-compact text-pretty text-muted-foreground">{body}</p>
          {note ? (
            <p className="mt-1 flex items-center gap-1.5 text-body-compact font-medium text-foreground">
              <LockIcon className="size-3.5 shrink-0" />{note}
            </p>
          ) : null}
        </div>
      </div>
      <Footer>{children}</Footer>
    </DialogBox>
  );
}

export const ConfirmRemoveNext = () => (
  <Screen height={420}>
    <ConfirmBox danger icon={UserXIcon} title="Remove Rahul from your office?" body="They will lose access to 14 cases immediately and leave your office. You can add them again at any time.">
      <Button variant="outline">Cancel</Button>
      <Button variant="destructive">Remove from office</Button>
    </ConfirmBox>
  </Screen>
);

export const ConfirmDiscardNext = () => (
  <Screen height={420}>
    <ConfirmBox danger icon={Trash2Icon} title="Discard this draft?" body="Its text and order data are removed, and it leaves Pending orders. Nothing is issued or recorded on the case." note="This cannot be undone.">
      <Button variant="outline">Keep the draft</Button>
      <Button variant="destructive">Discard draft</Button>
    </ConfirmBox>
  </Screen>
);

export const ConfirmSignNext = () => (
  <Screen height={420}>
    <ConfirmBox icon={PenLineIcon} title="Sign 8 orders?" body="Your signature issues each order. Its order data is triggered once it is complete — at once, for any the steno has already completed." note="This cannot be reversed.">
      <Button variant="outline">Back</Button>
      <Button>Sign</Button>
    </ConfirmBox>
  </Screen>
);

/* ------------------------------------------------------------- field errors */

/** Field errors stay light: a 14px outline cross, no disc. Heroes and toasts carry the
    solid marks; a long form with several errors should not fill with red discs. */
/* The words appear at once, so they can be read at once; the icon alone carries the
   motion, with the same scale-in as the small marks. */
function ErrLine({ children, still }: { children: React.ReactNode; still?: boolean }) {
  /* The room opens and the cross and the words drop in together, as one line. */
  const line = (
    <FieldError className={(still ? "" : "sb-errdrop ") + "flex items-center gap-1.5 pt-0.5 text-destructive-ink"}>
      <CircleXIcon className="size-3.5 shrink-0" strokeWidth={2.4} />
      <span>{children}</span>
    </FieldError>
  );
  return still ? line : <div className="sb-reveal"><div>{line}</div></div>;
}

export function FieldErrorsNext() {
  return (
    <div className="flex w-[820px] shrink-0 flex-col gap-6 rounded-lg border border-hairline bg-background p-8">
      {/* Rejected input: the first invalid field takes focus and shakes once. The rest
          are marked, still. */}
      <Field data-invalid>
        <FieldLabel>Full name <span className="text-destructive">*</span></FieldLabel>
        <div className="sb-shake"><Input aria-invalid defaultValue="" className="ring-3 ring-destructive/20" /></div>
        <ErrLine>Enter your name as it appears on your ID.</ErrLine>
      </Field>
      <Field data-invalid>
        <FieldLabel className="text-body-compact font-medium">Why are you sending this back?</FieldLabel>
        <Textarea aria-invalid className="min-h-24 text-body-compact" />
        <ErrLine still>Write a reason first.</ErrLine>
      </Field>
      <Field data-invalid>
        <FieldLabel>PIN code</FieldLabel>
        <Input aria-invalid defaultValue="6820" />
        <ErrLine still>PIN codes are 6 digits.</ErrLine>
      </Field>
    </div>
  );
}

/* --------------------------------------------------------- dead ends, pages */

function DeadEnd({ icon, title, body, action }: { icon: Icon; title: string; body: string; action?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 text-center">
      <SuccessMark size={56} tone="neutral" icon={icon} />
      <p className="sb-rise text-title-s font-semibold" style={{ animationDelay: "150ms" }}>{title}</p>
      <p className="sb-rise max-w-md text-body text-muted-foreground" style={{ animationDelay: "210ms" }}>{body}</p>
      {action ? <Button variant="outline" className="mt-3">{action}</Button> : null}
    </div>
  );
}

export function DeadEndNext() {
  return (
    <Screen height={480} scrim={false}>
      <div className="absolute inset-0 bg-background" />
      <div className="relative w-full max-w-xl rounded-xl border border-hairline bg-card py-12 shadow-raised">
        <DeadEnd icon={FileTextIcon} title="This task is not here" body="It may have been reset with the sandbox, or the link is wrong." action="Back to tasks" />
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
          <SuccessMark size={56} tone="neutral" icon={LinkIcon} />
          <h1 className="sb-rise text-title font-semibold text-balance" style={{ animationDelay: "150ms" }}>This link is no longer active</h1>
          <p className="sb-rise text-body text-muted-foreground" style={{ animationDelay: "210ms" }}>
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
      <InlineNote tone="info" icon={FileQuestionIcon} title="We could not load your case">Your case number and hearing date are on your summons.</InlineNote>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-hairline bg-card p-6 text-center">
        <SuccessMark size={44} tone="neutral" icon={FileXIcon} />
        <p className="text-body-compact text-muted-foreground">This document could not be shown. Try downloading it instead.</p>
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-title font-semibold text-balance">Your registration was not approved</h1>
        <p className="text-body text-muted-foreground">Correct your details and resubmit for approval.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ warning marks */

const Dot = ({ tone }: { tone: "error" | "warning" }) => <SuccessMark size={16} tone={tone} />;

/* A 16px disc in a 24px pill: 4px from the top, the bottom and the end (3px padding
   plus the badge's 1px border), so the disc is concentric with the pill's rounded end. */
const PILL = "gap-1.5 pl-[3px]";

export function WarnMarksNext() {
  return (
    <div className="flex w-[820px] shrink-0 flex-wrap items-center gap-4 rounded-lg border border-hairline bg-background p-8">
      <Badge variant="destructive" className={"sb-chip " + PILL}><Dot tone="error" />Overdue</Badge>
      <Badge variant="warning" className={"sb-chip " + PILL}><Dot tone="warning" />Due today</Badge>
      <Badge variant="warning" className={"sb-chip " + PILL}><Dot tone="warning" />Pending review</Badge>
      <Badge variant="warning" className={"sb-chip " + PILL}><Dot tone="warning" />3 actions to take</Badge>
      <span className="inline-flex items-center gap-1.5 text-body-compact font-medium text-destructive-ink"><Dot tone="error" />4 days overdue</span>
      <span className="flex items-center gap-2 text-body-compact"><Badge variant="warning" className={PILL}><Dot tone="warning" />Errored</Badge><span className="text-muted-foreground">No response from ICOPS</span></span>
      <span className="flex items-center gap-1.5 text-caption font-medium text-warning-ink"><Dot tone="warning" />Incomplete</span>
      <span className="flex items-center gap-1.5 text-body-compact text-destructive-ink"><Dot tone="error" />Couldn&apos;t save. Retrying</span>
    </div>
  );
}

/* =================================================== states missing today */
/* Copy here is new and marked as draft on the board: there is nothing to keep. */

export function PayDeclinedNext() {
  return (
    <Screen height={520}>
      <DialogBox width={512}>
        <Hero compact tone="error" title="Payment did not go through" body="Nothing was paid. You can try again now, or pay later from Take action." />
        <Facts>
          <Summary>
            <FactRows rows={[["Fee", "Court fee"], ["Amount", "₹1,250"], ["Reference", "PAY-55107"]]} />
          </Summary>
        </Facts>
        <Footer>
          <Button variant="outline">Pay later</Button>
          <Button>Try again</Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

function OtpSlots({ value, invalid }: { value: string; invalid?: boolean }) {
  return (
    <div className={"flex w-full max-w-sm overflow-hidden rounded-lg border " + (invalid ? "border-destructive ring-3 ring-destructive/20" : "border-input")}>
      {value.split("").map((d, i) => (
        <span key={i} className="flex h-12 flex-1 items-center justify-center border-r border-input text-body font-semibold last:border-r-0">{d}</span>
      ))}
    </div>
  );
}

export function OtpWrongNext() {
  return (
    <div className="flex h-[420px] w-[820px] shrink-0 items-center justify-center rounded-lg border border-hairline bg-background p-8">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-lg bg-surface-sunken p-4">
        <Field data-invalid>
          <FieldDescription>We sent a code to +91 98••• ••210.</FieldDescription>
          <div className="sb-shake"><OtpSlots value="482913" invalid /></div>
          <ErrLine>That code is not right. Check the SMS and try again.</ErrLine>
        </Field>
        <p className="text-body-compact text-muted-foreground">Resend code in 0:24</p>
      </div>
    </div>
  );
}

export function OtpExpiredNext() {
  return (
    <div className="flex h-[420px] w-[820px] shrink-0 items-center justify-center rounded-lg border border-hairline bg-background p-8">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-lg bg-surface-sunken p-4">
        <Field data-invalid>
          <FieldDescription>We sent a code to +91 98••• ••210.</FieldDescription>
          <OtpSlots value="482913" invalid />
          <ErrLine>This code has expired.</ErrLine>
        </Field>
        <Button variant="link" className="h-auto self-start p-0">Send a new code</Button>
      </div>
    </div>
  );
}

export function BatchPartialNext() {
  return (
    <Screen height={540}>
      <DialogBox width={448} close={false}>
        <Hero compact title="3 documents signed" />
        <Facts>
          <Tally label="Signed" ok={3} bad={1} okLine="3 are signed and ready to pay." badLine="1 was not signed. Open it from this tab to try again." />
        </Facts>
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function DscMissingNext() {
  return (
    <div className="flex h-[420px] w-[820px] shrink-0 items-center rounded-lg border border-hairline bg-background p-8">
      <div className="w-full">
        <InlineNote tone="error" title="No certificate found on this computer" action="Try again">
          Plug in your DSC token, then try again. Or sign with Aadhaar OTP instead.
        </InlineNote>
      </div>
    </div>
  );
}

export function NotFoundNext() {
  return (
    <Screen height={480} scrim={false}>
      <div className="absolute inset-0 bg-background" />
      <DeadEnd icon={FileQuestionIcon} title="This page is not here" body="The link may be wrong, or the page has moved." action="Go to home" />
    </Screen>
  );
}

export function PageErrorNext() {
  return (
    <Screen height={480} scrim={false}>
      {/* Same soft glow as the success page, in the error tint. */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 32%, color-mix(in oklab, var(--destructive-muted) 45%, var(--background)), var(--background) 55%)" }} />
      <div className="relative flex flex-col items-center gap-3 px-6 text-center">
        <SuccessMark size={56} tone="error" />
        <p className="sb-rise text-title-s font-semibold" style={{ animationDelay: "150ms" }}>This page could not load</p>
        <p className="sb-rise max-w-md text-body text-muted-foreground" style={{ animationDelay: "210ms" }}>Nothing was changed. Reload to try again.</p>
        <Button className="mt-3">Reload</Button>
      </div>
    </Screen>
  );
}

export { FactRows };
