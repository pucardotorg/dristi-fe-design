"use client";

import * as React from "react";
import { CheckIcon, DownloadIcon, FileTextIcon, InfoIcon } from "lucide-react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { DocumentSlot } from "@/components/ui/document-slot";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { pick, type Locale } from "@/lib/onboarding/content";
import { fill, joinDialog, type CaseParty, type JoinCase } from "@/lib/join/content";

/**
 * The PoA holder's part of the join dialog (handover §9b):
 * side (JOIN-63) → the parties they hold power of attorney for, multi-select (JOIN-29,
 * auto-picked when the side has one, JOIN-30) → per party, its own authorization
 * document (JOIN-32) and, when the party is not yet on the case, its mobile number
 * (JOIN-34). The number is confirmed by its owner at sign-in, not here (JOIN-64).
 *
 * Controlled: the dialog holds the values and validates on submit.
 */

export type PoaSide = "complainant" | "accused" | "";

export function poaPartiesFor(joinCase: JoinCase, side: PoaSide): CaseParty[] {
  return side === "complainant" ? joinCase.complainants : side === "accused" ? joinCase.accused : [];
}

/** A number on record, shown with only its last three digits. */
function maskedPhone(digits: string | undefined): string {
  const tail = (digits ?? "").replace(/\D/g, "").slice(-3);
  return tail ? `+91 ••••• ••${tail}` : "+91 ••••• •••••";
}

export function isValidMobile(value: string | undefined) {
  return (value ?? "").length === 10;
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PartyDocument({
  name,
  file,
  onFileChange,
  invalid,
  locale,
}: {
  /** The party it authorises for, named in the label. */
  name: string;
  file: File | null;
  onFileChange: (file: File) => void;
  invalid: boolean;
  locale: Locale;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    /* The full title, naming the person, sits above the slot where it can wrap; the
       slot says what to put in it. Inside the slot a long name wrapped and stranded the
       required mark, and repeating "Authorization document" said it twice
       (owner, 2026-10-14). */
    <Field data-invalid={invalid} className="gap-2">
      <FieldLabel>{fill(joinDialog.poaDocLabelFor, locale, { name })}</FieldLabel>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) onFileChange(next);
          event.target.value = "";
        }}
      />
      <DocumentSlot
        status={file ? "filled" : "empty"}
        media="icon"
        label={pick(joinDialog.poaDocSlot, locale)}
        required
        filename={file?.name}
        meta={file ? fileSize(file.size) : undefined}
        thumbnail={<FileTextIcon className="size-5" aria-hidden />}
        onChooseFile={() => inputRef.current?.click()}
        copy={{
          optional: locale === "ml" ? "നിർബന്ധമല്ല" : "Optional",
          noFile: locale === "ml" ? "ഫയൽ തിരഞ്ഞെടുത്തിട്ടില്ല" : "No file chosen yet",
          chooseFile: locale === "ml" ? "ഫയൽ തിരഞ്ഞെടുക്കുക" : "Choose file",
        }}
      />
      <FieldDescription>{pick(joinDialog.poaDocHelp, locale)}</FieldDescription>
      <FieldError>{invalid ? pick(joinDialog.poaDocError, locale) : null}</FieldError>
    </Field>
  );
}

