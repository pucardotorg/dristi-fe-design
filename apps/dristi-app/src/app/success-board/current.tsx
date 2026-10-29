"use client";

import * as React from "react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleCheckIcon,
  DownloadIcon,
  HourglassIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";

import { DialogBox, FauxPage, Screen, ToastBox, ToastScreen } from "./frames";

/* Faithful redraws of today's success states, taken from main @ 90bbc31.
   Copy is sample text; markup and classes follow the source file named on each card. */

const Disc = ({ tone = "success", icon }: { tone?: "success" | "info" | "warning"; icon?: React.ReactNode }) => (
  <span
    className={
      "flex size-14 shrink-0 items-center justify-center rounded-full " +
      (tone === "success"
        ? "bg-success-muted text-success-muted-foreground"
        : tone === "info"
          ? "bg-info-muted text-info-muted-foreground"
          : "bg-warning-muted text-warning-muted-foreground")
    }
  >
    {icon ?? <CheckCircle2Icon className="size-7" />}
  </span>
);

const Row = ({ term, children }: { term: string; children: React.ReactNode }) => (
  <DescriptionRow className="border-hairline">
    <DescriptionTerm>{term}</DescriptionTerm>
    <DescriptionDetails className="tabular-nums">{children}</DescriptionDetails>
  </DescriptionRow>
);

const Mono = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-body-compact">{children}</span>
);

const Foot = ({ children, sunken }: { children: React.ReactNode; sunken?: boolean }) => (
  <footer
    className={
      "flex shrink-0 items-center justify-between gap-2 border-t border-hairline px-6 py-4 " +
      (sunken ? "bg-surface-sunken" : "")
    }
  >
    {children}
  </footer>
);

const StagedHeader = ({ title, aside, description }: { title: string; aside?: React.ReactNode; description?: string }) => (
  <div className="flex shrink-0 flex-col gap-2 border-b border-hairline p-6 pr-16">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-title-s font-semibold tabular-nums">{title}</h2>
      {aside}
    </div>
    {description ? <p className="text-body-compact text-muted-foreground">{description}</p> : null}
  </div>
);

const StagedFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="flex shrink-0 justify-end gap-2 border-t border-hairline bg-card p-6">{children}</div>
);

/* ------------------------------------------------------------------ toasts */

export function ToastSuccess() {
  return (
    <ToastScreen>
      <ToastBox tone="success" icon={<CircleCheckIcon className="size-4" />} title="Access given to Adv. Meera Nair" />
    </ToastScreen>
  );
}

export function ToastSuccessDesc() {
  return (
    <ToastScreen>
      <ToastBox
        tone="success"
        icon={<CircleCheckIcon className="size-4" />}
        title="Order KL-ORD-0412 signed. The application is accepted."
      />
    </ToastScreen>
  );
}

export function ToastNeutral() {
  return (
    <ToastScreen>
      <ToastBox
        tone="normal"
        title="Task archived"
        description="Pay court fee. You can find it under Take action, Archive."
        action="Undo"
      />
    </ToastScreen>
  );
}

/* ------------------------------------------------- A. tinted disc header */

export function TintedHeader() {
  return (
    <Screen height={560}>
      <DialogBox width={672}>
        <div className="flex shrink-0 items-center gap-4 border-b border-hairline px-6 py-5 pr-14">
          <Disc />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="text-title-s font-semibold text-balance">Bail application submitted</h2>
            <p className="text-pretty text-muted-foreground">
              The court has received your application. You will be told by SMS when a decision is made.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <DescriptionList>
            <Row term="Submitted on">24-08-2026</Row>
            <Row term="Submission ID"><Mono>KL-000847-2026-AP1</Mono></Row>
            <Row term="Court fee">₹50 paid</Row>
          </DescriptionList>
        </div>
        <Foot sunken>
          <Button variant="outline"><DownloadIcon data-icon="inline-start" />Download application</Button>
          <Button>Done</Button>
        </Foot>
      </DialogBox>
    </Screen>
  );
}

