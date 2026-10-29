"use client";

import * as React from "react";
import { ArchiveIcon, ArrowRightIcon, CheckIcon, DownloadIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";

import { DialogBox, FauxPage, Screen } from "./frames";

/* Proposed success language. One mark, three weights:
   1. Takeover      — the dialog's top becomes the confirmation (consequential acts).
   2. Confirm toast — a real object on the page, not a tint (quick acts).
   3. Landing       — the row that changed glows once when the dialog closes onto it.
   Built only from DS tokens; motion respects prefers-reduced-motion. */

export const PROPOSED_CSS = `
@keyframes sb-pop { 0% { transform: scale(.55); opacity: 0 } 60% { transform: scale(1.06); opacity: 1 } 100% { transform: scale(1) } }
@keyframes sb-draw { from { stroke-dashoffset: 30 } to { stroke-dashoffset: 0 } }
@keyframes sb-ring { 0% { transform: scale(1); opacity: .45 } 100% { transform: scale(1.9); opacity: 0 } }
@keyframes sb-rise { from { transform: translateY(8px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes sb-band { from { opacity: 0 } to { opacity: 1 } }
@keyframes sb-toast { 0% { transform: translateY(24px) scale(.96); opacity: 0 } 70% { transform: translateY(-2px) scale(1); opacity: 1 } 100% { transform: none } }
@keyframes sb-drain { from { transform: scaleX(1) } to { transform: scaleX(0) } }
@keyframes sb-land { 0%,35% { background: var(--success-muted); box-shadow: inset 3px 0 0 var(--success) } 100% { background: transparent; box-shadow: inset 3px 0 0 transparent } }
@keyframes sb-flip { 0%,35% { transform: rotate(0) } 100% { transform: rotate(180deg) } }
@keyframes sb-chip { from { transform: scale(.88); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes sb-shake { 0%,100% { transform: none } 20%,60% { transform: translateX(-3px) } 40%,80% { transform: translateX(3px) } }
@keyframes sb-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
.sb-pop { animation: sb-pop 520ms cubic-bezier(.34,1.56,.64,1) both }
.sb-draw { stroke-dasharray: 30; animation: sb-draw 360ms 260ms cubic-bezier(.65,0,.35,1) both }
.sb-ring { animation: sb-ring 900ms 200ms ease-out both }
.sb-rise { animation: sb-rise 360ms cubic-bezier(.2,.8,.2,1) both }
.sb-band { animation: sb-band 300ms ease-out both }
.sb-toast { animation: sb-toast 420ms cubic-bezier(.2,.8,.2,1) both }
.sb-drain { transform-origin: left; animation: sb-drain 4s linear both }
.sb-land { animation: sb-land 2600ms ease-out both }
.sb-flip { transform-box: fill-box; transform-origin: center; animation: sb-flip 900ms 250ms cubic-bezier(.65,0,.35,1) both }
.sb-chip { animation: sb-chip 220ms cubic-bezier(.2,.8,.2,1) both }
.sb-shake { animation: sb-shake 380ms 520ms ease-in-out both }
.sb-fill { transform-origin: left; animation: sb-fill 700ms cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) {
  .sb-pop, .sb-draw, .sb-ring, .sb-rise, .sb-band, .sb-toast, .sb-drain, .sb-land, .sb-fill, .sb-flip, .sb-chip, .sb-shake { animation: none }
  .sb-ring { opacity: 0 }
}
`;

export type Tone = "success" | "info" | "error" | "warning";
const TONE: Record<Tone, { solid: string; fg: string; muted: string; edge: string }> = {
  error: { solid: "var(--destructive)", fg: "var(--destructive-foreground)", muted: "var(--destructive-muted)", edge: "var(--destructive-7)" },
  warning: { solid: "var(--warning)", fg: "var(--warning-foreground)", muted: "var(--warning-muted)", edge: "var(--warning-7)" },
  success: { solid: "var(--success)", fg: "var(--success-foreground)", muted: "var(--success-muted)", edge: "var(--success-7)" },
  info: { solid: "var(--info)", fg: "var(--info-foreground)", muted: "var(--info-muted)", edge: "var(--info-7)" },
};

/** The one mark, in four tones. Success: drawn check and one ring pulse. Error: drawn
    cross and a small shake, no pulse (nothing to celebrate). Warning: drawn "!".
    Info (sent, not decided): today's hourglass, turned over once. */
export function SuccessMark({ size = 72, tone = "success" }: { size?: number; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <span className={"relative flex shrink-0 items-center justify-center " + (tone === "error" ? "sb-shake" : "")} style={{ width: size, height: size }}>
      {tone === "success" ? <span className="sb-ring absolute inset-0 rounded-full" style={{ background: t.solid }} /> : null}
      <span
        className="sb-pop relative flex size-full items-center justify-center rounded-full shadow-raised"
        style={{ background: t.solid, color: t.fg }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {tone === "success" ? (
            <path className="sb-draw" d="M5 12.5l4.5 4.5L19 7.5" />
          ) : tone === "error" ? (
            <path className="sb-draw" d="M7.5 7.5l9 9M16.5 7.5l-9 9" />
          ) : tone === "warning" ? (
            <path className="sb-draw" strokeWidth={3} d="M12 6.5v7M12 17.5v.01" />
          ) : (
            /* Sent, not decided: the same hourglass as today, turned over once. */
            <g className="sb-flip" strokeWidth={2.2}>
              <path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" />
            </g>
          )}
        </svg>
      </span>
    </span>
  );
}

export function Hero({
  title,
  body,
  compact,
  tone = "success",
  children,
}: {
  title: React.ReactNode;
  body?: React.ReactNode;
  compact?: boolean;
  tone?: Tone;
  children?: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div
      className={"sb-band relative flex shrink-0 flex-col items-center gap-4 border-b text-center " + (compact ? "px-6 pt-8 pb-6" : "px-10 pt-10 pb-8")}
      style={{ borderColor: t.edge, background: `linear-gradient(180deg, ${t.muted} 0%, color-mix(in oklab, ${t.muted} 55%, var(--popover)) 100%)` }}
    >
      <SuccessMark size={compact ? 60 : 72} tone={tone} />
      <div className="flex max-w-md flex-col items-center gap-1.5">
        <h2 className={"sb-rise font-semibold text-balance text-foreground " + (compact ? "text-title-s" : "text-title")} style={{ animationDelay: "180ms" }}>
          {title}
        </h2>
        {body ? (
          <p className="sb-rise text-body text-pretty text-muted-foreground" style={{ animationDelay: "240ms" }}>
            {body}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export const Row = ({ term, children }: { term: string; children: React.ReactNode }) => (
  <DescriptionRow className="border-hairline">
    <DescriptionTerm>{term}</DescriptionTerm>
    <DescriptionDetails className="tabular-nums">{children}</DescriptionDetails>
  </DescriptionRow>
);

export const Facts = ({ children, className = "px-6 py-4" }: { children: React.ReactNode; className?: string }) => (
  <div className={"sb-rise " + className} style={{ animationDelay: "320ms" }}>
    {children}
  </div>
);

export const Footer = ({ children, between }: { children: React.ReactNode; between?: boolean }) => (
  <footer className={"flex items-center gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 " + (between ? "justify-between" : "justify-end")}>
    {children}
  </footer>
);

/** The facts under a hero, grouped so they read as one summary with a name. */
export const Summary = ({
  label,
  aside,
  tone,
  children,
}: {
  label?: string;
  aside?: React.ReactNode;
  /** "success": the label is the outcome itself, so it carries the success ink. */
  tone?: "success" | "error" | "warning";
  children: React.ReactNode;
}) => (
  <div className="overflow-hidden rounded-xl bg-surface-sunken">
    {label ? (
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
        <span className={"text-body-compact font-semibold " + (tone === "success" ? "text-success-ink" : tone === "error" ? "text-destructive-ink" : tone === "warning" ? "text-warning-ink" : "")}>{label}</span>
        {aside}
      </div>
    ) : null}
    <div className="px-4 py-1">{children}</div>
  </div>
);

const Mono = ({ children }: { children: React.ReactNode }) => <span className="font-mono text-body-compact">{children}</span>;

/* ================================================================ toasts */

/** Straight accent bar, full height and flush left. The card's rounded corners clip its
    ends, so it reads as a straight edge cut by the radius, never one that bends. */
export const Rail = ({ tone = "success" }: { tone?: "success" | "muted" | "error" | "warning" }) => (
  <span
    aria-hidden
    className={
      "absolute inset-y-0 left-0 w-[3px] " +
      (tone === "success" ? "bg-success" : tone === "error" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-muted-foreground/50")
    }
  />
);

export function ConfirmToast({
  title,
  description,
  action,
  neutral,
  tone = neutral ? "neutral" : "success",
}: {
  title: string;
  description?: string;
  action?: string;
  neutral?: boolean;
  /** error: stays until closed (no timer) and carries a close button. */
  tone?: "success" | "neutral" | "error" | "warning";
}) {
  const persistent = tone === "error";
  return (
    <div className="sb-toast relative flex w-[380px] items-center gap-2.5 overflow-hidden rounded-lg bg-popover py-3 pr-3 pl-4 text-popover-foreground shadow-overlay ring-1 ring-hairline">
      <Rail tone={tone === "neutral" ? "muted" : tone} />
      {/* One block of text: the icon sits in its middle. With a detail line: centred on
          the title and the detail's first line (20 + 2 + 20 = 42, so 21px down). */}
      <span className={description ? "mt-[8px] self-start" : "self-center"}>
        {tone === "neutral" ? (
          <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-surface-sunken text-foreground/75 ring-1 ring-foreground/35">
            <ArchiveIcon className="size-3.5" />
          </span>
        ) : (
          <span className="flex size-[26px] items-center justify-center"><SuccessMark size={22} tone={tone} /></span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-compact font-semibold">{title}</p>
        {description ? <p className="text-body-compact text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <Button size="xs" variant="outline">{action}</Button> : null}
      {persistent ? (
        <span className="flex size-7 shrink-0 items-center justify-center self-start text-muted-foreground"><XIcon className="size-4" /></span>
      ) : (
        /* Same 4s life the toasts have today (Sonner's default). */
        <span
          className={
            "sb-drain absolute inset-x-0 bottom-0 h-[2px] " +
            (tone === "neutral" ? "bg-muted-foreground/30" : tone === "warning" ? "bg-warning/60" : "bg-success/60")
          }
        />
      )}
    </div>
  );
}

function ToastOnPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[420px] w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background">
      <FauxPage />
      <div className="absolute inset-x-0 bottom-[56px] flex justify-center pl-44">{children}</div>
    </div>
  );
}

export const ToastTitleAfter = () => (
  <ToastOnPage><ConfirmToast title="Access given to Adv. Meera Nair" /></ToastOnPage>
);
export const ToastLongAfter = () => (
  <ToastOnPage><ConfirmToast title="Order KL-ORD-0412 signed. The application is accepted." /></ToastOnPage>
);
export const ToastNeutralAfter = () => (
  <ToastOnPage><ConfirmToast neutral title="Task archived" description="Pay court fee. You can find it under Take action, Archive." action="Undo" /></ToastOnPage>
);

/* ===================================================== takeover dialogs */

export function TintedWideAfter() {
  return (
    <Screen height={600}>
      <DialogBox width={672}>
        <Hero title="Bail application submitted" body="The court has received your application. You will be told by SMS when a decision is made." />
        <Facts>
          <DescriptionList>
            <Row term="Submitted on">24-08-2026</Row>
            <Row term="Submission ID"><Mono>KL-000847-2026-AP1</Mono></Row>
            <Row term="Court fee">₹50 paid</Row>
          </DescriptionList>
        </Facts>
        <Footer between>
          <Button variant="outline"><DownloadIcon data-icon="inline-start" />Download application</Button>
          <Button>Done</Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

export function TintedCompactAfter() {
  return (
    <Screen height={420}>
      <DialogBox width={448}>
        <Hero compact title="Document submitted" body="Signed with Aadhaar OTP. It is on the case record now. Everyone on the case can see it." />
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function TintedInfoAfter() {
  return (
    <Screen height={420}>
      <DialogBox width={448}>
        <Hero compact tone="info" title="Application sent to the magistrate" body="Signed with Aadhaar OTP. Adv. R. Pillai stays on the case until the order is passed." />
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

const Signer = ({ name, role, you }: { name: string; role: string; you?: boolean }) => (
  <li className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-b-0">
    <div className="min-w-0 flex-1">
      <p className="text-body-compact font-semibold">
        {name}
        {you ? <span className="ps-2 font-medium text-muted-foreground">You</span> : null}
      </p>
      <p className="text-body-compact text-muted-foreground">{role}</p>
    </div>
    <Badge variant="success"><CheckIcon />Signed</Badge>
  </li>
);

export function StripSignAfter() {
  return (
    <Screen height={620}>
      <DialogBox width={672}>
        <Hero title="Everyone has signed" body="You can pay the court fee now." />
        <Facts>
          <Summary tone="success" label="Every signature is in" aside={<Badge variant="success"><CheckIcon />3 of 3 signed</Badge>}>
            <ul className="flex flex-col">
              <Signer name="Adv. Meera Nair" role="Advocate for complainant" you />
              <Signer name="Suresh Kumar" role="Complainant" />
              <Signer name="Anita Kumar" role="Power of attorney holder" />
            </ul>
          </Summary>
        </Facts>
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function StripJoinAfter() {
  return (
    <Screen height={620}>
      <DialogBox width={576}>
        <Hero title="You have joined this case" body="You can now read the complaint and act in the case as Suresh Kumar." />
        <Facts>
          <Summary tone="success" label="Joined as Suresh Kumar">
            <div className="flex flex-col gap-0.5 py-3">
              <p className="text-body font-semibold">Suresh Kumar vs. Rajan Traders</p>
              <p className="text-body-compact text-muted-foreground">ST/0412/2026 · Complaint, S-138 NI Act</p>
            </div>
          </Summary>
          <p className="pt-3 text-body-compact text-muted-foreground">Next, give your advocate your access code (7Q4-K2M) or your summons.</p>
        </Facts>
        <Footer between>
          <Button variant="outline">Back to home</Button>
          <Button>View case<ArrowRightIcon data-icon="inline-end" /></Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

export function SlabAfter() {
  return (
    <Screen height={620}>
      <DialogBox width={512} close={false}>
        <Hero title="Payment successful" body="Your case file is complete.">
          <div className="sb-rise flex flex-col items-center pt-2" style={{ animationDelay: "280ms" }}>
            <span className="text-caption font-medium text-muted-foreground">Amount paid</span>
            <span className="text-title-s font-semibold tabular-nums">₹1,250</span>
          </div>
        </Hero>
        <Facts>
          <Summary>
            <DescriptionList>
              <Row term="Case file number">KL-000847-2026</Row>
              <Row term="Payment reference"><Mono>PAY-55102</Mono></Row>
            </DescriptionList>
          </Summary>
        </Facts>
        <div className="flex gap-3 px-6 pb-6">
          <Button variant="outline" size="lg" className="flex-1">Back to dashboard</Button>
          <Button variant="outline" size="lg" className="flex-1">Print or save as PDF</Button>
        </div>
      </DialogBox>
    </Screen>
  );
}

export function PanelAfter() {
  return (
    <Screen height={440}>
      <DialogBox width={448}>
        <Hero compact title="4 documents signed" body="One OTP covered the set, the same as signing one at a time." />
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function BandAfter() {
  return (
    <Screen height={580}>
      <DialogBox width={512}>
        <Hero compact title="8 forms signed" body="They have left the signing queue." />
        <Facts>
          <Summary>
            <DescriptionList>
              <Row term="Form 12 notices">5</Row>
              <Row term="Warrants">3</Row>
              <Row term="Cases">6 cases</Row>
            </DescriptionList>
          </Summary>
        </Facts>
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function CalloutAfter() {
  return (
    <Screen height={420}>
      <DialogBox width={360} close={false}>
        <Hero compact title="12 covers posted" body="They are now in In progress in Service." />
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function ReceiptAfter() {
  return (
    <Screen height={600}>
      <DialogBox width={512}>
        <Hero compact title="Payment successful" body="Suresh Kumar vs. Rajan Traders · ST/0412/2026">
          <div className="sb-rise flex flex-col items-center pt-2" style={{ animationDelay: "280ms" }}>
            <span className="text-caption font-medium text-muted-foreground">Amount paid</span>
            <span className="text-title-s font-semibold tabular-nums">₹50</span>
          </div>
        </Hero>
        <Facts>
          <Summary>
            <DescriptionList>
              <Row term="Fee">Application fee</Row>
              <Row term="Receipt"><Mono>RCPT-88213</Mono></Row>
            </DescriptionList>
          </Summary>
        </Facts>
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function CentredAfter() {
  return (
    <Screen height={560}>
      <DialogBox width={672}>
        <Hero title="Forwarded for registration" body="On Register cases as CMP — Complaint." />
        <div className="flex-1" />
        <Footer>
          <Button variant="outline">Stay here</Button>
          <Button>Next file<ArrowRightIcon data-icon="inline-end" /></Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

export function BadgeSwapAfter() {
  return (
    <Screen height={500}>
      <DialogBox width={512}>
        <Hero compact title="Complaint registered" body="The complaint is on the register. It appears in the court's case list from today." />
        <Facts>
          <Summary>
            <div className="flex flex-col gap-0.5 py-3">
              <p className="text-body-compact font-semibold">Suresh Kumar vs. Rajan Traders</p>
              <p className="font-mono text-body-compact text-muted-foreground">KL-000847-2026</p>
            </div>
          </Summary>
        </Facts>
        <Footer>
          <Button variant="ghost">Back to register cases</Button>
          <Button>Next complaint</Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

export function TitleBannerAfter() {
  return (
    <Screen height={480}>
      <DialogBox width={512}>
        <Hero compact title="Payment complete" body="Court fee of ₹20 paid. The application is submitted." />
        <Facts>
          <Summary label="Application for exemption">
            <dl className="flex flex-col text-body-compact">
              <div className="flex justify-between py-2.5"><dt>Court fee</dt><dd>₹20</dd></div>
              <div className="flex justify-between border-t border-hairline py-2.5 font-semibold"><dt>Total paid</dt><dd>₹20</dd></div>
            </dl>
          </Summary>
        </Facts>
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function TextOnlyAfter() {
  return (
    <Screen height={480}>
      <DialogBox width={400} close={false}>
        <Hero compact title="Sent for signing" body="It is in Pending orders, awaiting the magistrate." />
        <Facts>
          <Summary label="Next draft">
            <p className="py-3 text-body-compact">Order on bail, ST/0388/2026.</p>
          </Summary>
        </Facts>
        <Footer>
          <Button variant="outline">Back to Pending orders</Button>
          <Button>Next draft</Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

/** A viewer dialog stays open: the footer itself becomes the confirmation. */
export function FooterLineAfter() {
  return (
    <Screen height={480}>
      <DialogBox width={760}>
        <div className="flex shrink-0 flex-col gap-2 border-b border-hairline p-6 pr-16">
          <h2 className="text-title-s font-semibold">Summons · ST/0412/2026</h2>
        </div>
        <div className="flex h-64 items-center justify-center bg-card">
          <div className="h-56 w-44 rounded border border-hairline bg-surface-sunken" />
        </div>
        <div
          className="sb-band flex items-center gap-3 border-t px-6 py-4"
          style={{ borderColor: "var(--success-7)", background: "var(--success-muted)" }}
        >
          <SuccessMark size={36} />
          <p className="sb-rise mr-auto flex flex-col" style={{ animationDelay: "180ms" }}>
            <span className="text-body font-semibold text-foreground">Process signed</span>
            <span className="text-body-compact text-muted-foreground">It is now in To post in Issuance.</span>
          </p>
          <Button variant="outline">Download</Button>
          <Button>Done</Button>
        </div>
      </DialogBox>
    </Screen>
  );
}

/* ================================================================= page */

export function FullPageAfter() {
  return (
    <Screen height={520} scrim={false}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, var(--success-muted), var(--background) 60%)" }} />
      <div className="relative mx-auto flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <SuccessMark size={96} />
        <div className="flex flex-col items-center gap-2">
          <h1 className="sb-rise text-display-s font-semibold text-balance" style={{ animationDelay: "180ms" }}>Your account is ready</h1>
          <p className="sb-rise text-body text-pretty text-muted-foreground" style={{ animationDelay: "240ms" }}>
            You can add your address and official ID from your profile after entering the portal.
          </p>
        </div>
        <Button size="lg" className="sb-rise" style={{ animationDelay: "320ms" }}>Go to your home page</Button>
      </div>
    </Screen>
  );
}

/* =============================================================== inline */

/** End state of a page: a banner with the same mark, title-s, and the way out. */
function PageBanner({ title, body, action }: { title: string; body: string; action?: string }) {
  return (
    <div className="sb-band flex items-center gap-4 rounded-xl border p-4" style={{ borderColor: "var(--success-7)", background: "var(--success-muted)" }}>
      <SuccessMark size={44} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="sb-rise text-title-s font-semibold text-foreground" style={{ animationDelay: "180ms" }}>{title}</p>
        <p className="sb-rise text-body-compact text-muted-foreground" style={{ animationDelay: "240ms" }}>{body}</p>
      </div>
      {action ? <Button>{action}<ArrowRightIcon data-icon="inline-end" /></Button> : null}
    </div>
  );
}

/** Inside a dialog that stays open: a white line with a small mark, not a tinted box. */
function InlineConfirm({ children }: { children: React.ReactNode }) {
  return (
    <div className="sb-rise relative flex items-center gap-3 overflow-hidden rounded-lg bg-card py-2.5 pr-3 pl-4 ring-1 ring-hairline">
      <Rail />
      <SuccessMark size={22} />
      <p className="text-body-compact font-semibold">{children}</p>
    </div>
  );
}

export function InlineAfter() {
  return (
    <div className="relative w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background p-8">
      <div className="flex flex-col gap-5">
        <PageBanner title="Vakalatnama executed" body="Fees paid and all parties signed. The instrument is sealed with its audit trail." action="Done" />
        <PageBanner title="You have signed the bail bond" body="The court will be told when everyone has signed." />
        <InlineConfirm>Access given to Adv. Meera Nair, Rahul (clerk)</InlineConfirm>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="sb-fill h-1.5 flex-1 rounded-full bg-success" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
          <InlineConfirm>All 6 corrected.</InlineConfirm>
        </div>
      </div>
    </div>
  );
}

/* ============================================================= landing */

export function SilentAfter() {
  return (
    <div className="relative h-[420px] w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background">
      <div className="absolute inset-0 flex">
        <div className="w-44 border-r border-hairline bg-card" />
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="h-6 w-64 rounded bg-surface-sunken" />
          <div className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-card">
            {["Form 12 notice", "Bail bond", "Warrant", "Deposition", "Exhibit P-4"].map((t, i) => (
              <div key={t} className={"flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-0 " + (i === 1 ? "sb-land" : "")}>
                <span className="w-48 text-body-compact font-medium">{t}</span>
                <span className="flex-1 text-body-compact text-muted-foreground">Suresh Kumar vs. Rajan Traders</span>
                {i === 1 ? (
                  <span className="sb-rise inline-flex h-6 items-center rounded-full bg-success-muted px-2 text-xs font-medium text-success-muted-foreground">Signed</span>
                ) : (
                  <span className="h-5 w-16 rounded-full bg-surface-sunken" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-[56px] flex justify-center pl-44">
        <ConfirmToast title="Bail bond signed" description="It has left the signing queue." />
      </div>
    </div>
  );
}

/* =============================================================== marks */

/** States stay small. Three changes: one tick shape everywhere; a finished button turns
    success instead of grey-disabled; and when a state flips in front of the person, the
    chip settles in (220ms) and its tick draws. Nothing moves on page load. */
export function MarksAfter() {
  const Tick = () => (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path className="sb-draw" d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
  const Dot = () => (
    <span className="sb-pop flex size-4 items-center justify-center rounded-full bg-success text-success-foreground">
      <svg viewBox="0 0 24 24" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path className="sb-draw" d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
  return (
    <div className="flex w-[820px] shrink-0 flex-wrap items-center gap-4 rounded-lg border border-hairline bg-background p-8">
      <Badge variant="success" className="sb-chip"><Tick />Signed</Badge>
      <Badge variant="success" className="sb-chip"><Tick />Done: all 24 filed</Badge>
      <Badge variant="success" className="sb-chip"><Tick />Address added</Badge>
      <span className="inline-flex items-center gap-1.5 text-body-compact text-success-ink"><Dot />Saved</span>
      <span className="flex items-center gap-1.5 text-body-compact text-success-ink"><Dot />Mobile number verified</span>
      <span className="flex items-center gap-1.5 text-caption text-success-ink"><Dot />Read · 6 fields filled in your form</span>
      <span className="sb-chip inline-flex h-11 items-center gap-2 rounded-md bg-success-muted px-5 text-body-compact font-medium text-success-muted-foreground ring-1" style={{ ["--tw-ring-color" as string]: "var(--success-7)" }}>
        <Dot />Sent to scrutiny
      </span>
      <span className="sb-pop relative flex size-8 items-center justify-center rounded-full bg-success text-success-foreground"><Tick /></span>
    </div>
  );
}
