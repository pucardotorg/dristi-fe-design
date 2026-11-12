"use client";

import * as React from "react";
import {
  AlignLeftIcon,
  BoldIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Command = "bold" | "italic" | "insertOrderedList" | "insertUnorderedList" | "justifyLeft";

const TOOLS: { cmd: Command; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { cmd: "bold", label: "Bold", icon: BoldIcon },
  { cmd: "italic", label: "Italic", icon: ItalicIcon },
  { cmd: "insertOrderedList", label: "Numbered list", icon: ListOrderedIcon },
  { cmd: "insertUnorderedList", label: "Bulleted list", icon: ListIcon },
  { cmd: "justifyLeft", label: "Align left", icon: AlignLeftIcon },
];

/**
 * Brackets shown for what they are (bulk filing's facts of the case, owner 2026-11-12): a
 * `[Field]` the cases fill becomes a token that cannot be typed over, and any other
 * `[…]` is a prompt to write, highlighted, selected whole on click so typing replaces it.
 * The value stays plain brackets: the display is converted on the way in and out.
 */
export type BracketMarks = { isField: (name: string) => boolean };

const TOKEN_CLASS =
  "mx-0.5 rounded-md bg-brand-muted px-1.5 py-0.5 font-medium text-brand-muted-foreground";
const PROMPT_CLASS =
  "mx-0.5 cursor-text rounded-md border border-dashed border-warning-ink bg-warning-muted px-1.5 py-0.5 text-warning-muted-foreground";

const attr = (t: string) => t.replace(/"/g, "&quot;");

/** Plain-bracket HTML to the marked display. Text nodes only, so tags are never touched. */
function toDisplay(html: string, marks: BracketMarks): string {
  return String(html ?? "").replace(/(^|>)([^<]*)/g, (_, open: string, text: string) =>
    open +
    text.replace(/\[([^\]\n]+)\]/g, (_w, name: string) =>
      marks.isField(name)
        ? `<span data-token="${attr(name)}" contenteditable="false" class="${TOKEN_CLASS}">${name}</span>`
        : `<mark data-prompt="${attr(name)}" class="${PROMPT_CLASS}">${name}</mark>`,
    ),
  );
}

/** The marked display back to plain brackets: a prompt still unwritten stays a bracket. */
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
  /** Actions at the far end of the formatting strip. */
  toolbarEnd?: React.ReactNode;
  handleRef?: React.Ref<RichTextEditorHandle>;
  marks?: BracketMarks;
  /** The text's own size and leading, where it is read as prose (bulk's facts of the case). */
  contentClassName?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const lastValue = React.useRef<string>("");
  // The caret, kept while focus is away in a picker so an insert lands where it was.
  const caret = React.useRef<Range | null>(null);

  React.useEffect(() => {
    const keep = () => {
      const sel = document.getSelection();
      if (!sel?.rangeCount || !ref.current) return;
      const range = sel.getRangeAt(0);
      if (ref.current.contains(range.commonAncestorContainer)) caret.current = range.cloneRange();
    };
    document.addEventListener("selectionchange", keep);
    return () => document.removeEventListener("selectionchange", keep);
  }, []);

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
    lastValue.current = html;
    onChange(html);
  };

  /** Redraw the marks from the value: a written prompt turns plain, a typed field a token. */
  const redecorate = () => {
    if (!marks || !ref.current) return;
    ref.current.innerHTML = toDisplay(lastValue.current, marks);
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

  React.useImperativeHandle(handleRef, () => ({
    insertText(text: string) {
      if (!restoreCaret()) return;
      document.execCommand("insertText", false, text);
      emit();
      redecorate();
    },
  }));

  const empty = !value || value === "<br>" || value === "<p></p>";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      {/* Five packed controls: the buttons stay 36px so the strip reads as chrome, and
          `after:-inset-1` grows each hit area to 44px. The gap is 8px so those boxes
          meet rather than overlap. */}
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface-sunken px-2 py-1"
      >
        {TOOLS.map((t) => (
          <Button
            key={t.cmd}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.cmd)}
            className="relative after:absolute after:-inset-1"
          >
            <t.icon className="size-4" aria-hidden />
          </Button>
        ))}
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
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={() => {
            emit();
            redecorate();
          }}
          // A prompt is selected whole on click, so typing replaces it.
          onClick={(e) => {
            if (!marks) return;
            const mark = (e.target as HTMLElement).closest<HTMLElement>("mark[data-prompt]");
            if (!mark || (mark.textContent ?? "").trim() !== (mark.dataset.prompt ?? "").trim()) return;
            const range = document.createRange();
            range.selectNodeContents(mark);
            const sel = document.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }}
          className={cn(
            "prose-p:my-2 px-4 py-3 text-body-compact leading-relaxed text-foreground outline-none [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc",
            minHeightClassName,
            contentClassName
          )}
        />
      </div>
    </div>
  );
}
