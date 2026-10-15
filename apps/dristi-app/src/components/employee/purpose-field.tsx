"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  COURT_HEARING_PURPOSES,
  type CourtHearingPurposeId,
} from "@/lib/employee/hearings";

type Purpose = (typeof COURT_HEARING_PURPOSES)[number];

/**
 * The next hearing's purpose, picked from the court's list by typing part of it.
 *
 * A strict picker, unlike the filing `ComboField`: only a listed purpose can be chosen,
 * and what was typed without picking is dropped when the field closes. Every screen that
 * sets a listing purpose uses this one, so the list reads and filters the same in each.
 */
export function PurposeField({
  value,
  onChange,
  disabled,
  placeholder = "Choose a purpose",
  id,
  ariaLabel,
  labelledBy,
}: {
  value: CourtHearingPurposeId | "" | null | undefined;
  onChange: (value: CourtHearingPurposeId) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  labelledBy?: string;
}) {
  const selected = COURT_HEARING_PURPOSES.find((entry) => entry.id === value) ?? null;
  return (
    <Combobox
      items={COURT_HEARING_PURPOSES}
      value={selected}
      itemToStringLabel={(item: Purpose) => item.label}
      isItemEqualToValue={(item: Purpose, other: Purpose) => item.id === other.id}
      onValueChange={(item: Purpose | null) => {
        if (item) onChange(item.id);
      }}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        aria-label={labelledBy ? undefined : ariaLabel}
        aria-labelledby={labelledBy}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full"
        autoComplete="off"
      />
      {/* pointer-events-auto: a Radix modal dialog sets pointer-events:none on the body,
          which would swallow this portalled popup inside the hearing dialog. */}
      <ComboboxContent className="pointer-events-auto">
        <ComboboxEmpty>No purpose matches.</ComboboxEmpty>
        <ComboboxList>
          {(item: Purpose) => (
            <ComboboxItem key={item.id} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
