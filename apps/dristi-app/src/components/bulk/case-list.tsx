"use client";

import * as React from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { RAIL_ROW, RAIL_ROW_ACTIVE } from "@/components/filing/sections-rail";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { CaseView } from "./api";
import { CaseSearch, caseMatches } from "./case-list-tools";
import { CaseBadge } from "./stage";

/**
 * The batch's cases as a panel beside the case on screen: who each is against, its
 * reference, and where it stands; only a case that still needs something says so, so
 * Complete stays the quiet default (round 3). It can be searched, as every list of the
 * batch's cases can. When the list runs past its height, a fade and a count
 * at the hidden edge say how many more there are, and take you to them.
 */
export function CaseList({
  cases,
  selectedId,
  onSelect,
}: {
  cases: CaseView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = React.useState("");
  const listed = cases.filter((c) => caseMatches(c, search));
  const scroller = React.useRef<HTMLUListElement>(null);
  const [hidden, setHidden] = React.useState({ above: 0, below: 0 });

  const measure = React.useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const top = el.scrollTop;
    const bottom = top + el.clientHeight;
    let above = 0;
    let below = 0;
    for (const li of Array.from(el.children) as HTMLElement[]) {
      if (li.offsetTop + li.offsetHeight / 2 < top) above += 1;
      else if (li.offsetTop + li.offsetHeight / 2 > bottom) below += 1;
    }
    setHidden((h) =>
      h.above === above && h.below === below ? h : { above, below },
    );
  }, []);

  React.useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [measure, listed.length]);

  // Keep the chosen case in view as it changes (Next case, a filter).
  React.useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(
      '[aria-current="true"]',
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const page = (dir: 1 | -1) =>
    scroller.current?.scrollBy({
      top: dir * (scroller.current.clientHeight - 48),
      behavior: "smooth",
    });

  return (
    <Card
      variant="raised"
      className="sticky top-20 hidden gap-0 overflow-hidden py-0 lg:flex"
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <span className="text-body-compact font-semibold">Cases</span>
        <span className="text-body-compact text-muted-foreground tabular-nums">
          {cases.length}
        </span>
      </div>
      <div className="border-b border-hairline p-2">
        <CaseSearch id="review-search" className="sm:w-full" value={search} onChange={setSearch} />
      </div>
      <div className="relative min-h-0">
        <ul
          ref={scroller}
          onScroll={measure}
          aria-label="Cases"
          className="flex max-h-[calc(100dvh-16rem)] flex-col gap-1 overflow-y-auto overscroll-contain p-2"
        >
          {listed.length === 0 ? (
            <li className="px-2 py-3 text-body-compact text-muted-foreground">No case matches.</li>
          ) : null}
          {listed.map((c) => {
            const active = c.id === selectedId;
            return (
              <li key={c.id}>
                <Button
                  variant="ghost"
                  className={cn(
                    RAIL_ROW,
                    "h-auto min-h-12 py-2",
                    active && RAIL_ROW_ACTIVE,
                  )}
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelect(c.id)}
                >
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left">
                    <span className="w-full truncate font-medium">
                      {c.accused || c.title}
                    </span>
                    <span className="w-full truncate text-body-compact text-muted-foreground">
                      <span className="font-mono">{c.reference}</span>
                      {c.cheque ? <span className="tabular-nums"> · {c.cheque}</span> : null}
                    </span>
                    <CaseBadge c={c} reason={false} />
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
        {/* More past the edge: a fade, and a count that pages to them. */}
        {hidden.above ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-12 justify-center bg-gradient-to-b from-card to-transparent pt-1">
            <Button
              variant="secondary"
              size="sm"
              className="pointer-events-auto h-7 rounded-full shadow-raised"
              onClick={() => page(-1)}
            >
              <ArrowUpIcon data-icon="inline-start" aria-hidden />
              {hidden.above} more above
            </Button>
          </div>
        ) : null}
        {hidden.below ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-12 items-end justify-center bg-gradient-to-t from-card to-transparent pb-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="pointer-events-auto h-7 rounded-full shadow-raised"
              onClick={() => page(1)}
            >
              <ArrowDownIcon data-icon="inline-start" aria-hidden />
              {hidden.below} more below
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
