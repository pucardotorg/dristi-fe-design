"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { DocumentSlot } from "@/components/ui/document-slot";
import { Separator } from "@/components/ui/separator";
import { Stepper, StepperItem } from "@/components/ui/stepper";
import { Segmented } from "@/components/filing/segmented";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { InfoWell, SectionNotice } from "@/components/shell/notices";
import {
  DIVERGED,
  DUPLICATES,
  ORPHANS,
  TOKEN_CANDIDATES,
  VERDICT_LABEL,
  type Verdict,
} from "./audit-data";

const VERDICT_TONE: Record<Verdict, string> = {
  promote: "bg-brand-muted text-brand-muted-foreground",
  merge: "bg-surface-sunken text-muted-foreground",
  delete: "bg-surface-sunken text-muted-foreground",
  decide: "bg-warning-muted text-warning-ink",
};

function VerdictChip({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${VERDICT_TONE[verdict]}`}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

function Section({
  title,
  count,
  lede,
  children,
}: {
  title: string;
  count: number;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-3">
          <h2 className="text-title-s font-semibold">{title}</h2>
          <span className="text-caption font-medium text-muted-foreground tabular-nums">
            {count}
          </span>
        </div>
        <p className="max-w-2xl text-body text-muted-foreground">{lede}</p>
      </div>
      {children}
    </section>
  );
}

/** A live demo bench — the point of this page is that these are real, not screenshots. */
function Bench({
  label,
  source,
  children,
}: {
  label: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-caption font-semibold text-foreground">{label}</span>
        <code className="font-mono text-caption text-muted-foreground">{source}</code>
      </div>
      <div className="flex min-h-24 items-center rounded-lg bg-surface-sunken p-4">{children}</div>
    </div>
  );
}

function FileMeta({ file, lines, origin }: { file: string; lines: number; origin: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <code className="truncate font-mono text-body-compact text-foreground">{file}</code>
      <span className="text-caption text-muted-foreground">
        {origin}
        {lines > 0 ? (
          <>
            {" · "}
            <span className="tabular-nums">{lines}</span> lines
          </>
        ) : null}
      </span>
    </div>
  );
}

export default function DsAuditPage() {
  const [signInMethod, setSignInMethod] = React.useState("otp");
  const [posture, setPosture] = React.useState<"complainant" | "accused">("complainant");
  const [step, setStep] = React.useState(2);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [slotStatus, setSlotStatus] = React.useState<"empty" | "filled">("empty");

  const total = ORPHANS.length + DIVERGED.length + DUPLICATES.length;

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-hairline bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8">
          <span className="text-caption font-semibold text-muted-foreground uppercase">
            Working document
          </span>
          <h1 className="text-title-l font-semibold tracking-tight">Component audit</h1>
          <p className="max-w-3xl text-body text-muted-foreground">
            Everything in this app that the design system does not own, measured on the merge of{" "}
            <code className="font-mono text-body-compact">scrutiny-back-adv</code> and{" "}
            <code className="font-mono text-body-compact">case-access-management</code>. Controls
            below are live — click them. As of 2026-08-25 the promotions are LANDED on the DS
            branch and synced back: segmented control (one component, two sizes), document-slot
            and stepper props, brand-canvas tokens, the warm neutral ramp, and the
            wells-are-not-tracks grammar. check:ui-sync is green for the first time.
          </p>
          <p className="text-caption text-muted-foreground">
            <span className="tabular-nums">{total}</span> items awaiting a decision · delete this
            route once the DS push lands
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-10">
        <Section
          title="Not in the design system"
          count={ORPHANS.length}
          lede="Hand-written primitives sitting in components/ui/. These are why check:ui-sync fails — the gate was already red on your colleague's branch before the merge."
        >
          <div className="flex flex-col gap-4">
            {ORPHANS.map((o) => (
              <Card key={o.file} variant="raised" className="gap-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <FileMeta file={o.file} lines={0} origin={o.origin} />
                  <VerdictChip verdict={o.verdict} />
                </div>
                <p className="max-w-3xl text-body text-muted-foreground">{o.why}</p>
                <p className="text-caption text-muted-foreground">
                  {o.usedBy.length > 0 ? (
                    <>Used by {o.usedBy.join(", ")}</>
                  ) : (
                    <span className="text-warning-ink">Imported nowhere</span>
                  )}
                </p>
                <Separator className="bg-hairline" />
                {o.file.includes("compact-segmented") ? (
                  <Bench label="Live — 40px targets, 32px well" source={o.file}>
                    <SegmentedControl size="compact"
                      type="single"
                      value={signInMethod}
                      onValueChange={(v: string) => v && setSignInMethod(v)}
                      aria-label="Sign-in method"
                    >
                      <SegmentedControlItem value="otp">OTP</SegmentedControlItem>
                      <SegmentedControlItem value="password">
                        Password
                      </SegmentedControlItem>
                    </SegmentedControl>
                  </Bench>
                ) : (
                  <p className="text-caption text-muted-foreground">
                    Deleted 2026-08-25 — it was imported nowhere.
                  </p>
                )}
              </Card>
            ))}
          </div>
        </Section>

        <Section
          title="Forked from the design system"
          count={DIVERGED.length}
          lede="These exist in the DS but were edited in-app. Syncing them from the DS breaks the auth flow — I tried, and it produced seven type errors — so the forks are what is running right now."
        >
          <div className="flex flex-col gap-4">
            {DIVERGED.map((d) => (
              <Card key={d.file} variant="raised" className="gap-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <FileMeta file={d.file} lines={d.diffLines} origin={`${d.origin} · diverges by`} />
                  <VerdictChip verdict={d.verdict} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {d.extraProps.map((p) => (
                    <Badge key={p} variant="secondary" className="font-mono">
                      {p}
                    </Badge>
                  ))}
                </div>
                <p className="max-w-3xl text-body text-muted-foreground">{d.why}</p>
                <p className="text-caption text-muted-foreground">
                  <span className="tabular-nums">{d.usedBy.length}</span> call sites ·{" "}
                  {d.usedBy.join(", ")}
                </p>
                <Separator className="bg-hairline" />
                {d.file.includes("document-slot") ? (
                  <Bench label="Live — the three forked props in use" source={d.file}>
                    <div className="flex w-full max-w-md flex-col gap-3">
                      <DocumentSlot
                        status={slotStatus}
                        label="Cheque image"
                        required
                        filename={slotStatus === "filled" ? "cheque-front.jpg" : undefined}
                        meta={slotStatus === "filled" ? "1.2 MB" : undefined}
                        quality={slotStatus === "filled" ? "poor" : undefined}
                        onChooseFile={() =>
                          setSlotStatus((s) => (s === "empty" ? "filled" : "empty"))
                        }
                        copy={{
                          noFile: "No cheque added yet",
                          poorScan: "Hard to read — the amount may not scan",
                          chooseFile: "Add cheque",
                        }}
                      />
                      <DocumentSlot
                        status="empty"
                        label="Disabled while a scan runs"
                        disabled
                        onChooseFile={() => {}}
                      />
                    </div>
                  </Bench>
                ) : (
                  <Bench label="Live — completed steps are clickable" source={d.file}>
                    <Stepper className="w-full max-w-lg">
                      {["Identity", "Details", "Review"].map((title, i) => {
                        const n = i + 1;
                        const status = n < step ? "complete" : n === step ? "current" : "upcoming";
                        return (
                          <StepperItem
                            key={title}
                            step={n}
                            title={title}
                            status={status}
                            onActivate={n < step ? () => setStep(n) : undefined}
                            activateLabel={`Go back to ${title}`}
                          />
                        );
                      })}
                    </Stepper>
                  </Bench>
                )}
              </Card>
            ))}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.min(3, s + 1))}>
                Advance the stepper
              </Button>
              <span className="text-caption text-muted-foreground">
                then click a completed step — that is the forked behaviour
              </span>
            </div>
          </div>
        </Section>

        <Section
          title="Built twice"
          count={DUPLICATES.length}
          lede="The same job implemented more than once. Where both versions render standalone they are side by side below; the rest carry a link to the live route, because a shell or a 1,400-line dialog only tells the truth in context."
        >
          <div className="flex flex-col gap-4">
            {DUPLICATES.map((p) => (
              <Card key={p.id} variant="raised" className="gap-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-body font-semibold">{p.role}</h3>
                  <VerdictChip verdict={p.verdict} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FileMeta {...p.a} />
                  <FileMeta {...p.b} />
                </div>
                <p className="text-caption text-muted-foreground">
                  {p.diffLines === 0 ? (
                    <span className="text-brand-muted-foreground">Byte-identical</span>
                  ) : (
                    <>
                      <span className="tabular-nums">{p.diffLines}</span> lines differ
                    </>
                  )}
                  {p.liveAt ? (
                    <>
                      {" · "}
                      <a className="underline underline-offset-2" href={p.liveAt}>
                        see it live at {p.liveAt}
                      </a>
                    </>
                  ) : null}
                </p>
                {p.note ? <p className="max-w-3xl text-body text-muted-foreground">{p.note}</p> : null}

                {p.id === "segmented" ? (
                  <>
                    <Separator className="bg-hairline" />
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <Bench label="Yours — filing" source="filing/segmented.tsx">
                        <Segmented
                          value={posture}
                          onValueChange={setPosture}
                          ariaLabel="Posture"
                          options={[
                            { value: "complainant", label: "Complainant" },
                            { value: "accused", label: "Accused" },
                          ]}
                        />
                      </Bench>
                      <Bench label="His — sign-in" source="ui/compact-segmented-control.tsx">
                        <SegmentedControl size="compact"
                          type="single"
                          value={posture}
                          onValueChange={(v: string) =>
                            v && setPosture(v as "complainant" | "accused")
                          }
                          aria-label="Posture"
                        >
                          <SegmentedControlItem value="complainant">
                            Complainant
                          </SegmentedControlItem>
                          <SegmentedControlItem value="accused">
                            Accused
                          </SegmentedControlItem>
                        </SegmentedControl>
                      </Bench>
                    </div>
                    <p className="text-caption text-muted-foreground">
                      Both bound to the same state — click either and the other follows. That is the
                      argument for one component with a size variant.
                    </p>
                  </>
                ) : null}

                {p.id === "confirm-dialog" ? (
                  <>
                    <Separator className="bg-hairline" />
                    <Bench label="Live — one of the two identical copies" source={p.b.file}>
                      <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
                        Open confirm dialog
                      </Button>
                    </Bench>
                  </>
                ) : null}

                {p.id === "notices" ? (
                  <>
                    <Separator className="bg-hairline" />
                    <Bench label="Live — the two lines that differ are copy, not behaviour" source={p.b.file}>
                      <div className="flex w-full flex-col gap-3">
                        <SectionNotice variant="warning" title="Cheque details need attention">
                          The amount in words does not match the figure.
                        </SectionNotice>
                        <InfoWell>
                          Filing fees are calculated from the cheque amount at the next step.
                        </InfoWell>
                      </div>
                    </Bench>
                  </>
                ) : null}
              </Card>
            ))}
          </div>
        </Section>

        <Section
          title="Tokens the DS does not define"
          count={TOKEN_CANDIDATES.length}
          lede="App-level tokens in globals.css. Syncing tokens from the DS deletes these and flattens the sign-in panel, so they are the strongest case for going upstream."
        >
          <Card variant="raised" className="gap-4 p-6">
            <div className="flex flex-col gap-3">
              {TOKEN_CANDIDATES.map((t) => (
                <div key={t.name} className="flex items-start gap-4">
                  <span
                    className="mt-0.5 size-10 shrink-0 rounded-md border border-hairline"
                    style={{ background: t.value }}
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <code className="font-mono text-body-compact font-medium">{t.name}</code>
                      <code className="font-mono text-caption text-muted-foreground tabular-nums">
                        {t.value}
                      </code>
                    </div>
                    <span className="text-caption text-muted-foreground">{t.note}</span>
                  </div>
                </div>
              ))}
            </div>
            <Separator className="bg-hairline" />
            <div
              className="flex flex-col gap-1.5 rounded-lg p-6"
              style={{
                background: "linear-gradient(160deg, var(--brand-canvas), var(--brand-canvas-deep))",
              }}
            >
              <span className="text-body font-semibold text-brand-canvas-foreground">
                This plate is what the tokens buy
              </span>
              <span className="text-body-compact text-brand-canvas-muted-foreground">
                Sign-in and marketing panels sit on it. It stays identical in dark mode on purpose.
              </span>
            </div>
          </Card>
        </Section>
      </main>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Discard this draft?"
        description="This filing has unsaved changes. Discarding cannot be undone."
        confirmLabel="Discard"
        destructive
        onConfirm={() => setConfirmOpen(false)}
      />
    </div>
  );
}
