import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * How a panel sits on a filing screen: the DS Card lifted by the DS dual-layer
 * `shadow-raised` and edged with `hairline` — the same vocabulary as the owner's demo
 * (card + soft 5% shadow) and the accepted advocate-home build.
 * A `Card` takes `variant="raised"` instead; this is for panels that are not a `Card`.
 */
export const PANEL_CLASS = "border-hairline shadow-raised";

/**
 * A grouped block of fields on a filing screen — the DS "grouped content gets a border"
 * recipe. Fields inside stack with `gap-6`; use `FormRow` for two-up fields.
 */
export function FormCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card variant="raised" className={cn("gap-6", className)}>
      <CardHeader className={action && !description ? "items-center" : undefined}>
        <CardTitle className="text-body font-semibold">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-body-compact">{description}</CardDescription>
        ) : null}
        {action ? <CardAction className={!description ? "row-span-1 self-center" : undefined}>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Two fields side by side from `md` up, stacked below.
 *
 * `dense` only when the row holds a scrutiny inset. In a correction round a flagged
 * field's inset is a sibling that spans the whole row (brief §15.5) — without dense
 * packing it would push the field beside it onto a third line, which is the relaying of
 * the form that v2.1 forbids. Dense backfills the hole the spanning item left, so the row
 * renders exactly as the filing draws it and the layer lands underneath. Outside a
 * correction nothing spans, and the rule has no effect.
 */
export function FormRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    /* 24px between the columns, not 16. A card already puts 24px between its rows, so a
       tighter gutter than that made two fields read as one crowded pair rather than two
       (owner, Sept 8, on the cheque leaf). Stacked, the rows keep the 16px they had. */
    <div className={cn("grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-x-6", className)}>
      {children}
    </div>
  );
}

/**
 * A field that should take half the card width on wide screens.
 *
 * When it holds a flagged field it becomes the same two-column grid `FormRow` is, so the
 * field keeps its width to the pixel (50% less half the gap) while its inset spans the
 * row beneath it. The alternative — widening the wrapper — would stretch the input, and
 * the centre column is the e-filing form verbatim (brief §15.1).
 */
export function HalfWidth({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full md:w-1/2 md:pr-2", className)}>
      {children}
    </div>
  );
}

/** Sub-heading inside a card (e.g. "PoA holder details"). */
export function FormSubhead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-body-compact font-medium text-muted-foreground">{children}</p>
  );
}

/** Hairline divider inside a card. */
export function FormDivider() {
  return <div role="separator" className="h-px w-full bg-hairline" />;
}
