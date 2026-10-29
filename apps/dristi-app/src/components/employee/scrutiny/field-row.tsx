"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  FileTextIcon,
  FlagIcon,
  HistoryIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { docName } from "@/lib/employee/scrutiny/field";
import type {
  Flag as FlagType,
  FlatField,
  ReturnedItem,
} from "@/lib/employee/scrutiny/types";
import type { ScrutinyController } from "@/lib/employee/scrutiny/use-scrutiny-state";
import { cn } from "@/lib/utils";
import { FlagComposer } from "@/components/employee/scrutiny/flag-composer";
import {
  KeptReason,
  ReturnedValue,
} from "@/components/employee/scrutiny/returned-value";
import { useScrutinyCase } from "@/components/employee/scrutiny/scrutiny-case-context";
import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";
import {
  FieldValue,
  RecordLink,
  RecordList,
  RecordRow,
} from "@/components/employee/scrutiny/record-rows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * One filed field = one `DescriptionRow`, made interactive.
 *
 * The row carries NO border radius: its own bottom border IS the divider between rows,
 * and rounding the box rounds the ends of that 1px rule.
 *
 * The loudness ladder, spent once: hover is the accent fill, and selection is a leading
 * inset bar. Selection used to take `accent-strong` as well, which left the record inside
 * it with no fill of its own to sit on — beige on beige — and stacked two cues on the
 * same row. One quiet persistent mark is the whole allowance.
 */
