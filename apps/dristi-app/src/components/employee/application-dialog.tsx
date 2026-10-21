"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DocumentPreview } from "@/components/cases/document-preview";
import { ReviewRow } from "@/components/cases/filing-form-shared";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";
import { ApplicationFacsimile } from "@/components/employee/application-review-dialog";
import { useCourtRole } from "@/components/employee/use-court-role";
import { useOrderSigning } from "@/components/employee/use-order-signing";
import { usePendingOrders } from "@/components/employee/use-pending-orders";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/description-list";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { Separator } from "@/components/ui/separator";
import { decodeDraft } from "@/lib/applications/form-codec";
import {
  canDraftOrder,
  canSignOrder,
  discardOrder,
  signOrder,
  type CourtSeat,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";
import {
  allotOrderId,
  applyStep,
  today,
  useLifecycleApplications,
} from "@/lib/applications/store";
import { formatCaseDate, partiesLabel } from "@/lib/cases/types";
import { CURRENT_STAFF } from "@/lib/employee/content";
import { applicationOrderHref } from "@/lib/employee/application-order-decision";
import { nextApplicationOrderKey } from "@/lib/employee/application-order-draft";
import {
  objectionLine,
  queueOf,
  shortDate,
  statusLine,
} from "@/lib/employee/application-queue";
import {
  caseOf,
  causeTitleOf,
  courtDocumentOf,
  nextHearingOf,
} from "@/lib/employee/application-tasks";
import {
  pendingOrderHref,
  pendingOrderStage,
  pendingOrderStageLabel,
} from "@/lib/employee/pending-orders";

const QUEUE_LABEL: Record<string, string> = {
  onboard: "To onboard",
  decide: "To decide",
  signing: "Order awaiting signature",
  later: "Upcoming",
  closed: "Closed",
  archive: "Archive",
};

/**
 * One application, opened from the Applications list as a pop-up (owner, 2026-10-21: the
 * list beside the application "is actually a distraction … make this a pop-up like it was
 * before").
 *
 * The left holds the facts and what can be done; the right is the paper. Once the
 * application has been onboarded, the papers linked to it — **the order(s) already passed
 * on it** and **the objection** from the other side — are read in the same place, a switch
 * above the paper, so they are read in the application's context rather than looked up.
 *
 * **Every act is an order** (owner, 2026-10-21). Onboarding, when it will be decided and
 * whether objections are called for are not a system action here any more: *Pass an
 * order* opens the order screen, where they are the Application item of the order's data
 * (`application-outcome.ts`). The application moves once that order is signed and its
 * data complete (`application-outcome-steps.ts`).
 */
export function ApplicationDialog({
  applicationId,
  view,
  onOpenChange,
  onReturnFocus,
}: {
  applicationId: string | null;
  /** The list it was opened from, carried to the order screen for the way back. */
  view: string;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
}) {
  const apps = useLifecycleApplications();
  const app = applicationId
    ? apps.find((item) => item.id === applicationId)
    : undefined;
  return (
    <Dialog open={Boolean(app)} onOpenChange={onOpenChange}>
      {app ? (
        <ApplicationDialogBody
          key={app.id}
          app={app}
          all={apps}
          view={view}
          onClose={() => onOpenChange(false)}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

type Paper = {
  id: string;
  /** The switch's word for it. */
  label: string;
  /** The preview's title. */
  title: string;
  content: React.ReactNode;
};

function ApplicationDialogBody({
  app,
  all,
  view,
  onClose,
  onReturnFocus,
}: {
  app: LifecycleApplication;
  all: LifecycleApplication[];
  view: string;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const router = useRouter();
  const courtText = useCourtText();
  const seat = useCourtRole() as CourtSeat;
  const on = today();
  const record = caseOf(app);
  const queue = queueOf(app, on);
  const closed = queue === "closed" || queue === "archive";
  const document = React.useMemo(() => courtDocumentOf(app), [app]);
  const objection = app.objectionId
    ? all.find((item) => item.id === app.objectionId)
    : undefined;
  const [error, setError] = React.useState<string | null>(null);

  /* The order to pass next on it, and whether one is already under way. */
  const orders = usePendingOrders();
  const signing = useOrderSigning();
  const orderKey = nextApplicationOrderKey(app);
  const started = orders[orderKey];
  const stage = started ? pendingOrderStage(started, signing) : null;
  const underWay = Boolean(started && stage && stage !== "triggered");

  /* The application first, then what is linked to it: its objection, and the orders
     passed on it, latest last — the order the case file reads them in. */
  const papers = React.useMemo<Paper[]>(() => {
    const list: Paper[] = [];
    list.push({
      id: "application",
      label: "Application",
      title: document?.title ?? app.typeLabel,
      content: document ? (
        <ApplicationFacsimile document={document} />
      ) : (
        <p className="p-6 text-body text-muted-foreground">
          The application&rsquo;s text could not be read from what was filed.
        </p>
      ),
    });
    if (objection) {
      const objectionDocument = courtDocumentOf(objection);
      list.push({
        id: "objection",
        label: "Objection",
        title: `Objection from the ${objection.side}`,
        content:
          objectionDocument && objectionDocument.paragraphs.length > 0 ? (
            <ApplicationFacsimile document={objectionDocument} />
          ) : (
            <ObjectionPaper objection={objection} court={courtText(`Before the ${CURRENT_STAFF.court}`)} />
          ),
      });
    }
    const passed = app.orders ?? [];
    passed.forEach((order, index) => {
      list.push({
        id: `order-${order.key}`,
        label:
          passed.length === 1
            ? "Previous order"
            : `Order ${index + 1} · ${shortDate(order.signedOn)}`,
        title: `Order ${order.id}`,
        content: (
          <OrderPaper
            court={courtText(`Before the ${CURRENT_STAFF.court}`)}
            caseNumber={record?.caseNumber}
            matter={record ? partiesLabel(record) : causeTitleOf(app)}
            id={order.id}
            title={order.title}
            text={order.text}
            signedOn={order.signedOn}
          />
        ),
      });
    });
    /* An order signed before orders were recorded on the application: the one that
       closed it. */
    if (passed.length === 0 && app.linkedOrder) {
      const order = app.linkedOrder;
      list.push({
        id: "order-linked",
        label: "Previous order",
        title: `Order ${order.id}`,
        content: (
          <OrderPaper
            court={courtText(`Before the ${CURRENT_STAFF.court}`)}
            caseNumber={record?.caseNumber}
            matter={record ? partiesLabel(record) : causeTitleOf(app)}
            id={order.id}
            text={order.text}
            signedOn={order.signedOn}
          />
        ),
      });
    }
    return list;
  }, [app, document, objection, record, courtText]);
  const [paperId, setPaperId] = React.useState("application");
  const paper = papers.find((item) => item.id === paperId) ?? papers[0];

  function passOrder() {
    router.push(applicationOrderHref(app.id, undefined, view));
  }

  function run(result: ReturnType<typeof applyStep>, message: string) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    toast.success(message);
  }

  /* What can be done with it now — under the facts — and the one primary act. */
  let action: React.ReactNode = null;
  let primary: React.ReactNode = null;
  if (closed) {
    action = <ClosedRecord app={app} />;
  } else if (app.pendingOrder) {
    /* Drafted in the dialog before the order screen took over: still to sign or discard. */
    action = (
      <ActionBlock
        title={
          canSignOrder(seat) ? "Order awaiting your signature" : "Awaiting the Magistrate’s signature"
        }
        lead={`Drafted on ${formatCaseDate(app.pendingOrder.draftedOn)}.`}
      >
        <p className="line-clamp-4 text-body-compact">{app.pendingOrder.text}</p>
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          onClick={() =>
            run(applyStep(app.id, (current) => discardOrder(current, on)), "Draft discarded.")
          }
        >
          Discard draft
        </Button>
      </ActionBlock>
    );
    primary = canSignOrder(seat) ? (
      <Button
        type="button"
        onClick={() => {
          const orderId = allotOrderId();
          run(
            applyStep(app.id, (current) => signOrder(current, seat, orderId, on)),
            `Order ${orderId} signed.`,
          );
        }}
      >
        Sign order
      </Button>
    ) : null;
  } else if (underWay && started && stage) {
    action = (
      <ActionBlock
        title="Order in progress"
        lead={`${pendingOrderStageLabel(stage)}. The application moves once the order is signed and its order data is complete.`}
      />
    );
    primary = (
      <Button
        type="button"
        onClick={() =>
          router.push(stage === "drafting" ? started.orderHref : pendingOrderHref(orderKey))
        }
      >
        Open the order
      </Button>
    );
  } else if (canDraftOrder(seat)) {
    action = (
      <ActionBlock
        title={app.status === "pending-review" ? "Onboard it by order" : "Decide it by order"}
        lead={
          app.status === "pending-review"
            ? "Whether it is onboarded, when it will be decided and whether objections are called for are answered in the order’s data."
            : "Whether it is decided, what was decided, or when it comes back and whether the other party responds, are answered in the order’s data."
        }
      />
    );
    primary = (
      <Button type="button" onClick={passOrder}>
        Pass an order
      </Button>
    );
  }

  return (
    <ChromeDialogContent
      className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl md:h-[90dvh] xl:max-w-6xl"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
    >
      <DialogHeader className="shrink-0 gap-2 p-6 pr-16">
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle className="text-title-s font-semibold">{app.typeLabel}</DialogTitle>
          <StageBadge app={app} on={on} />
        </div>
        <DialogDescription className="text-body-compact text-muted-foreground">
          {causeTitleOf(app)}
          {record ? (
            <>
              {" · "}
              <Identifier value={record.caseNumber} label="case number" />
            </>
          ) : null}
        </DialogDescription>
      </DialogHeader>
      <Separator />

      <div className="grid min-h-0 flex-1 grid-rows-[auto_auto] gap-6 overflow-y-auto p-6 md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:grid-rows-1">
        <div className="flex flex-col gap-6 xl:min-h-0 xl:overflow-y-auto">
          <div className="rounded-lg bg-surface-sunken p-4">
            <DescriptionList>
              <Facts app={app} on={on} />
            </DescriptionList>
          </div>
          {action}
          {error ? <Banner variant="error">{error}</Banner> : null}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          {/* The linked papers, read in place of the application (owner, 2026-10-21). */}
          {papers.length > 1 ? (
            <SegmentedControl
              type="single"
              size="compact"
              value={paper.id}
              onValueChange={(next) => {
                if (next) setPaperId(next);
              }}
              aria-label="Which paper to read"
              className="w-full overflow-x-auto sm:w-fit"
            >
              {papers.map((item) => (
                <SegmentedControlItem key={item.id} value={item.id}>
                  {item.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          ) : null}
          <DocumentPreview
            key={paper.id}
            className="min-h-96 md:min-h-0"
            height="fill"
            title={paper.title}
            source={{ kind: "composed", content: paper.content }}
          />
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 shrink-0">
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
        {primary}
      </DialogFooter>
    </ChromeDialogContent>
  );
}

function ActionBlock({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body font-semibold">{title}</h3>
      {lead ? <p className="text-body-compact text-muted-foreground">{lead}</p> : null}
      {children}
    </section>
  );
}

function StageBadge({ app, on }: { app: LifecycleApplication; on: string }) {
  const queue = queueOf(app, on);
  if (queue === "closed" || queue === "archive") {
    return (
      <Badge
        variant={
          app.status === "accepted"
            ? "success"
            : app.status === "rejected" || app.status === "dismissed"
              ? "destructive"
              : "secondary"
        }
      >
        {app.decisionLabel || statusLine(app, on).word}
      </Badge>
    );
  }
  return <Badge variant="info">{QUEUE_LABEL[queue ?? "all"] ?? "Open"}</Badge>;
}

/**
 * The facts a bench checks first, always the same ones: when it is due, the objection,
 * the next hearing, its number, and who filed it when.
 */
function Facts({ app, on }: { app: LifecycleApplication; on: string }) {
  const queue = queueOf(app, on);
  const closed = queue === "closed" || queue === "archive";
  const line = statusLine(app, on);
  const hearing = nextHearingOf(app, on);
  const number = app.applicationNumber ?? app.temporaryId;
  const due = closed
    ? (app.decisionLabel ?? line.word)
    : app.review
      ? `Review by ${shortDate(app.review.dueOn)}`
      : app.decide
        ? `Listed for ${shortDate(app.decide.dueOn)}`
        : "—";
  return (
    <>
      <ReviewRow term={closed ? "Outcome" : "Due"}>
        <span className="flex flex-wrap items-center gap-2">
          {due}
          {!closed && line.due === "overdue" ? <Badge variant="destructive">Overdue</Badge> : null}
          {!closed && line.due === "today" ? <Badge variant="warning">Due today</Badge> : null}
        </span>
      </ReviewRow>
      <ReviewRow term="Objection">{objectionLine(app, on)}</ReviewRow>
      <ReviewRow term="Next hearing">{hearing ? shortDate(hearing) : "None listed"}</ReviewRow>
      <ReviewRow term={app.applicationNumber ? "Application no." : "Temporary no."}>
        {number ? (
          <Identifier
            value={number}
            label={app.applicationNumber ? "application number" : "temporary number"}
          />
        ) : (
          "—"
        )}
      </ReviewRow>
      <ReviewRow term="Filed">
        {formatCaseDate(app.submittedOn ?? app.createdOn)} by {app.raisedBy ?? app.createdByName}, for
        the {app.side}
      </ReviewRow>
    </>
  );
}

function ClosedRecord({ app }: { app: LifecycleApplication }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-body font-semibold">History</h3>
      <ol className="flex flex-col gap-2">
        {app.history.map((event, index) => (
          <li key={index} className="grid grid-cols-[5rem_1fr] gap-3 text-body-compact">
            <span className="tabular-nums text-muted-foreground">{shortDate(event.on)}</span>
            <span>{event.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** An order passed on the application, set as paper, as the application is. */
function OrderPaper({
  court,
  caseNumber,
  matter,
  id,
  title,
  text,
  signedOn,
}: {
  court: string;
  caseNumber?: string;
  matter: string;
  id: string;
  title?: string;
  text: string;
  signedOn: string;
}) {
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{court}</p>
        {caseNumber ? <p className="text-body font-semibold">Case no. {caseNumber}</p> : null}
        <p className="text-body font-semibold">{matter}</p>
        <p className="text-body-compact text-paper-muted-foreground">
          Order {id} · {formatCaseDate(signedOn)}
        </p>
      </header>
      {title ? <h3 className="text-center text-body font-semibold">{title}</h3> : null}
      <p className="text-body whitespace-pre-wrap">
        {text.trim() || "The order's words were not recorded."}
      </p>
      <footer className="flex flex-col items-end gap-2">
        <p className="text-body-compact text-paper-muted-foreground">
          Signed by the Judicial Magistrate of the First Class on {formatCaseDate(signedOn)}
        </p>
      </footer>
    </article>
  );
}

/** An objection whose filing carries only its grounds. */
function ObjectionPaper({
  objection,
  court,
}: {
  objection: LifecycleApplication;
  court: string;
}) {
  const reason = decodeDraft(objection.form).objectionReason;
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{court}</p>
        <p className="text-body font-semibold">{causeTitleOf(objection)}</p>
        <p className="text-body-compact text-paper-muted-foreground">
          Received {formatCaseDate(objection.submittedOn ?? objection.createdOn)}
        </p>
      </header>
      <h3 className="text-center text-body font-semibold">
        Objection on behalf of the {objection.side}
      </h3>
      <p className="text-body whitespace-pre-wrap">{reason || "No grounds were entered."}</p>
      <footer className="flex flex-col items-end gap-2">
        <p className="text-body-compact text-paper-muted-foreground">
          Filed by {objection.raisedBy ?? objection.createdByName}
        </p>
      </footer>
    </article>
  );
}
