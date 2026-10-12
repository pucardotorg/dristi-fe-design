"use client";

import * as React from "react";
import { PhoneIcon } from "lucide-react";

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
import { formatPhone } from "@/components/access/access-state";
import { pick, type Locale } from "@/lib/onboarding/content";
import { inviteFieldCopy, roleCopy, type AccessRole } from "@/lib/access/content";

/** Someone to invite. `phone` is spaced ("94950 33417"); `name` only for people you know. */
export type InvitePerson = { phone: string; name?: string; role?: AccessRole };

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
    onWheel: (event: React.WheelEvent<HTMLElement>) => nudge(event.currentTarget, event.deltaY),
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

/** What a chip or option reads as: the name you know them by, otherwise the number. */
export function inviteLabel(person: InvitePerson): string {
  return person.name ?? `+91 ${person.phone}`;
}

/**
 * Add people by typing, as sharing tools do (owner, 2026-10-12): the people you have
 * added before surface as you type their name or number; anyone else is entered by
 * their full number and shown only as that number.
 *
 * Privacy: `known` is limited to the people this office has already added. DRISTI's
 * account directory is never searched here, so typing a stranger's number never
 * reveals whose number it is. They get an access link by SMS and in DRISTI.
 */
export function PeopleInviteField({
  id,
  label,
  known,
  value,
  onValueChange,
  locale,
  disabled = false,
}: {
  id: string;
  /** The field's accessible name; the visible heading sits above it. */
  label: string;
  known: InvitePerson[];
  value: InvitePerson[];
  onValueChange: (next: InvitePerson[]) => void;
  locale: Locale;
  disabled?: boolean;
}) {
  const anchor = useComboboxAnchor();
  const scroll = useScrollOutsideLock();
  const [query, setQuery] = React.useState("");

  const chosen = new Set(value.map((person) => digitsOf(person.phone)));
  const text = query.trim().toLowerCase();
  const digits = digitsOf(query);
  const looksLikeNumber = text.length > 0 && /^[\d\s+]+$/.test(text);

  const matches = known.filter((person) => {
    if (chosen.has(digitsOf(person.phone))) return false;
    if (!text) return true;
    if (looksLikeNumber) return digits.length > 0 && digitsOf(person.phone).includes(digits);
    return person.name?.toLowerCase().includes(text) ?? false;
  });
  /* A full number nobody here knows: offered as itself, never resolved to a name. */
  const typedNumber =
    looksLikeNumber &&
    digits.length === 10 &&
    !chosen.has(digits) &&
    !known.some((person) => digitsOf(person.phone) === digits)
      ? { phone: formatPhone(digits) }
      : null;
  const options: InvitePerson[] = [
    ...(typedNumber ? [typedNumber] : []),
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
        digitsOf(a.phone) === digitsOf(b.phone)
      }
      autoHighlight
      disabled={disabled}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(people: InvitePerson[]) => (
            <>
              {people.map((person) => (
                <ComboboxChip key={person.phone} className="tabular-nums">
                  {inviteLabel(person)}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                aria-label={label}
                autoComplete="off"
                placeholder={people.length ? undefined : pick(inviteFieldCopy.placeholder, locale)}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor} className="pointer-events-auto">
        <ComboboxEmpty>{pick(inviteFieldCopy.keepTyping, locale)}</ComboboxEmpty>
        {!text && options.length ? (
          <p className="px-3 pt-3 pb-1 text-caption font-medium text-muted-foreground">
            {pick(inviteFieldCopy.suggested, locale)}
          </p>
        ) : null}
        <ComboboxList {...scroll}>
          {(person: InvitePerson) => (
            <ComboboxItem key={person.phone} value={person} className="gap-3">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="text-caption font-medium">
                  {person.name ? initials(person.name) : <PhoneIcon className="size-4" aria-hidden />}
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
                      <span className="tabular-nums">{person.phone}</span>
                      {person.role ? ` · ${pick(roleCopy[person.role], locale)}` : null}
                    </>
                  ) : (
                    pick(inviteFieldCopy.newNumber, locale)
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
