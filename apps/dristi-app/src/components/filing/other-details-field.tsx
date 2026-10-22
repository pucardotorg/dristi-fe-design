"use client";

/**
 * "Any additional details" — a long text the filer writes, with fields from the filing
 * placed in it as `[Field Name]`, the way a magistrate's order template carries its
 * variables. The fields fill from the form wherever the complaint is read; the list
 * under the box shows what each one will say now, and sends the filer to the section
 * where a missing one is entered.
 *
 * Fields and the starting format: `lib/filing/detail-fields.ts`.
 */

import * as React from "react";
import Link from "next/link";
import { BracesIcon, FileTextIcon } from "lucide-react";

import {
  DETAIL_FIELD_GROUPS,
  DETAILS_FORMAT,
  bracketsIn,
  detailField,
} from "@/lib/filing/detail-fields";
import { getStep } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { useCourtText } from "@/components/court/court-provider";
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
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "@/components/filing/rich-text-editor";

function InsertFieldMenu({ onPick }: { onPick: (name: string) => void }) {
  const { draft } = useFiling();
  const courtText = useCourtText();
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
        >
          <BracesIcon data-icon="inline-start" aria-hidden />
          Insert field
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search fields" />
          <CommandList className="max-h-80">
            <CommandEmpty>No field by that name.</CommandEmpty>
            {DETAIL_FIELD_GROUPS.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.fields.map((field) => {
                  const value = courtText(field.resolve(draft));
                  return (
                    <CommandItem
                      key={field.name}
                      value={field.name}
                      onSelect={() => {
                        onPick(field.name);
                        setOpen(false);
                      }}
                      className="flex-col items-start gap-0.5"
                    >
                      <span className="text-body-compact text-foreground">{field.name}</span>
                      <span className="w-full truncate text-caption text-muted-foreground">
                        {value || "Not entered yet"}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Each bracket in the text, and what it will read as on the complaint today. */
function FieldsInText({ html }: { html: string }) {
  const { draft, hrefFor } = useFiling();
  const courtText = useCourtText();
  const names = bracketsIn(html);
  if (!names.length) return null;

  return (
    <div className="rounded-lg bg-surface-sunken px-4 py-3">
      <p className="text-body-compact font-semibold text-foreground">Fields in this text</p>
      <p className="text-caption text-muted-foreground">
        Filled from the form on the complaint. Change a value in its section and the text
        follows.
      </p>
      <ul className="mt-3 flex flex-col divide-y divide-hairline">
        {names.map((name) => {
          const field = detailField(name);
          const value = field ? courtText(field.resolve(draft)) : "";
          return (
            <li
              key={name}
              className="flex flex-col gap-1 py-2 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <span className="text-body-compact text-foreground sm:w-56 sm:shrink-0">
                [{name}]
              </span>
              {!field ? (
                <span className="text-body-compact text-warning-ink">
                  To write. Type over it in the text.
                </span>
              ) : value ? (
                <span className="min-w-0 text-body-compact text-muted-foreground tabular-nums">
                  {value}
                </span>
              ) : (
                <span className="text-body-compact text-warning-ink">
                  Not entered yet.{" "}
                  <Link
                    href={hrefFor(field.step)}
                    className="underline underline-offset-3 hover:text-foreground"
                  >
                    Go to {getStep(field.step).title}
                  </Link>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OtherDetailsField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (html: string) => void;
  ariaLabel: string;
}) {
  const editor = React.useRef<RichTextEditorHandle>(null);
  const empty = !bracketsIn(value).length && !value.replace(/<[^>]*>|&nbsp;/g, "").trim();

  return (
    <div className="flex flex-col gap-3">
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder="Write here, or start from the format"
        ariaLabel={ariaLabel}
        minHeightClassName="min-h-64"
        handleRef={editor}
        toolbarEnd={
          <>
            {empty ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(DETAILS_FORMAT)}
              >
                <FileTextIcon data-icon="inline-start" aria-hidden />
                Start from the format
              </Button>
            ) : null}
            <InsertFieldMenu onPick={(name) => editor.current?.insertText(`[${name}]`)} />
          </>
        }
      />
      <FieldsInText html={value} />
    </div>
  );
}
