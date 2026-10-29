"use client";

import * as React from "react";

import { lookupPin } from "@/lib/filing/lookups";
import { STATES } from "@/lib/filing/options";
import type { Address } from "@/lib/filing/types";
import { FormRow } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { OptionSelect, TextField } from "@/components/filing/inputs";
import { LookupStatus } from "@/components/filing/lookup-status";

/** Wait after the sixth digit before asking the PIN service, so typing isn't chased. */
const PIN_DEBOUNCE_MS = 400;

/** What the PIN lookup filled on this address — cleared as soon as the person types over it. */
type PinFill = { pin: string; district: boolean; state: boolean };

/**
 * Address line · pincode · city · district · state. When `prefilled`, the address was
 * read from a document: fields carry the amber fill and open the source on click.
 *
 * The pincode is the fast path: once six digits are in, the postal service is asked for
 * the district and state and fills whichever of the two is still blank. Anything the
 * person typed is never overwritten, and a failed lookup says nothing — they just type.
 */
export function AddressFields({
  value,
  onChange,
  prefilled = false,
  onViewSource,
  prefilledFields,
  idPrefix,
  name,
  required = true,
  stateFirst = false,
}: {
  value: Address;
  onChange: (next: Address) => void;
  prefilled?: boolean;
  onViewSource?: (field: keyof Address) => void;
  prefilledFields?: Partial<Record<keyof Address, boolean>>;
  idPrefix?: string;
  /**
   * Where this address sits on its record ("res", "addresses.1.addr"), so a check on
   * one of its fields can point at it (`FormField name`). Changes nothing otherwise.
   */
  name?: string;
  /** False where the whole address is optional: no field is marked required. */
  required?: boolean;
  /**
   * Pincode · state, then city · district: the PIN's answers beside it, in the order a
   * court's witness form asks them (owner, 2026-10-28).
   */
  stateFirst?: boolean;
}) {
  const key = (k: keyof Address) => (name ? `${name}.${k}` : undefined);
  const set = (k: keyof Address) => (v: string) => onChange({ ...value, [k]: v });
  const pf = (key: keyof Address) => prefilled && !!value[key] && (prefilledFields?.[key] ?? !prefilledFields);
  const src = (key: keyof Address) => pf(key) && onViewSource ? () => onViewSource(key) : undefined;

  const [pinFill, setPinFill] = React.useState<PinFill | null>(null);

  // The lookup resolves after the fact, so it reads the newest address and the newest
  // fill state through a ref — depending on them would restart the debounce on every key.
  const latest = React.useRef({ value, onChange, pinFill });
  React.useEffect(() => {
    latest.current = { value, onChange, pinFill };
  });

  const pin6 = value.pin.replace(/\D/g, "");

  React.useEffect(() => {
    if (pin6.length !== 6) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      lookupPin(pin6)
        .then((hit) => {
          if (cancelled || !hit) return;
          const { value: addr, onChange: commit, pinFill: filled } = latest.current;
          // Only the state spellings the select actually offers can be filled into it.
          const stateHit = STATES.find(
            (s) => s.toLowerCase() === hit.state.trim().toLowerCase()
          );
          const fillDistrict = !addr.district.trim() || !!filled?.district;
          const fillState = (!addr.state.trim() || !!filled?.state) && !!stateHit;
          if (!fillDistrict && !fillState) return;
          commit({
            ...addr,
            district: fillDistrict ? hit.district : addr.district,
            state: fillState && stateHit ? stateHit : addr.state,
          });
          setPinFill({ pin: hit.pin, district: fillDistrict, state: fillState });
        })
        // Best-effort: an unknown PIN or an unreachable service says nothing.
        .catch(() => {});
    }, PIN_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pin6]);

  /** Typing over a machine-filled district or state hands that field back to the person. */
  const setDistrict = (v: string) => {
    setPinFill((f) => (f ? { ...f, district: false } : null));
    onChange({ ...value, district: v });
  };
  const setState = (v: string) => {
    setPinFill((f) => (f ? { ...f, state: false } : null));
    onChange({ ...value, state: v });
  };

  // The caption belongs to the PIN still in the field; changing the PIN retires it.
  const shownFill = pinFill?.pin === pin6 ? pinFill : null;
  const filledLabel =
    shownFill?.district && shownFill.state
      ? "District and state"
      : shownFill?.district
        ? "District"
        : shownFill?.state
          ? "State"
          : null;

  const pinField = (
    <FormField label="Pincode" name={key("pin")} required={required}>
      <TextField
        value={value.pin}
        onChange={set("pin")}
        placeholder="6-digit"
        inputMode="numeric"
        maxLength={6}
        prefilled={pf("pin")}
        onViewSource={src("pin")}
        autoComplete="postal-code"
      />
    </FormField>
  );
  const cityField = (
    <FormField label="City / town" name={key("city")} required={required}>
      <TextField
        value={value.city}
        onChange={set("city")}
        placeholder="City or town"
        prefilled={pf("city")}
        onViewSource={src("city")}
        autoComplete="address-level2"
      />
    </FormField>
  );
  const districtField = (
    <FormField label="District" name={key("district")} required={required}>
      <TextField
        value={value.district}
        onChange={setDistrict}
        placeholder="District"
        prefilled={pf("district")}
        onViewSource={src("district")}
      />
    </FormField>
  );
  const stateField = (
    <FormField label="State / UT" name={key("state")} required={required}>
      <OptionSelect
        value={value.state}
        onValueChange={setState}
        options={STATES}
        placeholder="Select state"
        prefilled={pf("state")}
        onViewSource={src("state")}
        /* The field's label does not reach a select's button; name it here. */
        ariaLabel="State / UT"
      />
    </FormField>
  );
  /* Mounted whether or not it has anything to say, so the fill is announced. */
  const lookupStatus = (
    <LookupStatus>
      {filledLabel && shownFill ? `${filledLabel} filled from PIN ${shownFill.pin}` : null}
    </LookupStatus>
  );

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Address line" name={key("line1")} required={required}>
        <TextField
          id={idPrefix ? `${idPrefix}-line1` : undefined}
          value={value.line1}
          onChange={set("line1")}
          placeholder="House / building, street, area"
          prefilled={pf("line1")}
                onViewSource={src("line1")}
          autoComplete="address-line1"
        />
      </FormField>
      {stateFirst ? (
        <>
          <div className="flex flex-col gap-2">
            <FormRow>
              {pinField}
              {stateField}
            </FormRow>
            {lookupStatus}
          </div>
          <FormRow>
            {cityField}
            {districtField}
          </FormRow>
        </>
      ) : (
        <>
          {/* PIN first: it is the field that fills the two below it, so it comes before
              the ones it answers rather than after them. */}
          <FormRow>
            {pinField}
            {cityField}
          </FormRow>
          <div className="flex flex-col gap-2">
            <FormRow>
              {districtField}
              {stateField}
            </FormRow>
            {lookupStatus}
          </div>
        </>
      )}
    </div>
  );
}
