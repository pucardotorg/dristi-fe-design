"use client";

import * as React from "react";
import { FileQuestionIcon, LinkIcon, LockIcon, PenLineIcon, RotateCcwIcon, Trash2Icon, UserXIcon } from "lucide-react";

import { ChromeAlertDialogContent, ChromeDialogContent } from "@/components/chrome/app-chrome";
import {
  BADGE_WITH_MARK,
  ConfirmMark,
  IrreversibleNote,
  LANDING,
  notify,
  OutcomeAmount,
  OutcomeHeader,
  OutcomeSummary,
  OutcomeTally,
  PageOutcome,
  StatusFieldControl,
  StatusFieldError,
  StatusLine,
  StatusMark,
  useRefusal,
  type MarkSize,
  type MarkTone,
} from "@/components/feedback";
import { AppToaster } from "@/components/shell/app-toaster";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { Dialog, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/**
 * Feedback kit: every piece in `components/feedback`, live, for checking at every width,
 * in both themes and with reduced motion. Not a product screen; sample copy only.
 * The visual spec it is checked against: `/success-board` on `feature/states-board`.
 */

const TONES: MarkTone[] = ["success", "error", "warning", "info", "neutral", "danger"];
const SIZES: MarkSize[] = [14, 16, 20, 24, 40, 56, 72];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-title-s font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const Row = ({ term, children }: { term: string; children: React.ReactNode }) => (
  <DescriptionRow className="border-hairline">
    <DescriptionTerm>{term}</DescriptionTerm>
    <DescriptionDetails className="tabular-nums">{children}</DescriptionDetails>
  </DescriptionRow>
);

function OutcomeDialog({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{label}</Button>
      </DialogTrigger>
      <ChromeDialogContent mobileSheet className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {children}
      </ChromeDialogContent>
    </Dialog>
  );
}

const Footer = ({ children }: { children: React.ReactNode }) => (
  <DialogFooter className="mx-0 mb-0 shrink-0 border-hairline bg-surface-sunken">{children}</DialogFooter>
);

function RefusalDemo() {
  const { attempt, refuse } = useRefusal();
  return (
    <Card className="flex max-w-xl flex-col gap-4 p-6">
      {/* The caller sets `data-invalid` and `aria-invalid`; the DS Field ties the error to
          the control with `aria-describedby`. */}
      <Field data-invalid={attempt > 0}>
        <FieldLabel htmlFor="kit-order">Order text</FieldLabel>
        <StatusFieldControl attempt={attempt}>
          <Textarea id="kit-order" aria-invalid={attempt > 0} className="min-h-32" />
        </StatusFieldControl>
        {attempt > 0 ? <StatusFieldError attempt={attempt}>Type the order before sending it for signing.</StatusFieldError> : null}
      </Field>
      <div className="flex justify-end">
        <Button onClick={refuse}>Send for signing</Button>
      </div>
    </Card>
  );
}

export default function FeedbackKitPage() {
  const [run, setRun] = React.useState(0);
  return (
    <main className="min-h-dvh bg-muted dark:bg-background">
      <AppToaster />
      <div key={run} className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-8 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-title font-semibold">Feedback kit</h1>
            <p className="text-body text-muted-foreground">Every feedback piece, live. Sample copy only.</p>
          </div>
          <Button variant="outline" onClick={() => setRun((n) => n + 1)}>
            <RotateCcwIcon data-icon="inline-start" aria-hidden />
            Replay motion
          </Button>
        </header>

        <Section title="Mark · tones and sizes">
          <Card className="overflow-x-auto p-6">
            <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] items-center gap-4">
              <span />
              {SIZES.map((s) => (
                <span key={s} className="text-caption text-muted-foreground tabular-nums">{s}px</span>
              ))}
              {TONES.map((t) => (
                <React.Fragment key={t}>
                  <span className="text-body-compact font-medium">{t}</span>
                  {SIZES.map((s) => (
                    <StatusMark key={s} tone={t} size={s} icon={t === "neutral" ? LockIcon : t === "danger" ? Trash2Icon : undefined} />
                  ))}
                </React.Fragment>
              ))}
            </div>
          </Card>
        </Section>

        <Section title="Toast">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => notify.success("Access given to Adv. Meera Nair")}>Success</Button>
            <Button variant="outline" onClick={() => notify.success("Order KL-ORD-0412 signed. The application is accepted.")}>Success, two lines</Button>
            <Button variant="outline" onClick={() => notify.error("The case file could not be prepared", { description: "Try again. Nothing was downloaded." })}>Error (stays)</Button>
            <Button variant="outline" onClick={() => notify.warning("2 required documents still needed")}>Warning</Button>
            <Button variant="outline" onClick={() => notify.neutral("The court fee opens once every signature and oath is in.", { icon: LockIcon })}>Neutral</Button>
            <Button variant="outline" onClick={() => notify.neutral("Saved as a draft")}>Neutral, no icon</Button>
            <Button variant="outline" onClick={() => notify.neutral("Task archived", { description: "Pay court fee. You can find it under Take action, Archive.", icon: Trash2Icon, action: { label: "Undo", onClick: () => undefined } })}>Neutral with action</Button>
          </div>
        </Section>

        <Section title="Takeover (dialog)">
          <div className="flex flex-wrap gap-2">
            <OutcomeDialog label="Success, wide">
              <OutcomeHeader titleFrom="dialog" title="Bail application submitted" body="The court has received your application. You will be told by SMS when a decision is made." />
              <div className="px-6 py-4">
                <DescriptionList>
                  <Row term="Submitted on">24-08-2026</Row>
                  <Row term="Submission ID">KL-000847-2026-AP1</Row>
                  <Row term="Court fee">₹50 paid</Row>
                </DescriptionList>
              </div>
              <Footer><Button>Done</Button></Footer>
            </OutcomeDialog>
            <OutcomeDialog label="Payment, compact">
              <OutcomeHeader titleFrom="dialog" compact title="Payment successful" body="Your case file is complete.">
                <OutcomeAmount label="Amount paid" value="₹1,250" />
              </OutcomeHeader>
              <div className="px-6 py-4">
                <OutcomeSummary>
                  <DescriptionList>
                    <Row term="Case file number">KL-000847-2026</Row>
                    <Row term="Payment reference">PAY-55102</Row>
                  </DescriptionList>
                </OutcomeSummary>
              </div>
              <Footer><Button>Done</Button></Footer>
            </OutcomeDialog>
            <OutcomeDialog label="Error">
              <OutcomeHeader titleFrom="dialog" tone="error" compact title="Nothing was signed" body="One OTP covered the set, the same as signing one at a time." />
              <Footer><Button>Done</Button></Footer>
            </OutcomeDialog>
            <OutcomeDialog label="Info (sent, not decided)">
              <OutcomeHeader titleFrom="dialog" tone="info" compact title="Application sent to the magistrate" body="Signed with Aadhaar OTP. Adv. R. Pillai stays on the case until the order is passed." />
              <Footer><Button>Done</Button></Footer>
            </OutcomeDialog>
            <OutcomeDialog label="Partial (tally)">
              <OutcomeHeader titleFrom="dialog" compact title="3 processes signed" />
              <div className="px-6 py-4">
                <OutcomeTally label="Sent" done={2} failed={1} doneLine="2 are now in Sent in Service." failedLine="1 could not be sent and is in Errored in Issuance." />
              </div>
              <Footer><Button>Done</Button></Footer>
            </OutcomeDialog>
            <OutcomeDialog label="Bulk tally (60)">
              <OutcomeHeader titleFrom="dialog" compact title="60 processes signed" />
              <div className="px-6 py-4">
                <OutcomeTally label="Sent" done={57} failed={3} doneLine="57 are now in Sent in Service." failedLine="3 could not be sent and are in Errored in Issuance." />
              </div>
              <Footer><Button>Done</Button></Footer>
            </OutcomeDialog>
            <OutcomeDialog label="Labelled summary">
              <OutcomeHeader titleFrom="dialog" title="Everyone has signed" body="You can pay the court fee now." />
              <div className="px-6 py-4">
                <OutcomeSummary tone="success" label="Every signature is in" aside={<Badge variant="success" className={BADGE_WITH_MARK}><StatusMark size={14} still />3 of 3 signed</Badge>}>
                  <p className="py-3 text-body-compact">Adv. Meera Nair · Suresh Kumar · Anita Kumar</p>
                </OutcomeSummary>
              </div>
              <Footer><Button>Done</Button></Footer>
            </OutcomeDialog>
          </div>
        </Section>

        <Section title="Confirm">
          <div className="flex flex-wrap gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline">Removal</Button></AlertDialogTrigger>
              <ChromeAlertDialogContent>
                <AlertDialogHeader>
                  <ConfirmMark danger icon={UserXIcon} />
                  <AlertDialogTitle>Remove Rahul from your office?</AlertDialogTitle>
                  <AlertDialogDescription>They will lose access to 14 cases immediately and leave your office. You can add them again at any time.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive">Remove from office</AlertDialogAction>
                </AlertDialogFooter>
              </ChromeAlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline">Discard</Button></AlertDialogTrigger>
              <ChromeAlertDialogContent>
                <AlertDialogHeader>
                  <ConfirmMark danger icon={Trash2Icon} />
                  <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
                  <AlertDialogDescription className="flex flex-col">
                    <span>Its text and order data are removed, and it leaves Pending orders. Nothing is issued or recorded on the case.</span>
                    <IrreversibleNote>This cannot be undone.</IrreversibleNote>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep the draft</AlertDialogCancel>
                  <AlertDialogAction variant="destructive">Discard draft</AlertDialogAction>
                </AlertDialogFooter>
              </ChromeAlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline">Irreversible</Button></AlertDialogTrigger>
              <ChromeAlertDialogContent>
                <AlertDialogHeader>
                  <ConfirmMark icon={PenLineIcon} />
                  <AlertDialogTitle>Sign 8 orders?</AlertDialogTitle>
                  <AlertDialogDescription className="flex flex-col">
                    <span>Your signature issues each order.</span>
                    <IrreversibleNote>This cannot be reversed.</IrreversibleNote>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Back</AlertDialogCancel>
                  <AlertDialogAction>Sign</AlertDialogAction>
                </AlertDialogFooter>
              </ChromeAlertDialogContent>
            </AlertDialog>
          </div>
        </Section>

        <Section title="Inline line">
          <div className="flex max-w-3xl flex-col gap-4">
            <StatusLine tone="success">Access given to Adv. Meera Nair, Rahul (clerk)</StatusLine>
            <StatusLine tone="error" title="Last attempt failed">Ref PAY-55102 on 24-08-2026, 11:40. Nothing was paid; try again.</StatusLine>
            <StatusLine tone="error" action={<Button size="sm" variant="outline">Try again</Button>}>Cases could not be loaded. Nothing has been changed. Try again in a moment.</StatusLine>
            <StatusLine tone="warning" title="12 days beyond the one-month limit">The court can still take this on file, but it must be asked to condone the delay.</StatusLine>
            <StatusLine tone="info">We could not load your case. Your case number and hearing date are on your summons.</StatusLine>
            <StatusLine tone="neutral" icon={FileQuestionIcon}>No case matches this number. Check your summons, or the case may not be in the system yet.</StatusLine>
          </div>
        </Section>

        <Section title="Field error (press twice)">
          <RefusalDemo />
        </Section>

        <Section title="Badges with a mark">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="success" className={BADGE_WITH_MARK}><StatusMark size={14} />Signed</Badge>
            <Badge variant="destructive" className={BADGE_WITH_MARK}><StatusMark size={14} tone="error" />Overdue</Badge>
            <Badge variant="warning" className={BADGE_WITH_MARK}><StatusMark size={14} tone="warning" />Due today</Badge>
            <Badge variant="warning" className={BADGE_WITH_MARK}><StatusMark size={14} tone="warning" />Errored</Badge>
          </div>
        </Section>

        <Section title="Landing highlight">
          <Card className="gap-0 overflow-hidden py-0">
            {["Pay court fee", "Sign vakalatnama", "File bail application"].map((t, i) => (
              <div key={t} className={`flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-0 ${i === 1 ? LANDING : ""}`}>
                <span className="flex-1 text-body-compact font-medium">{t}</span>
                {i === 1 ? <Badge variant="success">Signed</Badge> : null}
              </div>
            ))}
          </Card>
        </Section>

        <Section title="Page outcomes">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="items-center p-6"><PageOutcome tone="success" scale="hero" title="Your account is ready" body="You can add your address and official ID from your profile." action={<Button>Go to your home page</Button>} /></Card>
            <Card className="items-center p-6"><PageOutcome tone="error" title="This page could not load" body="Nothing was changed. Reload to try again." action={<Button>Reload</Button>} /></Card>
            <Card className="items-center p-6"><PageOutcome tone="neutral" icon={LinkIcon} title="This link is no longer active" body="Ask the advocate filing it to send you a new link." /></Card>
          </div>
        </Section>
      </div>
    </main>
  );
}
