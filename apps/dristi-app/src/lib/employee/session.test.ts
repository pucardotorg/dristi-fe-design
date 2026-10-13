import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CURRENT_STAFF } from "./content";
import {
  clearCourtSession,
  DEFAULT_COURT_SESSION,
  readCourtSession,
  serverCourtSession,
  setCourtSession,
  subscribeToCourtSession,
} from "./session";

describe("the court session", () => {
  it("stands on the fixture with nobody signed in", () => {
    assert.equal(readCourtSession().username, "");
    assert.equal(readCourtSession().name, CURRENT_STAFF.name);
    assert.equal(readCourtSession().role, CURRENT_STAFF.role);
    assert.equal(readCourtSession().court, CURRENT_STAFF.court);
  });

  /* The server snapshot is what hydration compares against, so it must not move when
     somebody signs in — otherwise the first client render disagrees with the HTML. */
  it("keeps the server snapshot fixed while the live one changes", () => {
    setCourtSession({ username: "michaelGeorgeJudge", role: "magistrate" });
    assert.equal(readCourtSession().role, "magistrate");
    assert.equal(serverCourtSession().role, DEFAULT_COURT_SESSION.role);
    assert.equal(serverCourtSession(), DEFAULT_COURT_SESSION);
  });

  /* `useSyncExternalStore` tears if the snapshot is a fresh object every read. */
  it("returns the same object until something actually changes", () => {
    const before = readCourtSession();
    setCourtSession({ role: before.role });
    assert.equal(readCourtSession(), before);
    setCourtSession({ role: "typist" });
    assert.notEqual(readCourtSession(), before);
  });

  it("tells subscribers about a change and not about a no-op", () => {
    let changes = 0;
    const stop = subscribeToCourtSession(() => {
      changes += 1;
    });
    setCourtSession({ district: "Ernakulam" });
    assert.equal(changes, 1);
    setCourtSession({ district: "Ernakulam" });
    assert.equal(changes, 1);
    stop();
    setCourtSession({ district: "Sample District" });
    assert.equal(changes, 1, "a stopped subscriber was still called");
  });

  it("goes back to the fixture when the session is cleared", () => {
    setCourtSession({ username: "bijuScrutinyOfficer", role: "scrutiny-officer" });
    clearCourtSession();
    assert.equal(readCourtSession(), DEFAULT_COURT_SESSION);
  });
});
