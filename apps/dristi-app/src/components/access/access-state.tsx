"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  ACCESS_CASES,
  ACCESS_PEOPLE,
  registerAccessCase,
  registeredUserByPhone,
  viewerHoldsVakalat,
  type AccessCase,
  type AccessPerson,
  type AccessRole,
} from "@/lib/access/content";
import { getRepository } from "@/lib/filing/data";
import { ensureSampleDrafts } from "@/lib/filing/sample-drafts";
import { draftTitle } from "@/lib/filing/selectors";

/**
 * Shared, in-memory access state for the prototype.
 *
 * One source of truth so a removal made in the per-case list is instantly
 * visible on the People page and vice versa. Grants are (person × case) pairs
 * carrying the role IN THAT CASE — vakalat nama is per-case, so the same person
 * can hold different roles across cases. A person with no grants left drops out
 * of every list.
 *
 * Sharing only ever grants office access: advocates get on a case's record
 * through its vakalat nama, never through the share flow. Only registered
 * advocates and clerks can be added (OFC-02); access is immediate (OFC-07).
 */

export type InviteResult = {
  /** Cases where at least one invitee actually gained access. */
  added: number;
  /** Cases where every invitee already had access — skipped, not an error. */
  skipped: number;
  total: number;
  /** Display names of the people given access. */
  names: string[];
};

