"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, BookmarkIcon, FolderOpenIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageOutcome } from "@/components/ui/outcome";
import { CASES } from "@/lib/cases/fixtures";
import { registeredRows, returnedRows, scrutinyRows } from "@/lib/filing/queue";
import { useTasks } from "@/lib/tasks/store";
import { cn } from "@/lib/utils";
import { DEMO_JOINED, RECENT_ROWS, RECENT_TAG, type RecentKind, recentItems, recentWhen } from "./recent";

/* The tag colours: a return needs you, so amber; registered is done, so green; the rest neutral. */
const TAG_VARIANT: Record<RecentKind, "secondary" | "warning" | "success"> = {
  scrutiny: "secondary",
  returned: "warning",
  registered: "success",
  joined: "secondary",
};
/* Card 1's tag size, so tags read alike across Home. */
const TAG_LOOK = "h-4.5 px-1.5 text-[11px]"; // ds-typography-allow: Home's small tag (11px), as on Your hearings.

/**
 * Card 6, "Recent cases": what you most recently filed or joined, newest first, five rows. Each row:
 * the parties and a tag saying what happened (in the Filings page's words); under them the number
 * (with its bookmark) and when it happened. A row opens the case, or the fix for a returned filing.
 */
export function RecentCasesCard({ today, className }: { today: string; className?: string }) {
  const { tasks, cases: taskCases } = useTasks();
  const items = React.useMemo(
    () =>
      recentItems({
        scrutiny: scrutinyRows(today),
        returned: returnedRows(tasks, taskCases),
        registered: registeredRows(today),
        joined: DEMO_JOINED,
        bookmarked: Object.fromEntries(CASES.map((c) => [c.id, c.bookmarked])),
        filedOn: Object.fromEntries(CASES.map((c) => [c.id, c.filedOn])),
      }),
    [today, tasks, taskCases],
  );
  const shown = items.slice(0, RECENT_ROWS);

  return (
    <Card variant="raised" role="region" aria-labelledby="home-recent" className={cn("min-w-0 gap-3", className)}>
      <CardHeader>
        <CardTitle>
          <h2 id="home-recent" className="text-body font-semibold">
            Recent cases
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {shown.length ? (
          <ul className="-mx-2 flex flex-col">
            {shown.map((it) => (
              <li key={`${it.kind}-${it.id}`}>
                <Link
                  href={it.href}
                  className="flex min-w-0 flex-col gap-1 rounded-lg px-2 py-2.5 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring motion-reduce:transition-none"
                >
                  {/* Right column reads top to bottom: what happened, then when ("Joined / 17 Nov"),
                      the date being the day it was filed, returned or joined (owner, 2026-11-19). */}
                  <span className="flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-body-compact font-medium" title={it.parties}>{it.parties}</span>
                    <Badge variant={TAG_VARIANT[it.kind]} className={cn("shrink-0", TAG_LOOK)}>
                      {RECENT_TAG[it.kind]}
                    </Badge>
                  </span>
                  <span className="flex min-w-0 items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5 text-caption font-medium text-muted-foreground tabular-nums">
                      {it.bookmarked ? (
                        <>
                          <BookmarkIcon aria-hidden="true" className="size-3 shrink-0 fill-current text-brand-muted-foreground" />
                          <span className="sr-only">Bookmarked case. </span>
                        </>
                      ) : null}
                      <span className="truncate">{it.ref || "No case number yet"}</span>
                    </span>
                    <span className="shrink-0 text-caption text-muted-foreground tabular-nums">{recentWhen(it.on, today)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-center py-6">
            <PageOutcome
              tone="neutral"
              icon={FolderOpenIcon}
              as="p"
              still
              title="Nothing filed or joined yet"
              body="Cases you file or join will show here."
              className="py-0 [&_p:first-of-type]:text-body"
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end py-3">
        <Button asChild variant="outline" size="sm" className="-mr-3">
          <Link href="/cases">
            All cases
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
