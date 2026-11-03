"use client";

import * as React from "react";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { StatusLine } from "@/components/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const NOTICE_ROLE = {
  none: undefined,
  polite: "status",
  assertive: "alert",
} as const;

export type NoticeVariant =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "destructive";

/**
 * A notice that carries a status wears that status: the DS `Alert` variants ship the
 * sanctioned opaque `*-muted` fill together with its own `*-muted-foreground` pair for
 * title, body and icon, so nothing here re-colours them — the primitive owns the fill,
 * the border and the text. `neutral` is the DS default (a white panel) and is for
 * guidance that has no status to report: how to fill the control next to it.
 */
const NOTICE_STYLE: Record<
  NoticeVariant,
  {
    Icon: LucideIcon;
    /** `undefined` = the DS default Alert. */
    alert?: "info" | "warning" | "success" | "destructive";
    /** Extra surface classes — only the white panel needs an edge and a lift. */
    surface?: string;
    /** Icon colour — only the white panel needs one; tints supply their own. */
    icon?: string;
    /** Dismiss control, kept in the notice's own colour rather than a grey-on-tint. */
    dismiss: string;
  }
> = {
  neutral: {
    Icon: InfoIcon,
    surface: "border-hairline shadow-raised",
    icon: "text-muted-foreground",
    dismiss: "text-muted-foreground",
  },
  info: {
    Icon: InfoIcon,
    alert: "info",
    dismiss: "text-current hover:bg-info-muted-hover hover:text-current",
  },
  warning: {
    Icon: TriangleAlertIcon,
    alert: "warning",
    dismiss: "text-current hover:bg-warning-muted-hover hover:text-current",
  },
  success: {
    Icon: CircleCheckIcon,
    alert: "success",
    dismiss: "text-current hover:bg-success-muted-hover hover:text-current",
  },
  destructive: {
    Icon: CircleAlertIcon,
    alert: "destructive",
    dismiss: "text-current hover:bg-destructive-muted-hover hover:text-current",
  },
};

/**
 * Standing notice at the top of a section. `onDismiss` adds a close control; the
 * dismissal itself is remembered on the draft by the caller.
 *
 * The DS `Alert` hardcodes `role="alert"`, which makes a screen reader interrupt on every
 * mount — right for something that has just gone wrong, wrong for guidance that was
 * always on the page. So `announce` defaults to none; raise it only when the notice
 * appears in response to what the user just did.
 */
export function SectionNotice({
  title,
  children,
  variant = "neutral",
  announce = "none",
  still = announce === "none",
  onDismiss,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Default is `neutral`: a notice is only coloured when it reports a status. */
  variant?: NoticeVariant;
  /** "polite" for a result the user is waiting for; "assertive" only for real errors. */
  announce?: "none" | "polite" | "assertive";
  /** Already true when the page opened: no motion. Defaults to still for a standing
      notice; pass it for a polite one that can also be there on arrival. */
  still?: boolean;
  onDismiss?: () => void;
  className?: string;
}) {
  /* A notice that reports a status (it worked, it failed, it needs a look) is a feedback
     line: the same shape as every other success, failure and warning in the product
     (`components/feedback`, skill `feedback-states`). Info and neutral notices are
     guidance, not outcomes, and keep the panel below. A standing notice (announce none)
     arrives still; one raised by what the person just did plays and is announced. */
  if (variant === "success" || variant === "warning" || variant === "destructive") {
    return (
      <StatusLine
        tone={variant === "destructive" ? "error" : variant}
        title={title}
        still={still}
        role={still ? undefined : NOTICE_ROLE[announce]}
        className={className}
        action={
          onDismiss ? (
            <Button type="button" variant="ghost" size="icon" aria-label="Dismiss" onClick={onDismiss} className="text-muted-foreground">
              <XIcon aria-hidden />
            </Button>
          ) : undefined
        }
      >
        {children}
      </StatusLine>
    );
  }
  const { Icon, alert, surface, icon, dismiss } = NOTICE_STYLE[variant];
  return (
    <Alert
      variant={alert}
      role={NOTICE_ROLE[announce]}
      className={cn("py-3 pl-3", surface, onDismiss && "pr-12", className)}
    >
      <Icon aria-hidden className={icon} />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription className="min-w-0 text-wrap md:text-wrap">{children}</AlertDescription>
      {onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Dismiss"
          onClick={onDismiss}
          className={cn("absolute right-1 top-1", dismiss)}
        >
          <XIcon aria-hidden />
        </Button>
      ) : null}
    </Alert>
  );
}

/** Sunken well used to echo a value the form carried over, beside the fields it fills. */
export function InfoWell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-lg bg-surface-sunken p-4 text-body-compact text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}