type AccessContextValue = {
  people: AccessPerson[];
  /** Give office access to every registered user in `phones`: `caseIds` as
   *  specific cases, idempotent per (person, case); or, with `allCases: true`,
   *  every shareable case now and in future (OFC-24, OFC-25). */
  invite: (
    phones: string[],
    caseIds: string[],
    options?: { allCases?: boolean },
  ) => InviteResult;
  removeGrant: (personId: string, caseId: string) => void;
  /** Remove from the office: every grant this advocate gave, whichever access they had. */
  removeAll: (personId: string) => void;
  /** Specific → All gives every shareable case; All → Specific keeps the
   *  cases they hold as their specific cases (OFC-31). */
  setAllCases: (personId: string, on: boolean) => void;
  /** The advocate was just added to a case (joined or filed): everyone on All
   *  cases gets it at once (OFC-25). */
  caseAdded: (caseId: string) => void;
  /** The cases and drafts this advocate may share, newest docket (OFC-04). */
  shareableCases: AccessCase[];
  personsOnCase: (caseId: string) => AccessPerson[];
  /** The signed-in advocate's office (OFC-11): people holding office access they
   *  gave. Each carries only those grants. */
  office: AccessPerson[];
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

/** Office access the signed-in advocate gave (OFC-09) — not a vakalatnama,
    and not access a co-advocate gave on a shared case. */
export function isOwnOfficeGrant(grant: AccessPerson["grants"][number]): boolean {
  return (
    grant.role !== "vakalat" && grant.addedBy === "self" && viewerHoldsVakalat(grant.caseId)
  );
}

/** Cases this advocate may share — those where they are on the vakalatnama, and
    their drafts (OFC-04). */
export function shareableCaseIds(): string[] {
  return ACCESS_CASES.filter((c) => viewerHoldsVakalat(c.id)).map((c) => c.id);
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  // A seed person on All cases holds every shareable case, like anyone set so here.
  const [people, setPeople] = React.useState<AccessPerson[]>(() =>
    ACCESS_PEOPLE.map((person) => {
      if (!person.allCases) return person;
      const role = person.grants.find((g) => g.role !== "vakalat")?.role ?? "clerk";
      const since = person.grants[0]?.since ?? displayToday();
      const missing = shareableCaseIds().filter(
        (caseId) => !person.grants.some((g) => g.caseId === caseId),
      );
      return {
        ...person,
        grants: [
          ...person.grants.map((g) => (g.role === "vakalat" ? g : { ...g, addedBy: "self" })),
          ...missing.map((caseId) => ({
            caseId,
            role,
            status: "joined" as const,
            since,
            addedBy: "self" as const,
          })),
        ],
      };
    }),
  );

  const invite = React.useCallback(
    (
      phones: string[],
      caseIds: string[],
      options?: { allCases?: boolean },
    ): InviteResult => {
      // Pure computation over the current state — no side effects inside the
      // setState updater (StrictMode runs updaters twice and would double them).
      const today = displayToday();
      // All cases: every case where the advocate is on the vakalatnama (OFC-25).
      const targetCases = options?.allCases ? shareableCaseIds() : caseIds;
      const names: string[] = [];
      // Which cases gained at least one new grant — drives the honest bulk line.
      const casesTouched = new Set<string>();
      const next = [...people];

      for (const raw of phones) {
        const user = registeredUserByPhone(raw);
        // Registered advocates and clerks only (OFC-02); anything else is ignored.
        if (!user) continue;
        const digits = normalizePhone(user.phone);
        const role: AccessRole = user.type === "clerk" ? "clerk" : "junior";
        const index = next.findIndex((p) => normalizePhone(p.phone) === digits);
        const scope = options?.allCases ? { allCases: true } : {};

        if (index >= 0) {
          const person = next[index];
          const missing = targetCases.filter(
            (caseId) => !person.grants.some((g) => g.caseId === caseId),
          );
          missing.forEach((caseId) => casesTouched.add(caseId));
          next[index] = {
            ...person,
            ...scope,
            grants: [
              ...person.grants,
              ...missing.map((caseId) => ({
                caseId,
                role,
                status: "joined" as const,
                since: today,
                addedBy: "self" as const,
              })),
            ],
          };
          names.push(person.name);
          continue;
        }

        targetCases.forEach((caseId) => casesTouched.add(caseId));
        next.push({
          id: `p-${digits}`,
          name: user.name,
          phone: user.phone,
          ...(user.barId ? { barId: user.barId } : {}),
          addedBy: "self",
          ...scope,
          grants: targetCases.map((caseId) => ({
            caseId,
            role,
            status: "joined" as const,
            since: today,
            addedBy: "self" as const,
          })),
        });
        names.push(user.name);
      }

      setPeople(next);
      return {
        added: casesTouched.size,
        skipped: targetCases.length - casesTouched.size,
        total: targetCases.length,
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
    // Only the office access this advocate gave goes; a vakalatnama the person
    // holds on a shared case is not office access and stays.
    setPeople((current) =>
      current.map((person) =>
        person.id === personId
          ? {
              ...person,
              allCases: false,
              grants: person.grants.filter((g) => !isOwnOfficeGrant(g)),
            }
          : person,
      ),
    );
  }, []);

  const setAllCases = React.useCallback((personId: string, on: boolean) => {
    const today = displayToday();
    setPeople((current) =>
      current.map((person) => {
        if (person.id !== personId) return person;
        if (!on) return { ...person, allCases: false };
        const role = person.grants.find((g) => g.role !== "vakalat")?.role ?? "clerk";
        const missing = shareableCaseIds().filter(
          (caseId) => !person.grants.some((g) => g.caseId === caseId),
        );
        return {
          ...person,
          allCases: true,
          grants: [
            ...person.grants,
            ...missing.map((caseId) => ({
              caseId,
              role,
              status: "joined" as const,
              since: today,
              addedBy: "self" as const,
            })),
          ],
        };
      }),
    );
  }, []);

  // Bumped when the docket grows, so lists built from it read it again.
  const [docketVersion, setDocketVersion] = React.useState(0);

  const casesAdded = React.useCallback((caseIds: string[]) => {
    if (!caseIds.length) return;
    const today = displayToday();
    setDocketVersion((v) => v + 1);
    setPeople((current) =>
      current.map((person) => {
        if (!person.allCases) return person;
        const missing = caseIds.filter((id) => !person.grants.some((g) => g.caseId === id));
        if (!missing.length) return person;
        const role = person.grants.find((g) => g.role !== "vakalat")?.role ?? "clerk";
        return {
          ...person,
          grants: [
            ...person.grants,
            ...missing.map((caseId) => ({
              caseId,
              role,
              status: "joined" as const,
              since: today,
              addedBy: "self" as const,
            })),
          ],
        };
      }),
    );
  }, []);

  const caseAdded = React.useCallback((caseId: string) => casesAdded([caseId]), [casesAdded]);

  /* Drafts live in the filing store. Read on every page change, so a draft
     created since reaches everyone on All cases (OFC-25) and the case picker
     (OFC-25a). The advocate's own drafts are the only ones this browser holds. */
  const pathname = usePathname();
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSampleDrafts();
        const drafts = await getRepository().listDrafts();
        if (cancelled) return;
        const fresh = drafts.filter(
          (d) => d.status === "draft" && !ACCESS_CASES.some((c) => c.id === d.id),
        );
        fresh.forEach((d) =>
          registerAccessCase({
            id: d.id,
            title: draftTitle(d),
            caseNumber: "",
            court: "",
            nextHearing: "—",
            draft: true,
          }),
        );
        casesAdded(fresh.map((d) => d.id));
      } catch {
        // No filing store (private window, blocked storage): cases only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, casesAdded]);

  const shareableCases = React.useMemo(
    () => ACCESS_CASES.filter((c) => viewerHoldsVakalat(c.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ACCESS_CASES grows in place
    [docketVersion],
  );

  const office = React.useMemo(
    () =>
      people
        .map((person) => ({ ...person, grants: person.grants.filter(isOwnOfficeGrant) }))
        .filter((person) => person.grants.length > 0),
    [people],
  );

  const personsOnCase = React.useCallback(
    (caseId: string) => people.filter((person) => person.grants.some((g) => g.caseId === caseId)),
    [people],
  );

  const value = React.useMemo(
    () => ({
      people,
      invite,
      removeGrant,
      removeAll,
      setAllCases,
      caseAdded,
      shareableCases,
      personsOnCase,
      office,
    }),
    [people, invite, removeGrant, removeAll, setAllCases, caseAdded, shareableCases, personsOnCase, office],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}