export function TintedHeaderCompact() {
  return (
    <Screen height={420}>
      <DialogBox width={448}>
        <div className="flex items-center gap-4 px-6 py-6 pr-12">
          <Disc />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="text-body font-semibold text-balance">Document submitted</h2>
            <p className="text-muted-foreground">
              Signed with Aadhaar OTP. It is on the case record now. Everyone on the case can see it.
            </p>
          </div>
        </div>
        <Foot sunken>
          <span />
          <Button>Done</Button>
        </Foot>
      </DialogBox>
    </Screen>
  );
}

export function TintedHeaderInfo() {
  return (
    <Screen height={420}>
      <DialogBox width={448}>
        <div className="flex items-center gap-4 px-6 py-6 pr-12">
          <Disc tone="info" icon={<HourglassIcon className="size-7" />} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="text-body font-semibold text-balance">Application sent to the magistrate</h2>
            <p className="text-muted-foreground">
              Signed with Aadhaar OTP. Adv. R. Pillai stays on the case until the order is passed.
            </p>
          </div>
        </div>
        <Foot sunken>
          <span />
          <Button>Done</Button>
        </Foot>
      </DialogBox>
    </Screen>
  );
}

/* --------------------------------------------- B. muted strip on a card */

function SettledCard({ headline, rows, footnote }: { headline: string; rows: React.ReactNode; footnote?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-card shadow-raised">
      <div className="flex items-center gap-2 bg-success-muted px-4 py-2.5 text-body-compact text-success-muted-foreground">
        <CircleCheckIcon className="size-4 shrink-0" />
        <span className="font-medium">{headline}</span>
      </div>
      <ul className="flex flex-col px-4">{rows}</ul>
      {footnote ? <p className="border-t border-hairline px-4 py-3 text-body-compact text-muted-foreground">{footnote}</p> : null}
    </div>
  );
}

const Signer = ({ name, role, you }: { name: string; role: string; you?: boolean }) => (
  <li className="flex items-center gap-3 border-b border-hairline py-3 last:border-b-0">
    <div className="min-w-0 flex-1">
      <p className="text-body-compact font-semibold text-foreground">
        {name}
        {you ? <span className="ps-2 font-medium text-muted-foreground">You</span> : null}
      </p>
      <p className="text-body-compact text-muted-foreground">{role}</p>
    </div>
    <Badge variant="success"><CheckIcon />Signed</Badge>
  </li>
);

export function MutedStrip() {
  return (
    <Screen height={560}>
      <DialogBox width={672}>
        <StagedHeader title="Everyone has signed" aside={<Badge variant="success"><CheckIcon />3 of 3 signed</Badge>} />
        <div className="bg-muted p-6 dark:bg-background">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
            <SettledCard
              headline="Every signature is in"
              rows={
                <>
                  <Signer name="Adv. Meera Nair" role="Advocate for complainant" you />
                  <Signer name="Suresh Kumar" role="Complainant" />
                  <Signer name="Anita Kumar" role="Power of attorney holder" />
                </>
              }
              footnote="You can pay the court fee now."
            />
          </div>
        </div>
        <StagedFooter><Button>Done</Button></StagedFooter>
      </DialogBox>
    </Screen>
  );
}

export function MutedStripJoin() {
  return (
    <Screen height={560}>
      <DialogBox width={576}>
        <div className="flex shrink-0 flex-col gap-2 border-b border-hairline p-6 pr-16">
          <h2 className="text-title-s font-semibold text-balance">You have joined this case</h2>
          <p className="text-body-compact text-muted-foreground">You can now read the complaint and act in the case as Suresh Kumar.</p>
        </div>
        <div className="flex flex-col gap-4 bg-muted p-6 dark:bg-background">
          <div className="overflow-hidden rounded-xl border border-hairline bg-card">
            <div className="flex items-center gap-2 bg-success-muted px-4 py-2.5 text-body-compact text-success-muted-foreground sm:px-6">
              <CircleCheckIcon className="size-4 shrink-0" />
              <span className="font-medium">Joined as Suresh Kumar</span>
            </div>
            <div className="flex flex-col gap-1 p-4 sm:p-6">
              <p className="text-body font-semibold">Suresh Kumar vs. Rajan Traders</p>
              <p className="text-body-compact text-muted-foreground">ST/0412/2026 · Complaint, S-138 NI Act</p>
            </div>
          </div>
          <p className="text-body-compact text-muted-foreground">Next, give your advocate your access code (7Q4-K2M) or your summons.</p>
        </div>
        <Foot>
          <Button variant="outline">Back to home</Button>
          <Button>View case<ArrowRightIcon data-icon="inline-end" /></Button>
        </Foot>
      </DialogBox>
    </Screen>
  );
}

