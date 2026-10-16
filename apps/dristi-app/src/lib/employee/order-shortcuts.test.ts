import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SAMPLE_SHORTCUTS,
  isFormatted,
  matchOrderShortcuts,
  shortcutHtml,
  shortcutInsertion,
  shortcutNameTaken,
} from "./order-shortcuts";

describe("order shortcuts", () => {
  it("opens on the catalogue's order items that carry no variables", () => {
    assert.ok(SAMPLE_SHORTCUTS.length > 0);
    for (const entry of SAMPLE_SHORTCUTS) {
      assert.ok(entry.text, entry.name);
      if (!entry.html) {
        assert.ok(!entry.text.includes("["), `${entry.name} has a blank`);
      }
    }
    assert.ok(SAMPLE_SHORTCUTS.some((entry) => entry.name === "Case transfer"));
  });

  it("also opens on longer formatted orders, each with its words plain beside them", () => {
    const formatted = SAMPLE_SHORTCUTS.filter((entry) => entry.html);
    assert.ok(formatted.length >= 5);
    assert.ok(formatted.some((entry) => /<(ul|ol)>/.test(entry.html ?? "")));
    for (const entry of formatted) {
      assert.ok(!/[<>]/.test(entry.text), `${entry.name} text carries markup`);
      assert.equal(shortcutInsertion(entry).kind, "block", entry.name);
    }
    const ids = SAMPLE_SHORTCUTS.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("types one plain line inline and anything formatted as its own blocks", () => {
    assert.ok(!isFormatted("Case transferred"));
    assert.ok(!isFormatted("<div>Case transferred</div>"));
    assert.ok(!isFormatted("Case transferred<br>"));
    assert.ok(isFormatted("<b>Allowed.</b>"));
    assert.ok(isFormatted("<div>One</div><div>Two</div>"));
    assert.deepEqual(
      shortcutInsertion({ id: "a", name: "A", text: "Plain", html: "Plain" }),
      { kind: "inline", text: "Plain" },
    );
    assert.deepEqual(shortcutInsertion({ id: "a", name: "A", text: "Old" }), {
      kind: "inline",
      text: "Old",
    });
  });

  it("opens a shortcut saved before formatting as its text, escaped", () => {
    assert.equal(
      shortcutHtml({ id: "a", name: "A", text: "a < b\nc" }),
      "a &lt; b<br>c",
    );
  });

  it("ranks a name that starts with the query above one that only contains it", () => {
    const list = [
      { id: "a", name: "Moving case out", text: "x" },
      { id: "b", name: "Case transfer", text: "y" },
      { id: "c", name: "Dismiss", text: "z" },
    ];
    assert.deepEqual(
      matchOrderShortcuts(list, "case").map((entry) => entry.id),
      ["b", "a"],
    );
    assert.deepEqual(matchOrderShortcuts(list, "DIS").map((entry) => entry.id), ["c"]);
    assert.deepEqual(matchOrderShortcuts(list, "zzz"), []);
  });

  it("refuses a second shortcut of the same name, whatever its case", () => {
    const list = [{ id: "a", name: "Case transfer", text: "x" }];
    assert.ok(shortcutNameTaken(list, " case TRANSFER "));
    assert.ok(!shortcutNameTaken(list, "Case transfer", "a"));
  });
});
