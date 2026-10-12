"use client";

import * as React from "react";
import { CalendarDaysIcon } from "lucide-react";

import { formatStructuredAddress } from "@/components/cases/structured-address";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COURT_HEARING_PURPOSES,
  courtHearingPurposeLabel,
  formatListingDate,
  isoDay,
  parseIsoDay,
  type CourtHearingPurposeId,
} from "@/lib/employee/hearings";
import type { ComposerContext, ItemBlock } from "@/lib/employee/order-composer";
import { orderTemplate, type OrderField } from "@/lib/employee/order-templates";
import {
  channelLabel,
  channelsFor,
  needsPoliceStation,
  POLICE_STATIONS,
  unreachableChannels,
  PROCESS_CHANNELS,
  type ProcessChannel,
  type ProcessRecipients,
} from "@/lib/employee/process-variables";
import { cn } from "@/lib/utils";

/**
 * An order item's fields — the top half of its block (Varun's shape: variables on top,
 * text below). One control per catalogue input type (`VAR-05`): a party selector, a
 * date picker, an amount in rupees, a hearing purpose from the hearing purposes, the
 * witnesses on the case, and for a process the recipients and channels (`ITM-11`).
 *
 * Read-only answers — the application an item was reached from — are shown as plain
 * values, never as disabled inputs: there is nothing to change and nothing to tab to.
 */
export function OrderItemFields({
  block,
  context,
  today,
  disabled,
  onValue,
  onRecipients,
}: {
  block: ItemBlock;
  context: ComposerContext;
  today: string;
  disabled: boolean;
  onValue: (key: string, value: string) => void;
  onRecipients: (recipients: ProcessRecipients) => void;
}) {
  const fields = orderTemplate(block.type).fields.filter(
    (field) => !field.derived,
  );
  if (fields.length === 0) return null;
  return (
    <div className="@container grid min-w-0 gap-4">
      {fields.some((field) => field.kind === "recipients") ? (
        <RecipientsField
          id={`${block.id}-recipients`}
          block={block}
          context={context}
          disabled={disabled}
          onChange={onRecipients}
        />
      ) : null}
      <div className="grid min-w-0 gap-4 @lg:grid-cols-2">
        {fields.map((field) =>
          field.kind === "recipients" ? null : (
            <OrderField
              key={field.key}
              id={`${block.id}-${field.key}`}
              field={field}
              value={block.values[field.key] ?? ""}
              context={context}
              today={today}
              disabled={disabled}
              onChange={(value) => onValue(field.key, value)}
            />
          ),
        )}
      </div>
    </div>
  );
}

/** The label every field carries, with "(optional)" on the ones the catalogue does not require. */
function FieldName({
  htmlFor,
  id,
  field,
}: {
  htmlFor?: string;
  id?: string;
  field: OrderField;
}) {
  const content = (
    <>
      {field.label}
      {field.required || field.kind === "fixed" ? null : (
        <span className="font-normal text-muted-foreground"> (optional)</span>
      )}
    </>
  );
  return htmlFor ? (
    <Label htmlFor={htmlFor} id={id} className="text-body-compact">
      {content}
    </Label>
  ) : (
    <span id={id} className="text-body-compact font-medium">
      {content}
    </span>
  );
}