export function FieldRow({
  field,
  controller,
  aiOn,
  onGoToItem,
}: {
  field: FlatField;
  controller: ScrutinyController;
  aiOn: boolean;
  onGoToItem: (fieldId: string) => void;
}) {
  const { docById, returned } = useScrutinyCase();
  const flag = controller.flags[field.id];
  const selected = controller.selectedId === field.id;
  const composing = controller.composeField === field.id;
  /* A returned item reads in place with the change the Changes card shows — the tint,
     old → new and the answer chip — so the full filing never hides what came back
     behind a grey hint (owner, 2026-10-28). */
  const back = returned?.items.find((item) => item.fieldId === field.id);
  const flagTitle = flag
    ? "Edit this flag"
    : back
      ? "Raise again"
      : field.docrow
        ? "Flag document"
        : "Flag";

  return (
    <DescriptionRow
      id={`row-${field.id}`}
      className={cn(
        // `border-hairline` overrides the DS row default (`border-border`, a darker rule)
        // so the divider between rows matches the lighter hairline the case file uses
        // (owner, 2026-09-15).
        "group/frow relative -mx-2 cursor-pointer grid-cols-[minmax(5.5rem,9rem)_minmax(0,1fr)] border-hairline px-2 transition-colors",
        // At the panel's 18rem floor the value column had ~100px for a value, a chip and
        // two 32px icons, so its min-content pushed the row — and the full-width wells
        // under it — past the card. Below 20rem every row stacks, label over value, and
        // `minmax(0,1fr)` keeps the value column from ever outgrowing the card.
        "@max-xs:grid-cols-1 @max-xs:gap-1",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        "hover:bg-accent",
        // A machine observation carries no row fill. The `HintLine` under the value —
        // icon, words, and the warning pair's own ink — is the complete signal, and
        // washing the row as well made every unread field a tinted band. Status text on
        // a neutral ground, never a fill.
        selected &&
          "before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-primary before:content-['']",
        // While composing, the composer's well is the surface; a row fill under it
        // would stack two greys and blur the well's edge.
        // A returned row carries the one colour that means "came back" (owner, 2026-10-28):
        // info, because red is a new flag, amber an AI reading, navy the selection. A tint
        // with its own solid as an inset edge — DS 6a — so it holds against the white card.
        // Labels stay muted on it: 5.08:1 light, 7.14:1 dark.
        back && "bg-info-muted ring-1 ring-info ring-inset hover:bg-info-muted-hover",
        composing && "bg-transparent hover:bg-transparent",
      )}
      role="option"
      tabIndex={0}
      aria-selected={selected}
      data-flagged={flag ? true : undefined}
      onClick={() => controller.selectField(field.id)}
      onKeyDown={(event) => {
        // Only the row itself: a Space typed into the composer's textarea bubbles
        // here, and swallowing it made "Not a clear document" come out as
        // "Notacleardocument".
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          controller.selectField(field.id);
        }
      }}
    >
      <DescriptionTerm>{field.label}</DescriptionTerm>
      <DescriptionDetails>
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {/*
             * While the composer is open the row says nothing of its own: the composer's
             * "Filed" block carries the old value and its AI badge carries the machine
             * reading, so repeating them here stated the same two numbers three times —
             * the exact "all over the place" the redesign removes.
             */}
            {composing ? null : (
              <>
                {back ? (
                  <ReturnedValue field={field} item={back} withReason={false} />
                ) : (
                  <ValueLines field={field} />
                )}
                <Hints field={field} flag={flag} aiOn={aiOn} />
              </>
            )}
          </div>
          <div className="flex shrink-0 items-start gap-1">
            {/*
             * A persistent source glyph, not a hover-gated one: structure is shown by
             * form, and hover-only affordances are unreachable by keyboard and touch.
             */}
            {field.doc && !field.thumb ? (
              /* The glyph says "this value came from a document"; the tooltip names which,
                 and the same text stays in `sr-only` so it is not a hover-only fact. */
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground">
                    <FileTextIcon className="size-4" aria-hidden="true" />
                    <span className="sr-only">
                      {`Read from Doc ${docById[field.doc]?.no}, ${docById[field.doc]?.name}${
                        field.srcnote ? ` — ${field.srcnote}` : ""
                      }`}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {`Read from Doc ${docById[field.doc]?.no}, ${docById[field.doc]?.name}${
                    field.srcnote ? ` — ${field.srcnote}` : ""
                  }`}
                </TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive-ghost"
                  size="icon-sm"
                  /* Dense by design inside the record, but never below the touch floor:
                     the registry works on tablets, so a coarse pointer gets the full 40px
                     (DS Laws, ACCESSIBILITY §5). */
                  className="[@media(pointer:coarse)]:size-10"
                  aria-label={`${flagTitle}: ${field.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    // A returned item is raised again from the note that went back.
                    if (back && !flag) controller.raiseAgain(field.id, back.note);
                    else controller.openComposer(field.id);
                  }}
                >
                  <FlagIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{flagTitle}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </DescriptionDetails>

      {/*
       * The record and the composer occupy the same box, spanning both columns. At the
       * panel's 24% floor the value column can spare about 140px — not enough for a
       * badge, a claim and two buttons — and editing an item now unfolds it in place
       * instead of moving it.
       */}
      {/* The returned record stays while the officer writes or holds a new flag: what was
          asked last time is the context for what they ask now. */}
      {/* The value keeps its column like every other row; the white wells under it take
          the row's full width (owner, 2026-10-28). */}
      {back && !composing ? <KeptReason item={back} className="col-span-full" /> : null}
      {back ? <ReturnedRecord item={back} /> : null}
      {composing ? (
        <FlagComposer field={field} controller={controller} onGoToItem={onGoToItem} />
      ) : flag ? (
        <RaisedItem
          field={field}
          flag={flag}
          controller={controller}
          onGoToItem={onGoToItem}
        />
      ) : null}
    </DescriptionRow>
  );
}

/** What `from-draft.ts` writes for a question the filer left unanswered. */
const NOT_PROVIDED = "Not provided";

/** The filed value. A raised item never replaces it — the advocate makes the fix. */
function ValueLines({ field }: { field: FlatField }) {
  /*
   * Prose (the affidavit, the prayer) stops at four lines with Show more. Printed whole,
   * the affidavit alone ran ~1,400px in the one scrolling fields panel and pushed the
   * next fields two screens down. The link only appears when there is more to read.
   */
  const ref = React.useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!field.long || !el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [field.long, field.value, expanded]);

  if (!field.value) return null;
  return (
    <div className="flex flex-col items-start gap-1">
      <div
        ref={ref}
        className={cn(
          "text-body-compact break-words",
          // Prose keeps the paragraph breaks it was filed with.
          field.long ? "whitespace-pre-line text-muted-foreground" : "font-medium",
          field.long && !expanded && "line-clamp-4",
          // An unanswered optional question is a fact, but not one to read as data.
          field.value === NOT_PROVIDED && "font-normal text-muted-foreground",
        )}
      >
        <FieldValue field={field} value={field.value} />
      </div>
      {field.long && (overflows || expanded) ? (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-body-compact"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Only real signals appear here. Rows with nothing to say say nothing — an interface
 * that narrates itself is an interface that isn't legible.
 *
 * Once a human has acted, the machine goes quiet: every machine-origin observation moves
 * inside the item's well as grey provenance, so a settled row carries one cue, not three.
 * `nodoc` is the exception because it is not a machine reading — an empty upload slot is
 * a standing fact about the bundle that renders without AI and is already grey.
 * `unfound` looks the same but is a machine reading (the bundle was searched), and
 * `scannote` is poor-scan detection, so like `docread` and `ocrfail` they need AI on.
 */
function Hints({
  field,
  flag,
  aiOn,
}: {
  field: FlatField;
  flag?: FlagType;
  aiOn: boolean;
}) {
  // A returned row says so in its own value and record, so no hint line repeats it.
  const { docById } = useScrutinyCase();
  const lines: React.ReactNode[] = [];
  const flagged = !!flag;
  const thumbId = field.thumb ?? field.docrow;
  const thumbDoc = thumbId ? docById[thumbId] : undefined;
  if (thumbDoc?.src) {
    lines.push(
      <div
        key="thumb"
        className="inline-flex items-center gap-2 self-start rounded-md bg-surface-sunken p-1 pe-2.5 text-caption text-muted-foreground"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbDoc.src}
          alt=""
          className="h-8 w-12 rounded-sm object-cover"
        />
        <span className="tabular-nums">Doc {thumbDoc.no}</span>
      </div>,
    );
  }
  if (aiOn && field.docread && !flagged) {
    lines.push(
      <HintLine key="docread" tone="warning" icon={<TriangleAlertIcon />}>
        Document shows a different value.
      </HintLine>,
    );
  }
  if (aiOn && field.ocrfail && !flagged) {
    lines.push(
      <HintLine key="ocrfail" tone="warning" icon={<TriangleAlertIcon />}>
        Couldn&rsquo;t read this in the document.
      </HintLine>,
    );
  }
  if (field.note) {
    lines.push(
      <HintLine key="note" tone="muted" icon={<HistoryIcon />}>
        {field.note}
      </HintLine>,
    );
  }
  if (field.nodoc) {
    lines.push(
      <HintLine key="nodoc" tone="muted" icon={<FileTextIcon />}>
        {field.nodoc}
      </HintLine>,
    );
  }
  if (aiOn && field.unfound) {
    lines.push(
      <HintLine key="unfound" tone="muted" icon={<FileTextIcon />}>
        {field.unfound}
      </HintLine>,
    );
  }
  if (aiOn && field.scannote && !flagged) {
    lines.push(
      <HintLine key="scannote" tone="warning" icon={<TriangleAlertIcon />}>
        {field.scannote}
      </HintLine>,
    );
  }
  return <>{lines}</>;
}

/** Each tone takes the ink of its own status pair — never grey text on a status line. */
const HINT_TONE = {
  muted: "text-muted-foreground",
  warning: "text-warning-muted-foreground",
} as const;

function HintLine({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof HINT_TONE;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-1.5 text-caption", HINT_TONE[tone])}>
      <span className="mt-px shrink-0 [&>svg]:size-3.5">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

/**
 * A returned item, read in place: what the officer asked and what was on file (Anshumanth,
 * 2026-10-28: "I can't see what the actual correction requested was or what the
 * previous value was"). The row's value above it is what is on file now, and its chip —
 * with a kept value's reason — is how the advocate answered, so the record does not
 * repeat that as a row of its own (owner, 2026-10-28: status compact and inline).
 *
 * Same stacked `RecordList` as the change card and a raised flag, so the ask never
 * flips between a table and a stack. There is no Accept — leaving it alone accepts it;
 * the row's flag raises it again.
 */
function ReturnedRecord({ item }: { item: ReturnedItem }) {
  return (
    /* Paper on the tinted row: a card-white well with a hairline, so the record reads as
       one object on the row rather than a second tint. No buttons in here — selecting
       the row turns the bundle to its page, and the row's flag is Raise again (owner,
       2026-10-28: one control per job). The send-back date lives in case history, not
       under every ask (owner, 2026-10-28). */
    <div className="col-span-full my-1 rounded-lg border border-hairline bg-card p-3">
      <RecordList>
        <RecordRow label="You asked">
          <span className="break-words">{item.note}</span>
        </RecordRow>
        {/* A corrected value shows its before in the value itself; a document's before
            is a file, so it is said here. Kept as filed has no before. */}
        {item.answer === "replaced" ? (
          <RecordRow label="Before">
            <span className="text-muted-foreground line-through decoration-muted-foreground">
              {item.was}
            </span>
          </RecordRow>
        ) : null}
      </RecordList>
    </div>
  );
}

/**
 * The record. Reading it answers four questions without a click: what kind, what is
 * wrong, what backs it up, and what it unlocks — in that fixed order.
 *
 * The Edit/Remove pair reveals on hover, selection and focus-within, and stays visible
 * on touch: a hover-only control is no control at all on a tablet, which is what the
 * registry actually uses.
 *
 * Exported for the change card, so a re-raise reads as the same record in either view.
 * Its host carries `group/frow` for the reveal.
 */
export function RaisedItem({
  field,
  flag,
  controller,
  onGoToItem,
}: {
  field: FlatField;
  flag: FlagType;
  controller: ScrutinyController;
  onGoToItem: (fieldId: string) => void;
}) {
  const { docById, docRow, fieldById } = useScrutinyCase();
  const partnerId = flag.linkedTo ?? flag.linkedFrom ?? null;
  const partner = partnerId ? fieldById[partnerId] : undefined;
  // A field sourced from an uploaded document could have had a re-upload requested,
  // so the row states the answer either way. Generated pages have nothing to re-upload.
  const reuploadApplies = !field.docrow && !!field.doc && !!docRow[field.doc];
  const silent = !flag.comment && !flag.reason;

  /*
   * The record is a small table: one label column, one value column, rows only where
   * they apply. That is what makes it scannable at a glance and scalable as items grow
   * more kinds of fact — the owner's call, replacing the earlier stack of unlike lines.
   *
   * A sunken well inside the card, carrying a hairline. The stroke is what keeps it
   * legible when the row behind it is hovered or selected: row hover is `accent` (243)
   * and the well is `surface-sunken` (245), so on a ramp this tight the two fills all
   * but merge and the record loses its edge exactly when the officer is pointing at it.
   * DS Laws sanction the stroke here — a well holding interactive content (Edit /
   * Remove) takes a hairline.
   */
  return (
    <div
      className={cn(
        "col-span-full my-1 flex flex-col gap-3 rounded-lg border border-hairline bg-surface-sunken p-3",
        // The item settles into place when it is saved — the same resolve the case file
        // uses for a fact taking its outcome (`motion.ts`).
        RESOLVE_IN_PLACE,
      )}
    >
      <div className="flex items-center gap-2">
        <Badge variant="destructive">
          {field.docrow ? "Document issue" : "Flag"}
        </Badge>
        <span className="ms-auto -my-1 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/frow:opacity-100 group-focus-within/frow:opacity-100 group-aria-selected/frow:opacity-100 [@media(hover:none)]:opacity-100">
          {/* `xs` is the record's own density — two words inside a well inside a row —
              but a coarse pointer still gets the 40px floor. */}
          <Button
            variant="ghost"
            size="xs"
            className="[@media(pointer:coarse)]:h-10"
            onClick={(event) => {
              event.stopPropagation();
              controller.openComposer(field.id);
            }}
          >
            Edit
          </Button>
          <Button
            variant="destructive-ghost"
            size="xs"
            className="[@media(pointer:coarse)]:h-10"
            onClick={(event) => {
              event.stopPropagation();
              const stranded = controller.removeFlag(field.id);
              if (!stranded) return;
              /*
               * Removal never cascades: a bad scan is still a bad scan. Say what stayed
               * behind, and offer the second removal rather than performing it.
               */
              toast(
                `Flag removed. The document issue on ${docName(
                  fieldById[stranded]?.docrow ?? "",
                  docById,
                )} stays.`,
                {
                  action: {
                    label: "Remove it too",
                    onClick: () => controller.removeFlag(stranded),
                  },
                },
              );
            }}
          >
            Remove
          </Button>
        </span>
      </div>

      <RecordList>
        {field.docrow && flag.reason ? (
          <RecordRow label="Reason">{flag.reason}</RecordRow>
        ) : null}

        {flag.comment ? (
          <RecordRow label="FSO’s comment">
            <span className="break-words">{flag.comment}</span>
          </RecordRow>
        ) : silent ? (
          <RecordRow label="FSO’s comment">
            <span className="text-warning-ink">{SILENT_FALLBACK}</span>
          </RecordRow>
        ) : null}

        {reuploadApplies ? (
          <RecordRow label="Re-upload requested">
            {partner ? (
              <RecordLink onClick={() => onGoToItem(partner.id)}>
                Yes — {docName(partner.docrow ?? "", docById)}
                {controller.flags[partner.id]?.reason
                  ? ` · ${controller.flags[partner.id]?.reason}`
                  : ""}
              </RecordLink>
            ) : (
              <span className="text-muted-foreground">No</span>
            )}
          </RecordRow>
        ) : null}

        {field.docrow && partner ? (
          <RecordRow label="Raised with">
            <RecordLink onClick={() => onGoToItem(partner.id)}>
              {partner.label}
            </RecordLink>
          </RecordRow>
        ) : null}
      </RecordList>
    </div>
  );
}

/** Defensive only — D1 stops a new item ever reaching it. */
const SILENT_FALLBACK = "No note — the advocate won't know what to fix.";
