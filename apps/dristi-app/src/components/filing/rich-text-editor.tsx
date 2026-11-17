"use client";

import * as React from "react";
import {
  AlignLeftIcon,
  BoldIcon,
  BracketsIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Command = "bold" | "italic" | "insertOrderedList" | "insertUnorderedList" | "justifyLeft";

const TOOLS: { cmd: Command; label: string; icon: React.ComponentType<{ className?: string }> }[][] = [
  [
    { cmd: "bold", label: "Bold", icon: BoldIcon },
    { cmd: "italic", label: "Italic", icon: ItalicIcon },
  ],
  [
    { cmd: "insertOrderedList", label: "Numbered list", icon: ListOrderedIcon },
    { cmd: "insertUnorderedList", label: "Bulleted list", icon: ListIcon },
    { cmd: "justifyLeft", label: "Align left", icon: AlignLeftIcon },
  ],
];

/**
 * Brackets shown for what they are (bulk filing's facts of the case, owner 2026-11-12):
 *
 *   · a `[Field]` the cases fill is a variable: a chip that cannot be typed over; clicked, it
 *     says what it is connected to and what it reads as in a sample case, and can be removed;
 *   · any other `[…]` is a part to write, and behaves as a field inside the text: with the
 *     caret in it (click, or arrow keys) it takes the focus ring and a caret, its prompt is
 *     replaced by the first key typed, and once left it is plain text (owner, 2026-11-17);
 *   · typing `[` opens a list of variables that narrows as you type; Enter or Tab inserts one.
 *
 * The value stays plain brackets: the display is converted on the way in and out.
 */
export type BracketMarks = {
  isField: (name: string) => boolean;
  /** The fields `[` offers, with the section each belongs to. */
  fields?: { name: string; group: string }[];
  /** What a field reads as in the sample case, for its card. */
  sample?: (name: string) => string | undefined;
  /** Whose case the sample is ("Harsh V. Bhavsar"). */
  sampleLabel?: string;
};

/* Two kinds of bracket, never confused (owner, 2026-11-17: a dotted underline did not read as
   a variable). A variable is a chip of the brand tint, upright and medium: something the case
   puts there. A part to write is the blank: italic in a dashed amber box. In hand, each takes
   the focus ring: the chip outlined while its card is open; the blank as a focused field,
   its edge solid, a caret at its start, its prompt kept unselected-looking until a key
   replaces it (`data-whole`), then upright body ink as it is written (`data-typed`). */
const TOKEN_CLASS =
  "cursor-pointer whitespace-nowrap rounded-md bg-brand-muted px-1 py-0.5 font-medium text-brand-muted-foreground transition-colors hover:bg-brand-muted-hover data-[active]:ring-2 data-[active]:ring-ring";
const PROMPT_CLASS =
  "mx-0.5 cursor-text rounded-md border border-dashed border-warning-ink bg-warning-muted box-decoration-clone px-1.5 py-0.5 italic text-warning-muted-foreground transition-shadow hover:bg-warning-muted-hover data-[active]:border-solid data-[active]:border-ring data-[active]:ring-3 data-[active]:ring-ring/50 data-[typed]:text-foreground data-[typed]:not-italic data-[whole]:selection:bg-transparent data-[whole]:before:-mr-px data-[whole]:before:inline-block data-[whole]:before:h-4 data-[whole]:before:w-px data-[whole]:before:animate-caret-blink data-[whole]:before:bg-foreground data-[whole]:before:align-middle data-[whole]:before:content-['']";

const attr = (t: string) => t.replace(/"/g, "&quot;");

const tokenHtml = (name: string) =>
  `<span data-token="${attr(name)}" contenteditable="false" class="${TOKEN_CLASS}">${name}</span>`;

/** The time for coalescing typing into undo steps; only ever read from event handlers. */
function clock(): number {
  return performance.now();
}

/** Plain-bracket HTML to the marked display. Text nodes only, so tags are never touched. */
function toDisplay(html: string, marks: BracketMarks): string {
  return String(html ?? "").replace(/(^|>)([^<]*)/g, (_, open: string, text: string) =>
    open +
    text.replace(/\[([^\]\n]+)\]/g, (_w, name: string) =>
      marks.isField(name)
        ? tokenHtml(name)
        : `<mark data-prompt="${attr(name)}" class="${PROMPT_CLASS}">${name}</mark>`,
    ),
  );
}

/** The marked display back to plain brackets: a part still unwritten stays a bracket. */
function fromDisplay(html: string): string {
  if (typeof document === "undefined") return html;
  const box = document.createElement("div");
  box.innerHTML = html;
  box.querySelectorAll<HTMLElement>("[data-token]").forEach((el) => {
    el.replaceWith(document.createTextNode(`[${el.dataset.token ?? el.textContent ?? ""}]`));
  });
  box.querySelectorAll<HTMLElement>("mark[data-prompt]").forEach((el) => {
    const text = el.textContent ?? "";
    el.replaceWith(document.createTextNode(text.trim() === (el.dataset.prompt ?? "").trim() ? `[${text}]` : text));
  });
  return box.innerHTML;
}

/** What a caller can do to the text from outside it — a picker that is not in the box. */
export type RichTextEditorHandle = {
  /** Put `text` where the caret last was in the box, or at the end if it never was. */
  insertText: (text: string) => void;
};

type Spot = { top: number; left: number };
type Picker = Spot & { query: string; index: number };
type Card = Spot & { name: string };

/**
 * Small rich text editor for prayer / affidavit / other-details copy. Stores HTML.
 * Uses the browser's editing commands — enough for bold, italic and lists.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write here",
  ariaLabel,
  minHeightClassName = "min-h-40",
  className,
  id,
  toolbarStart,
  toolbarEnd,
  handleRef,
  marks,
  contentClassName,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  minHeightClassName?: string;
  className?: string;
  id?: string;
  /** Something before the formatting tools, divided from them (bulk facts: Write / Preview). */
  toolbarStart?: React.ReactNode;
  /** Actions at the far end of the formatting strip. */
  toolbarEnd?: React.ReactNode;
  handleRef?: React.Ref<RichTextEditorHandle>;
  marks?: BracketMarks;
  /** The text's own size and leading, where it is read as prose (bulk's facts of the case). */
  contentClassName?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const wrap = React.useRef<HTMLDivElement>(null);
  const lastValue = React.useRef<string>("");
  // The caret, kept while focus is away in a picker so an insert lands where it was.
  const caret = React.useRef<Range | null>(null);
  /* Undo and redo of our own, for an editor with marks: redrawing the marks replaces the
     box's content, which empties the browser's undo stack. Snapshots of the value, typing
     coalesced into one step per pause. */
  const past = React.useRef<string[]>([]);
  const future = React.useRef<string[]>([]);
  const lastPush = React.useRef(0);
  // `[` picker: where the typed "[query" sits, so choosing a field can replace it.
  const typed = React.useRef<{ node: Text; start: number; end: number } | null>(null);
  const [picker, setPicker] = React.useState<Picker | null>(null);
  const [card, setCard] = React.useState<Card | null>(null);
  const activeMark = React.useRef<HTMLElement | null>(null);
  // The part to write the caret is in: shown as a focused field while it is.
  const activePrompt = React.useRef<HTMLElement | null>(null);

  /** Leave a part to write: back to a blank, or, written, plain text where it stands. */
  const leavePrompt = (el: HTMLElement) => {
    if (activePrompt.current === el) activePrompt.current = null;
    el.removeAttribute("data-active");
    el.removeAttribute("data-whole");
    if (el.isConnected && el.hasAttribute("data-typed")) el.replaceWith(...el.childNodes);
  };

  /**
   * Follow the caret into and out of the parts to write. Entering an unwritten one takes its
   * prompt whole, so the first key replaces it; the selection is hidden and a caret drawn at
   * its start, as an empty field shows its placeholder.
   */
  const syncPrompt = (sel: Selection) => {
    const box = ref.current;
    const node = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
    const host = node && box?.contains(node) ? (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)) : null;
    const el = host?.closest<HTMLElement>("mark[data-prompt]") ?? null;
    const prev = activePrompt.current;
    if (prev && prev !== el) leavePrompt(prev);
    if (!el) return;
    activePrompt.current = el;
    el.setAttribute("data-active", "");
    if (el.hasAttribute("data-typed")) {
      el.removeAttribute("data-whole");
      return;
    }
    if (sel.isCollapsed) {
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    el.toggleAttribute("data-whole", sel.toString() === (el.textContent ?? ""));
  };

  React.useEffect(() => {
    const keep = () => {
      const sel = document.getSelection();
      if (!sel?.rangeCount || !ref.current) return;
      const range = sel.getRangeAt(0);
      if (ref.current.contains(range.commonAncestorContainer)) caret.current = range.cloneRange();
      if (marks) syncPrompt(sel);
    };
    document.addEventListener("selectionchange", keep);
    return () => document.removeEventListener("selectionchange", keep);
    // `syncPrompt` reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks]);

  // Only write into the DOM when the incoming value differs from what we last emitted,
  // so the caret is not reset on every keystroke.
  React.useEffect(() => {
    if (!ref.current) return;
    if (value !== lastValue.current) {
      ref.current.innerHTML = marks ? toDisplay(value || "", marks) : value || "";
      lastValue.current = value || "";
    }
  }, [value, marks]);

  const emit = () => {
    const raw = ref.current?.innerHTML ?? "";
    const html = marks ? fromDisplay(raw) : raw;
    if (marks && html !== lastValue.current) {
      const now = clock();
      if (now - lastPush.current > 800 || !past.current.length) past.current.push(lastValue.current);
      lastPush.current = now;
      future.current = [];
    }
    lastValue.current = html;
    onChange(html);
  };

  /** Redraw the marks from the value: a written part turns plain, a typed field a token. */
  const redecorate = () => {
    if (!marks || !ref.current) return;
    activePrompt.current = null;
    ref.current.innerHTML = toDisplay(lastValue.current, marks);
  };

  /** Step back or forward through the snapshots, and redraw. */
  const travel = (dir: "undo" | "redo") => {
    const from = dir === "undo" ? past.current : future.current;
    const to = dir === "undo" ? future.current : past.current;
    const target = from.pop();
    if (target === undefined || !ref.current || !marks) return;
    to.push(lastValue.current);
    lastValue.current = target;
    lastPush.current = 0;
    ref.current.innerHTML = toDisplay(target, marks);
    onChange(target);
  };

  const run = (cmd: Command) => {
    ref.current?.focus();
    document.execCommand(cmd, false);
    emit();
  };

  /** Put the caret back where it was in the box, or at the end if it never was. */
  const restoreCaret = () => {
    const box = ref.current;
    if (!box) return false;
    box.focus();
    const sel = document.getSelection();
    let range = caret.current;
    if (!range || !box.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(box);
      range.collapse(false);
    }
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  };

  /** A point in the box, relative to the editor's frame, for a floating card. */
  const spotOf = (rect: DOMRect): Spot => {
    const frame = wrap.current?.getBoundingClientRect();
    return { top: rect.bottom - (frame?.top ?? 0) + 6, left: Math.max(8, rect.left - (frame?.left ?? 0)) };
  };

  const clearActive = () => {
    activeMark.current?.removeAttribute("data-active");
    activeMark.current = null;
  };

  const closeFloats = () => {
    setPicker(null);
    setCard(null);
    clearActive();
  };


  /* `[` shortcut: the text before the caret in its text node ends in "[query" → the list. */
  const fieldsFor = (query: string) => {
    const q = query.trim().toLowerCase();
    return (marks?.fields ?? []).filter((f) => !q || f.name.toLowerCase().includes(q)).slice(0, 8);
  };

  const detectTrigger = () => {
    if (!marks?.fields?.length) return;
    const sel = document.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const node = range?.startContainer;
    if (!range || !range.collapsed || !node || node.nodeType !== Node.TEXT_NODE || node.parentElement?.closest("mark,[data-token]")) {
      typed.current = null;
      setPicker(null);
      return;
    }
    const before = (node.textContent ?? "").slice(0, range.startOffset);
    const m = /\[([^[\]\n]{0,40})$/.exec(before);
    if (!m) {
      typed.current = null;
      setPicker(null);
      return;
    }
    typed.current = { node: node as Text, start: range.startOffset - m[0].length, end: range.startOffset };
    setPicker((p) => ({ ...spotOf(range.getBoundingClientRect()), query: m[1], index: p && p.query === m[1] ? p.index : 0 }));
  };

  const chooseField = (name: string) => {
    const t = typed.current;
    if (!t || !ref.current) return;
    const range = document.createRange();
    range.setStart(t.node, t.start);
    range.setEnd(t.node, Math.min(t.end, t.node.length));
    typed.current = null;
    setPicker(null);
    insertField(range, name);
  };

  /**
   * Put a field over `range` and keep it one: browsers strip a pasted token's markup, so the
   * bracket form goes in, the marks are redrawn, and the caret lands after the new field
   * (found as the k-th field of that name, counted before the redraw).
   */
  const insertField = (range: Range, name: string) => {
    const box = ref.current;
    if (!box || !marks) return;
    const before = [...box.querySelectorAll<HTMLElement>("[data-token]")].filter(
      (el) => el.dataset.token === name && range.comparePoint(el, 0) < 0,
    ).length;
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand("insertText", false, `[${name}] `);
    emit();
    redecorate();
    const token = [...box.querySelectorAll<HTMLElement>("[data-token]")].filter((el) => el.dataset.token === name)[before];
    if (!token) return;
    // After the space that follows the field, so typing carries on as a new word.
    const after = document.createRange();
    const next = token.nextSibling;
    if (next && next.nodeType === Node.TEXT_NODE && /^[\s\u00a0]/.test(next.textContent ?? "")) after.setStart(next, 1);
    else after.setStartAfter(token);
    after.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(after);
  };

  const removeField = (name: string) => {
    const el = activeMark.current;
    if (el && el.dataset.token === name) el.remove();
    closeFloats();
    emit();
  };

  React.useImperativeHandle(handleRef, () => ({
    insertText(text: string) {
      if (!restoreCaret()) return;
      const field = marks && /^\[(.+)\]$/.exec(text)?.[1];
      const sel = document.getSelection();
      if (field && marks?.isField(field) && sel?.rangeCount) {
        insertField(sel.getRangeAt(0), field);
        return;
      }
      document.execCommand("insertText", false, text);
      emit();
    },
  }));

  const empty = !value || value === "<br>" || value === "<p></p>";
  const matches = picker ? fieldsFor(picker.query) : [];

  return (
    <div
      ref={wrap}
      className={cn(
        "relative flex flex-col rounded-xl border border-input bg-card transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      {/* The formatting strip sits on the writing surface itself, grouped with quiet
          dividers, so the box reads as one considered surface rather than a grey band over
          a field. Buttons stay 36px, `after:-inset-1` grows each hit area to 44px. */}
      <div role="toolbar" aria-label="Text formatting" className="flex flex-wrap items-center gap-1 border-b border-hairline px-3 py-2">
        {toolbarStart ? (
          <>
            {toolbarStart}
            <span aria-hidden className="mx-2 h-5 w-px bg-border" />
          </>
        ) : null}
        {TOOLS.map((group, g) => (
          <React.Fragment key={g}>
            {g ? <span aria-hidden className="mx-1 h-5 w-px bg-border" /> : null}
            {group.map((t) => (
              <Button
                key={t.cmd}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t.label}
                title={t.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(t.cmd)}
                className="relative text-muted-foreground after:absolute after:-inset-1 hover:text-foreground"
              >
                <t.icon className="size-4" aria-hidden />
              </Button>
            ))}
          </React.Fragment>
        ))}
        {marks ? (
          <>
            <span aria-hidden className="mx-1 h-5 w-px bg-border" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Undo"
              title="Undo (⌘Z)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => travel("undo")}
              className="relative text-muted-foreground after:absolute after:-inset-1 hover:text-foreground"
            >
              <Undo2Icon className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Redo"
              title="Redo (⇧⌘Z)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => travel("redo")}
              className="relative text-muted-foreground after:absolute after:-inset-1 hover:text-foreground"
            >
              <Redo2Icon className="size-4" aria-hidden />
            </Button>
          </>
        ) : null}
        {toolbarEnd ? (
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">{toolbarEnd}</div>
        ) : null}
      </div>
      <div className="relative">
        {empty ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-4 top-3 text-body-compact text-muted-foreground"
          >
            {placeholder}
          </span>
        ) : null}
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          aria-autocomplete={marks?.fields ? "list" : undefined}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            // A key in a part to write: its prompt is gone, what is typed reads as text.
            const prompt = activePrompt.current;
            if (prompt && (prompt.textContent ?? "").trim() !== (prompt.dataset.prompt ?? "").trim()) {
              prompt.setAttribute("data-typed", "");
              prompt.removeAttribute("data-whole");
            }
            setCard(null);
            clearActive();
            emit();
            detectTrigger();
          }}
          onKeyDown={(e) => {
            if (picker && matches.length) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const step = e.key === "ArrowDown" ? 1 : -1;
                setPicker({ ...picker, index: (picker.index + step + matches.length) % matches.length });
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                chooseField(matches[picker.index]?.name ?? matches[0].name);
                return;
              }
            }
            if (e.key === "Escape" && (picker || card)) {
              e.preventDefault();
              closeFloats();
              return;
            }
            // Arrows step over an unwritten part as over a field, not into its prompt.
            const prompt = activePrompt.current;
            if (prompt?.hasAttribute("data-whole") && !e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
              e.preventDefault();
              const range = document.createRange();
              if (e.key === "ArrowRight") range.setStartAfter(prompt);
              else range.setStartBefore(prompt);
              range.collapse(true);
              leavePrompt(prompt);
              const sel = document.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
              return;
            }
            if (!marks || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
            e.preventDefault();
            travel(e.shiftKey ? "redo" : "undo");
          }}
          onBlur={() => {
            emit();
            redecorate();
            closeFloats();
          }}
          onClick={(e) => {
            if (!marks) return;
            const target = e.target as HTMLElement;
            const token = target.closest<HTMLElement>("[data-token]");
            setPicker(null);
            clearActive();
            setCard(null);
            // A part to write is taken by the caret (`syncPrompt`); a variable says what it
            // is connected to.
            if (token) {
              token.setAttribute("data-active", "");
              activeMark.current = token;
              setCard({ ...spotOf(token.getBoundingClientRect()), name: token.dataset.token ?? "" });
            }
          }}
          className={cn(
            "prose-p:my-2 px-4 py-3 text-body-compact leading-relaxed text-foreground outline-none [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc",
            minHeightClassName,
            contentClassName
          )}
        />
      </div>

      {/* The shortcut, said once where it is used. */}
      {marks?.fields?.length ? (
        <div className="flex items-center gap-2 border-t border-hairline px-4 py-2 text-body-compact text-muted-foreground">
          Type
          <kbd className="rounded-md border border-border bg-surface-sunken px-1.5 font-mono text-body-compact text-foreground">[</kbd>
          to insert a variable.
        </div>
      ) : null}

      {/* `[` list: the fields that match what is typed after the bracket. */}
      {picker ? (
        <div
          role="listbox"
          aria-label="Variables"
          className="absolute z-30 w-80 overflow-hidden rounded-lg bg-popover p-1.5 text-popover-foreground shadow-overlay ring-1 ring-foreground/10"
          style={{ top: picker.top, left: picker.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {matches.length ? (
            matches.map((f, i) => (
              <button
                key={f.name}
                type="button"
                role="option"
                aria-selected={i === picker.index}
                onClick={() => chooseField(f.name)}
                onMouseEnter={() => setPicker({ ...picker, index: i })}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-body-compact",
                  i === picker.index ? "bg-accent text-accent-foreground" : "text-foreground",
                )}
              >
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-muted-foreground">{f.group}</span>
              </button>
            ))
          ) : (
            <p className="px-2.5 py-2 text-body-compact text-muted-foreground">No variable matches “{picker.query}”</p>
          )}
        </div>
      ) : null}

      {/* A variable, clicked: what it is connected to, and what it reads as in a case. */}
      {card ? (
        <div
          role="dialog"
          aria-label={`${card.name}, a variable`}
          className="absolute z-30 flex w-80 flex-col gap-2 rounded-lg bg-popover p-3 text-popover-foreground shadow-overlay ring-1 ring-foreground/10"
          style={{ top: card.top, left: card.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2">
            <BracketsIcon aria-hidden className="size-4 shrink-0 text-brand-muted-foreground" />
            <span className="text-body-compact font-semibold">{card.name}</span>
          </div>
          <p className="text-body-compact text-muted-foreground">Filled in from each case&apos;s details.</p>
          {marks?.sample?.(card.name) ? (
            <p className="rounded-md bg-surface-sunken px-2.5 py-2 text-body-compact">
              <span className="text-muted-foreground">{marks.sampleLabel ? `In ${marks.sampleLabel}'s case: ` : "In a case: "}</span>
              {marks.sample(card.name)}
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground hover:text-foreground"
            onClick={() => removeField(card.name)}
          >
            <Trash2Icon data-icon="inline-start" aria-hidden />
            Remove variable
          </Button>
        </div>
      ) : null}

    </div>
  );
}
