"use client";

import * as React from "react";
import { CircleCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { DiscardQuestion, useDiscardGuard } from "@/components/chrome/discard-guard";
import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";
import { Identifier } from "@/components/chrome/identifier";
import { useStageFade } from "@/components/chrome/stage-fade";
import { StagedOverlay } from "@/components/chrome/staged-overlay";
import { DocumentPreview } from "@/components/cases/document-preview";
import {
  useCourtLocalized,
  useCourtText,
} from "@/components/court/court-provider";
import {
  SignedCopyUpload,
  useSignatureChoice,
} from "@/components/employee/sign-signature-fields";
import { useHeldRecord } from "@/components/employee/use-held-record";
import { PaperFallbackLink } from "@/components/filing/paper-fallback";
import {
  DscLookup,
  InstrumentChoice,
  OtpEntry,
} from "@/components/filing/sign-stages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import { causeTitle } from "@/lib/employee/hearings";
import {
  buildSignOrderDocument,
  downloadSignOrderDocument,
  formatSignOrderDate,
  signOrderStatusLabel,
  signOrderTypeLabel,
  type SignOrder,
  type SignOrderDocument,
} from "@/lib/employee/sign-orders";
import { cn } from "@/lib/utils";

/**
 * **Signing orders — one window, from the order to its publication** (owner, 2026-10-14).
 *
 * The signing window the filing flow defined (`filing/sign-flow-dialog.tsx`), fitted to
 * the bench: the two instruments a person e-signs with, Aadhaar OTP and a DSC, are the
 * first thing on the signing stage rather than one press behind "Sign digitally" — the
 * bench has no one else to send a link to, so there is no prior decision to make — and
 * paper is the secondary line beneath them, as it is there. Signing an order publishes
 * it, so the outcome says both, in the scene the act happened in, and a toast confirms
 * it once the window has gone.
 *
 * Two ways in, one window:
 *
 * `read` — one order, opened from its row: the order itself, then **Sign and publish**.
 *   A signed order opens here too, to be read; it has nothing to press.
 * `confirm` — orders selected in bulk: what is about to be signed, as a list to check
 *   against, at the signing stage's own width so the window does not grow under it.
 *
 * Then `sign` (the instrument, or the paper link for a single order), `otp` / `dsc` /
 * `paper` (that instrument doing its one job) and `done` (signed and issued).
 *
 * **The window takes each step's own size** (owner, 2026-10-14). Holding the reading
 * stage's 85dvh for a two-card question left it floating in tint, so the order is read
 * in the wide, tall window and every later step in the signing width at its own height.
 * The size changes the product's approved way (`useStageFade`, from Join a Case): the
 * window fades out, takes the next step and its size while it is clear, and fades back
 * in with the step drifting a hint the way the person is going. A resize is never seen.
 *
 * **Nothing is signed or published.** Submitting marks the rows signed in the demo
 * queue (`lib/employee/sign-orders.ts`); no e-sign provider is called and nothing is
 * filed, and the instrument stages say so where they stand in for a service.
 */

type Stage = "read" | "confirm" | "sign" | "otp" | "dsc" | "paper" | "done";

export type SignOrderFlowStart = "read" | "confirm";

/* The stage a window opens on leads its own order — the direction a stage travels is
   read from it. */
const ORDER: Record<SignOrderFlowStart, readonly Stage[]> = {
  read: ["read", "sign", "otp", "dsc", "paper", "done", "confirm"],
  confirm: ["confirm", "sign", "otp", "dsc", "paper", "done", "read"],
};

type Instrument = "aadhaar" | "dsc" | "paper";

const SIGNED_WITH: Record<Instrument, string> = {
  aadhaar: "Signed with Aadhaar OTP",
  dsc: "Signed with your DSC",
  paper: "Signed on paper and uploaded",
};

export type SignOrderFlowRequest = {
  orders: SignOrder[];
  start: SignOrderFlowStart;
};

function orders(count: number): string {
  return count === 1 ? "1 order" : `${count} orders`;
}

export function SignOrderFlow({
  request,
  onOpenChange,
  onSign,
  onReturnFocus,
}: {
  request: SignOrderFlowRequest | null;
  onOpenChange: (open: boolean) => void;
  /** The act: these orders are signed, and so published. */
  onSign: (ids: ReadonlySet<string>) => void;
  onReturnFocus: () => void;
}) {
  const { held, opening } = useHeldRecord(request);
  /* How many this opening signed, for the toast once the window has gone. */
  const signedCount = React.useRef(0);

  /* However the window is put away — Done, Back, Close or Escape — a signing it holds
     is confirmed once more as it goes, over the list it changed. */
  function close() {
    const count = signedCount.current;
    signedCount.current = 0;
    if (count > 0) toast.success(`${orders(count)} signed and issued`);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {held ? (
        <SignOrderFlowBody
          key={opening}
          request={held}
          onSigned={(count) => {
            signedCount.current = count;
          }}
          onSign={onSign}
          onClose={close}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function SignOrderFlowBody({
  request,
  onSigned,
  onSign,
  onClose,
  onReturnFocus,
}: {
  request: SignOrderFlowRequest;
  onSigned: (count: number) => void;
  onSign: (ids: ReadonlySet<string>) => void;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const courtText = useCourtText();
  const { start } = request;
  /* The orders as they were when the window opened: signing takes them out of the queue
     behind it, and the outcome still names them. */
  const [list] = React.useState(request.orders);
  const single = list.length === 1 ? list[0] : null;
  const pending = list.every((order) => order.status === "pending-signature");
  const flow = useStageFade<Stage>(start, ORDER[start]);
  const go = flow.setStage;
  /* Focus follows the step: the button just pressed is unmounted with its footer, so the
     title takes focus, as on every staged overlay. */
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (!flow.changed) return;
    const active = window.document.activeElement;
    if (!active || active === window.document.body || !active.isConnected) {
      titleRef.current?.focus();
    }
  }, [flow.stage, flow.changed]);
  const choice = useSignatureChoice("order");
  const [otp, setOtp] = React.useState("");
  const guard = useDiscardGuard(
    flow.stage !== "done" && (otp.length > 0 || choice.entered),
    onClose,
  );
  const [resent, setResent] = React.useState(false);
  const [dscFound, setDscFound] = React.useState(false);
  const [signedWith, setSignedWith] = React.useState<Instrument | null>(null);
  const document = React.useMemo(
    () => (single ? buildSignOrderDocument(single) : null),
    [single],
  );

  /* The certificate is read off this computer, and the utility takes a beat to answer. */
  React.useEffect(() => {
    if (flow.stage !== "dsc" || dscFound) return;
    const timer = window.setTimeout(() => setDscFound(true), 1100);
    return () => window.clearTimeout(timer);
  }, [flow.stage, dscFound]);

  function signAll(instrument: Instrument) {
    onSign(new Set(list.map((order) => order.id)));
    onSigned(list.length);
    setSignedWith(instrument);
    go("done");
  }

  const count = orders(list.length);
  /* Back from the instrument choice goes to where the window began. */
  const before: Stage = start;

  const title = {
    read: single ? signOrderTypeLabel(single.type) : "",
    confirm: `Sign ${count}`,
    sign: single ? "Sign and publish" : `Sign ${count}`,
    otp: "Enter the OTP",
    dsc: "Sign with your DSC",
    paper: "Upload the signed order",
    done: single ? "Order signed and issued" : `${count} signed and issued`,
  }[flow.stage];

  /* The record's own line while there is one record: it is what stays put as the stage
     changes, and it keeps the signature attached to the paper just read. */
  const recordLine = single ? (
    <DialogDescription className="text-body-compact text-muted-foreground">
      {causeTitle(single)} <span aria-hidden>· </span>
      <Identifier
        value={single.caseNumber}
        label="case number"
        copyable={false}
      />{" "}
      ·{" "}
      {single.status === "pending-signature"
        ? `Added ${formatSignOrderDate(single.addedOn)}`
        : `Signed ${formatSignOrderDate(single.signedOn ?? single.addedOn)}`}
    </DialogDescription>
  ) : null;

  const description = {
    read: recordLine,
    confirm:
      "Each is signed with your signature and published to its case file. This cannot be reversed.",
    sign: single ? recordLine : "One signature goes on every order selected.",
    otp: "Sent to your Aadhaar-linked mobile.",
    dsc: "Your certificate has to be plugged in, with the signing utility running on this computer.",
    paper: "Print the order, sign it by hand, and upload the scan.",
    done: null,
  }[flow.stage];

  const footer = {
    read: pending ? (
      <Button type="button" onClick={() => go("sign")}>
        Sign and publish
      </Button>
    ) : null,
    confirm: (
      <>
        <Button type="button" variant="outline" onClick={onClose}>
          Back
        </Button>
        <Button type="button" onClick={() => go("sign")}>
          Sign {count}
        </Button>
      </>
    ),
    sign: (
      <Button type="button" variant="outline" onClick={() => go(before)}>
        Back
      </Button>
    ),
    otp: (
      <>
        <Button type="button" variant="outline" onClick={() => go("sign")}>
          Back
        </Button>
        <Button
          type="button"
          disabled={otp.length < 6}
          onClick={() => signAll("aadhaar")}
        >
          Verify and sign
        </Button>
      </>
    ),
    dsc: (
      <>
        <Button type="button" variant="outline" onClick={() => go("sign")}>
          Back
        </Button>
        <Button
          type="button"
          disabled={!dscFound}
          onClick={() => signAll("dsc")}
        >
          Sign with this certificate
        </Button>
      </>
    ),
    paper: (
      <>
        <Button type="button" variant="outline" onClick={() => go("sign")}>
          Back
        </Button>
        <Button
          type="button"
          disabled={!choice.file}
          onClick={() => signAll("paper")}
        >
          Submit signed copy
        </Button>
      </>
    ),
    done: (
      <Button type="button" onClick={onClose}>
        Done
      </Button>
    ),
  }[flow.stage];

  return (
    <StagedOverlay
      {...guard.contentProps}
      {...guard.outsideProps}
      /* The order is read wide and tall; every other step, a bulk run's list included,
         is the signing width at its own height. */
      className={
        flow.stage === "read" ? "h-[85dvh] sm:max-w-4xl" : "sm:max-w-2xl"
      }
      title={title}
      titleRef={titleRef}
      style={flow.panelStyle}
      titleAside={
        single && (flow.stage === "read" || flow.stage === "sign") ? (
          <Badge variant={pending ? "warning" : "success"}>
            {signOrderStatusLabel(single.status)}
          </Badge>
        ) : null
      }
      description={description}
      /* One scene for the window's life: the steps move by `useStageFade`, in the keyed
         wrapper below, so the overlay's own slide plays only as the window opens. */
      sceneKey="steps"
      motion="forward"
      /* The row that opened the window is gone by the time it closes — signing takes it
         out of the queue — so the screen says where focus goes. */
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
      footer={footer}
    >
      <div
        key={flow.stage}
        className={cn("flex min-h-0 flex-1 flex-col", flow.sceneClassName)}
      >
        {flow.stage === "read" && single && document ? (
          <DocumentPreview
            className="min-h-0 flex-1"
            height="fill"
            variant="quiet"
            surface="card"
            title={document.title}
            header={
              <h3 className="flex min-w-0 items-center pl-4 text-caption font-semibold text-muted-foreground">
                {pending ? "Order for your signature" : "Signed order"}
              </h3>
            }
            source={{
              kind: "composed",
              content: <OrderFacsimile document={document} />,
            }}
            download={{
              onDownload: () => downloadSignOrderDocument(single),
              label: `Download the ${document.title.toLowerCase()} order`,
            }}
          />
        ) : flow.stage === "confirm" ? (
          <Column>
            <OrderList list={list} />
          </Column>
        ) : flow.stage === "sign" ? (
          <Column>
            <InstrumentChoice
              onAadhaar={() => {
                setOtp("");
                go("otp");
              }}
              onDsc={() => {
                setDscFound(false);
                go("dsc");
              }}
            />
            {/* Paper is one order's route: a signed scan is one document, and a bulk run
                has none to offer. */}
            {single ? <PaperFallbackLink onClick={() => go("paper")} /> : null}
            <p className="text-body-compact text-muted-foreground">
              {single
                ? courtText(
                    `Signing publishes this order to ${single.caseNumber}. It cannot be reversed.`,
                  )
                : "Signing publishes every order selected. It cannot be reversed."}
            </p>
          </Column>
        ) : flow.stage === "otp" ? (
          <Column>
            <OtpEntry
              id="sign-order-otp"
              value={otp}
              onChange={setOtp}
              resent={resent}
              onResend={() => setResent(true)}
            />
          </Column>
        ) : flow.stage === "dsc" ? (
          <Column>
            <DscLookup found={dscFound} holder="" />
          </Column>
        ) : flow.stage === "paper" ? (
          <Column>
            <SignedCopyUpload choice={choice} noun="order" />
          </Column>
        ) : flow.stage === "done" ? (
          <Column>
            <SignedCard
              list={list}
              headline={signedWith ? SIGNED_WITH[signedWith] : "Signed"}
            />
          </Column>
        ) : null}
      </div>
      <DiscardQuestion guard={guard} />
    </StagedOverlay>
  );
}

/** A step's column at reading width, in the signing window. */
function Column({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {children}
    </div>
  );
}

/** One order as a row: which decision it is, then its case. */
function OrderRow({
  order,
  trailing,
}: {
  order: SignOrder;
  trailing?: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 items-center gap-3 border-b border-hairline py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-body-compact font-medium">
          {signOrderTypeLabel(order.type)}
        </p>
        <p className="truncate text-body-compact text-muted-foreground">
          {causeTitle(order)} <span aria-hidden>· </span>
          <Identifier
            value={order.caseNumber}
            label="case number"
            copyable={false}
          />
        </p>
      </div>
      {trailing}
    </li>
  );
}

/** The orders selected, to check against before signing them. */
function OrderList({ list }: { list: SignOrder[] }) {
  return (
    <ul
      aria-label="Orders to sign"
      className="flex flex-col rounded-xl border border-hairline bg-card px-4 shadow-raised"
    >
      {list.map((order) => (
        <OrderRow key={order.id} order={order} />
      ))}
    </ul>
  );
}

/**
 * What just happened, on the thing it happened to — the product's settled card: the
 * outcome across the top in the success pair, the orders it happened to beneath, and
 * where they went.
 */
function SignedCard({
  list,
  headline,
}: {
  list: SignOrder[];
  headline: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-hairline bg-card shadow-raised",
        RESOLVE_IN_PLACE,
      )}
    >
      <div className="flex items-center gap-2 bg-success-muted px-4 py-2.5 text-body-compact text-success-muted-foreground">
        <CircleCheckIcon aria-hidden className="size-4 shrink-0" />
        <span role="status" className="font-medium">
          {headline}
        </span>
      </div>
      <ul className="flex flex-col px-4">
        {list.map((order) => (
          <OrderRow key={order.id} order={order} />
        ))}
      </ul>
      <p className="border-t border-hairline px-4 py-3 text-body-compact text-muted-foreground">
        {list.length === 1
          ? "Published to its case file."
          : "Each is published to its own case file."}
      </p>
    </div>
  );
}

/** The order itself as paper, bound to this order's own particulars. */
function OrderFacsimile({
  document: storedDocument,
}: {
  document: SignOrderDocument;
}) {
  const document = useCourtLocalized(storedDocument);
  return (
    <article className="flex flex-col gap-6 p-4 text-paper-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{document.court}</p>
        <p className="text-body font-semibold">
          Case no. {document.caseNumber}
        </p>
        <p className="text-body font-semibold">{document.matter}</p>
      </header>

      <h3 className="text-center text-body font-semibold">{document.title}</h3>

      <ol className="flex list-decimal flex-col gap-3 ps-6">
        {document.paragraphs.map((paragraph, index) => (
          <li key={index} className="text-body">
            {paragraph}
          </li>
        ))}
      </ol>

      <p className="text-body">Dated this the {document.dated}.</p>

      <p className="text-body text-paper-muted-foreground">
        {document.signature}
      </p>
    </article>
  );
}
