"use client";

import * as React from "react";
import { FlaskConicalIcon } from "lucide-react";

import { IrreversibleNote, OutcomeHeader, OutcomeSummary, OutcomeTally, notify } from "@/components/feedback";
import { Identifier } from "@/components/chrome/identifier";
import { useStageFade } from "@/components/chrome/stage-fade";
import { StagedOverlay } from "@/components/chrome/staged-overlay";
import { useCourtText } from "@/components/court/court-provider";
import { DscLookup, InstrumentChoice, OtpEntry } from "@/components/filing/sign-stages";
import { GATEWAY_MS, PaymentProcessing } from "@/components/payment/payment-steps";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { rupees } from "@/lib/tasks/format";
import { useTasks } from "@/lib/tasks/store";
import { recordPayment, sign, TransitionError } from "@/lib/tasks/transitions";
import type { Case, PaymentResult, Person, Task, TaskId } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

/**
 * **Signing or paying a selected set — the court side's bulk signing, for the
 * advocate** (owner, 2026-10-14: "the same logic").
 *
 * One window at the signing width, its steps fading between sizes (`useStageFade`):
 *
 * - `confirm` — what was selected, as a list to check against: each task, its case,
 *   and for a fee its amount, with the total under it.
 * - `sign` — Aadhaar OTP or a DSC, the instruments as cards (the filing flow's own
 *   parts, `filing/sign-stages`); then `otp` / `dsc`, that instrument doing its job.
 * - `processing` — a payment's gateway round trip. The gateway's answer is a sandbox
 *   control under the flask, as in every payment window.
 * - `done` — what became of each, in the window it happened in: a strip saying the
 *   outcome, the tasks under it, and any that did not go through named as such. A
 *   toast confirms once the window has gone.
 *
 * One authorisation for the set, applied task by task, because each task closes on its
 * own event and any one can be refused ("one OTP, one transaction; each task remains an
 * individual record"). Part success is the normal case, so the outcome lists each.
 */

type Stage = "confirm" | "sign" | "otp" | "dsc" | "processing" | "done";

const ORDER: readonly Stage[] = ["confirm", "sign", "otp", "dsc", "processing", "done"];

type Mark = "done" | "confirming" | "failed";
type Outcome = { task: Task; mark: Mark; note: string };

const GATEWAY: { value: PaymentResult; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "pending", label: "Still confirming" },
  { value: "failed", label: "Failed" },
];

export function BatchActDialog({
  kind,
  tasks,
  user,
  open,
  onOpenChange,
  onFinished,
}: {
  kind: "sign" | "pay" | null;
  tasks: Task[];
  user: Person;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The ids that left the selection, so the screen can clear them. */
  onFinished: (closed: TaskId[]) => void;
}) {
  /* No way out while the set is being applied: the loop outlives an unmount, and
     nobody would be told which ones went through (2026-09-15). */
  const [running, setRunning] = React.useState(false);
  const [opening, setOpening] = React.useState(0);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpening((n) => n + 1);
  }
  /* What the window settled, for the toast once it has gone. */
  const settled = React.useRef<string | null>(null);

  function close() {
    if (running) return;
    if (settled.current) notify.success(settled.current);
    settled.current = null;
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open && !!kind && tasks.length > 0}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      {open && kind ? (
        <BatchBody
          key={opening}
          kind={kind}
          tasks={tasks}
          user={user}
          running={running}
          onRunning={setRunning}
          onSettled={(message) => {
            settled.current = message;
          }}
          onClose={close}
          onFinished={onFinished}
        />
      ) : null}
    </Dialog>
  );
}

