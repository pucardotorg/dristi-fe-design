"use client";

import * as React from "react";

import {
  BLANK,
  paraParts,
  paraText,
  type ParaPart,
  type ValuePiece,
  type WordPart,
} from "@/lib/employee/order-proceedings";

/*
 * The two editable surfaces of version C, and the caret work they share.
 *
 * Both are plain `contenteditable`, uncontrolled while the drafter types: React writes a
 * surface's markup only when the block is new or something other than typing changed it
 * (`rev`), so the caret is never thrown out of the words under the drafter's hands. Every
 * keystroke is read back out of the markup into the draft.
 */

const escape = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );

/* ─────────────────────────────────── caret ──────────────────────────────────── */

export function textLength(el: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.toString().length;
}

export function caretOffset(el: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return 0;
  const range = selection.getRangeAt(0);
  const before = range.cloneRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length;
}

/** Puts the caret at a character offset in `el`, or at its end. */
export function setCaret(el: HTMLElement, offset: number | "end"): void {
  el.focus({ preventScroll: false });
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let left = offset === "end" ? Number.POSITIVE_INFINITY : offset;
  let placed = false;
  for (const child of Array.from(el.childNodes)) {
    const length = child.textContent?.length ?? 0;
    if (child.nodeType === Node.TEXT_NODE && left <= length) {
      range.setStart(child, left);
      placed = true;
      break;
    }
    if (child.nodeType !== Node.TEXT_NODE && left <= length) {
      range.setStartAfter(child);
      placed = true;
      break;
    }
    left -= length;
  }
  if (!placed) {
    range.selectNodeContents(el);
    range.collapse(false);
  } else {
    range.collapse(true);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

export function caretRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rects = range.getClientRects();
  return (
    rects[0] ??
    range.startContainer.parentElement?.getBoundingClientRect() ??
    null
  );
}

export function selectRange(range: Range): void {
  const host = range.startContainer.parentElement?.closest<HTMLElement>(
    "[contenteditable=true]",
  );
  host?.focus({ preventScroll: true });
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/* ──────────────────────────────────── blanks ────────────────────────────────── */

/** The next [blank] in `el` after a point, or the first one when there is no point. */
export function nextBlank(
  el: HTMLElement,
  from?: { node: Node; offset: number },
): Range | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let started = !from;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest("[data-ref]")) continue;
    let start = 0;
    if (!started && from) {
      if (node === from.node) {
        started = true;
        start = from.offset;
      } else if (
        from.node.nodeType !== Node.TEXT_NODE &&
        el.contains(from.node) &&
        from.node.compareDocumentPosition(node) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ) {
        started = true;
      } else {
        continue;
      }
    }
    for (const match of (node.textContent ?? "").matchAll(BLANK)) {
      if ((match.index ?? 0) >= start) {
        const range = document.createRange();
        range.setStart(node, match.index ?? 0);
        range.setEnd(node, (match.index ?? 0) + match[0].length);
        return range;
      }
    }
  }
  return null;
}

/** The [blank] the caret is in, or that is selected. */
export function blankAtCaret(el: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  if (
    node.nodeType !== Node.TEXT_NODE ||
    !el.contains(node) ||
    range.endContainer !== node
  )
    return null;
  const a = range.startOffset;
  const z = range.endOffset;
  for (const match of (node.textContent ?? "").matchAll(BLANK)) {
    const lo = match.index ?? 0;
    const hi = lo + match[0].length;
    if ((a === z && a > lo && a < hi) || (a !== z && a >= lo && z <= hi)) {
      const found = document.createRange();
      found.setStart(node, lo);
      found.setEnd(node, hi);
      return found;
    }
  }
  return null;
}

/**
 * Tints every [blank] in the typed text, without touching the markup the caret lives in —
 * the CSS Custom Highlight API, where the browser has it. Where it does not, the blanks
 * are still counted and still listed; they are only not tinted.
 */
export function paintBlanks(): void {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  const ranges: Range[] = [];
  document.querySelectorAll<HTMLElement>("[data-para]").forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest("[data-ref]")) continue;
      for (const match of (node.textContent ?? "").matchAll(BLANK)) {
        const range = new Range();
        range.setStart(node, match.index ?? 0);
        range.setEnd(node, (match.index ?? 0) + match[0].length);
        ranges.push(range);
      }
    }
  });
  (CSS as unknown as { highlights: Map<string, unknown> }).highlights.set(
    "proceedings-blank",
    new (
      window as unknown as { Highlight: new (...r: Range[]) => unknown }
    ).Highlight(...ranges),
  );
}

