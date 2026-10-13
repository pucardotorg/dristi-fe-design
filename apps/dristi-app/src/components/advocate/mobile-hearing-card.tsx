"use client";

import * as React from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ItemChip } from "@/components/advocate/home-bits";
import { courtIdentity, courtNumberFor } from "@/lib/advocate/courts";
import { advHome, fillCopy } from "@/lib/advocate/content";
import type { HearingAccess, HearingQueue, TimelineHearing } from "@/lib/advocate/home";
import { QUEUE_TAG, QueueFace, QueueTag, queueSentence } from "@/components/advocate/queue-tag";
import { AccessButton } from "@/components/advocate/access-button";
import { pick, type Locale } from "@/lib/onboarding/content";
import { passedOverLabel } from "@/lib/advocate/passed-over";
import { Identifier } from "@/components/chrome/identifier";
import { cn } from "@/lib/utils";
import "./mobile-hearing.css";
import { LocateHearingIcon } from "./locate-hearing-icon";

/** A phone matter exposes its actions by tap, keeping the docket scannable. */
export function MobileHearingCard({ hearing, locale, queue, onOpenCase, onOpenTasks, onViewInCauseList, access, time, showCourt = true }: {
  time?: React.ReactNode;
  /** Name the hearing's court; off where the deployment runs one court. */
  showCourt?: boolean;
  /** How the viewer reaches the matter; its button joins the tray. Null hides it. */
  access?: HearingAccess | null;
  hearing: TimelineHearing;
  locale: Locale;
  /** Today's queue position, for scheduled matters; null hides the tag. */
  queue?: HearingQueue | null;
  selected: boolean;
  onOpenCase: (id: string) => void;
  onOpenTasks: ((id: string, taskIds: string[]) => void) | null;
  onViewInCauseList: ((id: string) => void) | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [pointerMotion, setPointerMotion] = React.useState(true);
  const ongoing = hearing.status === "now";
  const count = hearing.blockers.length;
  const pending = fillCopy(count === 1 ? advHome.blockingOne : advHome.blockingMany, locale, { n: String(count) });
  const court = courtIdentity(hearing.courtLabel, courtNumberFor(hearing.court, hearing.kase.courtNumber));
  const actionClass = "h-auto min-h-10 min-w-0 whitespace-nowrap border-transparent bg-card px-2 py-2 text-caption text-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="relative min-w-0" data-pointer-motion={pointerMotion}>
      <CollapsibleTrigger
        aria-label={`${hearing.kase.parties}, ${pick(advHome.colItem, locale)} ${hearing.item}, ${hearing.kase.cnr || hearing.kase.stNumber}, ${hearing.kase.stage}${showCourt ? `, ${court.name} ${court.number ?? ""}` : ""}${count ? `, ${pending}` : ""}${hearing.passedOver ? `, ${passedOverLabel(locale)}` : ""}${queue ? `, ${queueSentence(queue, locale)}` : ""}`}
        onPointerDown={() => setPointerMotion(true)}
        onKeyDown={() => setPointerMotion(false)}
        className={cn("group/hearing relative z-10 flex w-full min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-left transition-colors active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", ongoing ? "border-brand-accent/40" : "border-hairline")}
      >
        <span className="flex w-full min-w-0 items-center gap-3">
          <ItemChip item={hearing.item} size="lg" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {/* Up to two lines, so the access button beside it never squeezes it to a stub. */}
            <span className={cn("line-clamp-2 text-body-compact font-semibold", ongoing ? "text-primary" : "text-foreground")}>{hearing.kase.parties}</span>
            {/* The whole card is one tap target, so the number keeps the face only. */}
            <Identifier value={hearing.kase.cnr || hearing.kase.stNumber} label="case number" copyable={false} className="text-body-compact wrap-anywhere text-muted-foreground" />
          </span>
          {/* The pending-task mark, centred on the 32px access button to its right. */}
          {count > 0 ? (
            <span aria-hidden="true" className={cn("flex size-5 shrink-0 items-center justify-center self-start rounded-full border border-warning bg-warning-muted text-warning-muted-foreground md:size-6", access && "mt-1.5 md:mt-1")}>
              <TriangleAlert className="size-3 md:size-3.5" />
            </span>
          ) : null}
          {/* Room for the queue tag, which sits over this spot with the access
              button (a button cannot live inside the card's tap target): an
              invisible copy holds its exact width. */}
          {queue ? (
            <span aria-hidden="true" className={cn(QUEUE_TAG, "invisible self-start")}>
              <QueueFace queue={queue} locale={locale} />
            </span>
          ) : null}
          {/* Room for the access button, which sits over this spot at the far
              right: a button cannot live inside the card's own tap target. */}
          {access ? <span aria-hidden="true" className="size-8 shrink-0 self-start" /> : null}
        </span>
        <span className="flex w-full items-center gap-2">
          {/* The stage gives way first; "Passed over" always shows in full after it. */}
          <span className="flex min-w-0 flex-1 items-baseline text-caption font-semibold text-muted-foreground">
            <span className="min-w-0 truncate" title={hearing.kase.stage}>{hearing.kase.stage}</span>
            {hearing.passedOver ? (
              <span className="shrink-0 whitespace-pre">
                <span aria-hidden="true"> · </span>
                <span className="text-warning-ink">{passedOverLabel(locale)}</span>
              </span>
            ) : null}
          </span>
          {/* ds-typography-allow: owner asked for the court tag a step under caption (11px); the DS has no role below 12px. */}
          {showCourt ? (
            <span className="shrink-0 rounded-full border border-border bg-accent-strong px-2 py-0.5 text-[0.6875rem] leading-4 font-semibold text-foreground">
              {court.name} · <span className="tabular-nums">{court.number ?? "N/A"}</span>
            </span>
          ) : null}
          <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-accent-strong text-muted-foreground">
            <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[state=open]/hearing:rotate-180 motion-reduce:transition-none" />
          </span>
        </span>
        {time ? <span className="text-caption text-muted-foreground">{time}</span> : null}
      </CollapsibleTrigger>
      {/* How the viewer reaches the matter, always in view at the card's top
          right, the pending-task mark to its left: a 40px outlined button laid
          over the space the card keeps for it. */}
      {access ? (
        // At the card's far right, inside its 16px padding.
        <div className="absolute top-4 right-4 z-20 flex items-start gap-3">
          {/* 32px drawn; the ::after keeps the 40px touch target. */}
          {queue ? <QueueTag queue={queue} locale={locale} className="after:absolute after:-inset-1" /> : null}
          <AccessButton
            access={access}
            locale={locale}
            variant="outline"
            // Drawn at 32px; the ::after keeps the 40px touch target.
            className="size-8 border-hairline bg-card text-muted-foreground after:absolute after:-inset-1"
            iconClassName="size-4"
          />
        </div>
      ) : null}
      <CollapsibleContent className="hearing-reveal mx-3 overflow-hidden">
        <div className={cn("hearing-actions flex items-center gap-2 rounded-b-xl p-3", ongoing ? "bg-brand-accent/20 text-brand-muted-foreground" : "bg-secondary text-foreground")}>
          {onViewInCauseList ? (
            <Button variant="ghost" size="icon" className={cn("shrink-0 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", ongoing ? "text-brand-muted-foreground hover:bg-brand-accent/20 hover:text-brand-muted-foreground" : "text-foreground hover:bg-accent")} aria-label={pick(advHome.viewOnCauseList, locale)} onClick={() => onViewInCauseList(hearing.kase.id)}>
              <LocateHearingIcon aria-hidden="true" className="size-5" />
            </Button>
          ) : null}
          <Button variant="outline" className={cn(actionClass, "flex-1")} onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpenCase(hearing.kase.id); }}>{pick(advHome.viewCase, locale)}</Button>
          {count > 0 && onOpenTasks ? (
            <Button variant="outline" className={cn(actionClass, "shrink-0 md:flex-1")} onClick={() => onOpenTasks(hearing.kase.id, hearing.blockers.map(task => task.id))}>
              <TriangleAlert aria-hidden="true" />{pending}
            </Button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
