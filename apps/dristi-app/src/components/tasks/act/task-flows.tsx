"use client";

import * as React from "react";
import { FlaskConicalIcon } from "lucide-react";

import { Identifier } from "@/components/chrome/identifier";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { RaiseApplicationForm } from "@/components/cases/raise-application-form";
import { SubmitDocumentsDialog } from "@/components/cases/submit-documents-form";
import { useCourtText } from "@/components/court/court-provider";
import {
  GATEWAY_MS,
  PAYMENT_PROCESSING_TITLE,
  PAYMENT_SUCCESS_TITLE,
  PaymentProcessing,
  PaymentFacts,
} from "@/components/payment/payment-steps";
import { type ActContext } from "@/components/tasks/act/shared";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { OutcomeAmount, OutcomeHeader, StatusLine } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { ApplicationViewer } from "@/lib/cases/application-access";
import type {
  ApplicationTypeId,
  SubmissionDocumentTypeId,
} from "@/lib/cases/applications";
import { formatCaseDate, type CaseRecord } from "@/lib/cases/types";
import { rupees } from "@/lib/tasks/format";
import { file, recordPayment } from "@/lib/tasks/transitions";
import type { Case, PaymentResult, Task } from "@/lib/tasks/types";

/**
 * **A Take action task opens the product's own window for the act** (owner,
 * 2026-10-14). Paying is the payment window the product pays every fee in (Join a
 * case, an application's fee): the fee in a short sheet, Pay, the gateway, the receipt.
 * Filing an application is View case's Raise application, opened at the type the task
 * names; filing a document is View case's Submit documents, filled with the document
 * the task asks for. Each says only what the task's own fields hold — the amount, the
 * fee head, the case, when it is due, the document's name — and nothing the system
 * does not know.
 *
 * Signatories only: someone off the vakalatnama prepares the work in the task modal
 * for the signatory (`act-modal.tsx`), and a payment the gateway is still confirming
 * is confirmed there too.
 */

/* ─────────────────────────────── which window ─────────────────────────────── */

/**
 * A task that asks for an application rather than a document — to file one, or to
 * finish one already drafted. A reply to the other side's application is a document.
 */
export function isApplicationTask(task: Task): boolean {
  return /^(file|continue) (the |an )?(draft )?application\b/i.test(task.title);
}

/** The application type a task's words name, else a generic application. */
export function applicationTypeOf(task: Task): ApplicationTypeId {
  const words = task.title.toLowerCase();
  if (/\bbail\b/.test(words)) return "bail";
  if (/\b(adjourn|postpone)/.test(words)) return "postpone";
  if (/\b(advance|prepone)/.test(words)) return "advancement-reschedule";
  if (/\b(recall|reopen)\b/.test(words)) return "reopen-evidence";
  if (/\bwitness\b/.test(words)) return "addition-of-witness";
  if (/\b(delay|condon)/.test(words)) return "condonation-of-delay";
  if (/\bproduc(e|tion)\b/.test(words)) return "production-of-documents";
  return "application-others";
}

/** The Submit documents type a document task's words name, if they name one;
 *  otherwise the filer picks it. */
function documentTypeOf(task: Task): SubmissionDocumentTypeId | undefined {
  const words = task.title.toLowerCase();
  if (/\baffidavit\b/.test(words)) return "affidavits";
  if (/\bmemo\b/.test(words)) return "memos";
  return undefined;
}

