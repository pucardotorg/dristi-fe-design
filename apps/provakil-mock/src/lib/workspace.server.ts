/** The matters as the workspace stands now: seed data plus the legal manager's assignments. */

import { ADVOCATES, allMatters, type Matter } from "./matters";
import { readAssignments } from "./pushes.server";

export async function currentMatters(): Promise<Matter[]> {
  const assigned = await readAssignments();
  return allMatters().map((m) => {
    const bar = assigned[m.id];
    const adv = bar ? ADVOCATES.find((a) => a.enrolment === bar) : undefined;
    return adv ? { ...m, advocate: adv } : m;
  });
}