function BatchBody({
  kind,
  tasks,
  running,
  onRunning,
  onSettled,
  onClose,
  onFinished,
}: {
  kind: "sign" | "pay";
  tasks: Task[];
  user: Person;
  running: boolean;
  onRunning: (running: boolean) => void;
  onSettled: (message: string) => void;
  onClose: () => void;
  onFinished: (closed: TaskId[]) => void;
}) {
  const { dispatch, cases } = useTasks();
  const flow = useStageFade<Stage>("confirm", ORDER);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (!flow.changed) return;
    const active = window.document.activeElement;
    if (!active || active === window.document.body || !active.isConnected) {
      titleRef.current?.focus();
    }
  }, [flow.stage, flow.changed]);

  /* The set as it was when the window opened: applying it takes the rows away. */
  const [batch] = React.useState(tasks);
  const [otp, setOtp] = React.useState("");
  const [resent, setResent] = React.useState(false);
  const [dscFound, setDscFound] = React.useState(false);
  const [gateway, setGateway] = React.useState<PaymentResult>("success");
  const [outcomes, setOutcomes] = React.useState<Outcome[]>([]);
  const [signedWith, setSignedWith] = React.useState<"aadhaar" | "dsc" | null>(null);

  React.useEffect(() => {
    if (flow.stage !== "dsc" || dscFound) return;
    const timer = window.setTimeout(() => setDscFound(true), 1100);
    return () => window.clearTimeout(timer);
  }, [flow.stage, dscFound]);

  const n = batch.length;
  const total = rupees(batch.reduce((sum, t) => sum + (t.amountPaise ?? 0), 0));
  const noun = kind === "sign" ? (n === 1 ? "document" : "documents") : n === 1 ? "fee" : "fees";
  const caseOf = (task: Task) => cases.find((c) => c.id === task.caseId);

  async function run(instrument?: "aadhaar" | "dsc") {
    onRunning(true);
    if (kind === "pay") {
      flow.setStage("processing");
      await new Promise((resolve) => window.setTimeout(resolve, GATEWAY_MS));
    }
    const done: Outcome[] = [];
    for (const task of batch) {
      try {
        const next = await dispatch(task.id, (t, ctx) =>
          kind === "sign" ? sign(t, ctx) : recordPayment(t, ctx, gateway)
        );
        const mark: Mark =
          kind === "pay" ? (gateway === "failed" ? "failed" : gateway === "pending" ? "confirming" : "done") : "done";
        done.push({
          task,
          mark,
          note:
            mark === "failed"
              ? "Not paid — the gateway declined it"
              : mark === "confirming"
                ? "The gateway is confirming"
                : kind === "pay"
                  ? `Receipt ${next.completion?.receipt ?? ""}`.trim()
                  : "Signed",
        });
      } catch (e) {
        done.push({
          task,
          mark: "failed",
          note: e instanceof TransitionError ? e.message : "Something went wrong — nothing changed",
        });
      }
    }
    onRunning(false);
    setOutcomes(done);
    if (instrument) setSignedWith(instrument);
    const through = done.filter((o) => o.mark !== "failed");
    onFinished(through.map((o) => o.task.id));
    if (through.length) {
      onSettled(
        kind === "sign"
          ? `${through.length} ${through.length === 1 ? "document" : "documents"} signed`
          : `${through.length} ${through.length === 1 ? "fee" : "fees"} paid`
      );
    }
    flow.setStage("done");
  }

  const through = outcomes.filter((o) => o.mark !== "failed");
  const title = {
    confirm: kind === "sign" ? `Sign ${n} ${noun}` : `Pay ${total} for ${n} ${noun}`,
    sign: `Sign ${n} ${noun}`,
    otp: "Enter the OTP",
    dsc: "Sign with your DSC",
    processing: "Processing payment…",
    done:
      kind === "sign"
        ? through.length
          ? `${through.length} ${through.length === 1 ? "document" : "documents"} signed`
          : "Nothing was signed"
        : /* A payment's outcome leads with the amount, as every payment in the product
             does ("₹452 paid"); the count labels the list under it. */
          through.length
          ? `${rupees(through.reduce((sum, o) => sum + (o.task.amountPaise ?? 0), 0))} paid`
          : "Nothing was paid",
  }[flow.stage];

  const description = {
    confirm:
      kind === "sign"
        ? "One signature goes on every document selected."
        : "One transaction, with a receipt against each fee.",
    sign: "Either one is your own signature — use whichever you have.",
    otp: "Sent to your Aadhaar-linked mobile.",
    dsc: "Your certificate has to be plugged in, with the signing utility running on this computer.",
    processing: null,
    done: null,
  }[flow.stage];

  const footer = {
    confirm: (
      <>
        <Button type="button" variant="outline" onClick={onClose}>
          Back
        </Button>
        {kind === "pay" ? (
          <div className="flex items-center gap-2">
            <GatewayMenu value={gateway} onChange={setGateway} />
            <Button type="button" disabled={running} onClick={() => void run()}>
              Pay {total}
            </Button>
          </div>
        ) : (
          <Button type="button" onClick={() => flow.setStage("sign")}>
            Sign {n} {noun}
          </Button>
        )}
      </>
    ),
    sign: (
      <Button type="button" variant="outline" onClick={() => flow.setStage("confirm")}>
        Back
      </Button>
    ),
    otp: (
      <>
        <Button type="button" variant="outline" onClick={() => flow.setStage("sign")}>
          Back
        </Button>
        <Button type="button" disabled={otp.length < 6 || running} onClick={() => void run("aadhaar")}>
          Verify and sign
        </Button>
      </>
    ),
    dsc: (
      <>
        <Button type="button" variant="outline" onClick={() => flow.setStage("sign")}>
          Back
        </Button>
        <Button type="button" disabled={!dscFound || running} onClick={() => void run("dsc")}>
          Sign with this certificate
        </Button>
      </>
    ),
    processing: null,
    done: (
      <Button type="button" onClick={onClose}>
        Done
      </Button>
    ),
  }[flow.stage];

  return (
    <StagedOverlay
      className="sm:max-w-2xl"
      title={title}
      titleRef={titleRef}
      description={description}
      style={flow.panelStyle}
      sceneKey="steps"
      motion="forward"
      footer={footer}
      showCloseButton={!running}
      /* The settled stage takes the window over: mark, then title (owner, Oct 29). */
      outcome={flow.stage === "done"}
      /* The outcome has a title and no body line: say so, rather than leave Radix
         looking for a description that is not there. */
      {...(flow.stage === "done" ? { "aria-describedby": undefined } : {})}
      onEscapeKeyDown={(e) => running && e.preventDefault()}
    >
      <div key={flow.stage} className={cn("flex min-h-0 flex-1 flex-col", flow.sceneClassName)}>
        {flow.stage === "done" ? (
          /* Full bleed: the band meets the window's edges; the facts keep their measure. */
          <OutcomeCard
            title={title}
            outcomes={outcomes}
            caseOf={caseOf}
            headline={
              kind === "sign"
                ? signedWith === "dsc"
                  ? "Signed with your DSC"
                  : "Signed with Aadhaar OTP"
                : `${through.length} ${through.length === 1 ? "fee" : "fees"} paid`
            }
            ok={through.length > 0}
          />
        ) : (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
          {flow.stage === "confirm" ? (
            <TaskList tasks={batch} caseOf={caseOf} pay={kind === "pay"} total={total} />
          ) : flow.stage === "sign" ? (
            <>
              <InstrumentChoice
                onAadhaar={() => {
                  setOtp("");
                  flow.setStage("otp");
                }}
                onDsc={() => {
                  setDscFound(false);
                  flow.setStage("dsc");
                }}
              />
              <p className="text-body-compact text-muted-foreground">
                Signing applies to every document selected.
                <IrreversibleNote>It cannot be reversed.</IrreversibleNote>
              </p>
            </>
          ) : flow.stage === "otp" ? (
            <OtpEntry
              id="batch-sign-otp"
              value={otp}
              onChange={setOtp}
              resent={resent}
              onResend={() => setResent(true)}
            />
          ) : flow.stage === "dsc" ? (
            <DscLookup found={dscFound} holder="" />
          ) : (
            <PaymentProcessing />
          )}
        </div>
        )}
      </div>
    </StagedOverlay>
  );
}

