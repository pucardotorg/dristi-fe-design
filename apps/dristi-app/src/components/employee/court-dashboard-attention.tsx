"use client";

import * as React from "react";
import { ChevronRightIcon, TriangleAlertIcon } from "lucide-react";

import { DocketCaseList } from "@/components/employee/docket-table";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CourtDocket } from "@/lib/employee/court-docket";
import {
  attentionToday,
  type AttentionItem,
  type CheckOwner,
  type CheckRow,
} from "@/lib/employee/court-flow";
import { formatCount } from "@/lib/employee/register-rows";
import { cn } from "@/lib/utils";

/**
 * "Needs attention" on the magistrate dashboard, and the pieces the dashboard's panels
 * share. The checks are grouped by who can act — one column each for the office, the
 * magistrate and those outside the court — and always read as of today, whatever period
 * the Overview is set to (`attentionToday`). An item opens its cases inside the panel.
 *
 * The design's hover tooltips are not used: what they said is in each item's accessible
 * name, and written out above the list when an item is opened.
 */

/** A top-level section of the dashboard: a lifted card on the work canvas. */
export const PANEL = cn("flex min-w-0 flex-col gap-6 rounded-xl border bg-card p-6 max-sm:p-4", PANEL_CLASS);

/** A bordered box inside a panel. */
export const BOX = "min-w-0 rounded-xl border border-hairline";

export function PanelHeader({
  id,
  title,
  line,
  note,
  children,
}: {
  id: string;
  title: string;
  /** The period or scope the panel reads, under the title. */
  line: React.ReactNode;
  note?: React.ReactNode;
  /** A control at the top right: the date picker, the trend range. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={id} className="text-title-s font-semibold">
            {title}
          </h2>
          <p className="text-body tabular-nums">{line}</p>
        </div>
        {children}
      </div>
      {note ? <p className="text-body-compact text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export const OWNER_LABEL: Record<CheckOwner, string> = {
  office: "Office",
  magistrate: "Magistrate",
  outside: "Outside the court",
};

/**
 * Who acts, as a chip. The three read apart without colour: the magistrate's chip carries
 * the brand edge, the outside one a dashed edge, the office a plain one.
 */
export function OwnerChip({ owner }: { owner: CheckOwner }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal",
        owner === "magistrate" && "border-primary text-brand-muted-foreground",
        owner === "outside" && "border-dashed",
      )}
    >
      {OWNER_LABEL[owner]}
    </Badge>
  );
}

/**
 * The three shades of "how far past": an ordinal ramp in the DS warning family — the pale
 * muted fill, the solid, then the ink — light to dark in light mode. The two lighter
 * shades carry a warning-ink edge so each mark keeps a 3:1 boundary on the panel.
 *
 * In dark mode the warning solid and ink are both bright yellows that cannot be told
 * apart, so the far-past shade steps to the destructive solid there.
 */
export const SEVERITY_SHADE = [
  "bg-warning-muted ring-1 ring-warning-ink ring-inset",
  "bg-warning ring-1 ring-warning-ink ring-inset",
  "bg-warning-ink dark:bg-destructive",
] as const;

const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

