"use client";

import * as React from "react";
import {
  BuildingIcon,
  CreditCardIcon,
  LockIcon,
  SmartphoneIcon,
} from "lucide-react";

import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PayMode = "card" | "upi" | "neft";

type Stage = "choose" | "card-otp" | "upi-wait" | "neft-wait" | "paying";

/** Groups of four as typed: "4111 1111 1111 1111". */
const groupCard = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

/**
 * A sandbox payment gateway for the court fee: card (with the bank's OTP), UPI (approve
 * in the app), or NEFT (transfer to the court's virtual account, then the gateway finds
 * it). Nothing is charged; each route ends by calling `onPaid` with how it was paid.
 */
export function PaymentGateway({
  amount,
  cases,
  onPaid,
  onCancel,
}: {
  amount: number;
  cases: number;
  onPaid: (mode: PayMode) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = React.useState<PayMode>("upi");
  const [stage, setStage] = React.useState<Stage>("choose");
  // The sandbox's own test details, filled in so a demo runs without typing.
  const [card, setCard] = React.useState({
    number: "4111 1111 1111 1111",
    expiry: "12/30",
    cvv: "123",
    name: "Anjali Parmar",
  });
  const [upi, setUpi] = React.useState("tatacapital.legal@okhdfc");
  const [otp, setOtp] = React.useState("");
  const [tried, setTried] = React.useState(false);
  const [left, setLeft] = React.useState(0);
  // A reference for this attempt, made once.
  const [reference] = React.useState(
    () => `SARAS${Math.random().toString().slice(2, 10)}`,
  );

  const cardErrors = {
    number:
      card.number.replace(/\D/g, "").length === 16
        ? null
        : "Enter the 16-digit card number",
    expiry: /^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)
      ? null
      : "Enter the expiry as MM/YY",
    cvv: /^\d{3}$/.test(card.cvv) ? null : "Enter the 3-digit CVV",
    name: card.name.trim() ? null : "Enter the name on the card",
  };
  const upiError = /^[\w.-]+@[\w]+$/.test(upi.trim())
    ? null
    : "Enter a UPI ID, such as name@bank";

  // UPI approval and the NEFT check each wait a few seconds, then go through.
  React.useEffect(() => {
    if (stage !== "upi-wait" && stage !== "neft-wait") return;
    const t = window.setTimeout(() => {
      if (left <= 1) setStage("paying");
      else setLeft(left - 1);
    }, 1000);
    return () => window.clearTimeout(t);
  }, [stage, left]);
  // Paid once only, however often the parent redraws.
  const paid = React.useRef(false);
  React.useEffect(() => {
    if (stage === "paying" && !paid.current) {
      paid.current = true;
      onPaid(mode);
    }
  }, [stage, mode, onPaid]);

  const start = () => {
    setTried(true);
    if (mode === "card") {
      if (Object.values(cardErrors).some(Boolean)) return;
      setStage("card-otp");
    } else if (mode === "upi") {
      if (upiError) return;
      setLeft(5);
      setStage("upi-wait");
    } else {
      setLeft(4);
      setStage("neft-wait");
    }
  };

  return (
    <div className="flex flex-col">
      {/* The gateway's own header: who is being paid, how much, that it is secure. */}
      <div className="flex items-start justify-between gap-4 border-b border-hairline bg-surface-sunken px-6 py-4 pr-12">
        <div className="flex flex-col gap-0.5">
          <DialogTitle className="text-body font-semibold">
            Pay court fees
          </DialogTitle>
          <DialogDescription className="text-caption tabular-nums">
            SARAS Court, Ahmedabad · {cases} case{cases === 1 ? "" : "s"} · Ref{" "}
            {reference}
          </DialogDescription>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-title-s font-semibold tabular-nums">
            {money(amount)}
          </span>
          <span className="flex items-center gap-1 text-caption text-muted-foreground">
            <LockIcon className="size-3" aria-hidden />
            Payment gateway
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-6 py-6">
        {stage === "choose" ? (
          <>
            <Tabs
              value={mode}
              onValueChange={(v) => {
                setMode(v as PayMode);
                setTried(false);
              }}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upi">
                  <SmartphoneIcon aria-hidden />
                  UPI
                </TabsTrigger>
                <TabsTrigger value="card">
                  <CreditCardIcon aria-hidden />
                  Card
                </TabsTrigger>
                <TabsTrigger value="neft">
                  <BuildingIcon aria-hidden />
                  NEFT
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {mode === "card" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field
                  className="col-span-2 gap-1.5"
                  data-invalid={tried && !!cardErrors.number}
                >
                  <FieldLabel htmlFor="gw-card">Card number</FieldLabel>
                  <Input
                    id="gw-card"
                    inputMode="numeric"
                    autoComplete="off"
                    value={card.number}
                    onChange={(e) =>
                      setCard({ ...card, number: groupCard(e.target.value) })
                    }
                  />
                  {tried && cardErrors.number ? (
                    <FieldError>{cardErrors.number}</FieldError>
                  ) : null}
                </Field>
                <Field
                  className="gap-1.5"
                  data-invalid={tried && !!cardErrors.expiry}
                >
                  <FieldLabel htmlFor="gw-exp">Expiry</FieldLabel>
                  <Input
                    id="gw-exp"
                    placeholder="MM/YY"
                    value={card.expiry}
                    onChange={(e) =>
                      setCard({ ...card, expiry: e.target.value.slice(0, 5) })
                    }
                  />
                  {tried && cardErrors.expiry ? (
                    <FieldError>{cardErrors.expiry}</FieldError>
                  ) : null}
                </Field>
                <Field
                  className="gap-1.5"
                  data-invalid={tried && !!cardErrors.cvv}
                >
                  <FieldLabel htmlFor="gw-cvv">CVV</FieldLabel>
                  <Input
                    id="gw-cvv"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={card.cvv}
                    onChange={(e) =>
                      setCard({
                        ...card,
                        cvv: e.target.value.replace(/\D/g, "").slice(0, 3),
                      })
                    }
                  />
                  {tried && cardErrors.cvv ? (
                    <FieldError>{cardErrors.cvv}</FieldError>
                  ) : null}
                </Field>
                <Field
                  className="col-span-2 gap-1.5"
                  data-invalid={tried && !!cardErrors.name}
                >
                  <FieldLabel htmlFor="gw-name">Name on card</FieldLabel>
                  <Input
                    id="gw-name"
                    value={card.name}
                    onChange={(e) => setCard({ ...card, name: e.target.value })}
                  />
                  {tried && cardErrors.name ? (
                    <FieldError>{cardErrors.name}</FieldError>
                  ) : null}
                </Field>
              </div>
            ) : mode === "upi" ? (
              <Field className="gap-1.5" data-invalid={tried && !!upiError}>
                <FieldLabel htmlFor="gw-upi">UPI ID</FieldLabel>
                <Input
                  id="gw-upi"
                  autoComplete="off"
                  value={upi}
                  onChange={(e) => setUpi(e.target.value)}
                />
                {tried && upiError ? <FieldError>{upiError}</FieldError> : null}
                <span className="text-caption text-muted-foreground">
                  A payment request goes to this UPI ID.
                </span>
              </Field>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-body-compact">
                  Transfer exactly {money(amount)} by NEFT or RTGS to the
                  court&apos;s account for this payment:
                </p>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-lg bg-surface-sunken p-4 text-body-compact">
                  <dt className="text-muted-foreground">Account name</dt>
                  <dd>Registrar, SARAS Court Ahmedabad</dd>
                  <dt className="text-muted-foreground">Account number</dt>
                  <dd className="font-mono tabular-nums">
                    SARAS{reference.slice(5)}
                  </dd>
                  <dt className="text-muted-foreground">IFSC</dt>
                  <dd className="font-mono">SBIN0000301</dd>
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="tabular-nums">{money(amount)}</dd>
                </dl>
                <span className="text-caption text-muted-foreground">
                  This account is only for this payment.
                </span>
              </div>
            )}
          </>
        ) : stage === "card-otp" ? (
          <Field className="gap-2">
            <FieldLabel>
              Enter the OTP your bank sent to the mobile on this card
            </FieldLabel>
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <span className="text-caption text-muted-foreground">
              Card ending {card.number.slice(-4)}.
            </span>
          </Field>
        ) : (
          <div
            role="status"
            className="flex flex-col items-center gap-3 py-6 text-center"
          >
            <Spinner className="size-8 text-primary" />
            <p className="text-body font-medium">
              {stage === "upi-wait"
                ? "Approve the request in your UPI app"
                : stage === "neft-wait"
                  ? "Checking for your transfer"
                  : "Confirming your payment"}
            </p>
            <p className="text-caption text-muted-foreground">
              {stage === "upi-wait"
                ? `Sent to ${upi}. Approves in ${left}s.`
                : stage === "neft-wait"
                  ? `Found in ${left}s.`
                  : "Please don't close this window."}
            </p>
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex justify-end gap-3 border-t border-hairline px-6 py-4",
          stage === "paying" && "invisible",
        )}
      >
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {stage === "choose" ? (
          <Button onClick={start}>
            {mode === "neft"
              ? "I have made the transfer"
              : `Pay ${money(amount)}`}
          </Button>
        ) : stage === "card-otp" ? (
          <Button disabled={otp.length < 6} onClick={() => setStage("paying")}>
            Confirm payment
          </Button>
        ) : null}
      </div>
    </div>
  );
}