/* --------------------------------------- C. solid slab / panel / band */

export function SolidSlab() {
  return (
    <Screen height={560}>
      <DialogBox width={512} close={false}>
        <div className="flex flex-col items-center gap-2 bg-success p-6 text-center text-success-foreground">
          <span className="flex size-12 items-center justify-center rounded-full bg-success-foreground text-success">
            <CheckIcon className="size-6" />
          </span>
          <h2 className="text-title-s font-semibold">Payment successful</h2>
          <p className="text-body-compact">Your case file is complete.</p>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-sunken p-4">
            <div>
              <p className="text-caption font-medium text-muted-foreground">Case file number</p>
              <p className="text-body font-semibold">KL-000847-2026</p>
            </div>
            <Button variant="ghost">Copy link</Button>
          </div>
          <div className="flex justify-between text-body-compact"><span className="text-muted-foreground">Amount paid</span><span className="font-semibold">₹1,250</span></div>
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1">Back to dashboard</Button>
            <Button variant="outline" size="lg" className="flex-1">Print or save as PDF</Button>
          </div>
        </div>
      </DialogBox>
    </Screen>
  );
}

export function SolidPanel() {
  return (
    <Screen height={440}>
      <DialogBox width={448} close={false} className="gap-4 p-6">
        <div className="flex flex-col items-center gap-4 rounded-lg bg-success p-6 text-center">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-title-s font-semibold tabular-nums text-success-foreground">4 documents signed</h2>
            <p className="text-body-compact text-pretty text-success-foreground">
              One OTP covered the set, the same as signing one at a time.
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

export function SolidBand() {
  return (
    <Screen height={500}>
      <DialogBox width={512}>
        <StagedHeader title="8 forms signed" />
        <div className="flex min-h-72 flex-col justify-center bg-muted p-6 dark:bg-background">
          <div className="overflow-hidden rounded-xl border border-hairline bg-card shadow-raised">
            <div className="flex items-center gap-2 bg-success px-4 py-3 text-success-foreground">
              <CircleCheckIcon className="size-5 shrink-0" />
              <p className="text-body">They have left the signing queue.</p>
            </div>
            <DescriptionList className="px-4">
              <Row term="Form 12 notices">5</Row>
              <Row term="Warrants">3</Row>
              <Row term="Cases">6 cases</Row>
            </DescriptionList>
          </div>
        </div>
        <StagedFooter><Button>Done</Button></StagedFooter>
      </DialogBox>
    </Screen>
  );
}

export function SolidCallout() {
  return (
    <Screen height={380}>
      <DialogBox width={360} close={false} className="gap-4 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">12 covers posted</h2>
          <p className="flex items-start gap-2 rounded-lg bg-success px-4 py-3 text-body text-success-foreground">
            <CircleCheckIcon className="mt-0.5 size-5 shrink-0" />
            <span>They are now in In progress in Service.</span>
          </p>
        </div>
        <div className="flex justify-end"><Button>Done</Button></div>
      </DialogBox>
    </Screen>
  );
}

/* --------------------------------------------------- D. payment receipt */

export function Receipt() {
  return (
    <Screen height={540}>
      <DialogBox width={512} className="gap-4 p-6">
        <div className="flex flex-col gap-2 pr-8">
          <h2 className="text-title-s font-semibold">Payment successful</h2>
          <p className="text-body-compact text-muted-foreground">Suresh Kumar vs. Rajan Traders · ST/0412/2026</p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success text-success-foreground">
              <CheckIcon className="size-6" />
            </span>
            <p className="text-title-s font-semibold tabular-nums">₹50</p>
          </div>
          <DescriptionList className="rounded-xl bg-surface-sunken px-4 py-1">
            <Row term="Fee">Application fee</Row>
            <Row term="Receipt"><Mono>RCPT-88213</Mono></Row>
          </DescriptionList>
        </div>
        <div className="flex justify-end"><Button>Done</Button></div>
      </DialogBox>
    </Screen>
  );
}

/* ----------------------------------------------- E. centred tinted disc */

export function CentredDisc() {
  return (
    <Screen height={560}>
      <DialogBox width={672}>
        <StagedHeader title="Forwarded for registration" />
        <div className="flex h-72 flex-col items-center justify-center gap-4 bg-card p-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-success-muted text-success-muted-foreground">
            <CheckIcon className="size-7" strokeWidth={2.2} />
          </div>
          <div className="flex max-w-sm flex-col gap-1">
            <p className="text-body font-semibold">Forwarded</p>
            <p className="text-body-compact text-muted-foreground">On Register cases as CMP — Complaint.</p>
          </div>
        </div>
        <StagedFooter>
          <Button variant="outline">Stay here</Button>
          <Button>Next file</Button>
        </StagedFooter>
      </DialogBox>
    </Screen>
  );
}

/* --------------------------------------- F. words change, nothing else */

export function BadgeSwap() {
  return (
    <Screen height={420}>
      <DialogBox width={512}>
        <div className="flex flex-col items-start gap-2 border-b border-hairline p-6 pr-16">
          <Badge variant="success" className="gap-1.5"><CircleCheckIcon className="size-3.5" />Registered</Badge>
          <h2 className="text-title-s font-semibold">Complaint registered</h2>
          <p className="text-body-compact text-muted-foreground">KL-000847-2026 · Suresh Kumar vs. Rajan Traders</p>
        </div>
        <div className="px-6 py-6">
          <p className="text-body-compact text-pretty">The complaint is on the register. It appears in the court's case list from today.</p>
        </div>
        <StagedFooter>
          <Button variant="ghost">Back to register cases</Button>
          <Button>Next complaint</Button>
        </StagedFooter>
      </DialogBox>
    </Screen>
  );
}

export function TitleBanner() {
  return (
    <Screen height={440}>
      <DialogBox width={512}>
        <div className="flex flex-col gap-1 border-b border-hairline px-6 py-4">
          <h2 className="text-body font-semibold">Payment complete</h2>
          <p className="text-caption font-medium text-muted-foreground">Application for exemption</p>
        </div>
        <div className="flex flex-col gap-4 bg-surface-sunken px-6 py-4">
          <Banner variant="success">Court fee of ₹20 paid. The application is submitted.</Banner>
          <dl className="flex flex-col rounded-lg border border-hairline bg-card px-4 py-1 text-body-compact">
            <div className="flex justify-between py-2.5"><dt>Court fee</dt><dd>₹20</dd></div>
            <div className="flex justify-between border-t border-hairline py-2.5 font-semibold"><dt>Total paid</dt><dd>₹20</dd></div>
          </dl>
        </div>
        <div className="flex justify-end border-t border-hairline px-6 py-4"><Button>Done</Button></div>
      </DialogBox>
    </Screen>
  );
}

export function TextOnly() {
  return (
    <Screen height={360}>
      <DialogBox width={360} close={false} className="gap-4 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Sent for signing</h2>
          <p className="text-sm text-muted-foreground">It is in Pending orders, awaiting the magistrate. Next draft: Order on bail, ST/0388/2026.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline">Back to Pending orders</Button>
          <Button>Next draft</Button>
        </div>
      </DialogBox>
    </Screen>
  );
}

export function FooterLine() {
  return (
    <Screen height={480}>
      <DialogBox width={760}>
        <StagedHeader title="Summons · ST/0412/2026" />
        <div className="flex h-64 items-center justify-center bg-card">
          <div className="h-56 w-44 rounded border border-hairline bg-surface-sunken" />
        </div>
        <div className="flex items-center gap-2 border-t border-hairline bg-card p-6">
          <p className="mr-auto flex items-start gap-2 text-body-compact text-success-ink">
            <CircleCheckIcon className="mt-0.5 size-4 shrink-0" />
            <span><span className="font-medium">Process signed.</span> It is now in To post in Issuance.</span>
          </p>
          <Button variant="outline">Download</Button>
          <Button>Done</Button>
        </div>
      </DialogBox>
    </Screen>
  );
}

/* ------------------------------------------------------- G. full page */

export function FullPage() {
  return (
    <Screen height={520} scrim={false}>
      <div className="absolute inset-0 bg-background" />
      <div className="relative mx-auto flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <Disc />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-title font-semibold text-balance">Your account is ready</h1>
          <p className="text-body text-pretty text-muted-foreground">
            You can add your address and official ID from your profile after entering the portal.
          </p>
        </div>
        <Button size="lg">Go to your home page</Button>
      </div>
    </Screen>
  );
}

/* --------------------------------------------- H. inline on the page */

export function InlineNotices() {
  return (
    <div className="relative w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background p-8">
      <div className="flex flex-col gap-5">
        <Alert variant="success">
          <CheckCircle2Icon />
          <AlertTitle>Vakalatnama executed</AlertTitle>
          <AlertDescription>Fees paid and all parties signed. The instrument is sealed with its audit trail.</AlertDescription>
        </Alert>
        <Banner variant="success">
          <span><span className="font-semibold">You have signed the bail bond</span> The court will be told when everyone has signed.</span>
        </Banner>
        <p className="flex items-start gap-1.5 rounded-lg border border-success bg-success-muted px-3 py-2 text-body-compact font-medium text-success-muted-foreground">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
          <span>Access given to Adv. Meera Nair, Rahul (clerk)</span>
        </p>
        <div className="flex flex-col gap-3">
          {/* QueueProgress on the scrutiny correction screen: one segment per defect. */}
          <div className="flex gap-1">
            {Array.from({ length: 6 }).map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-full bg-primary" />)}
          </div>
          <p className="flex items-center gap-2 rounded-lg bg-success-muted px-4 py-3 text-body-compact font-medium text-success-muted-foreground">
            <CircleCheckIcon className="size-4 shrink-0" />
            All 6 corrected.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- I. no visual at all */

export function Silent() {
  return (
    <div className="relative h-[420px] w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background">
      <FauxPage />
      <div className="absolute top-[118px] left-[200px] right-6 h-[46px] rounded-sm border-2 border-dashed border-muted-foreground/50 bg-background/70" />
      <p className="absolute top-[128px] left-[216px] text-body-compact text-muted-foreground">
        Row leaves the queue. Only a screen-reader line says it was signed.
      </p>
    </div>
  );
}

/* ------------------------------------------------ J. marks and ticks */

export function Marks() {
  return (
    <div className="flex w-[820px] shrink-0 flex-wrap items-center gap-4 rounded-lg border border-hairline bg-background p-8">
      <Badge variant="success"><CheckIcon />Signed</Badge>
      <Badge variant="success"><CircleCheckIcon data-icon="inline-start" />Done: all 24 filed</Badge>
      <Badge variant="success">Address added</Badge>
      <span className="inline-flex items-center gap-1.5 text-body-compact text-success-ink"><CheckIcon className="size-4" />Saved</span>
      <span className="flex items-center gap-1.5 text-body-compact text-success-ink"><CheckCircle2Icon className="size-4" />Mobile number verified</span>
      <span className="flex items-start gap-1.5 text-caption text-success-ink"><CircleCheckIcon className="size-4 shrink-0" />Read · 6 fields filled in your form</span>
      <Button size="lg" disabled><CircleCheckIcon data-icon="inline-start" />Sent to scrutiny</Button>
      <span className="relative flex size-8 items-center justify-center rounded-full bg-success text-success-foreground"><CheckIcon className="size-4" /></span>
    </div>
  );
}
