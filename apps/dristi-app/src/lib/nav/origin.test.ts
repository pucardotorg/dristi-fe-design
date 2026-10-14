import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { areaOf, originCrumb, safeOrigin, withOrigin } from "./origin";

describe("safeOrigin — the value comes from the address bar", () => {
  it("takes a relative path", () => {
    assert.equal(safeOrigin("/filings?tab=returned"), "/filings?tab=returned");
  });

  it("refuses an absolute URL", () => {
    assert.equal(safeOrigin("https://example.com/filings"), null);
  });

  it("refuses a protocol-relative host, which is how an off-site link gets in", () => {
    assert.equal(safeOrigin("//example.com/filings"), null);
  });

  it("refuses backslashes, which some browsers read as slashes", () => {
    assert.equal(safeOrigin("/\\example.com"), null);
    assert.equal(safeOrigin("/filings\\..\\evil"), null);
  });

  it("refuses a path with no leading slash, and nothing at all", () => {
    assert.equal(safeOrigin("filings"), null);
    assert.equal(safeOrigin(""), null);
    assert.equal(safeOrigin(null), null);
  });

  it("refuses a pathological length", () => {
    assert.equal(safeOrigin(`/filings?q=${"x".repeat(600)}`), null);
  });
});

describe("withOrigin", () => {
  it("records the door on a plain path", () => {
    assert.equal(
      withOrigin("/tasks/t-1/fix", "/filings?tab=returned"),
      "/tasks/t-1/fix?from=%2Ffilings%3Ftab%3Dreturned"
    );
  });

  it("joins a href that already has a query", () => {
    assert.equal(withOrigin("/tasks?task=t-1", "/cases"), "/tasks?task=t-1&from=%2Fcases");
  });

  it("records nothing when the door is unusable", () => {
    assert.equal(withOrigin("/tasks/t-1/fix", "//evil.com"), "/tasks/t-1/fix");
    assert.equal(withOrigin("/tasks/t-1/fix", null), "/tasks/t-1/fix");
  });
});

describe("areaOf", () => {
  it("names the areas the shell hosts, in the rail's own words", () => {
    assert.equal(areaOf("/filings?tab=returned").label, "File a case");
    assert.equal(areaOf("/cases/c-1").label, "Cases");
    assert.equal(areaOf("/tasks").label, "Take action");
  });

  it("knows the vakalatnama area, rather than filing it under tasks", () => {
    assert.equal(areaOf("/vakalatnama/v-1").label, "Vakalatnama");
    assert.equal(areaOf("/vakalatnama/v-1").href, "/vakalatnama");
  });

  it("gives every area root a way back", () => {
    assert.equal(areaOf("/home").href, "/home");
    assert.equal(areaOf("/advocate").href, "/advocate");
  });

  it("falls back to Take action, the shell's own home", () => {
    assert.equal(areaOf("/somewhere-else").label, "Take action");
    assert.equal(areaOf("/tasks/t-1/fix").href, "/tasks");
  });
});

describe("originCrumb", () => {
  it("names the area and points at the exact view left behind", () => {
    assert.deepEqual(originCrumb("/filings?tab=returned&page=2"), {
      label: "File a case",
      href: "/filings?tab=returned&page=2",
    });
  });

  it("is nothing when the recorded value cannot be trusted", () => {
    assert.equal(originCrumb("https://example.com"), null);
  });
});
