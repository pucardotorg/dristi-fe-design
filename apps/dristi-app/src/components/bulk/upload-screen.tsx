"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  } from "lucide-react";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import type { CaseExtraction } from "@/lib/bulk/case-doc";
import { apiComplainantOf, partiesOf } from "@/lib/bulk/parties";
import { useFiling } from "@/lib/filing/store";
import {
  autoMap,
  buildRequest,
  followsTemplate,
  instancesIn,
  readWorkbook,
  unknownValues,
  unmatchedRequired,
  type ColumnMap,
  type InstanceCounts,
  type ValueMap,
  type Workbookish,
} from "@/lib/bulk/excel";
import { COLUMNS, GROUPS, LISTS, type ListName } from "@/lib/bulk/excel-spec";
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
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
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

import { ColumnMapping } from "./column-mapping";
import { useGujarat } from "./court-guard";
import {
  defaultFormat,
  formatForFiler,
  readDetailsFormats,
  serverDetailsFormats,
  subscribeToDetailsFormats,
} from "@/lib/filing/details-formats";
import { BatchParties, type Adr } from "./batch-parties";
import { FileDrop } from "./file-drop";
import { bulkFetch } from "./api";
import { setupHref, uploadHref, useReportUploadState, type UploadStep } from "./setup-flow";
import { StatusMark } from "@/components/feedback";


