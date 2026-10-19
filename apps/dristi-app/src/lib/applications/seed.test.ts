import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { courtTasks } from "./lifecycle";
import { sampleApplications } from "./seed";

describe("sampleApplications", () => {
  it("fills both court queues through the real lifecycle steps", () => {
    const apps = Object.values(
      sampleApplications("2026-10-01", { temporary: 100, number: 400, order: 900 }),
    );
    const tasks = courtTasks(apps);
    assert.equal(tasks.filter((task) => task.kind === "review").length, 8);
    assert.equal(tasks.filter((task) => task.kind === "decide").length, 6);
    const objections = apps.filter((app) => app.type === "objection");
    assert.equal(objections.length, 2);
    for (const objection of objections) {
      assert.equal(objection.status, "submitted");
      assert.ok(apps.some((app) => app.objectionId === objection.id));
    }
  });
});
