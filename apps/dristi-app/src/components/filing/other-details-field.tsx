"use client";

/**
 * "Any additional details" — a long text the filer writes, started from a format whose
 * variables are already filled in from the form.
 *
 * A filled value stays tied to its field (`filledSpan` in `lib/filing/detail-fields.ts`),
 * so Refresh can bring it up to date after the form changes, and fill any `[Field]` the
 * form now holds. What the form does not hold yet stays as `[Field]`; the blanks a format
 * leaves for the filer stay as they are. Refresh never touches the filer's own writing.
 *
 * Formats are set up on their own page (`/filings/formats`), linked from under the box.
 */

import * as React from "react";
import Link from "next/link";
import { ChevronDownIcon, ExternalLinkIcon, FileTextIcon, RefreshCwIcon } from "lucide-react";

import { bracketsIn, filledSpan, resolveDetails, staleDetails } from "@/lib/filing/detail-fields";
import {
  formatForFiler,
  readDetailsFormats,
  serverDetailsFormats,
  subscribeToDetailsFormats,
  type DetailsFormat,
} from "@/lib/filing/details-formats";
import { useFiling } from "@/lib/filing/store";
import { plural } from "@/lib/filing/format";
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
import { Badge } from "@/components/ui/badge";
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

/** Filled values read as text with a light tint, so the filer can tell them apart. */
const FILLED_LOOK =
  "[&_[data-field]]:rounded-sm [&_[data-field]]:bg-info-muted [&_[data-field]]:px-0.5";

const isEmpty = (html: string) =>
  !bracketsIn(html).length && !html.replace(/<[^>]*>|&nbsp;/g, "").trim();

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
        <DropdownMenuLabel>Start from a format</DropdownMenuLabel>
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
  onStart,
  ariaLabel,
}: {
  value: string;
  formatId: string | undefined;
  onChange: (html: string) => void;
  /** The filer chose a format: its text, filled, replaces the box. */
  onStart: (formatId: string, html: string) => void;
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
  const [replacing, setReplacing] = React.useState<DetailsFormat | null>(null);
  const [status, setStatus] = React.useState("");

  const current = formats.find((f) => f.id === formatId);
  const stale = staleDetails(value, draft, courtText);

  const start = (format: DetailsFormat) => {
    onStart(format.id, resolveDetails(formatForFiler(format), draft, courtText).html);
    setStatus("");
  };

  const choose = (format: DetailsFormat) => {
    if (isEmpty(value)) start(format);
    else setReplacing(format);
  };

  const refresh = () => {
    const { html, changed } = resolveDetails(value, draft, courtText);
    if (changed) onChange(html);
    setStatus(
      changed
        ? `Updated ${plural(changed, "value")} from the form.`
        : "Everything is up to date with the form.",
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <RichTextEditor
        value={value}
        onChange={(html) => {
          onChange(html);
          setStatus("");
        }}
        placeholder="Write here, or choose a format"
        ariaLabel={ariaLabel}
        minHeightClassName="min-h-64"
        className={FILLED_LOOK}
        handleRef={editor}
        toolbarEnd={
          <>
            <FormatMenu formats={formats} current={current} onChoose={choose} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={refresh}
              aria-label={
                stale
                  ? `Refresh values from the form, ${plural(stale, "change")} waiting`
                  : "Refresh values from the form"
              }
            >
              <RefreshCwIcon data-icon="inline-start" aria-hidden />
              Refresh
              {stale ? (
                <Badge variant="warning" className="tabular-nums">
                  {stale}
                </Badge>
              ) : null}
            </Button>
            <DetailFieldMenu
              onPick={(field) => {
                const filled = courtText(field.resolve(draft));
                if (filled) editor.current?.insertHtml(filledSpan(field.name, filled));
                else editor.current?.insertText(`[${field.name}]`);
              }}
              describe={(field) => courtText(field.resolve(draft)) || "Not entered yet"}
            />
          </>
        }
      />

      <div className="flex flex-col gap-1 text-caption">
        <p role="status" className={stale ? "text-warning-ink" : "text-muted-foreground"}>
          {stale
            ? `${plural(stale, "value")} changed in the form since this text was filled. Refresh to update.`
            : status}
        </p>
        <p className="text-muted-foreground">
          Tinted words are filled from the form; anything still in [brackets] is for you to
          write or is not in the form yet.{" "}
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
      </div>

      <AlertDialog open={!!replacing} onOpenChange={(open) => !open && setReplacing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the text with &ldquo;{replacing?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              What is in the box now, including anything you wrote, will be replaced by this
              format, filled from the form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my text</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (replacing) start(replacing);
                setReplacing(null);
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
