"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  SparklesIcon,
} from "lucide-react";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import type { CaseExtraction } from "@/lib/bulk/case-doc";
import { CLIENTS, OFFICE_ADVOCATES } from "@/lib/bulk/clients";
import type { ApiBatchRequest } from "@/lib/bulk/contract";
import {
  autoMap,
  buildRequest,
  firstInstance,
  instancesIn,
  MUST_MAP,
} from "@/lib/bulk/excel";
import {
  COLUMNS,
  GROUPS,
  LISTS,
  suffixFor,
  type Column,
  type Group,
  type GroupId,
  type Instance,
} from "@/lib/bulk/excel-spec";
import { cn } from "@/lib/utils";
import { useCourt } from "@/components/court/court-provider";
import { FilingFooter } from "@/components/filing/filing-footer";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { RAIL_ROW, RAIL_ROW_ACTIVE } from "@/components/filing/sections-rail";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_SUBTITLE,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";

import { BatchParties } from "./batch-parties";
import { SKIP } from "./column-mapping";
import { useGujarat } from "./court-guard";
import { FileDrop } from "./file-drop";

type Decision = "todo" | "confirmed" | "aside";

type Review = {
  extraction: CaseExtraction;
  /** The values as the filer has them now, by sheet header. */
  values: Record<string, string>;
  decision: Decision;
};

/** Sections in the single filing's order, with what each instance is called. */
const ORDER: GroupId[] = [
  "case",
  "complainant",
  "accused",
  "address",
  "person",
  "cheque",
  "notice",
  "jurisdiction",
  "otherCase",
  "witness",
];

const keyOf = (c: Column, g: Group, i: Instance) =>
  `${c.header}${suffixFor(g, i)}`;

const sectionTitle = (g: Group, i: Instance, many: boolean) =>
  g.parent
    ? `${g.label} ${i[1]}${many ? `, accused ${i[0]}` : ""}`
    : g.repeats
      ? `${g.label} ${i[0]}`
      : g.label;

/**
 * The AI-assisted upload: one Word file or PDF per case. The documents are read for the
 * case's fields (a stand-in for the model, `lib/bulk/case-doc.ts`), and every case is then
 * reviewed on its own, against its document, before any batch is made. With AI off or
 * unavailable the route is closed and the Excel upload is offered instead.
 */
