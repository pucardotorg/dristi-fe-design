"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckCircle2Icon, DownloadIcon, FileSpreadsheetIcon } from "lucide-react";

import { CLIENTS, OFFICE_ADVOCATES } from "@/lib/bulk/clients";
import {
  autoMap,
  buildRequest,
  isMapped,
  followsTemplate,
  MUST_MAP,
  readWorkbook,
  unknownValues,
  type ColumnMap,
  type ValueMap,
  type Workbookish,
} from "@/lib/bulk/excel";
import { COLUMNS, LISTS, type ListName } from "@/lib/bulk/excel-spec";
import { cn } from "@/lib/utils";
import { TABLE_CELL, TABLE_HEAD, TABLE_HEAD_ROW, tableBodyClass, tableRowClass } from "@/components/chrome/table-plate";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { PAGE_GROUND, PAGE_GUTTER, PAGE_SUBTITLE, PAGE_TITLE } from "@/components/shell/page-frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { downloadTemplate } from "./batches-screen";
import { useGujarat } from "./court-guard";
import { FileDrop } from "./file-drop";

type Step = "setup" | "map" | "values" | "review";

const LIST_TITLE: Record<ListName, string> = {
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
  const [bars, setBars] = React.useState<string[]>([OFFICE_ADVOCATES[0].barNumber]);
  const [adr, setAdr] = React.useState<"yes" | "no">("no");
  const [file, setFile] = React.useState<File | null>(null);
  const [book, setBook] = React.useState<Workbookish | null>(null);
  const [map, setMap] = React.useState<ColumnMap>({});
  const [values, setValues] = React.useState<ValueMap>({});
  const [template, setTemplate] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const headers = book?.cases.headers ?? [];
  const unknown = book ? unknownValues(book.cases, map) : {};
  const unknownLists = Object.keys(unknown) as ListName[];
  const unmapped = MUST_MAP.filter((k) => !isMapped(map[k]));
  const valuesDone = unknownLists.every((l) => unknown[l]!.every((v) => values[l]?.[v]));

  const read = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const b = await readWorkbook(file);
      if (!b.cases.rows.length) throw new Error("No case rows were found in this file.");
      setBook(b);
      const m = autoMap(b.cases.headers);
      setMap(m);
      const follows = followsTemplate(b.cases.headers);
      setTemplate(follows);
      const u = unknownValues(b.cases, m);
      setStep(follows ? (Object.keys(u).length ? "values" : "review") : "map");
    } catch (e) {
      setError((e as Error).message || "This file could not be read.");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!book || !file) return;
    setBusy(true);
    setError(null);
    try {
      const client = CLIENTS.find((c) => c.id === clientId)!;
      const request = buildRequest(book, map, values, {
        complainant: client.complainant,
        barNumbers: OFFICE_ADVOCATES.map((a) => a.barNumber).filter((b) => bars.includes(b)),
        adr,
        fileName: file.name,
      });
      const res = await fetch("/api/bulk/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request, fileName: file.name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error([json.error, ...(json.details ?? [])].join(" "));
      router.push(`/filings/bulk/${json.batchId}?tab=documents`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const steps: { id: Step; label: string; shown: boolean }[] = [
    { id: "setup", label: "File and parties", shown: true },
    { id: "map", label: "Match columns", shown: !template || step === "map" },
    { id: "values", label: "Match values", shown: unknownLists.length > 0 },
    { id: "review", label: "Review", shown: true },
  ];

  if (!ready) return null;

  return (
    <div className={cn("flex w-full flex-1 flex-col gap-6", PAGE_GROUND, PAGE_GUTTER)}>
      <header className="flex flex-col gap-3">
        <Link href="/filings/bulk" className="flex w-fit items-center gap-1 text-body-compact text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden />
          Bulk filing
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className={cn(PAGE_TITLE, "text-foreground")}>Upload Excel</h1>
          <p className={PAGE_SUBTITLE}>Each upload becomes its own batch. Cases arrive as drafts; documents are added after.</p>
        </div>
        <ol className="flex flex-wrap gap-2" aria-label="Steps">
          {steps
            .filter((s) => s.shown)
            .map((s, i) => (
              <li key={s.id}>
                <Badge variant={s.id === step ? "default" : "outline"} aria-current={s.id === step ? "step" : undefined}>
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

      {step === "setup" ? (
        <Card className={cn(PANEL_CLASS, "max-w-3xl")}>
          <CardHeader>
            <CardTitle className="text-body font-semibold">The same for every case in the file</CardTitle>
            <CardDescription>The sheet carries only what changes from case to case: the accused, the cheque and the notice.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="client">Complainant</FieldLabel>
              <NativeSelect id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {CLIENTS.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.complainant.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-body-compact font-medium">Advocates</legend>
              <span className="text-caption text-muted-foreground">You, and advocates from your People page. Tick everyone who appears for the complainant.</span>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {OFFICE_ADVOCATES.map((a) => {
                  const id = `adv-${a.barNumber}`;
                  return (
                    <li key={a.barNumber}>
                      <label htmlFor={id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-accent">
                        <Checkbox
                          id={id}
                          aria-label={`${a.name}${a.you ? " (you)" : ""}, ${a.barNumber}`}
                          checked={bars.includes(a.barNumber)}
                          // The filing advocate stays on record; the others are optional.
                          disabled={a.you}
                          onCheckedChange={(v) =>
                            setBars((prev) => (v === true ? [...prev, a.barNumber] : prev.filter((b) => b !== a.barNumber)))
                          }
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-body-compact">
                            {a.name}
                            {a.you ? <span className="text-muted-foreground"> (you)</span> : null}
                          </span>
                          <span className="text-caption text-muted-foreground tabular-nums">{a.barNumber}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            <Field className="gap-1.5">
              <FieldLabel>Willing to settle through ADR</FieldLabel>
              <RadioGroup value={adr} onValueChange={(v) => setAdr(v as "yes" | "no")} className="flex gap-6">
                {(["no", "yes"] as const).map((v) => (
                  <label key={v} htmlFor={`adr-${v}`} className="flex min-h-10 cursor-pointer items-center gap-2 text-body-compact">
                    <RadioGroupItem value={v} id={`adr-${v}`} aria-label={v === "yes" ? "Yes" : "No"} />
                    {v === "yes" ? "Yes" : "No"}
                  </label>
                ))}
              </RadioGroup>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="sheet">Excel file</FieldLabel>
              <FileDrop
                id="sheet"
                accept=".xlsx,.csv"
                files={file ? [file] : []}
                onFiles={(f) => setFile(f[0] ?? null)}
                prompt="Drag your Excel file here"
                hint=".xlsx or .csv"
              />
              <span className="text-caption text-muted-foreground">
                The template&apos;s columns go straight in. Any other layout is matched on the next step.
              </span>
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => void downloadTemplate()}>
                <DownloadIcon data-icon="inline-start" aria-hidden />
                Download template
              </Button>
              <Button className="sm:ml-auto" disabled={!file || busy} onClick={() => void read()}>
                {busy ? <Spinner data-icon="inline-start" /> : <FileSpreadsheetIcon data-icon="inline-start" aria-hidden />}
                Read file
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "map" && book ? (
        <Card className={PANEL_CLASS}>
          <CardHeader>
            <CardTitle className="text-body font-semibold">Match your columns</CardTitle>
            <CardDescription>
              This file is not laid out like the template. Choose which of its columns holds each field. Fields already matched
              were found by their exact name.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <Table className="border-separate border-spacing-0" aria-label="Column matching">
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW}>
                    <TableHead className={cn(TABLE_HEAD, "pl-4")}>Field</TableHead>
                    <TableHead className={TABLE_HEAD}>Required</TableHead>
                    <TableHead className={TABLE_HEAD}>Your column</TableHead>
                    <TableHead className={cn(TABLE_HEAD, "pr-4")}>First value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={tableBodyClass({ hover: false })}>
                  {COLUMNS.map((c) => {
                    const i = map[c.key];
                    const missing = MUST_MAP.includes(c.key) && !isMapped(i);
                    const selectValue = typeof i === "number" ? String(i) : i && typeof i === "object" ? `every:${i.every}` : "";
                    return (
                      <TableRow key={c.key} className={tableRowClass({ hover: false })}>
                        <TableCell className={cn(TABLE_CELL, "pl-4 whitespace-normal")}>
                          <span className="font-medium">{c.header}</span>
                          <span className="block text-caption text-muted-foreground tabular-nums">{c.field}</span>
                        </TableCell>
                        <TableCell className={cn(TABLE_CELL, "max-w-48 whitespace-normal text-caption", missing ? "text-warning-ink" : "text-muted-foreground")}>
                          {c.required}
                        </TableCell>
                        <TableCell className={cn(TABLE_CELL, "min-w-56")}>
                          <NativeSelect
                            aria-label={`Column for ${c.header}`}
                            value={selectValue}
                            onChange={(e) => {
                              const v = e.target.value;
                              setMap((m) => ({
                                ...m,
                                [c.key]: v === "" ? null : v.startsWith("every:") ? { every: v.slice(6) } : Number(v),
                              }));
                            }}
                          >
                            <NativeSelectOption value="">Not in my file</NativeSelectOption>
                            {headers.map((h, k) => (
                              <NativeSelectOption key={`${h}-${k}`} value={String(k)}>
                                {h || `Column ${k + 1}`}
                              </NativeSelectOption>
                            ))}
                            {c.list
                              ? LISTS[c.list].map((o) => (
                                  <NativeSelectOption key={o.value} value={`every:${o.label}`}>
                                    Every row: {o.label}
                                  </NativeSelectOption>
                                ))
                              : null}
                          </NativeSelect>
                        </TableCell>
                        <TableCell className={cn(TABLE_CELL, "pr-4 max-w-56 truncate text-muted-foreground")}>
                          {typeof i === "number" ? book.cases.rows[0]?.[i] || "—" : i && typeof i === "object" ? i.every : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-caption text-muted-foreground tabular-nums">
                {unmapped.length ? `${unmapped.length} required field${unmapped.length === 1 ? "" : "s"} still to match` : "Every required field is matched"}
              </span>
              <Button variant="outline" className="sm:ml-auto" onClick={() => setStep("setup")}>
                Back
              </Button>
              <Button disabled={unmapped.length > 0} onClick={() => setStep(unknownLists.length ? "values" : "review")}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "values" && book ? (
        <Card className={cn(PANEL_CLASS, "max-w-3xl")}>
          <CardHeader>
            <CardTitle className="text-body font-semibold">Match your values</CardTitle>
            <CardDescription>These values are not in the court&apos;s lists. Choose what each one means; every row using it follows.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {unknownLists.map((l) => (
              <section key={l} className="flex flex-col gap-3">
                <h3 className="text-body-compact font-semibold">{LIST_TITLE[l]}</h3>
                {unknown[l]!.map((raw) => (
                  <Field key={raw} orientation="horizontal" className="flex-col gap-1.5 sm:flex-row sm:items-center">
                    <FieldLabel htmlFor={`v-${l}-${raw}`} className="sm:w-56">
                      &ldquo;{raw}&rdquo;
                    </FieldLabel>
                    <NativeSelect
                      id={`v-${l}-${raw}`}
                      value={values[l]?.[raw] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [l]: { ...(v[l] ?? {}), [raw]: e.target.value } }))}
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
              <Button variant="outline" className="sm:ml-auto" onClick={() => setStep(template ? "setup" : "map")}>
                Back
              </Button>
              <Button disabled={!valuesDone} onClick={() => setStep("review")}>
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
              <CheckCircle2Icon className="size-5 text-success-ink" aria-hidden />
              <span className="tabular-nums">{book.cases.rows.length}</span> cases read from {file?.name}
            </CardTitle>
            <CardDescription>
              {template ? "The file follows the template." : "Columns matched."}
              {book.cases.discarded
                ? ` ${book.cases.discarded} template guide row${book.cases.discarded === 1 ? "" : "s"} (format or example) discarded.`
                : ""}
              {book.extraCheques?.rows.length ? ` ${book.extraCheques.rows.length} extra cheques.` : ""}
              {book.extraAccused?.rows.length ? ` ${book.extraAccused.rows.length} extra accused.` : ""} The filing checks run once the
              batch is created.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <Table className="border-separate border-spacing-0" aria-label="First rows">
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW}>
                    {["reference", "accusedName", "chequeNumber", "chequeAmount", "returnReason", "dispatchDate"].map((k) => (
                      <TableHead key={k} className={cn(TABLE_HEAD, k === "reference" && "pl-4")}>
                        {COLUMNS.find((c) => c.key === k)!.header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className={tableBodyClass({ hover: false })}>
                  {book.cases.rows.slice(0, 8).map((row, n) => (
                    <TableRow key={n} className={tableRowClass({ hover: false })}>
                      {["reference", "accusedName", "chequeNumber", "chequeAmount", "returnReason", "dispatchDate"].map((k) => {
                        const i = map[k];
                        return (
                          <TableCell key={k} className={cn(TABLE_CELL, "tabular-nums", k === "reference" && "pl-4 font-medium")}>
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
              <span className="text-caption text-muted-foreground tabular-nums">and {book.cases.rows.length - 8} more</span>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="sm:ml-auto" onClick={() => setStep(unknownLists.length ? "values" : template ? "setup" : "map")}>
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
  );
}