/** A list's cases inside its panel: name, size, Close, and the shared paged case table. */
export function CaseListBox({
  id,
  title,
  summary,
  details,
  rows,
  daysHeader,
  onClose,
}: {
  id: string;
  title: string;
  summary: string;
  /** Lines that spell out what a sighted pointer user saw in a tooltip. */
  details?: string[];
  rows: CheckRow[] | { case: CheckRow["case"]; days: number }[];
  daysHeader: string;
  onClose: () => void;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn(BOX, "flex flex-col gap-4 border-border p-4 sm:p-6")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={`${id}-title`} className="text-body font-semibold">
            {title}
          </h3>
          <p className="text-body-compact text-muted-foreground tabular-nums">{summary}</p>
          {details?.map((line) => (
            <p key={line} className="text-body-compact text-muted-foreground tabular-nums">
              {line}
            </p>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      <DocketCaseList id={`${id}-list`} caption={title} rows={rows} daysHeader={daysHeader} />
    </section>
  );
}

function severityText(item: AttentionItem): string {
  return item.severity
    .map((value, i) => (value ? `${item.severityLabels[i]}: ${formatCount(value)}` : null))
    .filter(Boolean)
    .join(" · ");
}

function weekChange(item: AttentionItem): { text: string; tone: "up" | "down" | "flat" } | null {
  if (item.lastWeek === null) return null;
  const diff = item.count - item.lastWeek;
  if (!diff) return { text: "Same as last week", tone: "flat" };
  return { text: `${formatCount(Math.abs(diff))} since last week`, tone: diff > 0 ? "up" : "down" };
}

export function NeedsAttention({ docket }: { docket: CourtDocket }) {
  const groups = attentionToday(docket);
  const [open, setOpen] = React.useState<AttentionItem["id"] | null>(null);
  const most = Math.max(1, ...groups.flatMap((g) => g.items.map((it) => it.count)));
  const opened = groups.flatMap((g) => g.items).find((it) => it.id === open) ?? null;
  const listId = "dash-attention-cases";

  const close = () => {
    const key = open;
    setOpen(null);
    document.querySelector<HTMLElement>(`[data-attention-trigger="${key}"]`)?.focus();
  };

  return (
    <section aria-labelledby="dash-attention" className={PANEL}>
      <PanelHeader id="dash-attention" title="Needs attention" line="Cases to act on today, grouped by who can act" />
      <div className={cn(BOX, "grid lg:grid-cols-3")}>
        {groups.map((group, g) => (
          <div
            key={group.owner}
            className={cn("flex min-w-0 flex-col", g > 0 && "border-hairline max-lg:border-t lg:border-l")}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 border-b border-hairline px-4 py-3">
              <h3 className="text-body font-semibold">{group.label}</h3>
              <span className="text-body-compact font-semibold tabular-nums">{plural(group.cases, "case", "cases")}</span>
              <p className="col-span-2 text-caption text-muted-foreground">{group.description}</p>
            </div>
            <ul className="flex flex-col">
              {group.items.map((item) => (
                <AttentionRow
                  key={item.id}
                  item={item}
                  most={most}
                  open={open === item.id}
                  controls={listId}
                  onToggle={() => setOpen((current) => (current === item.id ? null : item.id))}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-compact text-muted-foreground">
        {["Just past the limit", "Well past", "Far past"].map((name, i) => (
          <span key={name} className="inline-flex items-center gap-2">
            <span aria-hidden className={cn("h-2.5 w-3.5 rounded-xs", SEVERITY_SHADE[i])} />
            {name}
          </span>
        ))}
        <span>Bars share one scale. Delays at each stage are in the Overview above.</span>
      </p>
      <div id={listId} className="min-w-0 empty:hidden">
        {opened ? (
          <CaseListBox
            key={opened.id}
            id={`dash-attention-${opened.id}`}
            title={opened.label}
            summary={`${plural(opened.count, "case", "cases")} · ${opened.soonestFirst ? "soonest" : "longest"} first`}
            details={[severityText(opened)]}
            rows={opened.rows}
            daysHeader={opened.daysHeader}
            onClose={close}
          />
        ) : null}
      </div>
    </section>
  );
}

function AttentionRow({
  item,
  most,
  open,
  controls,
  onToggle,
}: {
  item: AttentionItem;
  most: number;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  if (!item.count) {
    return (
      <li className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-1 border-hairline px-4 py-3 not-first:border-t">
        <span className="text-right text-title font-semibold text-muted-foreground tabular-nums">0</span>
        <span className="self-center text-body-compact text-muted-foreground">{item.label}</span>
        <span className="col-start-2 text-caption text-success-ink">All clear</span>
      </li>
    );
  }
  const change = weekChange(item);
  const far = item.severity[2] ? `${formatCount(item.severity[2])} ${item.farLabel}` : null;
  const name = [
    `${plural(item.count, "case", "cases")}: ${item.urgent ? "act now, " : ""}${item.label}.`,
    severityText(item) + ".",
    change ? `${change.tone === "up" ? "Up" : change.tone === "down" ? "Down" : ""} ${change.text}.`.trim() : "",
    item.hint ? `${item.hint}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <li className="border-hairline not-first:border-t">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={controls}
        aria-label={name}
        data-attention-trigger={item.id}
        onClick={onToggle}
        className="grid w-full cursor-pointer grid-cols-[3rem_minmax(0,1fr)_1rem] items-start gap-3 px-4 py-3 text-left outline-none hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:ring-inset aria-expanded:bg-surface-sunken"
      >
        <span className="text-right text-title font-semibold tabular-nums">{formatCount(item.count)}</span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="text-body-compact font-semibold">
            {item.urgent ? (
              <Badge variant="destructive" className="mr-2 align-text-bottom">
                <TriangleAlertIcon data-icon="inline-start" aria-hidden />
                Act now
              </Badge>
            ) : null}
            {item.label}
          </span>
          <span aria-hidden className="flex h-3 gap-0.5" style={{ width: `${Math.max(3, (item.count / most) * 100)}%` }}>
            {item.severity.map((value, i) =>
              value ? (
                <span key={i} className={cn("block h-full min-w-1", SEVERITY_SHADE[i])} style={{ flex: value }} />
              ) : null,
            )}
          </span>
          <span className="flex flex-col gap-0.5 text-caption text-muted-foreground tabular-nums">
            {far ? <span>{far}</span> : null}
            {change ? (
              <span
                className={cn(
                  change.tone === "up" && "text-destructive-ink",
                  change.tone === "down" && "text-success-ink",
                )}
              >
                {change.tone === "flat" ? null : <span aria-hidden>{change.tone === "up" ? "▲ " : "▼ "}</span>}
                {change.text}
              </span>
            ) : null}
            {item.hint ? <span>{item.hint}</span> : null}
          </span>
        </span>
        <ChevronRightIcon
          aria-hidden
          className={cn(
            "mt-1 size-4 text-muted-foreground transition-transform motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
      </button>
    </li>
  );
}
