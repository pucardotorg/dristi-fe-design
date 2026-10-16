import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasTable, tableHtml } from "./table";

/**
 * The markup a new table starts as. It is rendered later through
 * `dangerouslySetInnerHTML`, so what matters is that it is only ever bare structure.
 */
describe("tableHtml", () => {
  it("defaults to three columns, a header row and two body rows", () => {
    const html = tableHtml();
    assert.equal((html.match(/<th>/g) ?? []).length, 3);
    assert.equal((html.match(/<td>/g) ?? []).length, 6);
    assert.equal((html.match(/<tr>/g) ?? []).length, 3);
  });

  it("is bare structure — no attributes, styles or handlers on any tag", () => {
    for (const tag of tableHtml(4, 5).match(/<[a-z][^>]*>/g) ?? []) {
      assert.match(tag, /^<(table|thead|tbody|tr|th|td|p|br)>$/);
    }
  });

  it("leaves a line after the table to carry on writing in", () => {
    assert.ok(tableHtml().endsWith("</table><p><br></p>"));
  });

  it("writes only a header row when asked for one row", () => {
    const html = tableHtml(2, 1);
    assert.ok(!html.includes("<tbody>"));
    assert.equal((html.match(/<th>/g) ?? []).length, 2);
  });

  it("never writes a table with no columns", () => {
    assert.equal((tableHtml(0, 2).match(/<th>/g) ?? []).length, 1);
  });
});

describe("hasTable", () => {
  it("finds a table in markup", () => {
    assert.ok(hasTable("<p>Schedule</p><table><tr><td>1</td></tr></table>"));
    assert.ok(hasTable("<TABLE class=x>"));
  });

  it("does not mistake prose or other tags for one", () => {
    assert.ok(!hasTable("<p>the table of dates</p>"));
    assert.ok(!hasTable("<tablet>"));
  });
});
