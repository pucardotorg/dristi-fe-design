"use client";

import * as React from "react";
import { FileSearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSourceFieldLabel } from "@/components/filing/form-field";
import { useSourcesOff } from "@/components/filing/field-policy";

import type { Option } from "@/lib/filing/options";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useFieldReadOnly,
  useFieldReadOnlyHint,
  useInCorrection,
  useLockedDisabled,
} from "@/components/filing/posture";
import { useSourceDock } from "@/hooks/use-min-width";

/**
 * From `xl` the source rail is a permanent column beside the form (`useSourceDock`), so a
 * machine-read field opens the rail on click, as it always has. Below `xl` — phones and
 * tablets, and any correction round where the rail gives up its column — the rail is a
 * slide-in sheet, so the field edits normally and an adjacent button opens the sheet
 * (owner, 2026-09-29). This keeps the desktop untouched and adds the button only where
 * the small screens needed a separate affordance.
 */
export function useSourceDocked() {
  const wide = useSourceDock();
  const inCorrection = useInCorrection();
  const off = useSourcesOff();
  return wide && !inCorrection && !off;
}

/** Shared filing composition: editing and inspecting provenance are separate actions. */
export function SourceField({ children, onViewSource, disabled }: {
  children: React.ReactNode;
  onViewSource?: () => void;
  disabled?: boolean;
}) {
  const label = useSourceFieldLabel();
  const off = useSourcesOff();
  if (!onViewSource || off) return children;
  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      <Button type="button" variant="outline" size="icon" disabled={disabled}
        aria-label={`View source for ${label}`} title={`View source for ${label}`}
        aria-haspopup="dialog" onClick={onViewSource}>
        <FileSearchIcon aria-hidden />
      </Button>
    </div>
  );
}

/**
 * A flagged field's value, shown but not editable — for the controls that have no
 * read-only state of their own (a Select, a date picker, a segmented answer). The DS
 * `Input` does have one, so this is the primitive in its read-only mode rather than a
 * box built to look like it, and it stays focusable, selectable and announced.
 */