export function PoaJoinFields({
  joinCase,
  locale,
  side,
  onSideChange,
  partyIds,
  onPartyIdsChange,
  files,
  onFileChange,
  phones,
  onPhoneChange,
  touched,
}: {
  joinCase: JoinCase;
  locale: Locale;
  side: PoaSide;
  onSideChange: (side: PoaSide) => void;
  partyIds: string[];
  onPartyIdsChange: (ids: string[]) => void;
  files: Record<string, File | null>;
  onFileChange: (partyId: string, file: File) => void;
  phones: Record<string, string>;
  onPhoneChange: (partyId: string, value: string) => void;
  touched: boolean;
}) {
  const anchor = useComboboxAnchor();
  const [sampleNotice, setSampleNotice] = React.useState(false);
  const parties = poaPartiesFor(joinCase, side);
  const selected = parties.filter((party) => partyIds.includes(party.id));
  // JOIN-31: another PoA holder already acting blocks this person for that party only.
  const blocked = selected.filter((party) => party.poaHolderJoined);
  const actionable = selected.filter((party) => !party.poaHolderJoined);

  return (
    <>
      <Field data-invalid={touched && !side}>
        <FieldLabel className="block w-full text-body font-semibold leading-snug">
          {pick(joinDialog.poaSideLegend, locale)}
        </FieldLabel>
        <RadioGroup
          value={side}
          onValueChange={(value) => onSideChange(value as PoaSide)}
          className="flex flex-col gap-1"
        >
          <div className="flex min-h-10 items-center gap-2">
            <RadioGroupItem value="complainant" id="join-poa-side-complainant" />
            <Label htmlFor="join-poa-side-complainant">
              {pick(joinDialog.poaSideComplainant, locale)}
            </Label>
          </div>
          <div className="flex min-h-10 items-center gap-2">
            <RadioGroupItem value="accused" id="join-poa-side-accused" />
            <Label htmlFor="join-poa-side-accused">
              {pick(joinDialog.poaSideAccused, locale)}
            </Label>
          </div>
        </RadioGroup>
        <FieldError>{touched && !side ? pick(joinDialog.poaSideError, locale) : null}</FieldError>
      </Field>

      {side ? (
        <Field data-invalid={touched && selected.length === 0}>
          <FieldLabel className="block w-full text-body font-semibold leading-snug">
            {pick(joinDialog.whichPoaLabel, locale)}
          </FieldLabel>
          <Combobox
            multiple
            items={parties.map((party) => party.name)}
            value={selected.map((party) => party.name)}
            onValueChange={(names: string[]) =>
              onPartyIdsChange(
                parties.filter((party) => names.includes(party.name)).map((party) => party.id),
              )
            }
          >
            <ComboboxChips ref={anchor}>
              <ComboboxValue>
                {(value: string[]) => (
                  <>
                    {value.map((name) => (
                      <ComboboxChip key={name}>{name}</ComboboxChip>
                    ))}
                    <ComboboxChipsInput
                      placeholder={value.length ? undefined : pick(joinDialog.whichPoaPlaceholder, locale)}
                    />
                  </>
                )}
              </ComboboxValue>
            </ComboboxChips>
            {/* The popup portals to <body>, which the modal dialog freezes with
                pointer-events:none — the list re-enables its own. */}
            <ComboboxContent anchor={anchor} className="pointer-events-auto">
              <ComboboxEmpty>{pick(joinDialog.whichPoaEmpty, locale)}</ComboboxEmpty>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <FieldDescription>{pick(joinDialog.whichPoaHint, locale)}</FieldDescription>
          <FieldError>
            {touched && selected.length === 0 ? pick(joinDialog.whichPoaError, locale) : null}
          </FieldError>
        </Field>
      ) : null}

      {blocked.map((party) => (
        <Banner key={party.id} variant="warning" className="items-start">
          {fill(joinDialog.poaAlreadyTaken, locale, { name: party.name })}
        </Banner>
      ))}

      {actionable.length ? (
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={pick(joinDialog.poaDocTooltipLabel, locale)}
              >
                <InfoIcon aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72">
              <p className="text-body-compact text-pretty text-muted-foreground">
                {pick(joinDialog.poaDocTooltip, locale)}
              </p>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setSampleNotice(true)}
            data-icon="inline-start"
          >
            <DownloadIcon aria-hidden />
            {pick(joinDialog.poaDocSample, locale)}
          </Button>
        </div>
      ) : null}
      {sampleNotice ? (
        <Banner variant="info" className="items-start">{pick(joinDialog.poaDocSamplePrototype, locale)}</Banner>
      ) : null}

      {/* One well per party: its own authorization document (JOIN-32) and, if the
          party is not on the case yet, its own mobile number (JOIN-34). */}
      {actionable.map((party) => {
        const phone = phones[party.id] ?? "";
        const phoneInvalid = touched && !party.hasJoined && !isValidMobile(phone);
        return (
          <section
            key={party.id}
            aria-label={fill(joinDialog.poaPartyHeading, locale, { name: party.name })}
            className="flex flex-col gap-5 rounded-xl bg-surface-sunken p-4"
          >
            <PartyDocument
              name={party.name}
              file={files[party.id] ?? null}
              onFileChange={(file) => onFileChange(party.id, file)}
              invalid={touched && !files[party.id]}
              locale={locale}
            />
            {party.hasJoined ? (
              /* Joined already: the number stays in view, masked, as a fact rather than
                 a greyed-out input — there is nothing to fill (owner, 2026-10-14). */
              <div className="flex flex-col gap-1.5">
                <p className="text-body-compact font-medium">
                  {fill(joinDialog.poaPhoneLabelFor, locale, { name: party.name })}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-body tabular-nums">{maskedPhone(party.phoneOnRecord)}</span>
                  <Badge variant="success">
                    <CheckIcon data-icon="inline-start" aria-hidden />
                    {pick(joinDialog.poaJoinedChip, locale)}
                  </Badge>
                </div>
                <p className="text-caption text-muted-foreground">
                  {pick(joinDialog.poaPhoneJoinedNote, locale)}
                </p>
              </div>
            ) : (
              <Field data-invalid={phoneInvalid}>
                <FieldLabel htmlFor={`join-poa-phone-${party.id}`}>
                  {fill(joinDialog.poaPhoneLabelFor, locale, { name: party.name })}
                </FieldLabel>
                <Input
                  id={`join-poa-phone-${party.id}`}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-required="true"
                  value={phone}
                  onChange={(event) =>
                    onPhoneChange(party.id, event.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                />
                <FieldDescription>{pick(joinDialog.poaPhoneHelp, locale)}</FieldDescription>
                <FieldError>
                  {phoneInvalid ? pick(joinDialog.poaAccusedPhoneError, locale) : null}
                </FieldError>
              </Field>
            )}
          </section>
        );
      })}
    </>
  );
}