/** "File the proof affidavit of the complainant" → "Proof affidavit of the complainant". */
function documentTitleOf(task: Task): string {
  const rest = task.title.replace(/^(file|produce|submit|upload)\s+(the\s+)?/i, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** The case line every act window carries under its title. */
export function TaskCaseLine({ kase }: { kase: Case }) {
  const courtText = useCourtText();
  return (
    <>
      {kase.parties}
      {kase.stNumber ? (
        <>
          {" · "}
          <Identifier value={kase.stNumber} label="case number" copyable={false} />
        </>
      ) : (
        " · Not yet numbered"
      )}
      {" · "}
      {courtText(kase.court)}
    </>
  );
}

/* ─────────────────────────────────── pay ─────────────────────────────────── */

type PayStage = "pay" | "processing" | "paid";

const OUTCOMES: { value: PaymentResult; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "pending", label: "Still confirming" },
  { value: "failed", label: "Failed" },
];

function daysOverdue(dueAt: string): number {
  const day = 24 * 60 * 60 * 1000;
  const start = (iso: string | number) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  return Math.round((start(Date.now()) - start(dueAt)) / day);
}

/**
 * Pay a fee a task owes, in the payment window Join a case pays in: what is owed as
 * a short sheet — the fee, the case, when it was due, the amount — then Pay, the
 * gateway's round trip and the receipt. The gateway's answer is a sandbox control
 * under the flask, as there.
 */
export function TaskPaymentDialog({
  ctx,
  open,
  onOpenChange,
}: {
  ctx: ActContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { task, kase, online, finish } = ctx;
  const { act, busy } = useTaskActions();
  const [stage, setStage] = React.useState<PayStage>("pay");
  const [outcome, setOutcome] = React.useState<PaymentResult>("success");
  const [failed, setFailed] = React.useState(false);
  const [receipt, setReceipt] = React.useState("");
  const amount =
    task.amountPaise !== undefined ? rupees(task.amountPaise) : null;
  const overdue = task.dueAt ? daysOverdue(task.dueAt) : 0;

  async function pay() {
    setFailed(false);
    setStage("processing");
    await new Promise((resolve) => window.setTimeout(resolve, GATEWAY_MS));
    const t = await act(task.id, (x, c) => recordPayment(x, c, outcome));
    if (!t || outcome === "failed") {
      setFailed(true);
      setStage("pay");
      return;
    }
    if (outcome === "pending") {
      finish("Payment made — the gateway is confirming");
      return;
    }
    setReceipt(t.completion?.receipt ?? "");
    setStage("paid");
  }

  const title =
    stage === "processing"
      ? PAYMENT_PROCESSING_TITLE
      : stage === "paid"
        ? PAYMENT_SUCCESS_TITLE
        : task.title;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (stage === "processing") return;
        if (!next && stage === "paid") {
          finish(`Paid ${amount ?? ""}`.trim());
          return;
        }
        onOpenChange(next);
      }}
    >
      {/* Header and footer hold still; only the middle scrolls, so the act is always in reach. */}
      <FlowDialogContent className="flex max-h-[85svh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {stage === "paid" ? (
          /* The payment's outcome takes the window over (skill `feedback-states`). */
          <OutcomeHeader
            compact
            titleFrom="dialog"
            focusTitle
            title={title}
            body={<TaskCaseLine kase={kase} />}
          >
            {amount ? <OutcomeAmount label="Amount paid" value={amount} /> : null}
          </OutcomeHeader>
        ) : (
        <DialogHeader className="shrink-0 border-b border-hairline px-6 pt-6 pr-14 pb-4 text-left">
          <DialogTitle className="text-title-s font-semibold text-balance">
            {title}
          </DialogTitle>
          <DialogDescription className="text-body-compact text-muted-foreground">
            <TaskCaseLine kase={kase} />
          </DialogDescription>
        </DialogHeader>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        {stage === "pay" ? (
          <div className="flex flex-col gap-4">
            {failed ? (
              <StatusLine tone="error">
                The payment did not go through. Nothing was paid; try again.
              </StatusLine>
            ) : null}
            <DescriptionList className="rounded-xl bg-surface-sunken px-4 py-1">
              {task.feeHead ? (
                <DescriptionRow className="border-hairline">
                  <DescriptionTerm>Fee</DescriptionTerm>
                  <DescriptionDetails>{task.feeHead}</DescriptionDetails>
                </DescriptionRow>
              ) : null}
              <DescriptionRow className="border-hairline">
                <DescriptionTerm>Case</DescriptionTerm>
                <DescriptionDetails>
                  {kase.stNumber ? (
                    <Identifier value={kase.stNumber} label="case number" />
                  ) : (
                    kase.parties
                  )}
                </DescriptionDetails>
              </DescriptionRow>
              {task.dueAt ? (
                <DescriptionRow className="border-hairline">
                  <DescriptionTerm>Due</DescriptionTerm>
                  <DescriptionDetails className="tabular-nums">
                    {formatCaseDate(task.dueAt)}
                    {overdue > 0 ? (
                      <span className="text-destructive">
                        {" "}
                        · {overdue === 1 ? "1 day" : `${overdue} days`} overdue
                      </span>
                    ) : null}
                  </DescriptionDetails>
                </DescriptionRow>
              ) : null}
              {amount ? (
                <DescriptionRow className="border-hairline">
                  <DescriptionTerm>Amount</DescriptionTerm>
                  <DescriptionDetails className="font-semibold tabular-nums">
                    {amount}
                  </DescriptionDetails>
                </DescriptionRow>
              ) : null}
            </DescriptionList>
          </div>
        ) : null}

        {stage === "processing" ? <PaymentProcessing /> : null}

        {stage === "paid" ? (
          <PaymentFacts
            rows={[
              ...(task.feeHead ? [{ label: "Fee", value: task.feeHead }] : []),
              {
                label: "Case",
                value: kase.stNumber ? (
                  <Identifier value={kase.stNumber} label="case number" />
                ) : (
                  kase.parties
                ),
              },
              ...(receipt
                ? [
                    {
                      label: "Receipt",
                      value: <Identifier value={receipt} label="receipt number" />,
                    },
                  ]
                : []),
            ]}
          />
        ) : null}

        </div>

        {stage === "pay" ? (
          <DialogFooter className="mx-0 mb-0 shrink-0 gap-2 border-hairline bg-surface-sunken px-6 py-4 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Pay later
            </Button>
            <div className="flex items-center gap-2">
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
                    <DropdownMenuRadioGroup
                      value={outcome}
                      onValueChange={(value) => setOutcome(value as PaymentResult)}
                    >
                      {OUTCOMES.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipProvider>
              <Button
                type="button"
                disabled={!online || Boolean(busy)}
                className="flex-1 sm:flex-none"
                onClick={() => void pay()}
              >
                {amount ? `Pay ${amount}` : "Pay"}
              </Button>
            </div>
          </DialogFooter>
        ) : null}

        {stage === "paid" ? (
          <DialogFooter className="mx-0 mb-0 shrink-0 border-hairline bg-surface-sunken px-6 py-4">
            <Button
              type="button"
              onClick={() => finish(`Paid ${amount ?? ""}`.trim())}
            >
              Done
            </Button>
          </DialogFooter>
        ) : null}
      </FlowDialogContent>
    </Dialog>
  );
}

