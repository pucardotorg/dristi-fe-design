"use client";

import * as React from "react";

import {
  ACCESS_PEOPLE,
  PHONE_DIRECTORY,
  type AccessPerson,
  type AccessRole,
} from "@/lib/access/content";

/**
 * Shared, in-memory access state for the prototype.
 *
 * One source of truth so a removal made in the per-case list is instantly
 * visible on the People page and vice versa. Grants are (person × case) pairs
 * carrying the role IN THAT CASE — vakalat nama is per-case, so the same person
 * can hold different roles across cases. A person with no grants left drops out
 * of every list.
 *
 * Sharing only ever grants staff access (clerk / junior advocate): advocates
 * get on a case through its vakalat nama, never through the share flow.
 */

export type InviteResult = {
  /** Cases where at least one invitee actually gained access. */
  added: number;
  /** Cases where every invitee already had access — skipped, not an error. */
  skipped: number;
  total: number;
  /** Display names (or numbers) the invite went out to. */
  names: string[];
};

type AccessContextValue = {
  people: AccessPerson[];
  /** Grant `caseIds` to everyone in `ids` — each a mobile number or a Bar registration
   *  number — as staff; idempotent per (person, case). */
  invite: (ids: string[], caseIds: string[]) => InviteResult;
  removeGrant: (personId: string, caseId: string) => void;
  removeAll: (personId: string) => void;
  personsOnCase: (caseId: string) => AccessPerson[];
};

const AccessContext = React.createContext<AccessContextValue | null>(null);

export function useAccess(): AccessContextValue {
  const value = React.useContext(AccessContext);
  if (!value) throw new Error("useAccess must be used inside <AccessProvider>");
  return value;
}

/** Today's date in the display format the fixtures use ("20 Aug 2026"). */
function displayToday(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/** "94470 88221" for a bare 10-digit string — matches the fixture format. */
export function formatPhone(digits: string): string {
  return digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [people, setPeople] = React.useState<AccessPerson[]>(ACCESS_PEOPLE);

  const invite = React.useCallback(
    (ids: string[], caseIds: string[]): InviteResult => {
      // Pure computation over the current state — no side effects inside the
      // setState updater (StrictMode runs updaters twice and would double them).
      const today = displayToday();
      const names: string[] = [];
      // Which cases gained at least one new grant — drives the honest bulk line.
      const casesTouched = new Set<string>();
      const next = [...people];

      for (const raw of ids) {
        // A Bar registration number is the other unique identifier (owner, 2026-10-13).
        const barId = raw.includes("/") ? raw.toUpperCase() : null;
        const digits = barId ? "" : normalizePhone(raw);
        const pretty = barId ? "" : formatPhone(digits);
        const directory = barId ? undefined : PHONE_DIRECTORY[digits];
        const index = barId
          ? next.findIndex((p) => p.barId?.toUpperCase() === barId)
          : next.findIndex((p) => normalizePhone(p.phone) === digits);

        // Share always grants STAFF access — a past staff designation is
        // reused, an unknown person defaults to clerk. Advocates come through
        // each case's vakalat nama, never through here.
        const priorStaffRole =
          index >= 0
            ? next[index].grants.find((g) => g.role !== "vakalat")?.role
            : undefined;
        const role: AccessRole = directory?.designation ?? priorStaffRole ?? "clerk";

        if (index >= 0) {
          const person = next[index];
          const missing = caseIds.filter(
            (caseId) => !person.grants.some((g) => g.caseId === caseId),
          );
          missing.forEach((caseId) => casesTouched.add(caseId));
          if (missing.length) {
            next[index] = {
              ...person,
              grants: [
                ...person.grants,
                ...missing.map((caseId) => ({
                  caseId,
                  role,
                  // Extending a pending person's access does not mean they
                  // have accepted the invitation or signed in.
                  status: person.pending ? ("invited" as const) : ("joined" as const),
                  since: today,
                  addedBy: "self" as const,
                })),
              ],
            };
          }
          names.push(person.name);
          continue;
        }

        // A number the system doesn't know at all gets an SMS and a pending row;
        // a directory match shows the registered name right away.
        caseIds.forEach((caseId) => casesTouched.add(caseId));
        const shown = barId ?? `+91 ${pretty}`;
        next.push({
          id: barId ? `p-bar-${barId}` : `p-${digits}`,
          name: directory?.name ?? shown,
          phone: pretty,
          ...(barId ? { barId } : {}),
          addedBy: "self",
          grants: caseIds.map((caseId) => ({
            caseId,
            role,
            status: directory ? ("joined" as const) : ("invited" as const),
            since: today,
          })),
          pending: !directory,
        });
        names.push(directory?.name ?? shown);
      }

      setPeople(next);
      return {
        added: casesTouched.size,
        skipped: caseIds.length - casesTouched.size,
        total: caseIds.length,
        names,
      };
    },
    [people],
  );

  const removeGrant = React.useCallback((personId: string, caseId: string) => {
    setPeople((current) =>
      current.map((person) =>
        person.id === personId
          ? { ...person, grants: person.grants.filter((g) => g.caseId !== caseId) }
          : person,
      ),
    );
  }, []);

  const removeAll = React.useCallback((personId: string) => {
    setPeople((current) =>
      current.map((person) => (person.id === personId ? { ...person, grants: [] } : person)),
    );
  }, []);

  const personsOnCase = React.useCallback(
    (caseId: string) => people.filter((person) => person.grants.some((g) => g.caseId === caseId)),
    [people],
  );

  const value = React.useMemo(
    () => ({ people, invite, removeGrant, removeAll, personsOnCase }),
    [people, invite, removeGrant, removeAll, personsOnCase],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}