/** The demo spreadsheets the upload offers, from `public/samples/` (`scripts/bulk-demo-files.mts`). */
const SAMPLES = [
  { key: "tata-capital-bulk-filing-template.xlsx", label: "Sample file 1: template format" },
  { key: "tata-capital-recovery-mis.xlsx", label: "Sample file 2: custom format" },
];

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
    <Card className={cn(PANEL_CLASS, "max-w-3xl gap-0 py-0")}>
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
  const [adr, setAdr] = React.useState<Adr>("no");
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
  const step: UploadStep = book && asked && ["map", "values", "review"].includes(asked) ? asked : "file";
  const setStep = (s: UploadStep) => router.push(uploadHref(setupId, s, search.get("ai")));
  const [map, setMap] = React.useState<ColumnMap>({});
  const [counts, setCounts] = React.useState<InstanceCounts>({});
  const [values, setValues] = React.useState<ValueMap>({});
  const [template, setTemplate] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // A sample spreadsheet, fetched and chosen as if it had been dropped.
  const [sampling, setSampling] = React.useState<string | null>(null);
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
  // "2 accused, 3 cheques, 1 witness": the sections the file repeats, for the review.
  const repeatsFound = React.useMemo(() => {
    if (!book) return "";
    const inst = instancesIn(book.cases.headers, counts);
    return GROUPS.filter((g) => g.repeats && !g.parent)
      .map((g) => ({ g, n: inst[g.id].length }))
      .filter(({ g, n }) => n > (g.always ? 1 : 0))
      .map(
        ({ g, n }) =>
          `${g.label.toLowerCase()} up to ${g.first > 1 ? n + 1 : n}`,
      )
      .join(", ");
  }, [book, counts]);
  const unknown = book ? unknownValues(book.cases, map, counts) : {};
  const unknownLists = Object.keys(unknown) as ListName[];
  // Required fields no column fills: every case arrives without them.
  const missing = book && !docs ? unmatchedRequired(book.cases.headers, map) : [];
  const valuesDone = unknownLists.every((l) =>
    unknown[l]!.every((v) => values[l]?.[v]),
  );

  // The sections rail lists matching only where this file needs it.
  const report = useReportUploadState();
  const matchColumns = !!book && !(template || docs);
  const matchValues = unknownLists.length > 0;
  React.useEffect(() => {
    report({ read: !!book, matchColumns, matchValues, documents: docs });
  }, [report, book, matchColumns, matchValues, docs]);

  const read = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (files.length > 1 && !docs)
        throw new Error("Upload one Excel file, or Word files and PDFs only.");
      const b = docs ? await readDocuments() : await readWorkbook(file);
      if (!b.cases.rows.length)
        throw new Error("No case rows were found in this file.");
      setBook(b);
      const m = autoMap(b.cases.headers);
      setMap(m);
      setCounts({});
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
      const request = buildRequest(
        book,
        map,
        values,
        {
          complainant: apiComplainantOf(parties),
          barNumbers: parties.advocates.map((a) => a.barNumber),
          adr,
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
      router.push(`/filings/bulk/${json.batchId}?tab=documents`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!ready) return null;

  const errorNotice = error ? (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;
  const backFromReview: UploadStep = unknownLists.length ? "values" : template || docs ? "file" : "map";
  const PREVIEW = ["reference", "accusedName", "chequeNumber", "chequeAmount", "returnReason", "dispatchDate"];

  if (step === "file")
    return (
      <>
        <FilingMain>
          <FilingPageHeader
            title={ai === "on" ? "Excel file or case documents" : "Excel file"}
            description="One row per case. Each upload becomes its own batch; the cases arrive as drafts and their documents are added after."
          />
          {errorNotice}
          {reading ? (
            <ReadingCard rows={reading} />
          ) : (
            <Card className={PANEL_CLASS}>
              <CardContent className="flex flex-col gap-6">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="sheet">
                    {ai === "on" ? "Excel file, or one document per case" : "Excel file"}
                  </FieldLabel>
                  <FileDrop
                    id="sheet"
                    accept={ai === "on" ? ".xlsx,.csv,.docx,.pdf,.txt" : ".xlsx,.csv"}
                    multiple={ai === "on"}
                    files={files}
                    onFiles={setFiles}
                    prompt={ai === "on" ? "Drag your Excel file or case documents here" : "Drag your Excel file here"}
                    hint={ai === "on" ? ".xlsx or .csv, or Word and PDF files" : ".xlsx or .csv"}
                  />
                  <span className="text-caption text-muted-foreground">
                    The template&apos;s columns go straight in. Any other layout is matched on the
                    next step.
                  </span>
                </Field>
                {/* Demo: the two sample spreadsheets, one click away instead of on disk. */}
                <div className="flex flex-col gap-2">
                  <span className="text-body-compact text-muted-foreground">Or try a sample file</span>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLES.map((x) => (
                      <Button
                        key={x.key}
                        variant="outline"
                        disabled={busy || sampling !== null}
                        onClick={() => void chooseSample(x.key)}
                      >
                        {sampling === x.key ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <FileSpreadsheetIcon data-icon="inline-start" aria-hidden />
                        )}
                        {x.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button variant="outline" className="w-fit" onClick={() => void downloadTemplate()}>
                  <DownloadIcon data-icon="inline-start" aria-hidden />
                  Download template
                </Button>
              </CardContent>
            </Card>
          )}
          <Card className={PANEL_CLASS}>
            <CardHeader>
              <CardTitle className="text-body font-semibold">The same for every case in the file</CardTitle>
              <CardDescription>
                Like the complainants and advocates, these are set once here.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <BatchParties adr={adr} setAdr={setAdr} formatId={formatId} setFormatId={setFormatId} />
            </CardContent>
          </Card>
        </FilingMain>
        <FilingFooter
          showSaveState={false}
          backHref={setupHref(setupId, "documents")}
          onContinue={() => void read()}
          continueDisabled={!file || busy}
          continueLabel={busy ? "Reading…" : "Continue"}
        />
      </>
    );

  if (step === "map" && book)
    return (
      <>
        <FilingMain width="wide">
          <FilingPageHeader
            title="Match columns"
            description="This file is not laid out like the template. Pick the column that holds each field. Fields already matched were found by name."
          />
          {errorNotice}
          <ColumnMapping
            headers={headers}
            rows={book.cases.rows}
            map={map}
            onChange={setMap}
            counts={counts}
            onCounts={setCounts}
          />
        </FilingMain>
        {/* Continue always goes on: a field left on Skip is filled manually later, on
            Case details, where each case's gaps are held with their fix in place. */}
        <FilingFooter
          showSaveState={false}
          onBack={() => setStep("file")}
          onContinue={() => setStep(unknownLists.length ? "values" : "review")}
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
            <Card key={l} className={PANEL_CLASS}>
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

  if (step === "review" && book)
    return (
      <>
        <FilingMain width="wide">
          <FilingPageHeader
            title="Review"
            description={
              <>
                <span className="tabular-nums">{book.cases.rows.length}</span> cases read from {fileName}.{" "}
                {docs ? "Read from the documents." : template ? "The file follows the template." : "Columns matched."}
                {book.cases.discarded
                  ? ` ${book.cases.discarded} template guide row${book.cases.discarded === 1 ? "" : "s"} (format or example) discarded.`
                  : ""}
                {repeatsFound ? ` Repeated sections: ${repeatsFound}.` : ""} The filing checks run once
                the batch is created.
              </>
            }
          />
          {errorNotice}
          {missing.length ? (
            <Alert variant="warning">
              <CircleAlertIcon aria-hidden />
              <AlertTitle>
                {missing.length} required field{missing.length === 1 ? " is" : "s are"} not in your file
              </AlertTitle>
              <AlertDescription>
                Every case will arrive without{" "}
                {new Intl.ListFormat("en", { type: "conjunction" }).format(
                  missing.map((c) => c.header.toLowerCase()),
                )}
                . Each case stays in draft until you enter {missing.length === 1 ? "it" : "them"} on
                its Case details.
              </AlertDescription>
            </Alert>
          ) : null}
          <Card className={PANEL_CLASS}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-body font-semibold">
                <CheckCircle2Icon className="size-5 text-success-ink" aria-hidden />
                First cases
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="overflow-x-auto">
                <Table className="border-separate border-spacing-0" aria-label="First rows">
                  <TableHeader>
                    <TableRow className={TABLE_HEAD_ROW}>
                      {PREVIEW.map((k) => (
                        <TableHead key={k} className={cn(TABLE_HEAD, k === "reference" && "pl-4")}>
                          {COLUMNS.find((c) => c.key === k)!.header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className={tableBodyClass({ hover: false })}>
                    {book.cases.rows.slice(0, 8).map((row, n) => (
                      <TableRow key={n} className={tableRowClass({ hover: false })}>
                        {PREVIEW.map((k) => {
                          const i = map[k];
                          return (
                            <TableCell
                              key={k}
                              className={cn(TABLE_CELL, "tabular-nums", k === "reference" && "pl-4 font-medium")}
                            >
                              {typeof i === "number" ? row[i] || "—" : i && typeof i === "object" ? i.every : "—"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {book.cases.rows.length > 8 ? (
                <span className="text-caption text-muted-foreground tabular-nums">
                  and {book.cases.rows.length - 8} more
                </span>
              ) : null}
            </CardContent>
          </Card>
        </FilingMain>
        <FilingFooter
          showSaveState={false}
          onBack={() => setStep(backFromReview)}
          onContinue={() => void create()}
          continueDisabled={busy}
          continueLabel={busy ? "Creating batch…" : `Create batch of ${book.cases.rows.length}`}
        />
      </>
    );

  return null;
}