/* ──────────────────────────────── documents ──────────────────────────────── */

/**
 * File the document a task asks for, in View case's Submit documents: opened with the
 * document's type and name, so only the file is left to add. Submitting files the task
 * with the court.
 */
export function TaskDocumentsDialog({
  ctx,
  open,
  onOpenChange,
}: {
  ctx: ActContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { task, kase, finish } = ctx;
  const { act } = useTaskActions();
  return (
    <SubmitDocumentsDialog
      key={task.id}
      open={open}
      onOpenChange={onOpenChange}
      caseLine={<TaskCaseLine kase={kase} />}
      initial={{
        type: documentTypeOf(task),
        title: documentTitleOf(task),
      }}
      onSubmitted={() => {
        void act(task.id, (x, c) => file(x, c)).then((t) => {
          if (t) finish("Filed — awaiting scrutiny");
        });
      }}
    />
  );
}

/* ─────────────────────────────── applications ─────────────────────────────── */

/**
 * The task's case as Raise application needs it, built from what the task's case
 * holds — the way a case joined a moment ago is (`joined-case-bail.tsx`). The filer is
 * the person at this keyboard, for the complainant, as the tasks' cases are.
 */
function recordOf(kase: Case, filerName: string): CaseRecord {
  const [complainant, accused] = kase.parties.split(/\s+v\.?\s+/);
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `task-${kase.id}`,
    caseNumber: kase.stNumber || kase.cnr,
    parties: { complainant: complainant ?? kase.parties, accused: accused ?? "" },
    counsel: { complainant: [filerName] },
    court: kase.court,
    filedOn: today,
    updatedOn: today,
    latestUpdate: "",
    stage: "appearance",
    longPending: false,
    bookmarked: false,
  };
}

/**
 * File the application a task asks for, in View case's Raise application: opened
 * over the page at the type the task names. Finishing it files the task.
 */
export function TaskApplicationFlow({
  ctx,
  onClose,
}: {
  ctx: ActContext;
  onClose: () => void;
}) {
  const { task, kase, user, finish } = ctx;
  const { act } = useTaskActions();
  const record = React.useMemo(() => recordOf(kase, user.name), [kase, user.name]);
  const filer: ApplicationViewer = {
    role: "advocate",
    side: "complainant",
    personId: `${record.id}-counsel-c-0`,
  };
  return (
    <RaiseApplicationForm
      key={task.id}
      record={record}
      initialType={applicationTypeOf(task)}
      filer={filer}
      inPlace={{
        onClose,
        done: {
          label: "Done",
          onClick: () => {
            void act(task.id, (x, c) => file(x, c)).then((t) => {
              if (t) finish("Application filed");
              else onClose();
            });
          },
        },
      }}
    />
  );
}
