"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import {
  BLANK,
  PROCEEDINGS_TEMPLATES,
  type ProceedingsTemplate,
} from "@/lib/employee/order-proceedings";
import { orderTemplate } from "@/lib/employee/order-templates";
import { cn } from "@/lib/utils";

type Tab = "suggested" | "all" | "saved";

/**
 * Starting the proceedings: a template, or a blank page (order-screen v14, after v3's
 * chooser). It opens when a hearing's order is first opened.
 *
 * **Suggested** is what fits this hearing's purpose; **All** has a template for every
 * hearing purpose in the catalogue and the common situations; **Saved** is the court's own,
 * made from proceedings it has written. A page thumbnail per template, and the selected
 * one read out in full beside the grid with its [blanks] marked. The arrow keys walk the
 * grid; Enter, or a double press, starts from the selected one.
 */
export function ProceedingsTemplateChooser({
  open,
  onOpenChange,
  purposeLabel,
  suggested,
  saved,
  canSave,
  onSave,
  onUse,
  onBlank,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purposeLabel: string;
  suggested: readonly ProceedingsTemplate[];
  saved: readonly ProceedingsTemplate[];
  /** Whether there are proceedings on the page to save as a template. */
  canSave: boolean;
  onSave: () => ProceedingsTemplate;
  onUse: (template: ProceedingsTemplate) => void;
  onBlank: () => void;
  /** Once the dialog has gone: where the caret goes is the page's to say. */
  onClosed: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>(suggested.length ? "suggested" : "all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  const list = tab === "saved" ? saved : tab === "all" ? PROCEEDINGS_TEMPLATES : suggested;
  const selected = list.find((template) => template.id === selectedId) ?? list[0] ?? null;

  function focusTile(id: string) {
    requestAnimationFrame(() =>
      gridRef.current?.querySelector<HTMLElement>(`[data-template="${CSS.escape(id)}"]`)?.focus(),
    );
  }

  function use(template: ProceedingsTemplate | null) {
    if (!template) return;
    onOpenChange(false);
    onUse(template);
  }

  const tabButton = (value: Tab, label: string, count: number) => (
    <button
      key={value}
      type="button"
      role="radio"
      aria-checked={tab === value}
      onClick={() => {
        setTab(value);
        setSelectedId(null);
      }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-body-compact font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        tab === value
          ? "border-brand-accent bg-brand-muted font-semibold text-brand-muted-foreground"
          : "border-border hover:bg-accent",
      )}
    >
      {label}
      <span className={cn("tabular-nums", tab !== value && "text-muted-foreground")}>{count}</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[calc(100svh-4rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (selected) focusTile(selected.id);
        }}
        onKeyDown={(event) => {
          const tile = (event.target as HTMLElement).closest<HTMLElement>("[data-template]");
          if (tile && ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            const at = list.findIndex((template) => template.id === tile.dataset.template);
            const columns = gridRef.current
              ? getComputedStyle(gridRef.current).gridTemplateColumns.split(" ").length
              : 1;
            const by = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key] ?? 0;
            const next = list[Math.min(list.length - 1, Math.max(0, at + by))];
            if (next) {
              setSelectedId(next.id);
              focusTile(next.id);
            }
          }
          if (event.key === "Enter" && tile) {
            event.preventDefault();
            use(selected);
          }
        }}
      >
        <div className="flex flex-col gap-1 p-6 pr-12 pb-4">
          <DialogTitle className="text-title-s font-semibold">Start the proceedings</DialogTitle>
          <DialogDescription>
            Listed for {purposeLabel.charAt(0).toLowerCase() + purposeLabel.slice(1)}. Pick a
            starting page, or start blank.
          </DialogDescription>
        </div>
        <div role="radiogroup" aria-label="Templates" className="flex flex-wrap gap-2 px-6 pb-4">
          {tabButton("suggested", "Suggested", suggested.length)}
          {tabButton("all", "All", PROCEEDINGS_TEMPLATES.length)}
          {tabButton("saved", "Saved", saved.length)}
        </div>

        <div className="grid min-h-0 flex-1 border-t border-hairline md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="min-h-0 overflow-y-auto bg-surface-sunken p-6">
            <div
              ref={gridRef}
              role="radiogroup"
              aria-label="Template"
              className="grid grid-cols-2 gap-4 lg:grid-cols-3"
            >
              {list.map((template, index) => (
                <React.Fragment key={template.id}>
                  {tab === "all" && (index === 0 || list[index - 1].group !== template.group) ? (
                    <h3 className={cn("col-span-full text-body-compact font-semibold", index > 0 && "mt-2")}>
                      {template.group === "purpose" ? "By hearing purpose" : "Common situations"}
                    </h3>
                  ) : null}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected?.id === template.id}
                    data-template={template.id}
                    tabIndex={selected?.id === template.id ? 0 : -1}
                    onClick={(event) => {
                      setSelectedId(template.id);
                      if (event.detail === 2) use(template);
                    }}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border bg-card p-2 pb-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected?.id === template.id
                        ? "border-brand-accent ring-1 ring-brand-accent"
                        : "border-hairline hover:bg-accent",
                    )}
                  >
                    <TemplateThumb template={template} />
                    <span className="px-1 text-body-compact font-medium">{template.name}</span>
                  </button>
                </React.Fragment>
              ))}
              {list.length === 0 ? (
                <p className="col-span-full text-body-compact text-muted-foreground">Nothing saved yet.</p>
              ) : null}
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto border-hairline p-6 md:border-l">
            {selected ? (
              <div className="flex flex-col gap-4">
                <h3 className="text-body font-semibold">{selected.name}</h3>
                <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4 text-body-compact">
                  {selected.blocks.map((block, index) => (
                    <div key={index} className="flex flex-col gap-1">
                      {block.kind === "item" ? (
                        <span className="text-body-compact text-muted-foreground">
                          {orderTemplate(block.type).label}
                        </span>
                      ) : null}
                      <p>
                        {block.kind === "text" ? (
                          <Marked text={block.text} />
                        ) : orderTemplate(block.type).botd ? (
                          <Marked text={orderTemplate(block.type).botd} />
                        ) : (
                          <span className="text-muted-foreground">Written on its own screen.</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-body-compact text-muted-foreground">
                {tab === "saved"
                  ? "Save the proceedings of a hearing as a template, and it appears here for the next one like it."
                  : ""}
              </p>
            )}
            {tab === "saved" && canSave ? (
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  const made = onSave();
                  setSelectedId(made.id);
                }}
              >
                Save these proceedings
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-hairline bg-muted px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onBlank();
            }}
          >
            Start blank
          </Button>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-body-compact text-muted-foreground sm:inline-flex">
              <Kbd>Enter</Kbd> to start
            </span>
            <Button type="button" disabled={!selected} onClick={() => use(selected)}>
              Use template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Template words with their [blanks] marked, as they will land on the page. */
function Marked({ text }: { text: string }) {
  const pieces = text.split(new RegExp(`(${BLANK.source})`));
  return (
    <>
      {pieces.map((piece, index) =>
        /^\[[^\]\n]+\]$/.test(piece) ? (
          <mark key={index} className="rounded-sm bg-warning-muted px-0.5 text-warning-muted-foreground">
            {piece}
          </mark>
        ) : (
          <React.Fragment key={index}>{piece}</React.Fragment>
        ),
      )}
    </>
  );
}

/** A page in miniature: a line of words for typed text, a tinted line for an item. */
function TemplateThumb({ template }: { template: ProceedingsTemplate }) {
  const line = (width: number, tone = "bg-track") => (
    <span className={cn("block h-1 rounded-full", tone)} style={{ width: `${width}%` }} />
  );
  return (
    <span
      aria-hidden
      className="flex aspect-[4/3] flex-col gap-2.5 overflow-hidden rounded-md border border-hairline bg-card p-3"
    >
      <span className="flex gap-1">
        {line(18)}
        {line(18)}
        {line(18)}
      </span>
      {template.blocks.length ? (
        template.blocks.map((block, index) =>
          block.kind === "text" ? (
            <span key={index} className="flex flex-col gap-1">
              {line(92 - index * 7)}
              {line(58 + index * 9)}
            </span>
          ) : (
            <span key={index} className="flex flex-col gap-1">
              {line(30, "bg-secondary")}
              {line(84)}
              <span className="flex gap-1">
                {line(22, "bg-warning-muted")}
                {line(40)}
              </span>
            </span>
          ),
        )
      ) : (
        <span className="flex flex-col gap-1">{line(70)}</span>
      )}
    </span>
  );
}