/** The sandbox gateway's answer, under the flask as in every payment window. */
function GatewayMenu({
  value,
  onChange,
}: {
  value: PaymentResult;
  onChange: (value: PaymentResult) => void;
}) {
  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Sandbox: choose the gateway result"
                className="text-muted-foreground"
              >
                <FlaskConicalIcon aria-hidden />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Sandbox: choose the gateway result</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Sandbox gateway result</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as PaymentResult)}>
            {GATEWAY.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

/** One task as a row: what it is, then its case. */
function TaskRow({
  task,
  kase,
  trailing,
}: {
  task: Task;
  kase: Case | undefined;
  trailing?: React.ReactNode;
}) {
  const courtText = useCourtText();
  return (
    <li className="flex min-w-0 items-center gap-3 border-b border-hairline py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-compact font-medium">{task.title}</p>
        {kase ? (
          <p className="truncate text-body-compact text-muted-foreground">
            {kase.parties}
            {kase.stNumber ? (
              <>
                <span aria-hidden> · </span>
                <Identifier value={kase.stNumber} label="case number" copyable={false} />
              </>
            ) : null}
            <span aria-hidden> · </span>
            {courtText(kase.court)}
          </p>
        ) : null}
      </div>
      {trailing}
    </li>
  );
}

/** What was selected, to check against before acting on it. */
function TaskList({
  tasks,
  caseOf,
  pay,
  total,
}: {
  tasks: Task[];
  caseOf: (task: Task) => Case | undefined;
  pay: boolean;
  total: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-card shadow-raised">
      <ul aria-label="Selected" className="flex flex-col px-4">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            kase={caseOf(task)}
            trailing={
              pay && task.amountPaise !== undefined ? (
                <span className="shrink-0 text-body-compact tabular-nums">{rupees(task.amountPaise)}</span>
              ) : undefined
            }
          />
        ))}
      </ul>
      {pay ? (
        <p className="flex items-baseline justify-between gap-4 border-t border-hairline px-4 py-3 text-body-compact font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{total}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * What became of each — the product's settled card: the outcome across the top, the
 * tasks under it, and any that did not go through named as such with why.
 */
function OutcomeCard({
  title,
  outcomes,
  caseOf,
  headline,
  ok,
}: {
  title: string;
  outcomes: Outcome[];
  caseOf: (task: Task) => Case | undefined;
  headline: string;
  ok: boolean;
}) {
  /* The window's title says only what fully happened; any that did not go through are
     named in the list under it, in red with why (skill `feedback-states`). */
  const failedCount = outcomes.filter((o) => o.mark === "failed").length;
  const partial = ok && failedCount > 0;
  const doneCount = outcomes.length - failedCount;
  return (
    <>
      {/* Some did not go through: the amber "!", never the big tick that says all is well
          (owner, Oct 29). */}
      <OutcomeHeader
        tone={partial ? "warning" : ok ? "success" : "error"}
        titleFrom="dialog"
        focusTitle
        title={title}
        surface="card"
      />
      <div className="mx-auto flex w-full max-w-xl flex-col p-4 sm:p-6">
        {partial ? (
          /* Some went through: the title says only what did; the split is shown here. */
          <OutcomeTally
            label={headline}
            done={doneCount}
            failed={failedCount}
            /* Draft lines for the partial case, in the words this flow already uses;
               pending PM copy sign-off (feature record). */
            doneLine={`${doneCount} went through`}
            failedLine={`${failedCount} did not go through`}
            failedTone="error"
          />
        ) : null}
        <OutcomeSummary
          tone={ok ? "success" : "error"}
          className={partial ? "mt-4" : undefined}
          /* Nothing went through: an instrument or a count would claim what did not happen.
             A partial result already carries it on the tally above. */
          label={!ok || partial || headline === title ? undefined : headline}
        >
      <ul className="flex flex-col">
        {outcomes.map((o) => (
          <TaskRow
            key={o.task.id}
            task={o.task}
            kase={caseOf(o.task)}
            trailing={
              <span
                className={cn(
                  /* On a phone the note wraps ("Receipt" over the number) so the task's
                     own name keeps the width. */
                  "max-w-32 shrink-0 text-right text-body-compact text-pretty sm:max-w-none",
                  o.mark === "failed"
                    ? "text-destructive-ink"
                    : o.mark === "confirming"
                      ? "text-warning-ink"
                      : "text-muted-foreground"
                )}
              >
                {/* A reference never breaks inside itself: the label wraps above it. */}
                {o.note.startsWith("Receipt ") ? (
                  <>
                    Receipt{" "}
                    <span className="whitespace-nowrap">{o.note.slice("Receipt ".length)}</span>
                  </>
                ) : (
                  o.note
                )}
              </span>
            }
          />
        ))}
      </ul>
        </OutcomeSummary>
      </div>
    </>
  );
}