/* ─────────────────────────────── a typed paragraph ──────────────────────────── */

const CHIP =
  "cursor-pointer rounded-sm text-primary underline underline-offset-3 hover:bg-accent";

export function paragraphHTML(
  text: string,
  labelFor: (id: string) => string,
): string {
  return paraParts(text)
    .map((part) =>
      typeof part === "string"
        ? escape(part)
        : `<span class="${CHIP}" contenteditable="false" data-ref="${escape(part.ref)}" role="link" tabindex="-1">${escape(labelFor(part.ref))}</span>`,
    )
    .join("");
}

/** The words of a paragraph's markup, citations as tokens. */
export function readParagraph(el: HTMLElement): string {
  const parts: ParaPart[] = [];
  const walk = (node: Node) =>
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE)
        parts.push(child.textContent ?? "");
      else if (child instanceof HTMLElement && child.dataset.ref)
        parts.push({ ref: child.dataset.ref });
      else if (child.nodeName === "BR") parts.push("\n");
      else walk(child);
    });
  walk(el);
  const text = paraText(parts);
  return text === "\n" ? "" : text.replace(/\n$/, "");
}

export type Trigger = {
  mode: "slash" | "at";
  query: string;
  rect: DOMRect | null;
  node: Text;
  start: number;
  end: number;
};

/**
 * `/` or `@` typed at a word's start: the menu it asks for, and what it replaces. An `@`
 * query may run on past a space — a person's name has one — for a few words.
 */
export function triggerAtCaret(el: HTMLElement): Trigger | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || !el.contains(node)) return null;
  const before = (node.textContent ?? "").slice(0, range.startOffset);
  const at = before.match(/(?:^|[\s.,;:(])@((?:[^\s/@\n]+ ?){0,4})$/);
  const slash = before.match(/(?:^|[\s.,;:(])\/([^\s/@]{0,30})$/);
  const match = at ?? slash;
  if (!match) return null;
  return {
    mode: at ? "at" : "slash",
    query: match[1],
    rect: caretRect(),
    node: node as Text,
    start: range.startOffset - match[1].length - 1,
    end: range.startOffset,
  };
}

export const ProceedingsParagraph = React.forwardRef<
  HTMLDivElement,
  {
    id: string;
    text: string;
    /** Bumped whenever something other than typing changed the words. */
    rev: number;
    placeholder?: string;
    labelFor: (id: string) => string;
    onText: (text: string) => void;
    onTrigger: (trigger: Trigger | null) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
    onBlank: (range: Range) => void;
    onCite: (id: string, from: HTMLElement) => void;
    className?: string;
  }
>(function ProceedingsParagraph(
  {
    id,
    text,
    rev,
    placeholder,
    labelFor,
    onText,
    onTrigger,
    onKeyDown,
    onBlank,
    onCite,
    className,
  },
  forwarded,
) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useImperativeHandle(forwarded, () => ref.current as HTMLDivElement);

  /* Markup only on a new block or a change that was not typing. */
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = paragraphHTML(text, labelFor);
    paintBlanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- typing must not rewrite it
  }, [id, rev]);

  return (
    <div
      ref={ref}
      data-para={id}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-multiline
      aria-label="Order text"
      data-placeholder={placeholder}
      className={className}
      onInput={(event) => {
        const el = event.currentTarget;
        if (!el.textContent) el.innerHTML = "";
        onText(readParagraph(el));
        onTrigger(triggerAtCaret(el));
        paintBlanks();
      }}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        const chip = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-ref]",
        );
        if (chip?.dataset.ref) {
          onCite(chip.dataset.ref, chip);
          return;
        }
        const blank = blankAtCaret(event.currentTarget);
        if (blank) onBlank(blank);
      }}
      onPaste={(event) => {
        event.preventDefault();
        const plain = event.clipboardData
          .getData("text/plain")
          .replace(/\r/g, "");
        document.execCommand("insertText", false, plain);
      }}
    />
  );
});

/* ────────────────────────── an order item's own words ───────────────────────── */

