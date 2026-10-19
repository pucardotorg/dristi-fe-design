import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { COURT_PROFILES } from "./profiles";

/* `SCR-13`: each state's registration types, as the scrutiny-registration handover lists them. */
describe("registration types", () => {
  it("gives Kerala and Punjab & Haryana one type, so nothing is asked", () => {
    assert.deepEqual(COURT_PROFILES.kerala.registrationTypes.map((t) => t.name), ["Criminal complaint"]);
    assert.deepEqual(COURT_PROFILES["punjab-haryana"].registrationTypes.map((t) => t.code), ["NACT"]);
  });

  it("gives Gujarat its three, each with its own number series", () => {
    assert.deepEqual(
      COURT_PROFILES.gujarat.registrationTypes.map((t) => t.code),
      ["eCC", "eCR EN", "eCR MA"],
    );
  });
});
