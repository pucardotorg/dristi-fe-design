"use client";

import "@/components/advocate/cause-list.css";

import * as React from "react";
import Link from "next/link";
import { BookmarkIcon, ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type CarouselApi, Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { type CaseUpdate, SLIDE_MS, slidesOf, splitFrom, updateHref, whenLabel } from "./updates";

/**
 * Card 4, draft 2: "Updates on your cases" (owner, 2026-11-19). One update at a time, like a
 * phone's widget stack: up to 10 slides (bookmarked first, then newest), moving on every 4.5s,
 * with round arrows on the slide's edges, dots (bookmark-shaped for bookmarked cases) and a pause
 * button at the dots' end. The count beside the title opens every update.
 *
 * It holds still while the pointer is over it, focus is inside it, it's off screen, the tab is
 * hidden, the device asks for reduced motion, the list is open, or the pause button is on.
 * Swiping or the arrows move it without stopping it (owner's call).
 *
 * Mouse: a slide opens its case's history; the count opens every update in a side panel.
 * Touch (phones and iPads): a slide or the count opens every update in one bottom drawer, the
 * tapped one first and traced, as the Hearings home traces a row it jumps to.
 */
export function UpdatesCard({ updates, now }: { updates: CaseUpdate[]; now: Date }) {
  const fine = useMediaQuery("(pointer: fine)");
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const slides = React.useMemo(() => slidesOf(updates), [updates]);

  const [api, setApi] = React.useState<CarouselApi>();
  const [at, setAt] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [focusIn, setFocusIn] = React.useState(false);
  const [inView, setInView] = React.useState(true);
  const [hidden, setHidden] = React.useState(false);
  /* The full list: closed, or open (from a slide, which then leads; or from the count). */
  const [list, setList] = React.useState<{ open: boolean; firstId?: string; nonce: number }>({ open: false, nonce: 0 });

  const root = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => setAt(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const running = slides.length > 1 && !paused && !hover && !focusIn && inView && !hidden && !reduced && !list.open;

  /* One timer per slide, so every slide gets its full 4.5s, also after an arrow or a swipe. */
  React.useEffect(() => {
    if (!api || !running) return;
    const id = window.setTimeout(() => api.scrollNext(), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [api, running, at]);

  const openList = (firstId?: string) => setList((l) => ({ open: true, firstId, nonce: l.nonce + 1 }));
  const total = updates.length;

  return (
    <Card variant="raised" role="region" aria-labelledby="home-updates" className="min-w-0 gap-3">
      {/* The count sits right of the title whenever both fit on one line, and drops under it only
          when the card is too narrow (a 375px phone). Decided by the room there is, not by
          breakpoint (owner, 2026-11-19: on a 440px phone it fits). The button's own padding is the
          gap; it reaches 16px into the card's padding so the title keeps one line at 1280. */}
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between">
          <h2 id="home-updates" className="text-title-s font-semibold whitespace-nowrap">
            Updates on your cases
          </h2>
          {total ? <CountButton total={total} onClick={() => openList()} className="-mr-4 -ml-2 px-2" /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent
        ref={root}
        className="flex min-h-0 flex-1 flex-col gap-2"
        /* Pauses only for keyboard focus: a mouse click on an arrow or dot leaves focus on that
           button, and it used to keep the carousel stopped after the pointer had left. */
        onFocus={(e) => setFocusIn(e.target.matches(":focus-visible"))}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusIn(false);
        }}
      >
        {total ? (
          <>
            <Carousel
              setApi={setApi}
              opts={{ loop: slides.length > 1, align: "start" }}
              aria-label="Updates on your cases"
              /* Hover pauses it only over the slide and its arrows, not the card's padding. */
              onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
              onPointerLeave={() => setHover(false)}
            >
              <CarouselContent>
                {slides.map((u, i) => (
                  <CarouselItem key={u.id} aria-label={`${i + 1} of ${slides.length}`}>
                    <Slide update={u} now={now} fine={fine} onOpen={() => openList(u.id)} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {/* Round arrows floating on the slide's two edges (owner, 2026-11-19); smaller on touch. */}
              {slides.length > 1 ? (
                <>
                  <SideArrow side="left" fine={fine} onClick={() => api?.scrollPrev()} />
                  <SideArrow side="right" fine={fine} onClick={() => api?.scrollNext()} />
                </>
              ) : null}
            </Carousel>

            {slides.length > 1 ? (
              <div className="relative flex items-center justify-center">
                <Dots slides={slides} at={at} onPick={(i) => api?.scrollTo(i)} />
                {reduced ? null : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={paused ? "Play updates" : "Pause updates"}
                    aria-pressed={paused}
                    onClick={() => setPaused((p) => !p)}
                    className="absolute right-0 -mr-2 text-muted-foreground"
                  >
                    {paused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
                  </Button>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <p className="py-6 text-body-compact text-muted-foreground">No updates on your cases since yesterday.</p>
        )}
      </CardContent>

      <UpdatesList
        updates={updates}
        now={now}
        fine={fine}
        open={list.open}
        firstId={list.firstId}
        nonce={list.nonce}
        onOpenChange={(open) => setList((l) => ({ ...l, open }))}
      />
    </Card>
  );
}

/** "14 updates ›": opens every update. A button that looks like one (owner, 2026-11-19). */
function CountButton({ total, onClick, className }: { total: number; onClick: () => void; className?: string }) {
  return (
    <Button variant="ghost" size="xs" onClick={onClick} className={cn("text-muted-foreground tabular-nums", className)}>
      {total} {total === 1 ? "update" : "updates"}
      <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
    </Button>
  );
}

/** A round arrow floating on one edge of the slide, half over it. */
function SideArrow({ side, fine, onClick }: { side: "left" | "right"; fine: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeftIcon : ChevronRightIcon;
  /* The wrapper does the centring; the button keeps only its own 1px press. (Centring the button
     itself let its press transform replace the -50% offset, so it jumped half its height.) */
  return (
    <span
      className={cn(
        "absolute top-1/2 z-10 flex -translate-y-1/2",
        side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2",
      )}
    >
      <Button
        variant="outline"
        size="icon-xs"
        aria-label={side === "left" ? "Previous update" : "Next update"}
        onClick={onClick}
        className={cn("rounded-full bg-card shadow-sm", fine ? "size-8" : "size-7")}
      >
        <Icon className="size-4" />
      </Button>
    </span>
  );
}

/**
 * One update, filling the slide (owner, 2026-11-19: no empty middle). Top: its category (the same
 * grey badge as the case's own updates) and when. Middle: what happened, as the headline. Bottom:
 * the case number with a bookmark for a bookmarked case, then the parties. The whole slide is the
 * target: a link to the case's history with a mouse, a button opening the full list on touch.
 */
function Slide({ update: u, now, fine, onOpen }: { update: CaseUpdate; now: Date; fine: boolean; onOpen: () => void }) {
  const body = (
    <>
      {/* Top: what kind of update, and when it happened, a stat of its own (owner, 2026-11-19). */}
      <span className="flex w-full items-center justify-between gap-2">
        {/* A hairline edge so the grey tag holds its shape on the grey slide (owner, 2026-11-19). */}
        <Badge variant="secondary" className="border-hairline">
          {u.category}
        </Badge>
        <span className="text-caption font-medium whitespace-nowrap text-muted-foreground tabular-nums">{whenLabel(u.at, now)}</span>
      </span>
      {/* The headline: 16px, under the card's 20px title (owner, 2026-11-19), centred between the
          top and bottom rows. Up to 4 lines (exactly what the fixed slide holds), then "…"; the
          full text is in the list, the case history, and the slide's hover title. Pretty, not
          balanced: balanced wrapping split short headlines oddly on wide cards (iPad). */}
      <span className="flex w-full flex-1 items-center">
        <span className="line-clamp-4 text-body font-semibold text-pretty text-foreground">{u.what}</span>
      </span>
      {/* Bottom: the case number (with its bookmark), then the parties. */}
      <span className="flex w-full min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-caption font-semibold text-foreground tabular-nums">
          {u.bookmarked ? (
            <>
              <BookmarkIcon aria-hidden="true" className="size-3.5 shrink-0 fill-current text-muted-foreground" />
              <span className="sr-only">Bookmarked case. </span>
            </>
          ) : null}
          {u.caseNumber}
        </span>
        <span className="truncate text-caption text-muted-foreground">{u.caseTitle}</span>
      </span>
    </>
  );
  const look =
    /* A fixed 208px on every screen: the card's height never changes with the update shown. */
    "flex h-52 w-full flex-col items-start gap-3 rounded-xl bg-surface-sunken px-6 py-4 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring";
  return fine ? (
    <Link href={updateHref(u)} className={look} title={u.what}>
      {body}
    </Link>
  ) : (
    <button type="button" className={look} onClick={onOpen}>
      {body}
    </button>
  );
}

/**
 * One dot per slide; a bookmarked case's dot is a small bookmark. The current one is darker
 * (and a dot widens to a pill). Each is a 24px target around its small mark.
 */
function Dots({ slides, at, onPick }: { slides: CaseUpdate[]; at: number; onPick: (i: number) => void }) {
  return (
    <div className="flex items-center justify-center">
      {slides.map((u, i) => {
        const on = i === at;
        return (
          <button
            key={u.id}
            type="button"
            aria-label={`Update ${i + 1} of ${slides.length}${u.bookmarked ? ", bookmarked case" : ""}`}
            aria-current={on ? "true" : undefined}
            onClick={() => onPick(i)}
            /* 16px apart (owner, 2026-11-19), still 24px tall to tap. */
            className="flex h-6 w-4 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-focus-ring"
          >
            {u.bookmarked ? (
              <BookmarkIcon
                aria-hidden="true"
                className={cn("size-2.5 fill-current transition-colors", on ? "text-foreground" : "text-input")}
              />
            ) : (
              <span
                className={cn(
                  "h-1.5 rounded-full transition-all motion-reduce:transition-none",
                  on ? "w-4 bg-foreground" : "w-1.5 bg-input",
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Every update, newest first with bookmarked ones on top; a slide's update leads, traced. One
 * bottom drawer on touch (phones and iPads, 3/4 of the screen, scrolls); a side panel with a mouse.
 * Each row opens its case's history.
 */
function UpdatesList({
  updates,
  now,
  fine,
  open,
  firstId,
  nonce,
  onOpenChange,
}: {
  updates: CaseUpdate[];
  now: Date;
  fine: boolean;
  open: boolean;
  firstId?: string;
  nonce: number;
  onOpenChange: (open: boolean) => void;
}) {
  const { opened, rest } = splitFrom(updates, firstId);
  const title = `${updates.length} ${updates.length === 1 ? "update" : "updates"} on your cases`;
  const ORDER = "Bookmarked cases first, then newest.";
  const label = "text-caption font-medium text-muted-foreground";
  const body = opened ? (
    /* Opened from a slide: that update apart on top (traced), then everything else in order. */
    <div className="flex flex-col gap-4 pb-4">
      <section aria-label="The update you opened">
        <ul>
          <UpdateRow update={opened} now={now} trace={nonce} />
        </ul>
      </section>
      <section aria-label="All other updates" className="flex flex-col gap-1 border-t border-hairline pt-4">
        <p className={label}>All other updates · {ORDER}</p>
        <ul className="flex flex-col divide-y divide-hairline">
          {rest.map((u) => (
            <UpdateRow key={u.id} update={u} now={now} />
          ))}
        </ul>
      </section>
    </div>
  ) : (
    <ul className="flex flex-col divide-y divide-hairline pb-4">
      {rest.map((u) => (
        <UpdateRow key={u.id} update={u} now={now} />
      ))}
    </ul>
  );

  if (fine) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{opened ? null : ORDER}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent style={{ height: "75dvh", paddingBottom: "calc(var(--spacing) * 4 + env(safe-area-inset-bottom))" }}>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-left">{title}</DrawerTitle>
          <DrawerDescription className="text-left">{opened ? null : ORDER}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * One update in the list: the headline, then a line with the case number and parties on the left
 * (cut with "…" when long) and the time pinned to the right, so times line up in one column
 * whatever the case name (owner, 2026-11-19). `trace` draws the Hearings home's "look here" stroke.
 */
function UpdateRow({ update: u, now, trace }: { update: CaseUpdate; now: Date; trace?: number }) {
  return (
    <li className="relative">
      <Link
        href={updateHref(u)}
        className="-mx-2 flex min-h-14 flex-col gap-1.5 rounded-lg px-2 py-3 outline-none hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-focus-ring"
      >
        <span className="text-body-compact font-medium text-foreground">{u.what}</span>
        <span className="flex min-w-0 items-center justify-between gap-3 text-caption text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            {u.bookmarked ? (
              <>
                <BookmarkIcon aria-hidden="true" className="size-3 shrink-0 fill-current" />
                <span className="sr-only">Bookmarked case. </span>
              </>
            ) : null}
            <span className="shrink-0 font-medium text-foreground tabular-nums">{u.caseNumber}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{u.caseTitle}</span>
          </span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">{whenLabel(u.at, now)}</span>
        </span>
      </Link>
      {trace !== undefined ? (
        <span key={trace} aria-hidden="true" className="pointer-events-none absolute -inset-x-2 inset-y-1">
          <svg className="cause-trace-run size-full overflow-visible">
            <rect className="cause-trace-rect" pathLength={100} />
          </svg>
        </span>
      ) : null}
    </li>
  );
}