function OrderField({
  id,
  field,
  value,
  context,
  today,
  disabled,
  onChange,
}: {
  id: string;
  field: OrderField;
  value: string;
  context: ComposerContext;
  today: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const labelId = `${id}-label`;

  if (field.kind === "fixed") {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <FieldName id={labelId} field={field} />
        <p
          aria-labelledby={labelId}
          className="flex min-h-10 items-center text-body-compact text-foreground"
        >
          {value || (
            <span className="text-muted-foreground">
              None — chosen from the catalogue, not from an application
            </span>
          )}
        </p>
      </div>
    );
  }

  if (field.kind === "side" || field.kind === "choice") {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <FieldName id={labelId} field={field} />
        <SegmentedControl
          type="single"
          aria-labelledby={labelId}
          value={value}
          disabled={disabled}
          /* Radix hands back "" when the chosen segment is pressed again; that is a real
             answer here — the field goes back to unanswered. */
          onValueChange={onChange}
          className="max-w-full flex-wrap"
        >
          {(field.options ?? []).map((option) => (
            <SegmentedControlItem key={option.value} value={option.value}>
              {option.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
    );
  }

  if (field.kind === "date") {
    return (
      <DateField
        id={id}
        field={field}
        value={value}
        today={today}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (field.kind === "purpose") {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <FieldName id={labelId} field={field} />
        <Select
          value={value || undefined}
          disabled={disabled}
          onValueChange={onChange}
        >
          <SelectTrigger aria-labelledby={labelId} className="w-full">
            {/* The label rendered here rather than left to the primitive, which resolves
                it from the mounted item only after hydration. */}
            <SelectValue placeholder="Choose a purpose">
              {value
                ? courtHearingPurposeLabel(value as CourtHearingPurposeId)
                : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {COURT_HEARING_PURPOSES.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.kind === "master") {
    const options = field.options ?? [];
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <FieldName id={labelId} field={field} />
        <Select
          value={value || undefined}
          disabled={disabled}
          onValueChange={onChange}
        >
          <SelectTrigger aria-labelledby={labelId} className="w-full">
            <SelectValue placeholder="Choose one">
              {options.find((entry) => entry.value === value)?.label ?? null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.kind === "witness") {
    const witnesses = context.people.filter(
      (person) => person.kind === "witness",
    );
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <FieldName id={labelId} field={field} />
        {witnesses.length === 0 ? (
          <p className="flex min-h-10 items-center text-body-compact text-muted-foreground">
            No witness is on this case&rsquo;s record yet.
          </p>
        ) : (
          <Select
            value={value || undefined}
            disabled={disabled}
            onValueChange={onChange}
          >
            <SelectTrigger aria-labelledby={labelId} className="w-full">
              <SelectValue placeholder="Choose a witness">
                {witnesses.find((person) => person.id === value)?.name ?? null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {witnesses.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.name} · {person.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  }

  if (field.kind === "amount") {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <FieldName htmlFor={id} field={field} />
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>₹</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            step={100}
            className="tabular-nums"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        </InputGroup>
      </div>
    );
  }

  /* `text` — free text (Document details is the catalogue's one free-text variable). */
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <FieldName htmlFor={id} field={field} />
      <Input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function DateField({
  id,
  field,
  value,
  today,
  disabled,
  onChange,
}: {
  id: string;
  field: OrderField;
  value: string;
  today: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <OrderDatePicker
      id={id}
      label={<FieldName id={`${id}-label`} field={field} />}
      value={value}
      today={today}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

/**
 * A date, picked from a calendar that will not offer a day already gone. Shared by the
 * order items' date fields and the hearing's own Next hearing region, so one order has one
 * way of asking for a date.
 *
 * `label` must carry the id `${id}-label`: the trigger is named by it and by the date it
 * shows, the way a combobox is.
 */
export function OrderDatePicker({
  id,
  label,
  value,
  today,
  disabled,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  value: string;
  today: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const chosen = value ? parseIsoDay(value) : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            disabled={disabled}
            aria-labelledby={`${id}-label ${id}`}
            className={cn(
              "w-full justify-start gap-2 text-left font-normal tabular-nums",
              !chosen && "text-muted-foreground",
            )}
          >
            <CalendarDaysIcon data-icon="inline-start" aria-hidden />
            <span className="truncate">
              {value ? formatListingDate(value) : "Pick a date"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={16}
          className="w-auto max-w-(--radix-popover-content-available-width) gap-0 p-0"
        >
          <Calendar
            mode="single"
            autoFocus
            selected={chosen}
            defaultMonth={chosen ?? parseIsoDay(today)}
            disabled={{ before: parseIsoDay(today) }}
            onSelect={(day) => {
              onChange(day ? isoDay(day) : "");
              if (day) setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Who a process goes to and how, in the order a court decides it (owner, 2026-10-12):
 * **one person**, then **which of their addresses**, then **the channels**. Every
 * selected address with every selected channel becomes its own process (§3 of
 * `process-handover.md`). The person, their addresses, the channels and the station are
 * pre-selected by the process rules (`AUT-04`–`AUT-08`).
 */
function RecipientsField({
  id,
  block,
  context,
  disabled,
  onChange,
}: {
  id: string;
  block: ItemBlock;
  context: ComposerContext;
  disabled: boolean;
  onChange: (recipients: ProcessRecipients) => void;
}) {
  const recipients: ProcessRecipients = block.recipients ?? {
    person: "",
    addresses: [],
    channels: [],
    policeStations: {},
  };
  const person = context.people.find((entry) => entry.id === recipients.person);
  const allowed = PROCESS_CHANNELS.filter((channel) =>
    channelsFor(block.type).includes(channel.id),
  );
  const unreachable = unreachableChannels(person, recipients);

  function toggleAddress(addressId: string, on: boolean) {
    onChange({
      ...recipients,
      addresses: on
        ? [...recipients.addresses, addressId]
        : recipients.addresses.filter((entry) => entry !== addressId),
    });
  }

  function toggleChannel(channel: ProcessChannel, on: boolean) {
    onChange({
      ...recipients,
      channels: on
        ? [...recipients.channels, channel]
        : recipients.channels.filter((entry) => entry !== channel),
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1 @lg:max-w-sm">
        <span id={`${id}-person-label`} className="text-body-compact font-medium">
          Addressed to
        </span>
        <Select
          value={recipients.person || undefined}
          disabled={disabled}
          onValueChange={(value) => onChange({ ...recipients, person: value })}
        >
          <SelectTrigger aria-labelledby={`${id}-person-label`} className="w-full">
            <SelectValue placeholder="Choose a person">
              {person ? `${person.name} · ${person.role}` : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {context.people.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.name} · {entry.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {person ? (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 text-body-compact font-medium">
            Addresses of {person.name}
          </legend>
          <div className="grid min-w-0 gap-2 @lg:grid-cols-2">
            {person.addresses.map((entry, index) => {
              const checked = recipients.addresses.includes(entry.id);
              const inputId = `${id}-address-${entry.id}`;
              return (
                <Label
                  key={entry.id}
                  htmlFor={inputId}
                  className={cn(
                    "flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 font-normal transition-colors hover:bg-accent",
                    checked ? "border-input" : "border-hairline",
                  )}
                >
                  <Checkbox
                    id={inputId}
                    className="mt-0.5"
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(next) => toggleAddress(entry.id, next === true)}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-body-compact font-medium">
                      Address {index + 1}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {formatStructuredAddress(entry.address)}
                    </span>
                  </span>
                </Label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1 text-body-compact font-medium">Channels</legend>
        <div className="flex min-w-0 flex-wrap gap-x-6 gap-y-1">
          {allowed.map((channel) => {
            const inputId = `${id}-channel-${channel.id}`;
            return (
              <div key={channel.id} className="flex min-h-10 items-center gap-2">
                <Checkbox
                  id={inputId}
                  checked={recipients.channels.includes(channel.id)}
                  disabled={disabled}
                  onCheckedChange={(next) =>
                    toggleChannel(channel.id, next === true)
                  }
                />
                <Label
                  htmlFor={inputId}
                  className="cursor-pointer text-body-compact font-normal"
                >
                  {channel.label}
                </Label>
              </div>
            );
          })}
        </div>
      </fieldset>

      {unreachable.length > 0 && person ? (
        <p className="-mt-2 text-caption text-muted-foreground">
          {person.name} has no{" "}
          {unreachable
            .map((channel) => (channel === "sms" ? "mobile number" : "email address"))
            .join(" or ")}{" "}
          on record, so nothing goes by{" "}
          {unreachable.map((channel) => channelLabel(channel)).join(" or ")}.
        </p>
      ) : null}

      {needsPoliceStation(recipients) && person && recipients.addresses.length > 0 ? (
        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-1 text-body-compact font-medium">
            Police station, for each address
          </legend>
          <p className="-mt-2 text-caption text-muted-foreground">
            Filled in from each address. Change one if it is wrong.
          </p>
          <div className="grid min-w-0 gap-3 @lg:grid-cols-2">
            {person.addresses
              .map((entry, index) => ({ ...entry, index }))
              .filter((entry) => recipients.addresses.includes(entry.id))
              .map((entry) => {
                const labelId = `${id}-station-${entry.id}`;
                const station = recipients.policeStations[entry.id] ?? "";
                return (
                  <div key={entry.id} className="flex min-w-0 flex-col gap-1">
                    <span id={labelId} className="text-body-compact">
                      Address {entry.index + 1}
                      <span className="text-muted-foreground">
                        {" "}
                        · {entry.address.locality}
                      </span>
                    </span>
                    <Select
                      value={station || undefined}
                      disabled={disabled}
                      onValueChange={(value) =>
                        onChange({
                          ...recipients,
                          policeStations: {
                            ...recipients.policeStations,
                            [entry.id]: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger aria-labelledby={labelId} className="w-full">
                        <SelectValue placeholder="Choose a police station">
                          {station || null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {POLICE_STATIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
