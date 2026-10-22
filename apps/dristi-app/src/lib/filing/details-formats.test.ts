import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_FORMATS, FILER_WRITES, formatForFiler, mappedField } from "./details-formats";

const format = (html: string, mappings: Record<string, string> = {}) => ({
  id: "f",
  name: "F",
  html,
  mappings,
});

describe("additional details formats", () => {
  it("writes a mapped variable into the filer's text as its field", () => {
    const f = format("<p>Drawn by [Drawer] on [Cheque Date].</p>", { Drawer: "Accused Name" });
    assert.equal(formatForFiler(f), "<p>Drawn by [Accused Name] on [Cheque Date].</p>");
  });

  it("matches a variable named after a field, and a mapping set by hand wins", () => {
    assert.equal(mappedField(format(""), "cheque date")?.name, "Cheque Date");
    const f = format("[Cheque Date]", { "Cheque Date": FILER_WRITES });
    assert.equal(mappedField(f, "Cheque Date"), undefined);
    assert.equal(formatForFiler(f), "[Cheque Date]");
  });

  it("leaves an unmapped variable as a blank for the filer", () => {
    assert.equal(formatForFiler(format("[How they met]")), "[How they met]");
  });

  it("starts with the standard §138 format", () => {
    assert.equal(DEFAULT_FORMATS.length, 1);
    assert.equal(formatForFiler(DEFAULT_FORMATS[0]), DEFAULT_FORMATS[0].html);
  });
});
