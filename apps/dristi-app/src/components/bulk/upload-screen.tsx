"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleXIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FlaskConicalIcon,
  SearchIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import type { CaseExtraction } from "@/lib/bulk/case-doc";
import { advocatesMissing, apiComplainantOf, partiesOf } from "@/lib/bulk/parties";
import { useFiling } from "@/lib/filing/store";
import {
  autoMap,
  buildRequest,
  followsTemplate,
  readWorkbook,
  rowsThatCannotBeCreated,
  unknownValues,
  unmatchedRequired,
  type ColumnMap,
  type InstanceCounts,
  type RowProblem,
  type ValueMap,
  type Workbookish,
} from "@/lib/bulk/excel";
import { COLUMNS, LISTS, type ListName } from "@/lib/bulk/excel-spec";
import { money } from "@/lib/filing/format";
import type { StoredFileRef } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { useCourt } from "@/components/court/court-provider";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { downloadTemplate } from "./batches-screen";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";

import { ColumnMapping, mappingLeft } from "./column-mapping";
import { useGujarat } from "./court-guard";
import {
  defaultFormat,
  formatForFiler,
  readDetailsFormats,
  serverDetailsFormats,
  subscribeToDetailsFormats,
} from "@/lib/filing/details-formats";
import { DetailsFormatChoice } from "./batch-parties";
import { FileDrop } from "./file-drop";
import { FormatChoice, type UploadFormat } from "./format-choice";
import { bulkFetch } from "./api";
import { setupHref, uploadHref, useReportUploadState, type UploadStep } from "./setup-flow";
import { StatusMark } from "@/components/feedback";
import { StatusLine } from "@/components/feedback";


