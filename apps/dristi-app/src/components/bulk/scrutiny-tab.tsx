"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronRightIcon,
  CircleAlertIcon,
  OctagonAlertIcon,
  Undo2Icon,
} from "lucide-react";

import type { Flag } from "@/lib/bulk/scrutiny";
import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { FilingFooter } from "@/components/filing/filing-footer";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { bulkApi, caseFlowHref, type CaseView } from "./api";
import { CaseStateBadge } from "./case-list";
import type { BatchCtx } from "./batch-screen";
import { StatusLine } from "@/components/feedback";

type Kind = "hold" | "check";
const kindOf = (f: Flag): Kind =>
  f.level === "hold" ? "hold" : "check";

/** Glyph, tint and name per kind. Colour is never alone: the glyph and the words differ too. */
const KIND: Record<
  Kind,
  {
    Icon: typeof OctagonAlertIcon;
    disc: string;
    ink: string;
    ring: string;
    name: string;
  }
> = {
  hold: {
    Icon: OctagonAlertIcon,
    disc: "bg-destructive-muted text-destructive-muted-foreground",
    ink: "text-destructive-ink",
    ring: "border-destructive-ink",
    name: "Needs fixing",
  },
  check: {
    Icon: CircleAlertIcon,
    disc: "bg-warning-muted text-warning-muted-foreground",
    ink: "text-warning-ink",
    ring: "border-warning-ink bg-warning-muted",
    name: "To check",
  },
};

/** One flag, as a line: a tinted mark for its kind, what is wrong, and where. */
export function FlagLine({ flag }: { flag: Flag }) {
  const k = KIND[kindOf(flag)];
  return (
    <div className="flex items-start gap-2 text-body-compact">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          k.disc,
        )}
        title={k.name}
      >
        <k.Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="sr-only">{k.name}: </span>
        {flag.message}{" "}
        <Badge
          variant="outline"
          className="ml-1 align-middle font-normal text-muted-foreground"
        >
          {flag.where}
        </Badge>
      </span>
    </div>
  );
}

/** A case's flags about its details; missing documents are shown on the Documents tab. */
export const detailFlags = (c: CaseView) =>
  c.flags.filter(
    (f) =>
      f.section !== "documents" &&
      f.fix?.kind !== "upload" &&
      f.fix?.kind !== "documents",
  );

/** Fixing first, then checking, then ready. */
const rankOf = (c: CaseView) => {
  const f = detailFlags(c);
  return f.some((x) => x.level === "hold") ? 0 : f.length ? 1 : 2;
};
const RANK: Show[] = ["hold", "check", "ready"];

type Show = "all" | "hold" | "check" | "ready";

/**
 * Case details: every open case of the batch, with what each still needs. A case opens in
 * the single filing's own sections (`case-flow.tsx`), at the first section with something
 * to fix: the one complete view of a case, with the batch's checks on its fields.
 * Documents are on their own tab.
 */
