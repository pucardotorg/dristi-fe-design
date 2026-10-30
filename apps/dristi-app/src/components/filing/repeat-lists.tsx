"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import {
  blankAddressBlock,
  blankContact,
  blankRepresentative,
} from "@/lib/filing/blank";
import { useCourt } from "@/components/court/court-provider";
import { normalizeMobileNumber } from "@/lib/cases/witnesses";
import { policeStationsFor } from "@/lib/filing/options";
import type { AddressBlock, Contact, Representative } from "@/lib/filing/types";
import { Button } from "@/components/ui/button";
import { AddressFields } from "@/components/filing/address-fields";
import { FormRow, FormSubhead, HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { ComboField, PrefixInput, TextField } from "@/components/filing/inputs";

/** Icon-only remove control at the 40px floor. */
export function RemoveButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className={className}
    >
      <Trash2Icon aria-hidden />
    </Button>
  );
}

/** Mobile + email rows with add / remove — used for accused and witness contacts. */
export function ContactList({
  contacts,
  onChange,
  addLabel = "Add another contact",
  emailLabel = "Email address",
  mobilePlaceholder = "10-digit number",
  emailPlaceholder = "name@domain.com",
  optional = false,
  allowAdd = true,
}: {
  contacts: Contact[];
  onChange: (next: Contact[]) => void;
  addLabel?: string;
  emailLabel?: string;
  mobilePlaceholder?: string;
  emailPlaceholder?: string;
  /** Marks the mobile and email labels optional — the marker sits on the fields,
      not on the section heading (owner, Sept 2). */
  optional?: boolean;
  /** False hides the add-row control; a single contact row is enough. */
  allowAdd?: boolean;
}) {
  const setAt = (i: number, patch: Partial<Contact>) =>
    onChange(contacts.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  return (
    <div className="flex flex-col gap-4">
      {contacts.map((c, i) => (
        <div key={i} className="flex items-end gap-3">
          <FormRow className="flex-1">
            <FormField label="Mobile number" name={`contacts.${i}.mobile`} optional={optional}>
              <PrefixInput
                prefix="+91"
                value={c.mobile}
                // A +91 mobile is ten digits; keep only digits and cap the length
                // so the field can never overflow (owner, Sept 2). The cap is on the
                // digits, not the input: a maxLength cut a pasted "98470 12345" or
                // "+91 98470 12345" short before its spaces and prefix were dropped.
                onChange={(v) => setAt(i, { mobile: normalizeMobileNumber(v) })}
                placeholder={mobilePlaceholder}
                inputMode="numeric"
                autoComplete="tel-national"
              />
            </FormField>
            <FormField label={emailLabel} name={`contacts.${i}.email`} optional={optional}>
              <TextField
                type="email"
                value={c.email}
                onChange={(v) => setAt(i, { email: v })}
                placeholder={emailPlaceholder}
                autoComplete="email"
              />
            </FormField>
          </FormRow>
          {contacts.length > 1 ? (
            <RemoveButton
              label={`Remove contact ${i + 1}`}
              onClick={() => onChange(contacts.filter((_, k) => k !== i))}
            />
          ) : null}
        </div>
      ))}
      {allowAdd ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => onChange([...contacts, blankContact()])}
        >
          <PlusIcon data-icon="inline-start" aria-hidden />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * "Address N" blocks: address fields and the police station the address falls under.
 *
 * The latitude/longitude field that used to sit beside the station is gone. Nobody knows
 * their own coordinates, there is no map picker to read them off, and a process server
 * navigates by the address — it asked for work no one could do (owner, 2026-08-19).
 */
export function AddressBlockList({
  blocks,
  onChange,
  addLabel = "Add another address",
  optional = false,
}: {
  blocks: AddressBlock[];
  onChange: (next: AddressBlock[]) => void;
  addLabel?: string;
  /** No address is needed: the last one can be removed too, and no field is marked
      required (a started address still has to be complete; the host says so). */
  optional?: boolean;
}) {
  const { court } = useCourt();
  const setAt = (i: number, patch: Partial<AddressBlock>) =>
    onChange(blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)));

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-lg bg-surface-sunken p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <FormSubhead>Address {i + 1}</FormSubhead>
            {blocks.length > 1 || optional ? (
              <RemoveButton
                label={`Remove address ${i + 1}`}
                onClick={() => onChange(blocks.filter((_, k) => k !== i))}
              />
            ) : null}
          </div>
          <AddressFields
            value={b.addr}
            onChange={(addr) => setAt(i, { addr })}
            name={`addresses.${i}.addr`}
            required={!optional}
          />
          <HalfWidth>
            {/* Item 7: a station list is far too long to scan, so it is searched. It
                stays open — our copy of the directory is not the last word on which
                stations exist. */}
            <FormField
              label="Police station"
              name={`addresses.${i}.police`}
              required={!optional}
              help="The station this address falls under."
            >
              <ComboField
                value={b.police}
                onChange={(v: string) => setAt(i, { police: v })}
                items={policeStationsFor(court)}
                placeholder="Search stations"
                emptyLabel="No station by that name."
                ariaLabel="Police station"
              />
            </FormField>
          </HalfWidth>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => onChange([...blocks, blankAddressBlock()])}
      >
        <PlusIcon data-icon="inline-start" aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}

/**
 * The people summoned for an accused entity.
 *
 * A company cannot be produced before a magistrate, so S-141 reaches the people who were
 * running it: every one of them is a person the summons has to name and find. Hence a
 * list with its own name, contact and address per row, rather than a single "representative".
 */
export function RepresentativeList({
  reps,
  onChange,
  addLabel = "Add another person",
}: {
  reps: Representative[];
  onChange: (next: Representative[]) => void;
  addLabel?: string;
}) {
  const setAt = (i: number, patch: Partial<Representative>) =>
    onChange(reps.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-4">
      {reps.map((r, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-lg bg-surface-sunken p-4">
          <div className="flex items-center justify-between gap-3">
            <FormSubhead>Person {i + 1}</FormSubhead>
            {reps.length > 1 ? (
              <RemoveButton
                label={`Remove person ${i + 1}`}
                onClick={() => onChange(reps.filter((_, k) => k !== i))}
              />
            ) : null}
          </div>
          <FormRow>
            <FormField label="Full name" name={`reps.${i}.name`} required>
              <TextField
                value={r.name}
                onChange={(v) => setAt(i, { name: v })}
                placeholder="As it should appear on the summons"
                autoComplete="off"
              />
            </FormField>
            <FormField label="Designation" name={`reps.${i}.designation`} required>
              <TextField
                value={r.designation}
                onChange={(v) => setAt(i, { designation: v })}
                placeholder="e.g. Managing Director"
                autoComplete="off"
              />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Mobile number" name={`reps.${i}.mobile`} optional>
              <PrefixInput
                prefix="+91"
                value={r.mobile}
                onChange={(v) => setAt(i, { mobile: v })}
                placeholder="10-digit number"
                inputMode="numeric"
              />
            </FormField>
            <FormField label="Email address" name={`reps.${i}.email`} optional>
              <TextField
                type="email"
                value={r.email}
                onChange={(v) => setAt(i, { email: v })}
                placeholder="name@domain.com"
                autoComplete="off"
              />
            </FormField>
          </FormRow>
          <FormSubhead>Address for service</FormSubhead>
          <AddressFields value={r.addr} onChange={(addr) => setAt(i, { addr })} name={`reps.${i}.addr`} />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => onChange([...reps, blankRepresentative()])}
      >
        <PlusIcon data-icon="inline-start" aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}
