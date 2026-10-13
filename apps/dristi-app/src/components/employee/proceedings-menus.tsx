"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/*
 * The two small floating lists version C opens at the caret, where a Popover has no
 * element to anchor to: the `/` and `@` menu that the drafter drives from the paragraph
 * they are typing in, and the list that fills a [blank]. Both take the DS overlay recipe
 * — popover fill, overlay elevation, the hairline ring.
 */

const SURFACE =
  "fixed z-50 flex flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-overlay ring-1 ring-foreground/10 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95";

/** Where a floating list goes: under the caret, or above it when it would run off. */
function place(rect: DOMRect | null, width: number, height: number) {
  const margin = 12;
  const footer = document.querySelector("footer.sticky")?.getBoundingClientRect().height ?? 0;
  let left = rect ? rect.left : margin;
  let top = rect ? rect.bottom + 6 : margin;
  if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
  if (top + height > window.innerHeight - footer - margin) {
    top = Math.max(margin, rect ? rect.top - height - 6 : margin);
  }
  return { left: Math.max(margin, left), top };
}

export type MenuEntry = {
  id: string;
  label: string;
  detail?: string;
  icon?: React.ReactNode;
  disabled?: string | null;
};

export type MenuGroup = { heading: string; entries: MenuEntry[] };

/**
 * The `/` and `@` menu. It never takes focus: the drafter keeps typing in the paragraph,
 * which narrows the list, and its arrow keys, Enter and Escape drive it.
 */
export function CaretMenu({
  id,
  rect,
  groups,
  selected,
  empty,
  onPick,
  onHover,
}: {
  id: string;
  rect: DOMRect | null;
  groups: MenuGroup[];
  selected: string | null;
  empty: string;
  onPick: (entry: MenuEntry) => void;
  onHover: (id: string) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [at, setAt] = React.useState<{ left: number; top: number } | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = place(rect, el.offsetWidth, el.offsetHeight);
    setAt((current) => (current && current.left === next.left && current.top === next.top ? current : next));
  }, [rect, groups]);

  React.useEffect(() => {
    if (!selected) return;
    ref.current?.querySelector(`[data-entry="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return createPortal(
    <div
      ref={ref}
      className={cn(SURFACE, "w-80 max-w-[calc(100vw-2rem)]")}
      style={at ?? { left: -9999, top: -9999 }}
    >
      <div
        id={id}
        role="listbox"
        aria-label="Insert"
        className="max-h-96 overflow-y-auto overscroll-contain p-1"
      >
        {groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-body-compact text-muted-foreground">{empty}</p>
        ) : (
          groups.map((group) => (
            <div key={group.heading} role="group" aria-label={group.heading}>
              <p className="px-2 pt-2 pb-1 text-body-compact text-muted-foreground">{group.heading}</p>
              {group.entries.map((entry) => (
                <div
                  key={entry.id}
                  id={`${id}-${entry.id}`}
                  data-entry={entry.id}
                  role="option"
                  aria-selected={entry.id === selected}
                  aria-disabled={Boolean(entry.disabled)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (!entry.disabled) onPick(entry);
                  }}
                  onMouseEnter={() => !entry.disabled && onHover(entry.id)}
                  className={cn(
                    "flex min-h-10 cursor-default items-center gap-3 rounded-md px-2 py-1.5",
                    entry.disabled ? "opacity-50" : "",
                    entry.id === selected ? "bg-accent" : "",
                  )}
                >
                  {entry.icon}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-compact font-medium">{entry.label}</span>
                    {entry.disabled || entry.detail ? (
                      <span className="truncate text-body-compact text-muted-foreground">
                        {entry.disabled || entry.detail}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Moves a menu's selection by one, past what cannot be chosen, wrapping at the ends. */
export function stepSelection(groups: MenuGroup[], selected: string | null, by: 1 | -1): string | null {
  const entries = groups.flatMap((group) => group.entries).filter((entry) => !entry.disabled);
  if (!entries.length) return null;
  const at = entries.findIndex((entry) => entry.id === selected);
  return entries[(at + by + entries.length) % entries.length].id;
}

export function firstSelectable(groups: MenuGroup[]): string | null {
  return groups.flatMap((group) => group.entries).find((entry) => !entry.disabled)?.id ?? null;
}

/**
 * Filling a [blank]: what usually goes there, drawn from the case, searchable, with the
 * drafter's own words always one Enter away. Escape or Tab leaves the blank selected, so a
 * fast typist can simply type over it.
 */
export function BlankCombo({
  rect,
  label,
  options,
  onPick,
  onLeave,
}: {
  rect: DOMRect | null;
  label: string;
  options: readonly { value: string; detail?: string }[];
  onPick: (value: string) => void;
  onLeave: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState(0);
  const [at, setAt] = React.useState<{ left: number; top: number } | null>(null);
  const listId = React.useId();

  const needle = query.trim().toLowerCase();
  const matches = options.filter(
    (option) => !needle || `${option.value} ${option.detail ?? ""}`.toLowerCase().includes(needle),
  );
  const items = query.trim() && !matches.some((option) => option.value.toLowerCase() === needle)
    ? [...matches, { value: query.trim(), typed: true as const }]
    : matches;
  const current = Math.min(selected, Math.max(0, items.length - 1));

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAt(place(rect, el.offsetWidth, el.offsetHeight));
    inputRef.current?.focus();
  }, [rect]);

  React.useEffect(() => {
    function away(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onLeave();
    }
    window.document.addEventListener("mousedown", away);
    return () => window.document.removeEventListener("mousedown", away);
  }, [onLeave]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Fill [${label}]`}
      className={cn(SURFACE, "w-80 max-w-[calc(100vw-2rem)]")}
      style={at ?? { left: -9999, top: -9999 }}
    >
      <p className="px-3 pt-2.5 text-body-compact text-muted-foreground">Fill [{label}]</p>
      <div className="border-b border-hairline p-1">
        <input
          ref={inputRef}
          role="combobox"
          aria-controls={listId}
          aria-expanded
          aria-autocomplete="list"
          aria-activedescendant={items.length ? `${listId}-${current}` : undefined}
          aria-label={`Fill ${label}`}
          autoComplete="off"
          value={query}
          placeholder={options.length ? "Search, or type something else" : `Type ${label}`}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (items.length) setSelected((current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const item = items[current];
              if (item) onPick(item.value);
            }
            if (event.key === "Escape" || event.key === "Tab") {
              event.preventDefault();
              onLeave();
            }
          }}
          className="h-9 w-full rounded-lg bg-transparent px-2 text-body-compact outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1">
        {items.length === 0 ? (
          <p className="px-2 py-2 text-body-compact text-muted-foreground">
            {options.length ? "Nothing matches. Keep typing to use your words." : "Type the words, then Enter."}
          </p>
        ) : (
          items.map((item, index) => (
            <div
              key={`${item.value}-${index}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === current}
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(item.value);
              }}
              onMouseEnter={() => setSelected(index)}
              className={cn(
                "flex min-h-10 cursor-default flex-col justify-center rounded-md px-2 py-1.5",
                index === current && "bg-accent",
              )}
            >
              <span className={cn("text-body-compact", "typed" in item ? "" : "font-medium")}>
                {"typed" in item ? `Use “${item.value}”` : item.value}
              </span>
              {"detail" in item && item.detail ? (
                <span className="text-body-compact text-muted-foreground">{item.detail}</span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}
