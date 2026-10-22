"use client";

/**
 * "Any additional details" — a long text the filer writes, or generates from a format.
 *
 * Choosing a format writes its text into the box with the form's values in place
 * (`generateDetails` in `lib/filing/detail-fields.ts`). From then on it is simply text,
 * the filer's to edit. Refresh writes the chosen format again with the form's current
 * values — after a confirmation when the box has text, because it replaces it. A filing
 * that has never had a format starts with the default format's text, if one is set.
 *
 * Formats are set up on their own page (`/filings/formats`), linked from under the box.
 */

import * as React from "react";
import Link from "next/link";
import { ChevronDownIcon, ExternalLinkIcon, FileTextIcon, RefreshCwIcon } from "lucide-react";

import { generateDetails } from "@/lib/filing/detail-fields";
import {
  defaultFormat,
  formatForFiler,
  readDetailsFormats,
  serverDetailsFormats,
  subscribeToDetailsFormats,
  type DetailsFormat,
} from "@/lib/filing/details-formats";
import { useFiling } from "@/lib/filing/store";
import { useCourtText } from "@/components/court/court-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DetailFieldMenu } from "@/components/filing/detail-field-menu";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "@/components/filing/rich-text-editor";

/** Where the formats this box starts from are set up. */
const FORMATS_HREF = "/filings/formats";

const isEmpty = (html: string) => !html.replace(/<[^>]*>|&nbsp;/g, "").trim();

function FormatMenu({
  formats,
  current,
  onChoose,
}: {
  formats: readonly DetailsFormat[];
  current: DetailsFormat | undefined;
  onChoose: (format: DetailsFormat) => void;
}) {
  if (!formats.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="max-w-56">
          <FileTextIcon data-icon="inline-start" aria-hidden />
          <span className="truncate">{current ? current.name : "Choose a format"}</span>
          <ChevronDownIcon data-icon="inline-end" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Generate from a format</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current?.id ?? ""}
          onValueChange={(id) => {
            const format = formats.find((f) => f.id === id);
            if (format) onChoose(format);
          }}
        >
          {formats.map((format) => (
            <DropdownMenuRadioItem key={format.id} value={format.id}>
              {format.name || "Untitled"}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OtherDetailsField({
  value,
  formatId,
  onChange,
  onGenerate,
  ariaLabel,
}: {
  value: string;
  formatId: string | undefined;
  onChange: (html: string) => void;
  /** Text generated from a format replaces the box. */
  onGenerate: (formatId: string, html: string) => void;
  ariaLabel: string;
}) {
  const { draft } = useFiling();
  const courtText = useCourtText();
  const editor = React.useRef<RichTextEditorHandle>(null);
  const formats = React.useSyncExternalStore(
    subscribeToDetailsFormats,
    readDetailsFormats,
    serverDetailsFormats,
  );
  // A format waiting on "replace your text?".
  const [pending, setPending] = React.useState<DetailsFormat | null>(null);

  const current = formats.find((f) => f.id === formatId);
  const fallback = defaultFormat(formats);


  const generate = (format: DetailsFormat) =>
    onGenerate(format.id, generateDetails(formatForFiler(format), draft, courtText));

  const ask = (format: DetailsFormat) => {
    if (isEmpty(value)) generate(format);
    else setPending(format);
  };

  // An empty box that has never had a format gets the default's text — once: after that
  // the filing remembers its format, so a box the filer clears stays clear.
  React.useEffect(() => {
    if (fallback && !formatId && isEmpty(value)) generate(fallback);
    // Only a default appearing, or changing, should fill the box — not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback?.id]);

  return (
    <div className="flex flex-col gap-3">
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder="Write here, or choose a format"
        ariaLabel={ariaLabel}
        minHeightClassName="min-h-64"
        handleRef={editor}
        toolbarEnd={
          <>
            <FormatMenu formats={formats} current={current} onChoose={ask} />
            {current ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => ask(current)}>
                <RefreshCwIcon data-icon="inline-start" aria-hidden />
                Refresh
              </Button>
            ) : null}
            <DetailFieldMenu
              onPick={(field) =>
                editor.current?.insertText(courtText(field.resolve(draft)) || `[${field.name}]`)
              }
              describe={(field) => courtText(field.resolve(draft)) || "Not entered yet"}
            />
          </>
        }
      />

      <p className="text-caption text-muted-foreground">
        A format writes its text here with the details from the form filled in. Refresh
        writes it again after you change the form.{" "}
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

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.id === current?.id
                ? "Write the text again with the form's current details?"
                : <>Replace the text with &ldquo;{pending?.name}&rdquo;?</>}
            </AlertDialogTitle>
            <AlertDialogDescription>
              What is in the box now, including any changes you made, will be replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my text</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) generate(pending);
                setPending(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