export function ScrutinyTab({ batch, setBatch, go }: BatchCtx) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const closed = !!batch.clubbedInto;
  const params = useSearchParams();
  const ai = params.get("ai");
  // The case the filer came back from, marked so they can find their place.
  const last = params.get("case");

  const open = batch.cases.filter(
    (c) => c.stage === "held" || c.stage === "ready",
  );
  const ordered = [...open].sort((a, b) => rankOf(a) - rankOf(b));
  const [show, setShow] = React.useState<Show>("all");
  const listed = ordered.filter(
    (c) => show === "all" || RANK[rankOf(c)] === show,
  );
  const count = (s: Show) =>
    s === "all"
      ? open.length
      : ordered.filter((c) => RANK[rankOf(c)] === s).length;

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      setBatch(await bulkApi.act(batch.id, body));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Complete: ready, with nothing left to fix or check. What Sign offers.
  const ready = batch.cases.filter(
    (c) => c.stage === "ready" && c.flags.length === 0,
  ).length;
  const skipped = open.flatMap((c) => c.skipped.map((f) => ({ c, f })));

  const chips: { id: Show; label: string; ink?: string }[] = [
    { id: "all", label: "All" },
    { id: "hold", label: "Needs fixing", ink: "text-destructive-ink" },
    { id: "check", label: "To check", ink: "text-warning-ink" },
    { id: "ready", label: "Ready", ink: "text-success-ink" },
  ];

  if (!open.length)
    return (
      <StatusLine tone="success" still>
        Nothing open here.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => go("sign")}
        >
          Go to Sign
        </button>
      </StatusLine>
    );

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Show cases"
      >
        {chips.map((c) => (
          <Button
            key={c.id}
            variant="outline"
            aria-pressed={show === c.id}
            disabled={c.id !== "all" && count(c.id) === 0}
            onClick={() => setShow(c.id)}
            className="rounded-full aria-pressed:border-primary aria-pressed:bg-accent-strong"
          >
            {c.label}
            <span
              className={cn("tabular-nums", c.ink ?? "text-muted-foreground")}
            >
              {count(c.id)}
            </span>
          </Button>
        ))}
      </div>

      {error ? (
        <StatusLine tone="error">{error}</StatusLine>
      ) : null}

      <Card className={cn(PANEL_CLASS, "gap-0 py-1")}>
        <ul className="flex flex-col divide-y divide-hairline">
          {listed.map((c) => {
            const f = detailFlags(c);
            const holds = f.filter((x) => x.level === "hold").length;
            const first = f.find((x) => x.level === "hold") ?? f[0];
            return (
              <li key={c.id}>
                <Link
                  href={caseFlowHref(batch.id, c, undefined, ai)}
                  aria-current={c.id === last ? "true" : undefined}
                  className="flex min-h-10 items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none focus-visible:ring-inset aria-[current=true]:bg-accent"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-compact font-medium">
                      {c.title}
                    </span>
                    <span className="flex flex-wrap gap-x-2 text-caption text-muted-foreground tabular-nums">
                      <span>{c.reference}</span>
                      {c.cheque ? <span>· Cheque {c.cheque}</span> : null}
                      {c.amount ? <span>· {money(c.amount)}</span> : null}
                    </span>
                    {first ? (
                      <span className="mt-1 text-caption text-muted-foreground">
                        {first.where}: {first.message}
                        {f.length > 1 ? ` (and ${f.length - 1} more)` : ""}
                      </span>
                    ) : null}
                  </span>
                  <CaseStateBadge holds={holds} checks={f.length - holds} />
                  <ChevronRightIcon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      {skipped.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-body font-semibold">Skipped checks</h3>
          <Card className={cn(PANEL_CLASS, "gap-0 px-4 py-1")}>
            <ul className="flex flex-col divide-y divide-hairline">
              {skipped.map(({ c, f }) => (
                <li
                  key={`${c.id}-${f.id}`}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-body-compact font-medium">
                      {c.title}
                    </span>
                    <FlagLine flag={f} />
                  </div>
                  <Button
                    variant="ghost"
                    disabled={busy || closed}
                    onClick={() =>
                      void act({ action: "unskip", caseId: c.id, flagId: f.id })
                    }
                  >
                    <Undo2Icon data-icon="inline-start" aria-hidden />
                    Undo skip
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <FilingFooter
        showSaveState={false}
        // Signing never waits for the whole batch: once any case is complete it can go
        // ahead on its own, and the rest stay here.
        continueLabel={
          ready
            ? `Sign ${ready} complete case${ready === 1 ? "" : "s"}`
            : "Sign"
        }
        continueBlocked={!ready}
        continueHint="No case is complete yet"
        onContinue={() => {
          if (ready) go("sign");
        }}
        className="-mx-6 -mb-6 md:-mx-8 md:-mb-8"
      />
    </div>
  );
}