/* A value is a tinted piece of the sentence. Its breathing room is a ring in its own
   fill, not padding, so the words around it keep their natural spacing. Filled, it
   takes the brand's tint — set apart from the words typed around it as plainly as an
   unfilled one is in yellow (owner, 2026-10-14: the neutral tint read as nothing). */
const VALUE =
  "cursor-pointer rounded-sm bg-brand-muted text-brand-muted-foreground ring-2 ring-brand-muted transition-colors hover:bg-brand-muted-hover hover:ring-brand-muted-hover";
const VALUE_ACTIVE =
  "cursor-pointer rounded-sm bg-brand-muted text-brand-muted-foreground ring-4 ring-halo";
const VALUE_GAP =
  "cursor-pointer rounded-sm bg-warning-muted text-warning-muted-foreground ring-2 ring-warning-muted transition-colors hover:underline hover:underline-offset-3";

export function wordingHTML(
  parts: readonly WordPart[],
  piece: (key: string) => ValuePiece,
  name: string,
  active?: string | null,
): string {
  return parts
    .map((part) => {
      if (typeof part === "string") return escape(part);
      const value = piece(part.k);
      return value.missing
        ? `<span class="${part.k === active ? VALUE_ACTIVE : VALUE_GAP}" contenteditable="false" data-var="${escape(part.k)}" title="Not set yet. Fill it in the fields.">${escape(value.label.toLowerCase())}</span>`
        : `<span class="${part.k === active ? VALUE_ACTIVE : VALUE}" contenteditable="false" data-var="${escape(part.k)}" title="From ${escape(name)}. Change it in the fields.">${escape(value.text)}</span>`;
    })
    .join("");
}

export function readWording(el: HTMLElement): WordPart[] {
  const parts: WordPart[] = [];
  el.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) parts.push(child.textContent ?? "");
    else if (child instanceof HTMLElement && child.dataset.var)
      parts.push({ k: child.dataset.var });
    else if (child.textContent) parts.push(child.textContent);
  });
  return parts.reduce<WordPart[]>((out, part) => {
    const previous = out[out.length - 1];
    if (typeof part === "string" && typeof previous === "string") {
      out[out.length - 1] = previous + part;
      return out;
    }
    out.push(part);
    return out;
  }, []);
}

/**
 * An order item's sentence, editable as words: the values are locked pieces, because the
 * workflows run on them. A value pressed opens its field. Typing that would take a value
 * out puts the sentence back as it was.
 */
export function ItemWording({
  id,
  rev,
  parts,
  piece,
  name,
  active,
  onWording,
  onLostValue,
  onValue,
}: {
  id: string;
  rev: number;
  parts: readonly WordPart[];
  piece: (key: string) => ValuePiece;
  name: string;
  /** The value whose field has focus: it is marked, so the eye joins the two. */
  active?: string | null;
  onWording: (parts: WordPart[]) => void;
  onLostValue: () => void;
  onValue: (key: string) => void;
}) {
  const ref = React.useRef<HTMLParagraphElement>(null);
  const html = wordingHTML(parts, piece, name, active);
  const needed = parts
    .filter((part): part is { k: string } => typeof part !== "string")
    .map((part) => part.k);

  /* Values change from the fields while the line is not being typed in; keep the markup
     in step then, and never while the caret is in it. */
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    el.innerHTML = html;
  }, [html, rev, id]);

  return (
    <p
      ref={ref}
      data-wording={id}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label={`${name} order text`}
      className="-mx-1.5 rounded-md px-1.5 py-0.5 text-body transition-colors outline-none hover:bg-accent/50 focus:bg-accent/50"
      onInput={(event) => {
        const el = event.currentTarget;
        const read = readWording(el);
        const have = read
          .filter((part): part is { k: string } => typeof part !== "string")
          .map((part) => part.k);
        if (!needed.every((key) => have.includes(key))) {
          el.innerHTML = html;
          setCaret(el, "end");
          onLostValue();
          return;
        }
        onWording(read);
      }}
      onBlur={(event) => {
        event.currentTarget.innerHTML = html;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
      onClick={(event) => {
        const value = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-var]",
        );
        if (value?.dataset.var) onValue(value.dataset.var);
      }}
      onPaste={(event) => {
        event.preventDefault();
        document.execCommand(
          "insertText",
          false,
          event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " "),
        );
      }}
    />
  );
}
