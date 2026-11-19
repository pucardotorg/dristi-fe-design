"use client";

import "@/components/advocate/cause-list.css";

import * as React from "react";
import Link from "next/link";
import { BookmarkIcon, ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type CarouselApi, Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { type CaseUpdate, SLIDE_MS, listFrom, slidesOf, updateHref, whenLabel } from "./updates";

/**
 * Card 4, draft 2: "Updates on your cases" (owner, 2026-11-19). One update at a time, like a
 * phone's widget stack: up to 10 slides (bookmarked first, then newest), moving on every 4.5s,
 * with arrows, a pause button and dots (bookmark-shaped for bookmarked cases).
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
    <Card variant="raised" role="region" aria-labelledby="home-updates" className="min-w-0 gap-3 xl:h-104">
      <CardHeader>
        <CardTitle>
          <h2 id="home-updates" className="text-title-s font-semibold">
            Updates on your cases
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent
        ref={root}
        className="flex min-h-0 flex-1 flex-col gap-3"
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setFocusIn(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusIn(false);
        }}
      >
        {total ? (
          <>
            {/* The count (opens every update) and the controls, top right of the body. */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="link"
                size="sm"
                className="-ml-0.5 h-auto p-0 text-caption font-medium text-muted-foreground tabular-nums"
                onClick={() => openList()}
              >
                {total} {total === 1 ? "update" : "updates"}
              </Button>
              {slides.length > 1 ? (
                <div className="-mr-2 flex items-center">
                  <Button variant="ghost" size="icon-xs" aria-label="Previous update" onClick={() => api?.scrollPrev()}>
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label="Next update" onClick={() => api?.scrollNext()}>
                    <ChevronRightIcon className="size-4" />
                  </Button>
                  {reduced ? null : (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={paused ? "Play updates" : "Pause updates"}
                      aria-pressed={paused}
                      onClick={() => setPaused((p) => !p)}
                    >
                      {paused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
                    </Button>
                  )}
                </div>
              ) : null}
            </div>

            <Carousel
              setApi={setApi}
              opts={{ loop: slides.length > 1, align: "start" }}
              aria-label="Updates on your cases"
              /* The slide fills the card's fixed height: the carousel's viewport and track stretch. */
              className="flex min-h-0 flex-1 flex-col [&>[data-slot=carousel-content]]:flex-1"
            >
              <CarouselContent className="h-full">
                {slides.map((u, i) => (
                  <CarouselItem key={u.id} aria-label={`${i + 1} of ${slides.length}`} className="h-full">
                    <Slide update={u} now={now} fine={fine} onOpen={() => openList(u.id)} />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            {slides.length > 1 ? <Dots slides={slides} at={at} onPick={(i) => api?.scrollTo(i)} /> : null}
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

/**
 * One update, filling the slide: the case (with its bookmark) and when on top, what happened large
 * below. The whole slide is the target: a link to the case's history with a mouse, a button that
 * opens the full list on touch.
 */
function Slide({ update: u, now, fine, onOpen }: { update: CaseUpdate; now: Date; fine: boolean; onOpen: () => void }) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-caption font-medium text-muted-foreground">
        {u.bookmarked ? (
          <>
            <BookmarkIcon aria-hidden="true" className="size-3.5 shrink-0 fill-current" />
            <span className="sr-only">Bookmarked case. </span>
          </>
        ) : null}
        <span className="truncate">{u.caseTitle}</span>
      </span>
      <span className="line-clamp-3 text-body font-semibold text-balance text-foreground">{u.what}</span>
      <span className="mt-auto text-caption text-muted-foreground tabular-nums">{whenLabel(u.at, now)}</span>
    </>
  );
  const look =
    "flex h-full min-h-32 w-full flex-col items-start gap-2 rounded-xl bg-surface-sunken p-4 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring";
  return fine ? (
    <Link href={updateHref(u)} className={look}>
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
            className="flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-focus-ring"
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
  const rows = listFrom(updates, firstId);
  const title = `${updates.length} ${updates.length === 1 ? "update" : "updates"} on your cases`;
  const list = (
    <ul className="flex flex-col divide-y divide-hairline">
      {rows.map((u, i) => (
        <li key={u.id} className="relative">
          <Link
            href={updateHref(u)}
            className="-mx-2 flex min-h-14 flex-col gap-0.5 rounded-lg px-2 py-3 outline-none hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-focus-ring"
          >
            <span className="text-body-compact font-medium text-foreground">{u.what}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
              {u.bookmarked ? (
                <>
                  <BookmarkIcon aria-hidden="true" className="size-3 shrink-0 fill-current" />
                  <span className="sr-only">Bookmarked case. </span>
                </>
              ) : null}
              <span className="truncate">{u.caseTitle}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">{whenLabel(u.at, now)}</span>
            </span>
          </Link>
          {/* The Hearings home's "look here" stroke, once, around the update you tapped. */}
          {i === 0 && firstId ? (
            <span key={nonce} aria-hidden="true" className="pointer-events-none absolute -inset-x-2 inset-y-1">
              <svg className="cause-trace-run size-full overflow-visible">
                <rect className="cause-trace-rect" pathLength={100} />
              </svg>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );

  if (fine) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>Bookmarked cases first, then newest.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{list}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent style={{ height: "75dvh", paddingBottom: "calc(var(--spacing) * 4 + env(safe-area-inset-bottom))" }}>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-left">{title}</DrawerTitle>
          <DrawerDescription className="text-left">Bookmarked cases first, then newest.</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">{list}</div>
      </DrawerContent>
    </Drawer>
  );
}
