"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileTextIcon,
  XCircleIcon,
} from "lucide-react";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import type { CaseExtraction } from "@/lib/bulk/case-doc";
import { CLIENTS, OFFICE_ADVOCATES } from "@/lib/bulk/clients";
import {
  autoMap,
  buildRequest,
  followsTemplate,
  instancesIn,
  readWorkbook,
  unknownValues,
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
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_SUBTITLE,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

import { ColumnMapping } from "./column-mapping";
import { useGujarat } from "./court-guard";
import { BatchParties } from "./batch-parties";
import { FileDrop } from "./file-drop";

type Step = "setup" | "map" | "values" | "review";

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
      <CardHeader className="gap-3 px-6 py-5">
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
                <CheckCircle2Icon
                  className="size-5 text-success-ink"
                  aria-label="Read"
                />
              ) : r.state === "reading" ? (
                <Spinner className="size-4 text-primary" aria-label="Reading" />
              ) : r.state === "failed" ? (
                <XCircleIcon
                  className="size-5 text-destructive-ink"
                  aria-label="Not read"
                />
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
 * Excel upload: choose the complainant and advocate once, upload the sheet, map its
 * columns only if it is not the template, map list values only if some are not in the
 * lists, then create the batch. Every case lands as a draft; documents come after.
 */
export function UploadScreen() {
  const ready = useGujarat();
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("setup");
  const [clientId, setClientId] = React.useState(CLIENTS[0].id);
  // You first, then whoever else is ticked, in the People page's order.
  const [bars, setBars] = React.useState<string[]>([
    OFFICE_ADVOCATES[0].barNumber,
  ]);
  const [adr, setAdr] = React.useState<"yes" | "no">("no");
  const [files, setFiles] = React.useState<File[]>([]);
  const file = files[0] ?? null;
  // With AI on, a Word file or PDF per case can stand in for the sheet: each is read into
  // the template's columns, and the rest of the upload is the same.
  const { profile } = useCourt();
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
  const [map, setMap] = React.useState<ColumnMap>({});
  const [counts, setCounts] = React.useState<InstanceCounts>({});
  const [values, setValues] = React.useState<ValueMap>({});
  const [template, setTemplate] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
  const valuesDone = unknownLists.every((l) =>
    unknown[l]!.every((v) => values[l]?.[v]),
  );

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
          fetch("/api/bulk/extract", { method: "POST", body: form }),
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
      const client = CLIENTS.find((c) => c.id === clientId)!;
      const request = buildRequest(
        book,
        map,
        values,
        {
          complainant: client.complainant,
          barNumbers: OFFICE_ADVOCATES.map((a) => a.barNumber).filter((b) =>
            bars.includes(b),
          ),
          adr,
          fileName,
        },
        counts,
      );
      const res = await fetch("/api/bulk/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          docs
            ? { request, fileName, from: "documents", originals }
            : { request, fileName },
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

  const steps: { id: Step; label: string; shown: boolean }[] = [
    { id: "setup", label: "File and parties", shown: true },
    {
      id: "map",
      label: "Match columns",
      shown: !(template || docs) || step === "map",
    },
    { id: "values", label: "Match values", shown: unknownLists.length > 0 },
    { id: "review", label: "Review", shown: true },
  ];

  if (!ready) return null;

  return (
    // The footer sits outside the page's padding, as in the single filing: flush with the
    // screen's edges and its foot when it sticks.
    <div className={cn("flex w-full flex-1 flex-col", PAGE_GROUND)}>
      <div className={cn("flex w-full flex-1 flex-col gap-6", PAGE_GUTTER)}>
        <header className="flex flex-col gap-3">
          <Link
            href="/filings/bulk"
            className="flex w-fit items-center gap-1 text-body-compact text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            Bulk filing
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className={cn(PAGE_TITLE, "text-foreground")}>
              {ai === "on" ? "Upload cases" : "Upload Excel"}
            </h1>
            <p className={PAGE_SUBTITLE}>
              Each upload becomes its own batch. Cases arrive as drafts;
              documents are added after.
            </p>
          </div>
          <ol className="flex flex-wrap gap-2" aria-label="Steps">
            {steps
              .filter((s) => s.shown)
              .map((s, i) => (
                <li key={s.id}>
                  <Badge
                    variant={s.id === step ? "default" : "outline"}
                    aria-current={s.id === step ? "step" : undefined}
                  >
                    {i + 1}. {s.label}
                  </Badge>
                </li>
              ))}
          </ol>
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === "setup" && reading ? (
          <ReadingCard rows={reading} />
        ) : step === "setup" ? (
          <Card className={cn(PANEL_CLASS, "max-w-3xl")}>
            <CardHeader>
              <CardTitle className="text-body font-semibold">
                The same for every case in the file
              </CardTitle>
              <CardDescription>
                The sheet carries only what changes from case to case: the
                accused, the cheque and the notice.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <BatchParties
                clientId={clientId}
                setClientId={setClientId}
                bars={bars}
                setBars={setBars}
                adr={adr}
                setAdr={setAdr}
              />
              <Field className="gap-1.5">
                <FieldLabel htmlFor="sheet">
                  {ai === "on"
                    ? "Excel file, or one document per case"
                    : "Excel file"}
                </FieldLabel>
                <FileDrop
                  id="sheet"
                  accept={
                    ai === "on" ? ".xlsx,.csv,.docx,.pdf,.txt" : ".xlsx,.csv"
                  }
                  multiple={ai === "on"}
                  files={files}
                  onFiles={setFiles}
                  prompt={
                    ai === "on"
                      ? "Drag your Excel file or case documents here"
                      : "Drag your Excel file here"
                  }
                  hint={
                    ai === "on"
                      ? ".xlsx or .csv, or Word and PDF files"
                      : ".xlsx or .csv"
                  }
                />
                <span className="text-caption text-muted-foreground">
                  The template&apos;s columns go straight in. Any other layout
                  is matched on the next step.
                </span>
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => void downloadTemplate()}
                >
                  <DownloadIcon data-icon="inline-start" aria-hidden />
                  Download template
                </Button>
                <Button
                  className="sm:ml-auto"
                  disabled={!file || busy}
                  onClick={() => void read()}
                >
                  {busy ? <Spinner data-icon="inline-start" /> : null}
                  Next
                  {busy ? null : (
                    <ArrowRightIcon data-icon="inline-end" aria-hidden />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === "map" && book ? (
          // No outer card: the sections are cards on the page, as in the single filing.
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-title-s font-semibold">Match your columns</h2>
              <p className="text-body-compact text-muted-foreground">
                This file is not laid out like the template. Pick the column
                that holds each field. Fields already matched were found by
                name.
              </p>
            </div>
            <div className="flex flex-col gap-6">
              <ColumnMapping
                headers={headers}
                rows={book.cases.rows}
                map={map}
                onChange={setMap}
                counts={counts}
                onCounts={setCounts}
              />
            </div>
          </div>
        ) : null}

        {step === "values" && book ? (
          <Card className={cn(PANEL_CLASS, "max-w-3xl")}>
            <CardHeader>
              <CardTitle className="text-body font-semibold">
                Match your values
              </CardTitle>
              <CardDescription>
                These values in your sheet are not in the ON Courts lists.
                Choose what each one means; every row using it follows.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {unknownLists.map((l) => (
                <section key={l} className="flex flex-col gap-3">
                  <h3 className="text-body-compact font-semibold">
                    {LIST_TITLE[l]}
                  </h3>
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
                </section>
              ))}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="sm:ml-auto"
                  onClick={() => setStep(template ? "setup" : "map")}
                >
                  Back
                </Button>
                <Button
                  disabled={!valuesDone}
                  onClick={() => setStep("review")}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === "review" && book ? (
          <Card className={PANEL_CLASS}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-body font-semibold">
                <CheckCircle2Icon
                  className="size-5 text-success-ink"
                  aria-hidden
                />
                <span className="tabular-nums">{book.cases.rows.length}</span>{" "}
                cases read from {fileName}
              </CardTitle>
              <CardDescription>
                {docs
                  ? "Read from the documents."
                  : template
                    ? "The file follows the template."
                    : "Columns matched."}
                {book.cases.discarded
                  ? ` ${book.cases.discarded} template guide row${book.cases.discarded === 1 ? "" : "s"} (format or example) discarded.`
                  : ""}
                {repeatsFound ? ` Repeated sections: ${repeatsFound}.` : ""} The
                filing checks run once the batch is created.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="overflow-x-auto">
                <Table
                  className="border-separate border-spacing-0"
                  aria-label="First rows"
                >
                  <TableHeader>
                    <TableRow className={TABLE_HEAD_ROW}>
                      {[
                        "reference",
                        "accusedName",
                        "chequeNumber",
                        "chequeAmount",
                        "returnReason",
                        "dispatchDate",
                      ].map((k) => (
                        <TableHead
                          key={k}
                          className={cn(
                            TABLE_HEAD,
                            k === "reference" && "pl-4",
                          )}
                        >
                          {COLUMNS.find((c) => c.key === k)!.header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className={tableBodyClass({ hover: false })}>
                    {book.cases.rows.slice(0, 8).map((row, n) => (
                      <TableRow
                        key={n}
                        className={tableRowClass({ hover: false })}
                      >
                        {[
                          "reference",
                          "accusedName",
                          "chequeNumber",
                          "chequeAmount",
                          "returnReason",
                          "dispatchDate",
                        ].map((k) => {
                          const i = map[k];
                          return (
                            <TableCell
                              key={k}
                              className={cn(
                                TABLE_CELL,
                                "tabular-nums",
                                k === "reference" && "pl-4 font-medium",
                              )}
                            >
                              {typeof i === "number"
                                ? row[i] || "—"
                                : i && typeof i === "object"
                                  ? i.every
                                  : "—"}
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="sm:ml-auto"
                  onClick={() =>
                    setStep(
                      unknownLists.length
                        ? "values"
                        : template
                          ? "setup"
                          : "map",
                    )
                  }
                >
                  Back
                </Button>
                <Button disabled={busy} onClick={() => void create()}>
                  {busy ? <Spinner data-icon="inline-start" /> : null}
                  Create batch of {book.cases.rows.length}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
      {/* The filing flow's own footer, kept at the foot of the screen: the list is long.
          Continue always goes on: a field left on Skip is filled manually later, on
          Case details, where each case's gaps are held with their fix in place. */}
      {step === "map" && book ? (
        <FilingFooter
          showSaveState={false}
          onBack={() => setStep("setup")}
          onContinue={() => setStep(unknownLists.length ? "values" : "review")}
        />
      ) : null}
    </div>
  );
}
