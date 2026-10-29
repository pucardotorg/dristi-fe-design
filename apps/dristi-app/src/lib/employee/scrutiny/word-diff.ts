import { diffArrays } from "diff";

export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

/**
 * What changed between the value that went back and the value that came back, word by
 * word — one library call, rendered as-is (owner's prototype, 2026-10-29: the change is
 * marked inside the new value, so a paragraph appears once instead of twice).
 *
 * Words split on whitespace only, so "₹6,50,000" or a PIN code is one token and changes
 * as a whole, never digit by digit. The whitespace runs are tokens too, so paragraph
 * breaks survive into the rendered text.
 */
export function wordDiff(was: string, now: string): DiffPart[] {
  return diffArrays(tokens(was), tokens(now)).map((part) => ({
    kind: part.added ? "added" : part.removed ? "removed" : "same",
    text: part.value.join(""),
  }));
}

function tokens(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}