export function DocumentsScreen() {
  const ready = useGujarat();
  const router = useRouter();
  const params = useSearchParams();
  const { profile } = useCourt();
  const ai = aiModeFrom(params.get("ai"), profile.aiMode);

  const [clientId, setClientId] = React.useState(CLIENTS[0].id);
  const [bars, setBars] = React.useState<string[]>([
    OFFICE_ADVOCATES[0].barNumber,
  ]);
  const [adr, setAdr] = React.useState<"yes" | "no">("no");
  const [files, setFiles] = React.useState<File[]>([]);
  const [reviews, setReviews] = React.useState<Review[] | null>(null);
  const [at, setAt] = React.useState(0);
  const [showAll, setShowAll] = React.useState(false);
  const [focusLine, setFocusLine] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      form.append("ai", ai);
      const res = await fetch("/api/bulk/extract", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error ?? "The documents could not be read.");
      const list = (json.cases as CaseExtraction[]).map((x): Review => {
        const values = Object.fromEntries(
          Object.entries(x.fields).map(([k, v]) => [k, v.value]),
        );
        // No reference in the document: the file's name stands in, to be checked.
        if (!values["Case reference"]) {
          values["Case reference"] = x.fileName.replace(/\.[^.]+$/, "");
          x.fields["Case reference"] = {
            value: values["Case reference"],
            confidence: "check",
            line: null,
            note: "Not in the document: taken from the file name",
          };
        }
        return { extraction: x, values, decision: "todo" };
      });
      setReviews(list);
      setAt(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!reviews) return;
    setBusy(true);
    setError(null);
    try {
      const client = CLIENTS.find((c) => c.id === clientId)!;
      const batch = {
        complainant: client.complainant,
        barNumbers: OFFICE_ADVOCATES.map((a) => a.barNumber).filter((b) =>
          bars.includes(b),
        ),
        adr,
        fileName: `${reviews.filter((r) => r.decision === "confirmed").length} case documents`,
      };
      // Each case is built as a one-row sheet in the template's layout, so it passes the
      // same rules as an Excel upload.
      const built = reviews
        .filter((r) => r.decision === "confirmed")
        .map((r) => {
          const entries = Object.entries(r.values).filter(([, v]) => v.trim());
          const headers = entries.map(([k]) => k);
          return buildRequest(
            {
              cases: {
                name: "Cases",
                headers,
                rows: [entries.map(([, v]) => v)],
                discarded: 0,
              },
            },
            autoMap(headers),
            {},
            { ...batch, fileName: r.extraction.fileName },
          );
        });
      const request: ApiBatchRequest = {
        ...built[0],
        cases: built.flatMap((b) => b.cases),
      };
      const res = await fetch("/api/bulk/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request,
          fileName: batch.fileName,
          from: "documents",
        }),
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

  const current = reviews?.[at] ?? null;
  const decide = (decision: Decision) => {
    if (!reviews) return;
    const next = reviews.map((r, k) => (k === at ? { ...r, decision } : r));
    setReviews(next);
    setShowAll(false);
    setFocusLine(null);
    // On to the next case still to review, after this one first.
    const order = [...next.keys()]
      .slice(at + 1)
      .concat([...next.keys()].slice(0, at));
    const todo = order.find((k) => next[k].decision === "todo");
    if (todo !== undefined) setAt(todo);
  };
  const confirmed =
    reviews?.filter((r) => r.decision === "confirmed").length ?? 0;
  const allDecided = !!reviews && reviews.every((r) => r.decision !== "todo");

  return (
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
            <h1
              className={cn(
                PAGE_TITLE,
                "flex items-center gap-2 text-foreground",
              )}
            >
              Upload case documents
              <Badge variant="info">
                <SparklesIcon data-icon="inline-start" aria-hidden />
                AI
              </Badge>
            </h1>
            <p className={PAGE_SUBTITLE}>
              One Word file or PDF per case. AI reads each one; you check every
              case before the batch is made.
            </p>
          </div>
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {ai !== "on" ? (
          <Alert>
            <AlertTitle>
              {ai === "off" ? "AI is turned off" : "AI reading is unavailable"}
            </AlertTitle>
            <AlertDescription>
              <span>Case documents cannot be read without it. </span>
              <Link href="/filings/bulk/upload" className="underline">
                Upload an Excel file instead
              </Link>
            </AlertDescription>
          </Alert>
        ) : !reviews ? (
          <Card className={cn(PANEL_CLASS, "max-w-3xl")}>
            <CardHeader>
              <CardTitle className="text-body font-semibold">
                The same for every case
              </CardTitle>
              <CardDescription>
                Each document carries what changes from case to case: the
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
                <FieldLabel htmlFor="case-docs">Case documents</FieldLabel>
                <FileDrop
                  id="case-docs"
                  accept=".docx,.pdf"
                  multiple
                  files={files}
                  onFiles={(f) =>
                    setFiles((prev) => [
                      ...prev,
                      ...f.filter((x) => !prev.some((p) => p.name === x.name)),
                    ])
                  }
                  prompt="Drag the case documents here"
                  hint="Word (.docx) or PDF, one per case"
                />
              </Field>
              <div className="flex">
                <Button
                  className="ml-auto"
                  disabled={!files.length || busy}
                  onClick={() => void read()}
                >
                  {busy ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <SparklesIcon data-icon="inline-start" aria-hidden />
                  )}
                  {busy
                    ? `Reading ${files.length} documents`
                    : files.length ? `Read ${files.length} document${files.length === 1 ? "" : "s"}` : "Read documents"}
                  {busy ? null : (
                    <ArrowRightIcon data-icon="inline-end" aria-hidden />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : current ? (
          <div className="xl:grid xl:grid-cols-[15rem_minmax(0,1fr)] xl:items-start xl:gap-6">
            {/* The cases, as the filing rail lists its sections: where each one stands. */}
            <nav
              aria-label="Cases to review"
              className="sticky top-20 hidden xl:block"
            >
              <p className="mb-2 px-2 text-caption text-muted-foreground tabular-nums">
                {confirmed} of {reviews.length} confirmed
              </p>
              <ul className="flex flex-col gap-1">
                {reviews.map((r, k) => {
                  const toCheck = Object.values(r.extraction.fields).filter(
                    (f) => f.confidence === "check",
                  ).length;
                  return (
                    <li key={r.extraction.fileName}>
                      <Button
                        variant="ghost"
                        className={cn(RAIL_ROW, k === at && RAIL_ROW_ACTIVE)}
                        aria-current={k === at ? "step" : undefined}
                        onClick={() => {
                          setAt(k);
                          setFocusLine(null);
                        }}
                      >
                        <FileTextIcon
                          aria-hidden
                          className={
                            k === at ? undefined : "text-muted-foreground"
                          }
                        />
                        <span className="min-w-0 truncate">
                          {r.values["Case reference"] || r.extraction.fileName}
                        </span>
                        {r.decision === "confirmed" ? (
                          <CheckIcon
                            className="ml-auto text-success-ink"
                            aria-label="Confirmed"
                          />
                        ) : r.decision === "aside" ? (
                          <span className="ml-auto text-caption text-muted-foreground">
                            Set aside
                          </span>
                        ) : toCheck ? (
                          <span className="ml-auto text-caption text-warning-ink tabular-nums">
                            {toCheck} to check
                          </span>
                        ) : null}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <CaseReview
              key={current.extraction.fileName}
              review={current}
              index={at}
              total={reviews.length}
              showAll={showAll}
              setShowAll={setShowAll}
              focusLine={focusLine}
              setFocusLine={setFocusLine}
              onChange={(header, value) =>
                setReviews((prev) =>
                  prev!.map((r, k) =>
                    k === at
                      ? { ...r, values: { ...r.values, [header]: value } }
                      : r,
                  ),
                )
              }
            />
          </div>
        ) : null}
      </div>

      {reviews && current ? (
        <FilingFooter
          showSaveState={false}
          onBack={() => (at > 0 ? setAt(at - 1) : setReviews(null))}
          backLabel={at > 0 ? "Previous case" : "Back"}
          extra={
            allDecided ? null : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => decide("aside")}
              >
                Set aside
              </Button>
            )
          }
          continueLabel={
            allDecided
              ? `Create batch with ${confirmed} case${confirmed === 1 ? "" : "s"}`
              : "Confirm case"
          }
          continueBlocked={allDecided && confirmed === 0}
          continueHint="Confirm at least one case"
          onContinue={() =>
            allDecided ? confirmed && void create() : decide("confirmed")
          }
        />
      ) : null}
    </div>
  );
}

/** One case: its document on one side, the fields read from it on the other. */
function CaseReview({
  review,
  index,
  total,
  showAll,
  setShowAll,
  focusLine,
  setFocusLine,
  onChange,
}: {
  review: Review;
  index: number;
  total: number;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  focusLine: number | null;
  setFocusLine: (line: number | null) => void;
  onChange: (header: string, value: string) => void;
}) {
  const { extraction, values } = review;
  const docRef = React.useRef<HTMLOListElement>(null);
  React.useEffect(() => {
    if (focusLine === null) return;
    docRef.current
      ?.querySelector(`[data-line="${focusLine}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusLine]);

  // The sections this case has, with the instances its document reached.
  const headers = Object.keys(values);
  const inst = instancesIn(headers);
  const sections = ORDER.map((id) => GROUPS.find((g) => g.id === id)!)
    .flatMap((g) =>
      (g.repeats ? inst[g.id] : [firstInstance(g)]).map((i) => ({ g, i })),
    )
    .map(({ g, i }) => ({
      g,
      i,
      cols: COLUMNS.filter((c) => c.group === g.id).filter(
        (c) =>
          showAll ||
          MUST_MAP.includes(c.key) ||
          (values[keyOf(c, g, i)] ?? "").trim(),
      ),
    }))
    .filter(
      ({ g, cols, i }) =>
        cols.length &&
        (g.always || cols.some((c) => (values[keyOf(c, g, i)] ?? "").trim())),
    );
  const toCheck = Object.values(extraction.fields).filter(
    (f) => f.confidence === "check",
  ).length;
  const missing = sections.flatMap(({ g, i, cols }) =>
    cols.filter(
      (c) => MUST_MAP.includes(c.key) && !(values[keyOf(c, g, i)] ?? "").trim(),
    ),
  ).length;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-title-s font-semibold">
          {values["Case reference"] || extraction.fileName}
        </h2>
        <span className="text-body-compact text-muted-foreground">
          {extraction.fileName}
        </span>
        {review.decision === "confirmed" ? (
          <Badge variant="success">Confirmed</Badge>
        ) : null}
        {review.decision === "aside" ? (
          <Badge variant="outline">Set aside</Badge>
        ) : null}
        <span className="ml-auto flex gap-2">
          {toCheck ? <Badge variant="warning">{toCheck} to check</Badge> : null}
          {missing ? (
            <Badge variant="destructive">{missing} not found</Badge>
          ) : null}
        </span>
      </div>
      <span className="sr-only">
        Case {index + 1} of {total}
      </span>

      {!extraction.lines.some(Boolean) ? (
        <Alert>
          <AlertTitle>This document has no text to read</AlertTitle>
          <AlertDescription>
            It may be a scan or an image. Fill the fields manually, or set the
            case aside.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* The document, line by line; the field in focus lights the line it came from. */}
        <Card
          className={cn(
            PANEL_CLASS,
            "gap-0 py-0 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-12rem)]",
          )}
        >
          <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
            <FileTextIcon
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            <span className="text-body-compact font-semibold">
              The document
            </span>
          </div>
          <ol
            ref={docRef}
            className="min-h-0 overflow-y-auto px-2 py-2 text-body-compact"
            aria-label={`Text of ${extraction.fileName}`}
          >
            {extraction.lines.map((line, k) =>
              line ? (
                <li
                  key={k}
                  data-line={k}
                  className={cn(
                    "rounded-md px-2 py-0.5 whitespace-pre-wrap transition-colors",
                    focusLine === k &&
                      "bg-warning-muted text-warning-muted-foreground",
                  )}
                >
                  {line}
                </li>
              ) : (
                <li key={k} aria-hidden className="h-3" />
              ),
            )}
          </ol>
        </Card>

        <div className="flex flex-col gap-4">
          {sections.map(({ g, i, cols }) => (
            <section
              key={`${g.id}-${i.join("-")}`}
              className="flex flex-col gap-2"
            >
              <h3 className="text-body font-semibold">
                {sectionTitle(g, i, inst.accused.length > 1)}
              </h3>
              <Card className={cn(PANEL_CLASS, "gap-0 px-4 py-3")}>
                <ul className="flex flex-col gap-3">
                  {cols.map((c) => {
                    const key = keyOf(c, g, i);
                    const read = extraction.fields[key];
                    const value = values[key] ?? "";
                    const required = MUST_MAP.includes(c.key);
                    const state = !value.trim()
                      ? required
                        ? "missing"
                        : "empty"
                      : read?.confidence === "check"
                        ? "check"
                        : read
                          ? "found"
                          : "edited";
                    const id = `doc-${key}`;
                    const focus = () => setFocusLine(read?.line ?? null);
                    return (
                      <li key={key}>
                        <Field className="gap-1">
                          <FieldLabel
                            htmlFor={id}
                            className="text-body-compact"
                          >
                            {c.header}
                          </FieldLabel>
                          {c.list ? (
                            <NativeSelect
                              id={id}
                              value={value}
                              onFocus={focus}
                              onChange={(e) => onChange(key, e.target.value)}
                              className={cn(
                                "w-full",
                                state === "check" &&
                                  "[&_select]:border-warning-ink [&_select]:bg-warning-muted",
                                state === "found" &&
                                  "[&_select]:bg-success-muted",
                              )}
                            >
                              <NativeSelectOption value="">
                                {SKIP}
                              </NativeSelectOption>
                              {/* A value the court's list does not have stays visible until changed. */}
                              {value &&
                              !LISTS[c.list].some((o) => o.label === value) ? (
                                <NativeSelectOption value={value}>
                                  {value}
                                </NativeSelectOption>
                              ) : null}
                              {LISTS[c.list].map((o) => (
                                <NativeSelectOption
                                  key={o.value}
                                  value={o.label}
                                >
                                  {o.label}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          ) : (
                            <Input
                              id={id}
                              value={value}
                              onFocus={focus}
                              onChange={(e) => onChange(key, e.target.value)}
                              placeholder={
                                required
                                  ? "Not found in the document"
                                  : "Not stated"
                              }
                              className={cn(
                                state === "check" &&
                                  "border-warning-ink bg-warning-muted",
                                state === "found" && "bg-success-muted",
                                state === "missing" && "border-destructive-ink",
                              )}
                            />
                          )}
                          {state === "check" ? (
                            <span className="text-caption text-warning-ink">
                              {read?.note ?? "Check this value"}
                            </span>
                          ) : state === "missing" ? (
                            <span className="text-caption text-destructive-ink">
                              Required. Not found in the document.
                            </span>
                          ) : null}
                        </Field>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
          <Button
            variant="ghost"
            className="self-start"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show only what the document gave" : "Show every field"}
          </Button>
        </div>
      </div>
    </div>
  );
}
