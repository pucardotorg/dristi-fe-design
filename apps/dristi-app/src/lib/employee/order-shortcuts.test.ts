import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SAMPLE_SHORTCUTS,
  matchOrderShortcuts,
  shortcutNameTaken,
} from "./order-shortcuts";

describe("order shortcuts", () => {
  it("opens on the catalogue's order items that carry no variables", () => {
    assert.ok(SAMPLE_SHORTCUTS.length > 0);
    for (const entry of SAMPLE_SHORTCUTS) {
      assert.ok(entry.text, entry.name);
      assert.ok(!entry.text.includes("["), `${entry.name} has a blank`);
    }
    assert.ok(SAMPLE_SHORTCUTS.some((entry) => entry.name === "Case transfer"));
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
