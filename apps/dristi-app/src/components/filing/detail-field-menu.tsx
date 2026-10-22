"use client";

/**
 * The e-filing fields, grouped by section and searchable — the list a filer inserts from
 * in "Any additional details", and the list Configurations maps a format's variables to.
 */

import * as React from "react";
import { BracesIcon } from "lucide-react";

import { DETAIL_FIELD_GROUPS, type DetailField } from "@/lib/filing/detail-fields";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DetailFieldMenu({
  onPick,
  describe,
  label = "Insert field",
}: {
  onPick: (field: DetailField) => void;
  /** A second line under each field — its value in this filing, or its section. */
  describe: (field: DetailField) => string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // Keep the caret in the text box, so the field lands where it was.
          onMouseDown={(e) => e.preventDefault()}
        >
          <BracesIcon data-icon="inline-start" aria-hidden />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search fields" />
          <CommandList className="max-h-80">
            <CommandEmpty>No field by that name.</CommandEmpty>
            {DETAIL_FIELD_GROUPS.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.fields.map((field) => (
                  <CommandItem
                    key={field.name}
                    value={field.name}
                    onSelect={() => {
                      onPick(field);
                      setOpen(false);
                    }}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="text-body-compact text-foreground">{field.name}</span>
                    <span className="w-full truncate text-caption text-muted-foreground">
                      {describe(field)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
