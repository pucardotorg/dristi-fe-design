"use client";

import * as React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { pick, type Locale } from "@/lib/onboarding/content";
import {
  SELF,
  fillCopy,
  listCopy,
  peopleCopy,
  roleCopy,
  shareCopy,
  type AccessGrant,
  type AccessPerson,
} from "@/lib/access/content";

/**
 * The per-case access list — shared by the share dialog's "who has access"
 * and the case file's manage view.
 *
 * Roles are read off the GRANT, not the person (the vakalatnama is per-case).
 * Kept deliberately quiet: no role badges — on-nama advocates are marked by a
 * plain "Vakalatnama" on the right with a disabled Remove (removal is a court
 * application, said on hover), everyone else is office staff with a live red
 * Remove. The only badge is "Yet to join", for anyone who hasn't signed in.
 */

export function initials(name: string): string {
  const parts = name.replace(/^Adv\.\s*/, "").trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase() || "?";
}

/** Disabled Remove that still explains itself on hover. */
export function LockedRemove({ locale }: { locale: Locale }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Disabled buttons swallow pointer events — the span carries the hover. */}
        <span tabIndex={0} className="inline-flex">
          <Button type="button" variant="ghost" size="sm" disabled>
            {pick(listCopy.remove, locale)}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-56 text-pretty">
        {pick(listCopy.vakalatLocked, locale)}
      </TooltipContent>
    </Tooltip>
  );
}

export function PersonRow({
  person,
  grant,
  locale,
  onRemove,
  onRemoveVakalat,
}: {
  person: AccessPerson;
  /** The person's grant on the case this list is scoped to. */
  grant: AccessGrant;
  locale: Locale;
  /** Omit to render the row without a remove affordance (read-only contexts). */
  onRemove?: () => void;
  /**
   * Makes Remove live on on-nama rows, opening the formal removal flow
   * (3a/3b) instead of the locked-button explanation. Contexts without the
   * flow wired keep the locked button.
   */
  onRemoveVakalat?: () => void;
}) {
  const isVakalat = grant.role === "vakalat";
  const grantInviter = grant.addedBy ?? person.addedBy;
  const addedByLine =
    grantInviter === "self"
      ? pick(listCopy.addedByYou, locale)
      : grantInviter
        ? fillCopy(listCopy.addedBy, locale, { name: grantInviter })
        : null;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className="text-caption font-medium">
          {initials(person.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate text-body-compact font-medium">{person.name}</p>
          {person.pending || grant.status === "invited" ? (
            <Badge variant="warning">{pick(shareCopy.statusInvited, locale)}</Badge>
          ) : null}
        </div>
        <p className="truncate text-caption text-muted-foreground">
          <span className="tabular-nums">{person.phone}</span>
          {!isVakalat && addedByLine ? <> · {addedByLine}</> : null}
        </p>
      </div>

      {isVakalat ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-caption text-muted-foreground">
            {pick(roleCopy.vakalat, locale)}
          </span>
          {onRemoveVakalat ? (
            <Button
              type="button"
              variant="destructive-ghost"
              size="sm"
              onClick={onRemoveVakalat}
            >
              {pick(listCopy.remove, locale)}
            </Button>
          ) : (
            <LockedRemove locale={locale} />
          )}
        </div>
      ) : person.allCases && grant.addedBy === "self" ? (
        // On All cases: narrowed from the People tab, not case by case (OFC-52).
        <span className="shrink-0 text-caption text-muted-foreground">
          {pick(peopleCopy.allCasesShareNote, locale)}
        </span>
      ) : onRemove ? (
        <Button type="button" variant="destructive-ghost" size="sm" onClick={onRemove}>
          {pick(listCopy.remove, locale)}
        </Button>
      ) : null}
    </div>
  );
}

/** The signed-in advocate, pinned atop per-case lists — never removable. */
export function SelfRow({
  locale,
  accessLabel,
}: {
  locale: Locale;
  /**
   * How the viewer holds THIS case — "Through Vakalatnama" by default, or
   * the office-access label where the case only reached them by a share.
   * The fixed vakalat label used to claim a nama on every case (owner,
   * Sept 2).
   */
  accessLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className="text-caption font-medium">{initials(SELF.name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-body-compact font-medium">
          {SELF.name} <span className="font-normal text-muted-foreground">{pick(shareCopy.you, locale)}</span>
        </p>
        <p className="truncate text-caption text-muted-foreground tabular-nums">{SELF.phone}</p>
      </div>
      <span className="shrink-0 text-caption text-muted-foreground">
        {accessLabel ?? pick(roleCopy.vakalat, locale)}
      </span>
    </div>
  );
}

/**
 * Per-case access list: you first, then the nama's advocates, then staff —
 * each row read through that person's grant on THIS case.
 */
export function CaseAccessList({
  caseId,
  people,
  locale,
  query = "",
  onRemove,
  onRemoveVakalat,
  selfAccessLabel,
}: {
  caseId: string;
  people: AccessPerson[];
  locale: Locale;
  query?: string;
  onRemove?: (personId: string) => void;
  /** See PersonRow — makes Remove live on on-nama rows. */
  onRemoveVakalat?: (person: AccessPerson) => void;
  /** See SelfRow. */
  selfAccessLabel?: string;
}) {
  const q = query.trim().toLowerCase();
  const phoneQ = q.replace(/\D/g, "");
  const showSelf =
    !q ||
    SELF.name.toLowerCase().includes(q) ||
    (phoneQ.length > 0 && SELF.phone.replace(/\D/g, "").includes(phoneQ));
  const withGrants = people
    .map((person) => ({
      person,
      grant: person.grants.find((g) => g.caseId === caseId),
    }))
    .filter((entry): entry is { person: AccessPerson; grant: AccessGrant } => Boolean(entry.grant))
    .filter(
      ({ person }) =>
        !q ||
        person.name.toLowerCase().includes(q) ||
        (phoneQ.length > 0 && person.phone.replace(/\D/g, "").includes(phoneQ)) ||
        person.barId?.toLowerCase().includes(q),
    )
    .sort((a, b) => Number(b.grant.role === "vakalat") - Number(a.grant.role === "vakalat"));

  return (
    <div className="flex flex-col divide-y divide-hairline">
      {showSelf ? <SelfRow locale={locale} accessLabel={selfAccessLabel} /> : null}
      {withGrants.map(({ person, grant }) => (
        <PersonRow
          key={person.id}
          person={person}
          grant={grant}
          locale={locale}
          onRemove={onRemove ? () => onRemove(person.id) : undefined}
          onRemoveVakalat={
            onRemoveVakalat ? () => onRemoveVakalat(person) : undefined
          }
        />
      ))}
    </div>
  );
}
