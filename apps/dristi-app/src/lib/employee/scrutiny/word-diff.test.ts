import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { wordDiff } from "./word-diff";

const changed = (was: string, now: string) =>
  wordDiff(was, now)
    .filter((part) => part.kind !== "same")
    .map((part) => `${part.kind === "added" ? "+" : "-"}${part.text.trim()}`);

describe("wordDiff", () => {
  it("changes an amount as one token, not digit by digit", () => {
    assert.deepEqual(changed("₹6,05,000", "₹6,50,000"), ["-₹6,05,000", "+₹6,50,000"]);
  });

  it("marks only the words that moved in a long value", () => {
    assert.deepEqual(
      changed(
        "House No. 14, Gandhi Nagar, Kochi 682020",
        "House No. 41, Gandhi Nagar, Kochi 682024",
      ),
      ["-14,", "+41,", "-682020", "+682024"],
    );
  });

  it("rebuilds both values exactly, paragraph breaks included", () => {
    const was = "It is prayed:\n\nDirect the Accused to pay ₹1,30,000.";
    const now = "It is prayed:\n\nDirect the Accused to pay 20% of the cheque amount.";
    const parts = wordDiff(was, now);
    const side = (kind: "added" | "removed") =>
      parts.filter((part) => part.kind !== kind).map((part) => part.text).join("");
    assert.equal(side("added"), was);
    assert.equal(side("removed"), now);
  });

  it("reads an empty old value as all added", () => {
    assert.deepEqual(wordDiff("", "a@b.in"), [{ kind: "added", text: "a@b.in" }]);
  });
});