export function ReadOnlyValue({
  value,
  id,
  ariaLabel,
  className,
}: {
  value: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const hint = useFieldReadOnlyHint();
  return (
    <Input
      id={id}
      readOnly
      value={value}
      aria-label={ariaLabel}
      aria-describedby={hint}
      className={cn("w-full", className)}
    />
  );
}

/**
 * Text input that may carry a machine-read value. When `prefilled`, the DS amber fill
 * shows; an adjacent button opens its source (`onViewSource`). The field edits normally.
 */
export function TextField({
  value,
  onChange,
  prefilled = false,
  onViewSource,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "prefilled"> & {
  value: string;
  onChange: (value: string) => void;
  prefilled?: boolean;
  onViewSource?: () => void;
}) {
  const disabled = useLockedDisabled(props.disabled);
  /* Flagged by scrutiny: the value stays legible and focusable, and is corrected in the
     inset beneath the field rather than typed over here (brief §15.2). */
  const readOnly = useFieldReadOnly();
  const hint = useFieldReadOnlyHint();
  const docked = useSourceDocked();
  const amber = prefilled && !!value && !readOnly;
  /* Docked (desktop): the field itself opens the rail, unchanged. Undocked: the field
     edits and the adjacent SourceField button opens the sheet. */
  const inlineOpen = amber && !!onViewSource && docked;
  return (
    <SourceField onViewSource={amber && !docked ? onViewSource : undefined} disabled={disabled}>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-describedby={hint}
      prefilled={amber}
      onClick={inlineOpen ? onViewSource : undefined}
      className={cn(inlineOpen && "cursor-pointer", className)}
      {...props}
      readOnly={readOnly || props.readOnly}
      disabled={disabled}
    />
    </SourceField>
  );
}

/** Input with a fixed prefix — "+91" for mobiles, "₹" for amounts. */
export function PrefixInput({
  prefix,
  value,
  onChange,
  prefilled = false,
  onViewSource,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "prefix"> & {
  prefix: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  prefilled?: boolean;
  onViewSource?: () => void;
}) {
  const disabled = useLockedDisabled(props.disabled);
  const readOnly = useFieldReadOnly();
  const hint = useFieldReadOnlyHint();
  const docked = useSourceDocked();
  const amber = prefilled && !!value && !readOnly;
  /* Docked (desktop): click the field to open the rail, unchanged. Undocked: edit here,
     open the sheet from the adjacent button. */
  const inlineOpen = amber && !!onViewSource && docked;
  return (
    <SourceField onViewSource={amber && !docked ? onViewSource : undefined} disabled={disabled}>
    <InputGroup
      data-disabled={disabled || undefined}
      className={cn(
        amber && "border-dashed border-warning-ink bg-prefilled",
        /* Locked: the same quiet sunken fill as every other locked control — the `!`
           outranks the group's own `has-disabled:bg-input/50` (the correction screen
           restores full opacity; see its centre pane). */
        disabled && "bg-surface-sunken!",
        readOnly && "bg-muted",
        className
      )}
    >
      <InputGroupAddon variant="field">
        <InputGroupText>{prefix}</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={inlineOpen ? onViewSource : undefined}
        aria-describedby={hint}
        aria-description={amber ? "Machine filled, not yet verified" : undefined}
        className={cn(inlineOpen && "cursor-pointer")}
        {...props}
        readOnly={readOnly || props.readOnly}
        disabled={disabled}
      />
    </InputGroup>
    </SourceField>
  );
}

/**
 * Select over an `Option[]` with a placeholder row. `prefilled` applies the amber fill;
 * `onViewSource` opens the source panel from the adjacent source button.
 */
export function OptionSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  prefilled = false,
  onViewSource,
  disabled,
  ariaLabel,
  className,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[] | string[];
  placeholder?: string;
  prefilled?: boolean;
  onViewSource?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  id?: string;
}) {
  const opts: Option[] = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  const isDisabled = useLockedDisabled(disabled);
  const readOnly = useFieldReadOnly();
  const docked = useSourceDocked();
  /* A Select has no read-only state — a flagged one therefore shows its chosen option as
     a read-only value (brief §15.5, "rendered as text where the control type cannot be
     read-only"). Focusable and announced; simply not re-openable. */
  if (readOnly) {
    const chosen = opts.find((o) => o.value === value);
    return (
      <ReadOnlyValue
        id={id}
        value={chosen?.label ?? value}
        ariaLabel={ariaLabel}
        className={className}
      />
    );
  }
  const inlineOpen = prefilled && !!value && !!onViewSource && docked;
  return (
    <SourceField onViewSource={prefilled && !!value && !docked ? onViewSource : undefined} disabled={isDisabled}>
    <Select value={value || undefined} onValueChange={onValueChange} disabled={isDisabled}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        onPointerDown={inlineOpen ? onViewSource : undefined}
        className={cn(
          "w-full",
          prefilled && !!value && "border-dashed border-warning-ink bg-prefilled",
          className
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/*
        The DS default is `item-aligned`, which lays the open list over the trigger — on a
        form card that reads as the menu having eaten the label and the field below it.
        Inside a form a menu belongs under the control it belongs to, at its width.
      */}
      <SelectContent position="popper" align="start" sideOffset={4} className="w-(--radix-select-trigger-width)">
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    </SourceField>
  );
}

/**
 * A field whose list is too long to scan — police stations, a bar register — so it is
 * typed into and filtered rather than scrolled.
 *
 * It stays open: anything typed is kept whether or not the list has it. These registers
 * are never complete, and a form that refuses an address because its station is missing
 * from our copy of the directory is worse than one that takes the person's word for it.
 */
export function ComboField({
  value,
  onChange,
  items,
  onSelect,
  placeholder = "Search or type",
  emptyLabel = "No match. What you typed is kept.",
  renderItem,
  itemKey = (item) => String(item),
  itemLabel = (item) => String(item),
  /**
   * `undefined` (default) leaves Base UI's own matching in place — it checks the typed
   * text against `itemToStringLabel`, which is right for a field with one thing to match
   * on (a police station's name). `null` turns internal matching off entirely: use this
   * when `items` already *is* the matched set, e.g. handed down from an async search that
   * matched on more than the one string this field displays (a name search that has to
   * find rows by registration number too, or the reverse).
   */
  filter,
  disabled,
  ariaLabel,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  items: readonly unknown[];
  /** Fired only when a row is picked, so a screen can fill sibling fields from it. */
  onSelect?: (item: unknown) => void;
  placeholder?: string;
  emptyLabel?: string;
  renderItem?: (item: unknown) => React.ReactNode;
  itemKey?: (item: unknown) => string;
  itemLabel?: (item: unknown) => string;
  filter?: null;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
}) {
  const locked = useLockedDisabled(disabled);
  const readOnly = useFieldReadOnly();
  if (readOnly) {
    return <ReadOnlyValue id={id} value={value} ariaLabel={ariaLabel} />;
  }
  return (
    <Combobox
      items={items as unknown[]}
      itemToStringLabel={(item) => itemLabel(item)}
      filter={filter}
      inputValue={value}
      onInputValueChange={(text) => onChange(text)}
      onValueChange={(item) => {
        if (item == null) return;
        onChange(itemLabel(item));
        onSelect?.(item);
      }}
      disabled={locked}
    >
      <ComboboxInput
        id={id}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="w-full"
        autoComplete="off"
      />
      {/* pointer-events-auto: a Radix modal dialog puts pointer-events:none
          on the body, which swallowed this portalled popup when the field
          is used inside one (the witness dialog) — the same fix the
          advocate join dialog's combobox carries. No effect on the filing
          pages, which have no modal. */}
      <ComboboxContent className="pointer-events-auto">
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(item: unknown) => (
            <ComboboxItem key={itemKey(item)} value={item}>
              {renderItem ? renderItem(item) : itemLabel(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
