"use client";

import * as React from "react";
import { IdCardIcon, PhoneIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { initials } from "@/components/access/access-list";
import { useCourtLocalized } from "@/components/court/court-provider";
import { formatPhone } from "@/components/access/access-state";
import { cn } from "@/lib/utils";
import { pick, type Locale } from "@/lib/onboarding/content";
import {
  inviteFieldCopy,
  REGISTERED_USERS,
  roleCopy,
  type AccessRole,
} from "@/lib/access/content";

/**
 * Someone to invite, by either unique identifier: `phone` is spaced ("94950 33417"),
 * `barId` is the Bar registration number ("K/2048/2015"). `name` only for people you know.
 */
export type InvitePerson = {
  phone?: string;
  barId?: string;
  name?: string;
  role?: AccessRole;
  /** A registered account's type — set on directory entries (`registeredOnly`). */
  type?: "advocate" | "clerk";
  /** Already in the signed-in advocate's office — listed first (OFC-22). */
  inOffice?: boolean;
};

/**
 * Every registered advocate and clerk, the signed-in advocate's office first
 * (OFC-20, OFC-22). `officePhones` are the office's numbers, any format.
 */
export function directoryOptions(officePhones: Iterable<string>): InvitePerson[] {
  const office = new Set([...officePhones].map(digitsOf));
  const all = REGISTERED_USERS.map((user) => ({
    name: user.name,
    phone: user.phone,
    ...(user.barId ? { barId: user.barId } : {}),
    type: user.type,
    inOffice: office.has(digitsOf(user.phone)),
  }));
  return [...all.filter((p) => p.inOffice), ...all.filter((p) => !p.inOffice)];
}

const MAX_SHOWN = 5;

/**
 * The list opens in a portal outside the dialog, and the dialog's scroll lock swallows
 * wheel and touch scrolling there, so the list could not be scrolled (owner,
 * 2026-10-12). These handlers move it by hand, but only when the browser did not:
 * outside a modal the native scroll wins and nothing is doubled.
 */
function useScrollOutsideLock() {
  const lastY = React.useRef(0);
  const nudge = (el: HTMLElement, dy: number) => {
    const before = el.scrollTop;
    window.requestAnimationFrame(() => {
      if (el.scrollTop === before) el.scrollTop = before + dy;
    });
  };
  return {
    onWheel: (event: React.WheelEvent<HTMLElement>) =>
      nudge(event.currentTarget, event.deltaY),
    onTouchStart: (event: React.TouchEvent<HTMLElement>) => {
      lastY.current = event.touches[0]?.clientY ?? 0;
    },
    onTouchMove: (event: React.TouchEvent<HTMLElement>) => {
      const y = event.touches[0]?.clientY ?? lastY.current;
      nudge(event.currentTarget, lastY.current - y);
      lastY.current = y;
    },
  };
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/** A whole Bar registration number: state letters / roll number / year ("K/2048/2015"). */
const BAR_ID = /^[a-z]{1,3}\/\d{1,6}\/\d{4}$/i;

/** One identity per person, whichever identifier they were added by. */
function keyOf(person: InvitePerson): string {
  return person.phone
    ? digitsOf(person.phone)
    : (person.barId ?? "").toUpperCase();
}

/** What a chip or option reads as: the name you know them by, otherwise the identifier typed. */
export function inviteLabel(person: InvitePerson): string {
  return (
    person.name ?? (person.phone ? `+91 ${person.phone}` : (person.barId ?? ""))
  );
}

/**
 * Add people by typing, as sharing tools do (owner, 2026-10-12): the people you have
 * added before surface as you type their name, number or Bar ID; anyone else is entered
 * by a full mobile number or Bar registration number — both unique (owner,
 * 2026-10-13) — and shown only as that.
 *
 * Privacy: `known` is limited to the people this office has already added. DRISTI's
 * account directory is never searched here, so typing a stranger's number or Bar ID
 * never reveals who it belongs to. They get an access link by SMS and in DRISTI.
 */
export function PeopleInviteField({
  id,
  label,
  known: knownAsWritten,
  value,
  onValueChange,
  locale,
  disabled = false,
  registeredOnly = false,
  officeTaken = false,
  copy: copyOverride,
  invalid = false,
  describedBy,
}: {
  id: string;
  /** The field's accessible name; the visible heading sits above it. */
  label: string;
  known: InvitePerson[];
  value: InvitePerson[];
  onValueChange: (next: InvitePerson[]) => void;
  locale: Locale;
  disabled?: boolean;
  /**
   * Office management (owner, 2026-10-21): `known` is DRISTI's directory of
   * registered advocates and clerks, searched by name, number or Bar ID. Only
   * someone in it can be chosen — a typed number is never offered as itself —
   * and with nothing typed the field suggests the office.
   */
  registeredOnly?: boolean;
  /**
   * Add person (Anshumanth + owner, Oct 26): nothing is suggested before
   * typing, since you are adding someone new, and anyone already in the office
   * still shows when searched, greyed and marked, so the search says why they
   * can't be picked.
   */
  officeTaken?: boolean;
  /** Wording for a narrower use — co-advocates on a vakalatnama rather than the team. */
  copy?: Partial<typeof inviteFieldCopy>;
  /** Marks the input invalid, which reddens the chips box (DS `has-aria-invalid`). */
  invalid?: boolean;
  /** The id of the message that explains the error. */
  describedBy?: string;
}) {
  const copy = { ...inviteFieldCopy, ...copyOverride };
  /* Searched as shown: names and Bar IDs in the selected court's terms, so typing what
     is on screen ("G/2048/2015" in Gujarat) finds it. */
  const known = useCourtLocalized(knownAsWritten);
  const anchor = useComboboxAnchor();
  const scroll = useScrollOutsideLock();
  const [query, setQuery] = React.useState("");

  const chosen = new Set(value.map(keyOf));
  const text = query.trim().toLowerCase();
  const digits = digitsOf(query);
  const looksLikeNumber = text.length > 0 && /^[\d\s+]+$/.test(text);
  const looksLikeBarId = text.includes("/");

  /* A mobile number is private (Anshumanth, Oct 26): a stranger in the
     directory is found by number only when the whole number is typed, and
     their number is never shown for a name or Bar ID search. The office's
     own numbers are already on the People page. */
  const numberShown = (person: InvitePerson) =>
    !registeredOnly ||
    Boolean(person.inOffice) ||
    (digits.length === 10 && digitsOf(person.phone ?? "") === digits);
  const matches = known.filter((person) => {
    if (chosen.has(keyOf(person))) return false;
    if (!text)
      return registeredOnly ? !officeTaken && Boolean(person.inOffice) : true;
    if (looksLikeNumber) {
      if (!digits.length) return false;
      return registeredOnly && !person.inOffice
        ? digitsOf(person.phone ?? "") === digits
        : digitsOf(person.phone ?? "").includes(digits);
    }
    if (looksLikeBarId)
      return person.barId?.toLowerCase().includes(text) ?? false;
    return (
      (person.name?.toLowerCase().includes(text) ?? false) ||
      (person.barId?.toLowerCase().includes(text) ?? false)
    );
  });
  /* A full number or Bar ID nobody here knows: offered as itself, never resolved to
     a name. */
  const typedBarId = BAR_ID.test(text) ? text.toUpperCase() : null;
  const typed: InvitePerson | null =
    looksLikeNumber && digits.length === 10
      ? { phone: formatPhone(digits) }
      : typedBarId
        ? { barId: typedBarId }
        : null;
  const typedNew =
    !registeredOnly &&
    typed &&
    !chosen.has(keyOf(typed)) &&
    !known.some(
      (person) =>
        keyOf(person) === keyOf(typed) ||
        (typed.barId && person.barId?.toUpperCase() === typed.barId),
    )
      ? typed
      : null;
  const options: InvitePerson[] = [
    ...(typedNew ? [typedNew] : []),
    ...matches.slice(0, MAX_SHOWN),
  ];

  return (
    <Combobox
      multiple
      items={options}
      filteredItems={options}
      value={value}
      onValueChange={(next: InvitePerson[]) => {
        onValueChange(next);
        setQuery("");
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={inviteLabel}
      isItemEqualToValue={(a: InvitePerson, b: InvitePerson) =>
        keyOf(a) === keyOf(b)
      }
      autoHighlight
      disabled={disabled}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(people: InvitePerson[]) => (
            <>
              {people.map((person) => (
                <ComboboxChip key={keyOf(person)} className="tabular-nums">
                  {inviteLabel(person)}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                aria-label={label}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                autoComplete="off"
                placeholder={
                  people.length ? undefined : pick(copy.placeholder, locale)
                }
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      {/* Nothing typed and nothing to suggest: no list at all, since it could
          only repeat the placeholder (owner, Oct 26). */}
      <ComboboxContent
        anchor={anchor}
        className={cn(
          "pointer-events-auto",
          !text && options.length === 0 && "hidden",
        )}
      >
        <ComboboxEmpty>
          {pick(
            registeredOnly && looksLikeNumber && digits.length < 10
              ? copy.fullNumber
              : copy.keepTyping,
            locale,
          )}
        </ComboboxEmpty>
        {!text && options.length ? (
          <p className="px-3 pt-3 pb-1 text-caption font-medium text-muted-foreground">
            {pick(copy.suggested, locale)}
          </p>
        ) : null}
        <ComboboxList {...scroll}>
          {(person: InvitePerson) => (
            <ComboboxItem
              key={keyOf(person)}
              value={person}
              disabled={officeTaken && person.inOffice}
              className="gap-3"
            >
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="text-caption font-medium">
                  {person.name ? (
                    initials(person.name)
                  ) : person.phone ? (
                    <PhoneIcon className="size-4" aria-hidden />
                  ) : (
                    <IdCardIcon className="size-4" aria-hidden />
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-compact font-medium tabular-nums">
                  {inviteLabel(person)}
                </span>
                <span
                  className={
                    person.name
                      ? "truncate text-caption text-muted-foreground"
                      : "text-caption text-pretty text-muted-foreground"
                  }
                >
                  {person.name ? (
                    <>
                      <span className="tabular-nums">
                        {[person.barId, numberShown(person) && person.phone]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {person.type
                        ? ` · ${pick(person.type === "clerk" ? copy.typeClerk : copy.typeAdvocate, locale)}`
                        : person.role
                          ? ` · ${pick(roleCopy[person.role], locale)}`
                          : null}
                      {person.inOffice && registeredOnly
                        ? ` · ${pick(officeTaken ? copy.alreadyInOffice : copy.inOffice, locale)}`
                        : null}
                    </>
                  ) : (
                    pick(copy.newNumber, locale)
                  )}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