/** The rows left out, as a CSV in the file's own columns with the reason first, to fix and upload. */
function downloadRows(book: Workbookish, rows: RowProblem[], fileName: string) {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    ["Why it was left out", "Row", ...book.cases.headers],
    ...rows.map((x) => [x.why, String(x.row), ...book.cases.rows[x.index]]),
  ].map((r) => r.map((v) => cell(v ?? "")).join(","));
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `rows-to-fix-${fileName.replace(/\.[^.]+$/, "")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** A file without a column for any of these can't make cases (owner and PM, 2026-11-04). */
const CORE_COLUMNS = ["accusedName", "chequeNumber", "chequeAmount"];

/** A numbered step of the template's two (download, fill and upload). */
function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="flex size-7 items-center justify-center rounded-full bg-brand-muted text-body-compact font-semibold text-brand-muted-foreground"
    >
      {n}
    </span>
  );
}

/** The demo spreadsheets the upload offers, from `public/samples/` (`scripts/bulk-demo-files.mts`). */
const SAMPLES = [
  { key: "tata-capital-bulk-filing-template.xlsx", label: "Sample 1: the filled template", format: "template" },
  { key: "tata-capital-recovery-mis.xlsx", label: "Sample 2: a lender's own export", format: "own" },
] as const;

type ReadingRow = {
  name: string;
  state: "waiting" | "reading" | "done" | "failed";
  /** What was read from it: reference, accused, cheque, amount. */
  found?: string;
};

/** The documents being read, each as it is done, with what was found in it. */
function ReadingCard({ rows }: { rows: ReadingRow[] }) {
  const done = rows.filter((r) => r.state === "done").length;
  return (
    <Card variant="raised" className="max-w-3xl gap-0 py-0">
      <CardHeader className="gap-3 px-6 py-6">
        <CardTitle className="flex items-center gap-2 text-body font-semibold">
          <Spinner className="size-4 text-primary" />
          Reading {rows.length} document{rows.length === 1 ? "" : "s"}
        </CardTitle>
        <Progress
          value={(done / rows.length) * 100}
          aria-label={`${done} of ${rows.length} read`}
        />
        <CardDescription className="tabular-nums" aria-live="polite">
          {done} of {rows.length} read
        </CardDescription>
      </CardHeader>
      <ul className="flex max-h-[50dvh] flex-col divide-y divide-hairline overflow-y-auto border-t border-hairline">
        {rows.map((r) => (
          <li
            key={r.name}
            className={cn(
              "flex items-center gap-3 px-6 py-3 transition-colors",
              r.state === "reading" && "bg-accent",
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center">
              {r.state === "done" ? (
                <StatusMark size={20} still label="Read" />
              ) : r.state === "reading" ? (
                <Spinner className="size-4 text-primary" aria-label="Reading" />
              ) : r.state === "failed" ? (
                <StatusMark tone="error" size={20} still label="Not read" />
              ) : (
                <FileTextIcon
                  className="size-4 text-muted-foreground"
                  aria-label="Waiting"
                />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span
                className={cn(
                  "truncate text-body-compact",
                  r.state === "waiting"
                    ? "text-muted-foreground"
                    : "font-medium",
                )}
              >
                {r.name}
              </span>
              {r.state === "reading" ? (
                <Skeleton className="mt-1 h-3 w-2/3" />
              ) : r.found ? (
                <span className="truncate text-caption text-muted-foreground tabular-nums">
                  {r.found}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Case documents, as opposed to a sheet. */
const DOC = /\.(docx|pdf|txt)$/i;

const LIST_TITLE: Record<ListName, string> = {
  complainantEntity: "Complainant institution type",
  gender: "Gender",
  yesNo: "Yes / No",
  accusedType: "Accused type",
  accusedEntity: "Accused institution type",
  returnReason: "Return reason",
  natureOfDebt: "Nature of debt",
  modeOfService: "Mode of service",
  nonDelivery: "Reason for non-delivery",
  payment: "Payment after notice",
};

/**
 * The upload's own steps, after the Complainant, Advocate and Documents sections it shares
 * the filing's frame with (`setup-flow.tsx`): the file, its columns matched only if it is
 * not the template, list values matched only if some are not in the lists, then review and
 * create the batch. Every case lands as a draft; documents come after. Which step is on
 * screen is in the address (`?step=`), so the sections rail can link to each.
 */
export function UploadScreen() {
  const ready = useGujarat();
  const router = useRouter();
  // The batch's complainants and advocates, set on the setup's sections before the file
  // (`setup-flow.tsx`): this screen is one of the setup's own.
  const { draft: setup } = useFiling();
  const setupId = setup.id;
  // The additional-details format every case is generated from: what the filer chose
  // ("" for none), or until they choose, the default format if one is set.
  const [formatChoice, setFormatId] = React.useState<string | null>(null);
  const formats = React.useSyncExternalStore(
    subscribeToDetailsFormats,
    readDetailsFormats,
    serverDetailsFormats,
  );
  const formatId = formatChoice ?? defaultFormat(formats)?.id ?? "";
  const [files, setFiles] = React.useState<File[]>([]);
  const file = files[0] ?? null;
  // With AI on, a Word file or PDF per case can stand in for the sheet: each is read into
  // the template's columns, and the rest of the upload is the same.
  const { profile, court } = useCourt();
  const ai = aiModeFrom(useSearchParams().get("ai"), profile.aiMode);
  const docs = files.length > 0 && files.every((f) => DOC.test(f.name));
  const [reading, setReading] = React.useState<ReadingRow[] | null>(null);
  const [originals, setOriginals] = React.useState<
    Record<string, { file: StoredFileRef; text: string | null }>
  >({});
  const fileName = docs
    ? `${files.length} case document${files.length === 1 ? "" : "s"}`
    : (file?.name ?? "");
  const [book, setBook] = React.useState<Workbookish | null>(null);
  // Which step is on screen is in the address, so the sections rail can link to each; one
  // that needs a file read falls back to the file until there is one.
  const search = useSearchParams();
  const asked = search.get("step") as UploadStep | null;
  // Template or own file, chosen first; kept while the upload is open.
  const [format, setFormat] = React.useState<UploadFormat | null>(null);
  const step: UploadStep =
    asked === "format" || (!format && !book)
      ? "format"
      : book && asked && ["map", "values", "review"].includes(asked)
        ? asked
        : "file";
  const setStep = (s: UploadStep) => router.push(uploadHref(setupId, s, search.get("ai")));
  const [map, setMap] = React.useState<ColumnMap>({});
  const [counts, setCounts] = React.useState<InstanceCounts>({});
  // Fields the filer chose to fill in each case later, on Match columns.
  const [later, setLater] = React.useState<Set<string>>(() => new Set());
  const [values, setValues] = React.useState<ValueMap>({});
  const [template, setTemplate] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // A sample spreadsheet, fetched and chosen as if it had been dropped.
  const [sampling, setSampling] = React.useState<string | null>(null);
  // Check's table: which rows show, a search over them, and the page (v8).
  const [checkShow, setCheckShow] = React.useState<"all" | "clean" | "blanks">("all");
  const [checkQ, setCheckQ] = React.useState("");
  const [checkPage, setCheckPage] = React.useState(0);
  const chooseSample = async (key: string) => {
    setSampling(key);
    setError(null);
    try {
      const res = await fetch(`/samples/${key}`);
      if (!res.ok) throw new Error("The sample file could not be loaded.");
      const blob = await res.blob();
      setFiles([new File([blob], key, { type: blob.type })]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSampling(null);
    }
  };

  const headers = book?.cases.headers ?? [];
  const unknown = book ? unknownValues(book.cases, map, counts) : {};
  const unknownLists = Object.keys(unknown) as ListName[];
  // Required fields no column fills: every case arrives without them.
  const missing = book && !docs ? unmatchedRequired(book.cases.headers, map) : [];
  // Without these the file can't make cases at all: every one would need them typed by hand.
  const coreMissing = missing.filter((c) => CORE_COLUMNS.includes(c.key));
  // Rows that won't become cases (nothing identifies them, or they repeat one): left out
  // of this batch, and downloadable to fix. Everything else becomes a case.
  const cannot = React.useMemo<RowProblem[]>(
    () => (book && !docs ? rowsThatCannotBeCreated(book, map, values) : []),
    [book, docs, map, values],
  );
  const creating = book ? book.cases.rows.length - cannot.length : 0;
  const valuesDone = unknownLists.every((l) =>
    unknown[l]!.every((v) => values[l]?.[v]),
  );

  // Required fields Match columns still waits on (a column, or "fill in each case later").
  const mapLeft = book && !(template || docs) ? mappingLeft(book.cases.headers, map, counts, later) : 0;
  // The sections rail lists matching only where this file needs it.
  const report = useReportUploadState();
  const matchColumns = !!book && !(template || docs);
  const matchValues = unknownLists.length > 0;
  React.useEffect(() => {
    report({ read: !!book, matchColumns, matchValues, documents: docs, format });
  }, [report, book, matchColumns, matchValues, docs, format]);

  const read = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (files.length > 1 && !docs)
        throw new Error("Upload one Excel file, or Word files and PDFs only.");
      const b = docs
        ? await readDocuments()
        : await readWorkbook(file).catch(() => {
            throw new Error(
              `We couldn't read ${file.name}. It may be damaged or protected by a password. Open it in Excel, save a copy as .xlsx without a password, and upload that.`,
            );
          });
      if (!b.cases.rows.length)
        throw new Error("No case rows were found in this file.");
      // A corrected file in the same layout keeps the columns already matched.
      const same =
        !!book && book.cases.headers.join("\u0001") === b.cases.headers.join("\u0001");
      setBook(b);
      const m = same ? map : autoMap(b.cases.headers);
      if (!same) {
        setMap(m);
        setCounts({});
      }
      // Documents are read straight into the template's columns: nothing to match.
      const follows = docs || followsTemplate(b.cases.headers);
      setTemplate(follows);
      const u = unknownValues(b.cases, m);
      setStep(follows ? (Object.keys(u).length ? "values" : "review") : "map");
    } catch (e) {
      setError((e as Error).message || "This file could not be read.");
    } finally {
      setReading(null);
      setBusy(false);
    }
  };

  /** Each document read into one row, under the template's own headers. */
  const readDocuments = async (): Promise<Workbookish> => {
    type Read = CaseExtraction & {
      original: StoredFileRef;
      text: string | null;
    };
    setReading(files.map((f) => ({ name: f.name, state: "waiting" })));
    const mark = (i: number, row: Partial<ReadingRow>) =>
      setReading((rows) =>
        rows ? rows.map((r, k) => (k === i ? { ...r, ...row } : r)) : rows,
      );
    // One document per request, a few at a time, so each shows as it is read. Each takes
    // a moment at least, so the reading can be followed.
    const read: Read[] = new Array(files.length);
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        mark(i, { state: "reading" });
        const form = new FormData();
        form.append("files", files[i]);
        form.append("ai", ai);
        const [res] = await Promise.all([
          bulkFetch("/api/bulk/extract", { method: "POST", body: form }),
          new Promise((r) => setTimeout(r, 700 + Math.random() * 600)),
        ]);
        const json = await res.json();
        if (!res.ok) {
          mark(i, { state: "failed" });
          throw new Error(json.error ?? "The documents could not be read.");
        }
        const x = (json.cases as Read[])[0];
        read[i] = x;
        const f = (k: string) => x.fields[k]?.value?.trim() ?? "";
        const amount = Number(f("Cheque amount").replace(/[^\d.]/g, ""));
        mark(i, {
          state: "done",
          found: [
            f("Case reference"),
            f("Accused name"),
            f("Cheque number") && `Cheque ${f("Cheque number")}`,
            amount ? money(amount) : "",
          ]
            .filter(Boolean)
            .join(" · "),
        });
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(3, files.length) }, worker),
    );
    await new Promise((r) => setTimeout(r, 500));
    const values = read.map((x) => {
      const v = Object.fromEntries(
        Object.entries(x.fields).map(([k, f]) => [k, f.value]),
      );
      // No reference in the document: the file's name stands in.
      if (!v["Case reference"]?.trim())
        v["Case reference"] = x.fileName.replace(/\.[^.]+$/, "");
      return v;
    });
    setOriginals(
      Object.fromEntries(
        read.map((x, i) => [
          values[i]["Case reference"].trim(),
          { file: x.original, text: x.text },
        ]),
      ),
    );
    const headers = [...new Set(values.flatMap((v) => Object.keys(v)))];
    return {
      cases: {
        name: "Cases",
        headers,
        rows: values.map((v) => headers.map((h) => v[h] ?? "")),
        discarded: 0,
      },
    };
  };

  const create = async () => {
    if (!book || !file) return;
    setBusy(true);
    setError(null);
    try {
      if (!setup) throw new Error("Set the complainants and advocates first.");
      const parties = partiesOf(setup);
      // Reachable from the stepper without passing the Advocate section's own hold.
      const noAdvocate = advocatesMissing(parties.advocates);
      if (noAdvocate) throw new Error(`${noAdvocate}, in Common details.`);
      const left = new Set(cannot.map((x) => x.index));
      const usable: Workbookish = {
        cases: { ...book.cases, rows: book.cases.rows.filter((_, i) => !left.has(i)) },
      };
      const request = buildRequest(
        usable,
        map,
        values,
        {
          complainant: apiComplainantOf(parties),
          barNumbers: parties.advocates.map((a) => a.barNumber),
          // Asked with the complainants on Common details (BLK-05).
          adr: setup.adr.adr,
          fileName,
          detailsFormat: (() => {
            const format = formats.find((f) => f.id === formatId);
            return format
              ? { id: format.id, html: formatForFiler(format), court }
              : undefined;
          })(),
        },
        counts,
      );
      const res = await bulkFetch("/api/bulk/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          docs
            ? { request, fileName, from: "documents", originals, parties }
            : { request, fileName, parties },
        ),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error([json.error, ...(json.details ?? [])].join(" "));
      router.push(`/filings/bulk/${json.batchId}?tab=scrutiny`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!ready) return null;

  const errorNotice = error ? (
    <StatusLine tone="error">{error}</StatusLine>
  ) : null;
  const backFromReview: UploadStep = unknownLists.length ? "values" : template || docs ? "file" : "map";

  if (step === "format")
    return (
      <>
        {/* The choice sits in the middle of the canvas, a little above centre, rather than
            hanging from the top with the lower half empty. PRD BLK-10: the batch comes from
            one Excel file, so the two cards are the whole choice (the Word/PDF-per-case
            entry is gone, owner 2026-11-10). */}
        <FilingMain width="wide" className="flex flex-col justify-center-safe pb-[8vh]">
          <FilingPageHeader
            title="How will you send the cases?"
            description="Put one case on each row. The cases in one file are filed together."
          />
          <FormatChoice
            onChoose={(f) => {
              if (f !== format) setFiles([]);
              setFormat(f);
              setStep("file");
            }}
          />
        </FilingMain>
        {/* The choice is the cards themselves, so the footer has only Back (round 3: a
            Continue that could never be pressed). */}
        <FilingFooter showSaveState={false} backHref={setupHref(setupId, "documents")} noContinue />
      </>
    );

  if (step === "file") {
    const template = format === "template";
    return (
      <>
        <FilingMain>
          <FilingPageHeader
            title={template ? "Upload the filled template" : ai === "on" ? "Upload your Excel or case documents" : "Upload your Excel"}
            description={
              template
                ? "The cases go straight in. Every row is checked as soon as the file is read."
                : "Upload it as it comes from your system. You match its columns next."
            }
          />
          {errorNotice}
          {reading ? (
            <ReadingCard rows={reading} />
          ) : (
            <Card variant="raised">
              <CardContent className="flex flex-col gap-6">
                {template ? (
                  <ol className="grid gap-6 sm:grid-cols-2">
                    <li className="flex flex-col gap-3">
                      <StepNumber n={1} />
                      <span className="text-body-compact font-medium">Download the template</span>
                      <span className="text-body-compact text-muted-foreground">
                        A column for every case detail, with an example row and the court&apos;s
                        lists built in.
                      </span>
                      <Button variant="outline" className="w-fit" onClick={() => void downloadTemplate()}>
                        <DownloadIcon data-icon="inline-start" aria-hidden />
                        Download template
                      </Button>
                    </li>
                    <li className="flex flex-col gap-3">
                      <StepNumber n={2} />
                      <span className="text-body-compact font-medium">Fill one row per case, then upload it</span>
                      <span className="text-body-compact text-muted-foreground">
                        Leave a cell blank if you don&apos;t have it yet. You can complete it on
                        Case details.
                      </span>
                    </li>
                  </ol>
                ) : null}
                <Field className="gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel htmlFor="sheet">
                      {template ? "Filled template" : ai === "on" ? "Your Excel, or one document per case" : "Your Excel file"}
                    </FieldLabel>
                    {/* Sandbox, the product's flask (as on e-filing's signing step): the demo
                        spreadsheets, used here in one move or downloaded to show the upload. */}
                    <DropdownMenu>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Sandbox: sample files"
                                disabled={busy || sampling !== null}
                                className="relative text-muted-foreground after:absolute after:-inset-1"
                              >
                                {sampling ? <Spinner /> : <FlaskConicalIcon aria-hidden />}
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Sandbox: sample files</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent align="end" className="w-72">
                        <DropdownMenuLabel>Use a sample file</DropdownMenuLabel>
                        {SAMPLES.map((x) => (
                          <DropdownMenuItem
                            key={x.key}
                            onSelect={() => {
                              // A sample in the other format switches the step to it first.
                              if (x.format !== format) setFormat(x.format);
                              void chooseSample(x.key);
                            }}
                          >
                            <FileSpreadsheetIcon aria-hidden />
                            {x.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Download to upload yourself</DropdownMenuLabel>
                        {SAMPLES.map((x) => (
                          <DropdownMenuItem key={x.key} asChild>
                            <a href={`/samples/${x.key}`} download={x.key}>
                              <DownloadIcon aria-hidden />
                              {x.label}
                            </a>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <FileDrop
                    id="sheet"
                    accept={ai === "on" && !template ? ".xlsx,.csv,.docx,.pdf,.txt" : ".xlsx,.csv"}
                    multiple={ai === "on" && !template}
                    files={files}
                    onFiles={setFiles}
                    prompt={template ? "Drag the filled template here" : ai === "on" ? "Drag your Excel file or case documents here" : "Drag your Excel file here"}
                    hint={ai === "on" && !template ? ".xlsx or .csv, or Word and PDF files" : ".xlsx or .csv"}
                  />
                </Field>
              </CardContent>
            </Card>
          )}
          <p className="flex flex-wrap items-center gap-x-1 text-body-compact text-muted-foreground">
            {template ? "Have a file from your own system instead?" : "The template is quicker and needs no matching."}
            <Button
              variant="link"
              className="px-0 underline"
              onClick={() => {
                setFiles([]);
                setFormat(template ? "own" : "template");
              }}
            >
              {template ? "Use your own Excel" : "Use the template instead"}
            </Button>
          </p>
        </FilingMain>
        <FilingFooter
          showSaveState={false}
          onBack={() => setStep("format")}
          onContinue={() => void read()}
          continueDisabled={!file || busy}
          continueLabel={busy ? "Reading…" : template ? "Continue" : "Match columns"}
        />
      </>
    );
  }

  if (step === "map" && book)
    return (
      <>
        <FilingMain width="wide">
          <FilingPageHeader
            title="Match columns"
            description={`${fileName} uses its own layout. Say which column holds each field, or that it's filled in each case later.`}
          />
          {errorNotice}
          <ColumnMapping
            headers={headers}
            rows={book.cases.rows}
            map={map}
            onChange={setMap}
            counts={counts}
            onCounts={setCounts}
            later={later}
            onLater={setLater}
          />
        </FilingMain>
        {/* Every required field is answered before going on: a column, or "Fill in each
            case later", which Case details then holds with its fix in place (v8). */}
        <FilingFooter
          showSaveState={false}
          onBack={() => setStep("file")}
          status={
            mapLeft ? (
              <span className="text-body-compact text-muted-foreground tabular-nums">{mapLeft} still to match</span>
            ) : undefined
          }
          continueBlocked={mapLeft > 0}
          continueHint={mapLeft ? "Choose a column, or Fill in each case later, for each field" : undefined}
          onContinue={mapLeft ? undefined : () => setStep(unknownLists.length ? "values" : "review")}
        />
      </>
    );

  if (step === "values" && book)
    return (
      <>
        <FilingMain>
          <FilingPageHeader
            title="Match values"
            description="These values in your sheet are not in the court's lists. Choose what each one means; every row using it follows."
          />
          {errorNotice}
          {unknownLists.map((l) => (
            <Card key={l} variant="raised" >
              <CardHeader>
                <CardTitle className="text-body font-semibold">{LIST_TITLE[l]}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {unknown[l]!.map((raw) => (
                  <Field
                    key={raw}
                    orientation="horizontal"
                    className="flex-col gap-1.5 sm:flex-row sm:items-center"
                  >
                    <FieldLabel htmlFor={`v-${l}-${raw}`} className="sm:w-56">
                      &ldquo;{raw}&rdquo;
                    </FieldLabel>
                    <NativeSelect
                      id={`v-${l}-${raw}`}
                      value={values[l]?.[raw] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [l]: { ...(v[l] ?? {}), [raw]: e.target.value },
                        }))
                      }
                    >
                      <NativeSelectOption value="">Choose</NativeSelectOption>
                      {LISTS[l].map((o) => (
                        <NativeSelectOption key={o.value} value={o.value}>
                          {o.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                ))}
              </CardContent>
            </Card>
          ))}
        </FilingMain>
        <FilingFooter
          showSaveState={false}
          onBack={() => setStep(template ? "file" : "map")}
          onContinue={() => setStep("review")}
          continueBlocked={!valuesDone}
          continueHint="Choose what each value means first."
        />
      </>
    );

  if (step === "review" && book) {
    const left = new Set(cannot.map((x) => x.index));
    // The rows that become cases, with their Excel row number (headers are row 1).
    const created = book.cases.rows
      .map((cells, i) => ({ cells, row: i + 2 + (book.cases.discarded ?? 0), i }))
      .filter((x) => !left.has(x.i));
    // Of those, the ones that arrive with a required detail blank: a column the file lacks
    // leaves every case blank there; otherwise the empty cells in the row.
    const requiredCols = COLUMNS.filter((c) => c.required.startsWith("Yes") && typeof map[c.key] === "number");
    const withBlanks = created
      .map((x) => ({
        row: x.row,
        blanks: [
          ...missing.map((c) => c.header),
          ...requiredCols.filter((c) => !String(x.cells[map[c.key] as number] ?? "").trim()).map((c) => c.header),
        ],
      }))
      .filter((x) => x.blanks.length);
    return (
      <>
        <FilingMain width="wide">
          <FilingPageHeader
            title={coreMissing.length ? "Check" : `Create ${creating} case${creating === 1 ? "" : "s"}`}
            description="Cases with details to fix are still created. You fix them in the filing form next."
          />
          {errorNotice}
          {coreMissing.length ? (
            <StatusLine
              tone="error"
              still
              title="No cases can be created from this file yet"
              action={
                matchColumns ? (
                  <Button variant="outline" onClick={() => setStep("map")}>
                    Match columns
                  </Button>
                ) : null
              }
            >
              It has no column for{" "}
              {new Intl.ListFormat("en", { type: "disjunction" }).format(coreMissing.map((c) => c.header.toLowerCase()))}
              , and every case needs {coreMissing.length === 1 ? "it" : "them"} from the file. Match{" "}
              {coreMissing.length === 1 ? "it" : "them"} on Match columns, or upload a file that has{" "}
              {coreMissing.length === 1 ? "it" : "them"}.
            </StatusLine>
          ) : missing.length ? (
            <StatusLine
              tone="warning"
              still
              title={`${missing.length} required field${missing.length === 1 ? " is" : "s are"} not in your file`}
            >
              Every case will arrive without{" "}
              {new Intl.ListFormat("en", { type: "conjunction" }).format(missing.map((c) => c.header.toLowerCase()))}
              . Each case stays in draft until you enter {missing.length === 1 ? "it" : "them"} on its Case details.
            </StatusLine>
          ) : null}
          {/* While the file can't make any case, no count is shown: a number of cases "to be
              created" under that blocker says the opposite of it (bulk audit, 2026-11-04). */}
          {coreMissing.length ? null : (
            <Card variant="raised">
              <CardContent className="flex flex-col gap-6">
                <div className="grid gap-6 sm:grid-cols-3">
                  {[
                    { n: creating - withBlanks.length, label: "Ready to create", tone: "" },
                    { n: withBlanks.length, label: "Created, with details to fix", tone: withBlanks.length ? "text-warning-ink" : "" },
                    { n: cannot.length, label: "Can't be created", tone: cannot.length ? "text-destructive-ink" : "" },
                  ].map((x) => (
                    <div key={x.label} className="flex flex-col gap-1">
                      <span className={cn("text-title font-semibold tabular-nums", x.tone)}>{x.n}</span>
                      <span className="text-body-compact text-muted-foreground">{x.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-body-compact text-muted-foreground">
                  <span className="tabular-nums">{book.cases.rows.length}</span> rows read from {fileName}.{" "}
                  {docs ? "Read from the documents." : template ? "The file follows the template." : "Columns matched."}
                  {book.cases.discarded
                    ? ` ${book.cases.discarded} template guide row${book.cases.discarded === 1 ? "" : "s"} skipped.`
                    : ""}
                </p>
              </CardContent>
            </Card>
          )}
          {/* Additional details are a column of the file (PRY-1); a format fills only the
              cases whose row left it empty, so it is chosen here, against the real count. */}
          {coreMissing.length || !created.length ? null : (
            <DetailsFormatChoice
              formats={formats}
              formatId={formatId}
              setFormatId={setFormatId}
              own={
                typeof map.otherDetails === "number"
                  ? created.filter((x) => String(x.cells[map.otherDetails as number] ?? "").trim()).length
                  : 0
              }
              total={created.length}
            />
          )}
          {cannot.length && !coreMissing.length ? (
            <Card variant="raised">
              <CardHeader>
                <CardTitle className="text-body font-semibold">
                  {cannot.length === 1 ? "1 row can't be created" : `${cannot.length} rows can't be created`}
                </CardTitle>
                <CardDescription>
                  {cannot.length === 1 ? "It's" : "They're"} left out of this batch. Fix {cannot.length === 1 ? "it" : "them"} in
                  the downloaded file and upload {cannot.length === 1 ? "it" : "them"} as a new batch, or correct your file and
                  upload it again here.
                </CardDescription>
                <CardAction>
                  <Button variant="outline" size="sm" onClick={() => downloadRows(book, cannot, fileName)}>
                    <DownloadIcon data-icon="inline-start" aria-hidden />
                    Download these rows
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col">
                  {cannot.map((x) => (
                    <li
                      key={x.index}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3 last:border-b-0"
                    >
                      <span className="w-20 shrink-0 text-body-compact text-muted-foreground tabular-nums">Row {x.row}</span>
                      <span className="min-w-0 flex-1 text-body-compact">{x.who || "—"}</span>
                      <span className="inline-flex items-center gap-1.5 text-body-compact text-destructive-ink">
                        <CircleXIcon className="size-4 shrink-0" aria-hidden />
                        {x.why}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          {(() => {
            // Every row that becomes a case, filterable and searchable, 25 at a time (v8).
            const cell = (row: string[], k: string) => {
              const i = map[k];
              return typeof i === "number" ? row[i] || "" : i && typeof i === "object" ? i.every : "";
            };
            const blankSet = new Set(withBlanks.map((x) => x.row));
            const q = checkQ.trim().toLowerCase();
            const rows = created
              .filter((x) =>
                checkShow === "all" ? true : checkShow === "blanks" ? blankSet.has(x.row) : !blankSet.has(x.row),
              )
              .filter((x) => !q || ["accusedName", "reference", "chequeNumber"].some((k) => cell(x.cells, k).toLowerCase().includes(q)));
            const pages = Math.max(1, Math.ceil(rows.length / 25));
            const at = Math.min(checkPage, pages - 1);
            const page = rows.slice(at * 25, (at + 1) * 25);
            return (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <SegmentedControl
                    type="single"
                    value={checkShow}
                    onValueChange={(v) => {
                      if (!v) return;
                      setCheckShow(v as typeof checkShow);
                      setCheckPage(0);
                    }}
                    aria-label="Show rows"
                  >
                    <SegmentedControlItem value="all">All {created.length}</SegmentedControlItem>
                    <SegmentedControlItem value="clean">Ready {created.length - withBlanks.length}</SegmentedControlItem>
                    <SegmentedControlItem value="blanks">To fix {withBlanks.length}</SegmentedControlItem>
                  </SegmentedControl>
                  <div className="w-full sm:ml-auto sm:w-72">
                    <Label htmlFor="check-search" className="sr-only">
                      Search rows
                    </Label>
                    <InputGroup>
                      <InputGroupAddon>
                        <SearchIcon aria-hidden />
                      </InputGroupAddon>
                      <InputGroupInput
                        id="check-search"
                        type="search"
                        autoComplete="off"
                        value={checkQ}
                        onChange={(e) => {
                          setCheckQ(e.target.value);
                          setCheckPage(0);
                        }}
                        placeholder="Reference, accused or cheque"
                      />
                    </InputGroup>
                  </div>
                </div>
                <Card variant="raised" className="gap-0 p-2">
                  <div className="overflow-x-auto">
                    <Table className="border-separate border-spacing-0" aria-label="Rows that become cases">
                      <TableHeader>
                        <TableRow className={TABLE_HEAD_ROW}>
                          <TableHead className={TABLE_HEAD}>Row</TableHead>
                          <TableHead className={TABLE_HEAD}>Accused</TableHead>
                          <TableHead className={TABLE_HEAD}>Your reference</TableHead>
                          <TableHead className={cn(TABLE_HEAD, "text-right")}>Cheque amount</TableHead>
                          <TableHead className={TABLE_HEAD}>To fix</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className={tableBodyClass({ hover: false })}>
                        {page.map((x) => {
                          const blanks = withBlanks.find((w) => w.row === x.row)?.blanks ?? [];
                          return (
                            <TableRow key={x.row} className={tableRowClass({ hover: false })}>
                              <TableCell className={cn(TABLE_CELL, "text-muted-foreground tabular-nums")}>{x.row}</TableCell>
                              <TableCell className={cn(TABLE_CELL, "font-medium")}>{cell(x.cells, "accusedName") || "—"}</TableCell>
                              <TableCell className={cn(TABLE_CELL, "tabular-nums")}>{cell(x.cells, "reference") || "—"}</TableCell>
                              <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>{(() => {
                                const raw = cell(x.cells, "chequeAmount");
                                const n = Number(raw.replace(/[^\d.]/g, ""));
                                return raw ? (n ? money(n) : raw) : "—";
                              })()}</TableCell>
                              <TableCell className={cn(TABLE_CELL, "whitespace-normal")}>
                                {blanks.length ? (
                                  <span className="inline-flex items-start gap-1.5">
                                    <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-ink" />
                                    {blanks.join(", ")}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                    <CheckIcon aria-hidden className="size-4 text-success" />
                                    Nothing missing
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {rows.length > 25 ? (
                    <div className="flex items-center justify-between gap-3 px-2 pt-3 pb-1 text-body-compact text-muted-foreground">
                      <span className="tabular-nums">
                        {at * 25 + 1}–{Math.min(rows.length, (at + 1) * 25)} of {rows.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={at === 0} onClick={() => setCheckPage(at - 1)}>
                          <ChevronLeftIcon aria-hidden />
                        </Button>
                        <span className="tabular-nums">
                          Page {at + 1} of {pages}
                        </span>
                        <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={at >= pages - 1} onClick={() => setCheckPage(at + 1)}>
                          <ChevronRightIcon aria-hidden />
                        </Button>
                      </span>
                    </div>
                  ) : null}
                </Card>
              </>
            );
          })()}
        </FilingMain>
        {/* Two ways on, and only two: create the cases that can be, or correct the file
            and upload it again. Rows left out never join this batch later. */}
        <FilingFooter
          showSaveState={false}
          onBack={() => setStep(backFromReview)}
          extra={
            cannot.length ? (
              <Button variant="outline" size="lg" disabled={busy} onClick={() => setStep("file")}>
                Upload a corrected file
              </Button>
            ) : null
          }
          onContinue={coreMissing.length ? undefined : () => void create()}
          continueDisabled={busy || creating === 0}
          continueBlocked={coreMissing.length > 0}
          continueHint={coreMissing.length ? "Match the missing columns first" : undefined}
          continueLabel={
            busy
              ? "Creating batch…"
              : coreMissing.length
                ? "Create cases"
                : `Create ${creating} case${creating === 1 ? "" : "s"}`
          }
        />
      </>
    );
  }

  return null;
}
