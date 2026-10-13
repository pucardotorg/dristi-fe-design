import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { passwordOk, passwordProblem } from "./password-policy";

const person = {
  mobile: "9645207107",
  name: "Abhiram Rajilan",
  email: "Abhiram@example.com",
};

describe("password policy", () => {
  it("REG-40: fewer than 8 characters fails, 8 passes", () => {
    assert.equal(passwordProblem("courtro", person), "length");
    assert.equal(passwordProblem("", person), "length");
    assert.equal(passwordProblem("courtroom12", person), null);
  });

  it("REG-40 only: no complexity requirement beyond length", () => {
    assert.ok(passwordOk("courtroom12"));
    assert.ok(passwordOk("        "));
    assert.ok(passwordOk("93748261"));
  });

  it("REG-41: the exact mobile number fails, in its three spellings", () => {
    assert.equal(passwordProblem("9645207107", person), "mobile");
    assert.equal(passwordProblem("919645207107", person), "mobile");
    assert.equal(passwordProblem("+919645207107", person), "mobile");
    assert.equal(passwordProblem("96452071071", person), null);
  });

  it("REG-42: the exact name fails, ignoring case and spacing", () => {
    assert.equal(passwordProblem("Abhiram Rajilan", person), "name");
    assert.equal(passwordProblem("abhiram  rajilan ", person), "name");
    assert.equal(passwordProblem("Abhiram Rajilan1", person), null);
  });

  it("REG-43: the exact email fails, ignoring case", () => {
    assert.equal(passwordProblem("abhiram@example.com", person), "email");
    assert.equal(passwordProblem("abhiram@example.co", person), null);
  });

  it("REG-44: common passwords fail, ignoring case", () => {
    assert.equal(passwordProblem("password", person), "common");
    assert.equal(passwordProblem("PASSWORD123", person), "common");
    assert.equal(passwordProblem("12345678", person), "common");
    assert.equal(passwordProblem("correct horse battery", person), null);
  });

  it("reports the first failing rule in policy order", () => {
    // Too short beats everything else.
    assert.equal(passwordProblem("pass", person), "length");
    // A name that is also on no blacklist reports as the name.
    assert.equal(passwordProblem("Abhiram Rajilan", { ...person, name: "Abhiram Rajilan" }), "name");
  });

  it("identity rules are skipped when the context is empty", () => {
    assert.equal(passwordProblem("9645207107", {}), null);
    assert.equal(passwordProblem("Abhiram Rajilan", { mobile: "" }), null);
  });
});
