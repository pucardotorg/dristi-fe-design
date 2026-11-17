/**
 * Taking the filer from an open check to the place it is about (owner, 2026-11-17: "if I
 * click on an error, take me directly to where that error is; I don't need to hunt").
 *
 *  · A check on a field: the field whose error line says the same thing (`FormField`
 *    shows the host's issue under its control). It is scrolled to the middle of the
 *    screen, its control focused, and its frame lit once.
 *  · A check on the facts of the case: the `[…]` parts in the editor, the fields left
 *    unfilled (`pry-1-unfilled`) or the parts still to write (`pry-1-blanks`). Each press
 *    selects the next one, so the filer types straight over it.
 *
 * Nothing in the shared filing sections changes: the place is read from what they already
 * render. A check with no place on screen has nothing to go to, and offers nothing.
 */

import type { Flag } from "@/lib/bulk/scrutiny";
import { detailField } from "@/lib/filing/detail-fields";

type Target =
  | { kind: "field"; frame: HTMLElement; control: HTMLElement | null }
  | { kind: "text"; editor: HTMLElement; ranges: Range[] };

const CONTROL =
  'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), [role=combobox], [contenteditable=true], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The `[…]` parts in an editor's text that a check is about, as ranges, in reading order. */
function bracketRanges(editor: HTMLElement, rule: string): Range[] {
  const out: Range[] = [];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    for (const m of node.data.matchAll(/\[([^\]\n]+)\]/g)) {
      const isField = !!detailField(m[1]);
      if (rule === "pry-1-unfilled" ? !isField : isField) continue;
      const r = document.createRange();
      r.setStart(node, m.index ?? 0);
      r.setEnd(node, (m.index ?? 0) + m[0].length);
      out.push(r);
    }
  }
  return out;
}

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Where a check is on the page now, or `null`. */
export function findTarget(f: Pick<Flag, "rule" | "message">, root: ParentNode = document): Target | null {
  if (f.rule === "pry-1-unfilled" || f.rule === "pry-1-blanks") {
    for (const editor of root.querySelectorAll<HTMLElement>("main [contenteditable=true]")) {
      const ranges = bracketRanges(editor, f.rule);
      if (ranges.length) return { kind: "text", editor, ranges };
    }
    return null;
  }
  const message = norm(f.message);
  for (const frame of root.querySelectorAll<HTMLElement>("main [data-flagged]")) {
    const error = frame.querySelector('[data-slot="field-error"]');
    if (error && norm(error.textContent) === message)
      return { kind: "field", frame, control: frame.querySelector<HTMLElement>(CONTROL) };
  }
  // A check the section says in its own words, inside the form (a note in the cheque's
  // card): the note itself, in its card. Nothing is focused; there is no one field.
  for (const el of root.querySelectorAll<HTMLElement>("main [data-slot=card] div, main [data-slot=card] p")) {
    if (el.closest("[data-fix-list]") || el.children.length > 3 || norm(el.textContent) !== message) continue;
    const frame = (el.closest(".ring-1") as HTMLElement | null) ?? el;
    return { kind: "field", frame, control: null };
  }
  return null;
}

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One soft ring around what was found; a held ring, without motion, when motion is off. */
function light(el: HTMLElement) {
  const ring = getComputedStyle(document.documentElement).getPropertyValue("--focus-ring").trim() || "rgb(59 130 246 / 0.5)";
  const radius = getComputedStyle(el).borderRadius;
  if (!radius || radius === "0px") el.style.borderRadius = "0.75rem";
  const shown = [{ boxShadow: `0 0 0 4px ${ring}` }];
  el.animate(
    calm()
      ? [...shown, ...shown, { boxShadow: "0 0 0 0 transparent" }]
      : [{ boxShadow: "0 0 0 0 transparent" }, ...shown, ...shown, { boxShadow: "0 0 0 0 transparent" }],
    { duration: calm() ? 1600 : 1400, easing: "ease-out" },
  );
}

function scrollToMiddle(rect: DOMRect) {
  const y = window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
  window.scrollTo({ top: Math.max(0, y), behavior: calm() ? "auto" : "smooth" });
}

/**
 * Go to a check's place. `turn` counts presses on the same check, so a check with several
 * parts in the text moves to the next one each time. Returns whether it found a place.
 */
export function goToFlag(f: Pick<Flag, "rule" | "message">, turn = 0): boolean {
  const t = findTarget(f);
  if (!t) return false;
  if (t.kind === "field") {
    scrollToMiddle(t.frame.getBoundingClientRect());
    t.control?.focus({ preventScroll: true });
    light(t.frame);
    return true;
  }
  const range = t.ranges[turn % t.ranges.length];
  t.editor.focus({ preventScroll: true });
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  scrollToMiddle(range.getBoundingClientRect());
  // The editor's frame is its bordered box, a step or two up.
  light((t.editor.closest('[class*="rounded-xl"]') as HTMLElement | null) ?? t.editor);
  return true;
}
