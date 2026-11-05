import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COLUMNS } from "./excel-spec";
import { suggestColumn } from "./excel";

const col = (key: string) => COLUMNS.find((c) => c.key === key)!;

describe("suggestColumn", () => {
  const headers = ["Sr No", "Loan A/c No", "Customer Name", "Chq Amount (Rs)", "Chq Dt", "Bounce Reason"];
  const rows = [["1", "TCL-1", "A B", "148500", "12/08/2026", "INSUFFICIENT FUNDS"]];

  it("reads a lender's short forms", () => {
    assert.equal(suggestColumn(col("chequeAmount"), headers, rows, new Set()), 3);
    assert.equal(suggestColumn(col("chequeDate"), headers, rows, new Set()), 4);
  });

  it("skips columns already matched, and values that don't fit", () => {
    assert.equal(suggestColumn(col("chequeAmount"), headers, rows, new Set([3])), null);
    assert.equal(suggestColumn(col("chequeDate"), ["Chq Dt"], [["not a date"]], new Set()), null);
  });
});
