/**
 * The bridge between the case world and the access world (owner, Sept 2).
 *
 * The access fixtures were authored against their own little docket, so a
 * case opened from Your Cases showed an impossible thing: the viewer
 * holding office access with nobody on the vakalatnama to have shared it.
 * This derives each case's real access list from the case's own record and
 * parties pack — the viewer's side's advocates on the nama, and the office
 * staff working under them — so "Who has access" always tells the story
 * the case file tells.
 *
 * Derived people are display-shaped `AccessPerson`s. Phones are stable
 * synthetics (the registry knows these people; the fixtures do not), and
 * removal of a derived row is the dialog's local state, since the access
 * store never held them.
 */

import { participantsFile } from "@/lib/cases/parties";
import { formatCaseDate, type CaseRecord } from "@/lib/cases/types";
import { viewerAccess } from "@/lib/cases/viewer";
import type { AccessPerson } from "./content";

const VIEWER_NAME = "Anjali Nair";

/** A stable, obviously-synthetic 10-digit number from a name. */
function stablePhone(name: string): string {
  let hash = 7;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  const tail = String(hash).padStart(5, "0");
  return `98${tail.slice(0, 3)} ${tail.slice(3)}${String((hash * 13) % 1000).padStart(3, "0")}`;
}

export function derivedAccessPeople(record: CaseRecord): AccessPerson[] {
  let file: ReturnType<typeof participantsFile>;
  try {
    file = participantsFile(record);
  } catch {
    // A fixture without a finished register renders its case page fine;
    // the share list just falls back to the access store alone.
    return [];
  }

  const access = viewerAccess(record);
  const side = access.kind === "vakalatnama" ? access.sides[0] : access.side;
  const since = formatCaseDate(record.filedOn);

  const people: AccessPerson[] = [];
  const seen = new Set<string>();

  for (const team of file.legalTeams) {
    if (team.side !== side) continue;

    if (!team.advocate.includes(VIEWER_NAME) && !seen.has(team.advocate)) {
      seen.add(team.advocate);
      people.push({
        id: `derived-${record.id}-${team.id}`,
        name: team.advocate,
        phone: stablePhone(team.advocate),
        addedBy: null,
        grants: [{ caseId: record.id, role: "vakalat", status: "joined", since }],
      });
    }

    const staff = [
      ...team.juniors.map((name) => ({ name, role: "junior" as const })),
      ...team.clerks.map((name) => ({ name, role: "clerk" as const })),
    ];
    // The viewer's own staff are office access they gave, so theirs to remove;
    // a co-advocate's are not (OFC-09).
    const addedBy = team.advocate.includes(VIEWER_NAME) ? "self" : team.advocate;
    for (const person of staff) {
      if (seen.has(person.name)) continue;
      seen.add(person.name);
      people.push({
        id: `derived-${record.id}-${team.id}-${person.role}-${person.name}`,
        name: person.name,
        phone: stablePhone(person.name),
        addedBy,
        grants: [
          {
            caseId: record.id,
            role: person.role,
            status: "joined",
            since,
            addedBy,
          },
        ],
      });
    }
  }

  return people;
}
