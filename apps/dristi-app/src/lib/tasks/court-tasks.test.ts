import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTasks } from "./sandbox";
import { isProcessFee, tasksForCourt } from "./court-tasks";

describe("tasksForCourt", () => {
  const tasks = buildTasks();

  it("leaves every process fee out in Gujarat, and nothing else", () => {
    const gujarat = tasksForCourt(tasks, "gujarat");
    assert.ok(tasks.some(isProcessFee));
    assert.equal(gujarat.filter(isProcessFee).length, 0);
    assert.equal(gujarat.length, tasks.length - tasks.filter(isProcessFee).length);
  });

  it("keeps them elsewhere", () => {
    assert.equal(tasksForCourt(tasks, "kerala").length, tasks.length);
  });
});
