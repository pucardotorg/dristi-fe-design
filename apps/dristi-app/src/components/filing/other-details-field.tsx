"use client";

/**
 * "Any additional details" — a long text the filer writes, with fields from the filing
 * placed in it as `[Field Name]`, the way a magistrate's order template carries its
 * variables. The fields fill from the form wherever the complaint is read; the list
 * under the box shows what each one will say now, and sends the filer to the section
 * where a missing one is entered.
 *
 * Fields: `lib/filing/detail-fields.ts`. The formats to start from are set up on
 * Configurations (`lib/filing/details-formats.ts`).
 */

import * as React from "react";
import Link from "next/link";
import { ChevronDownIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";

import { bracketsIn, detailField } from "@/lib/filing/detail-fields";
import {
  formatForFiler,
  readDetailsFormats,
  serverDetailsFormats,
  subscribeToDetailsFormats,
  type DetailsFormat,
} from "@/lib/filing/details-formats";
import { getStep } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { useCourtText } from "@/components/court/court-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DetailFieldMenu } from "@/components/filing/detail-field-menu";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "@/components/filing/rich-text-editor";

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

/** Where the formats this box starts from are set up. */
const FORMATS_HREF = "/filings/formats";

/** One format: a button. Several: the button opens the list to choose from. */
function StartFromFormat({ onStart }: { onStart: (format: DetailsFormat) => void }) {
  const formats = React.useSyncExternalStore(
    subscribeToDetailsFormats,
    readDetailsFormats,
    serverDetailsFormats,
  );
  if (!formats.length) return null;
  if (formats.length === 1) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => onStart(formats[0])}>
        <FileTextIcon data-icon="inline-start" aria-hidden />
        Start from the format
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <FileTextIcon data-icon="inline-start" aria-hidden />
          Start from a format
          <ChevronDownIcon data-icon="inline-end" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {formats.map((format) => (
          <DropdownMenuItem key={format.id} onSelect={() => onStart(format)}>
            {format.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
  const { draft } = useFiling();
  const courtText = useCourtText();
  const editor = React.useRef<RichTextEditorHandle>(null);
  const empty = !bracketsIn(value).length && !value.replace(/<[^>]*>|&nbsp;/g, "").trim();

  return (
    <div className="flex flex-col gap-3">
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder="Write here, or start from a format"
        ariaLabel={ariaLabel}
        minHeightClassName="min-h-64"
        handleRef={editor}
        toolbarEnd={
          <>
            {empty ? (
              <StartFromFormat onStart={(format) => onChange(formatForFiler(format))} />
            ) : null}
            <DetailFieldMenu
              onPick={(field) => editor.current?.insertText(`[${field.name}]`)}
              describe={(field) => courtText(field.resolve(draft)) || "Not entered yet"}
            />
          </>
        }
      />
      <p className="text-caption text-muted-foreground">
        Formats, and the field that fills each of their variables, are set up separately.{" "}
        <Link
          href={FORMATS_HREF}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-foreground underline underline-offset-3"
        >
          Edit formats
          <ExternalLinkIcon aria-hidden className="size-3" />
          <span className="sr-only">(opens in a new tab)</span>
        </Link>
      </p>
      <FieldsInText html={value} />
    </div>
  );
}
