"use client";

import { CircleCheckIcon } from "lucide-react";

import { dateTime, longDate } from "@/lib/tasks/format";
import { signatoriesOf } from "@/lib/tasks/permissions";
import type { Case, Person, Task } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PANEL_CLASS } from "@/components/shell/panel";
import { useCourtLocalized } from "@/components/court/court-provider";

/** "Sign the vakalatnama for …" → "Vakalatnama for …". */
export function documentTitleOf(task: Task): string {
  const object = task.title.replace(/^(Sign|File|Upload|Submit|Produce|Re-file)\s+(the\s+)?/i, "");
  return object.charAt(0).toUpperCase() + object.slice(1);
}

type DocumentKind = "vakalatnama" | "affidavit" | "memo" | "application" | "other";

/** What kind of instrument the title names — decides the operative words below. */
export function documentKindOf(task: Task): DocumentKind {
  const t = task.title.toLowerCase();
  if (/vakalat/.test(t)) return "vakalatnama";
  if (/affidavit/.test(t)) return "affidavit";
  if (/\bmemo\b/.test(t)) return "memo";
  if (/application|petition/.test(t)) return "application";
  return "other";
}

/**
 * The operative and closing sentences by document kind. A vakalatnama appoints; an
 * affidavit is sworn by a deponent; a memo and an application are filed. No document
 * gets another's boilerplate.
 */
function wordsFor(kind: DocumentKind, court: string, why: string): { opening: string; closing: string; role: string } {
  const because = why ? `, ${why.charAt(0).toLowerCase() + why.slice(1)}` : "";
  switch (kind) {
    case "vakalatnama":
      return {
        opening: `The complainant appoints the advocate named below to appear, plead and act on their behalf in the above matter before the ${court}${because}.`,
        closing: "Accepted by the advocate named below.",
        role: "Advocate for the complainant",
      };
    case "affidavit":
      return {
        opening: `The deponent solemnly affirms and states as follows in the above matter before the ${court}${because}.`,
        closing: "Solemnly affirmed by the deponent as true to the best of their knowledge and belief; identified by the advocate named below.",
        role: "Advocate for the complainant",
      };
    case "memo":
      return {
        opening: `This memo is filed in the above matter before the ${court}${because}.`,
        closing: "The figures above are drawn from the case record.",
        role: "Advocate for the complainant",
      };
    case "application":
      return {
        opening: `This application is made in the above matter before the ${court}${because}.`,
        closing: "It is prayed that this Hon'ble Court may be pleased to allow the same.",
        role: "Advocate for the complainant",
      };
    default:
      return {
        opening: `This document is filed in the above matter before the ${court}${because}.`,
        closing: "The contents above are drawn from the case record.",
        role: "Advocate for the complainant",
      };
  }
}

/**
 * A court-document-styled preview generated from the task and its case: the cause
 * title, the document heading, the substance the task describes, and the signature
 * block — with the e-sign stamp once signed. DS type only; the sheet is the panel.
 */
export function CourtDocument({
  task,
  kase: storedKase,
  people,
  className,
}: {
  task: Task;
  kase: Case;
  people: Person[];
  className?: string;
}) {
  const kase = useCourtLocalized(storedKase);
  const [complainant, accused] = kase.parties.split(/\s+v\.\s+/);
  const signatories = signatoriesOf(kase, people);
  const signedBy = people.find((p) => p.id === task.completion?.by);
  const signed = task.status === "done" && task.completion?.how === "event";
  const words = wordsFor(documentKindOf(task), kase.court, task.why.event);

  return (
    <Card className={cn(PANEL_CLASS, "gap-0 p-6 md:p-10", className)}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 text-body">
        <header className="flex flex-col items-center gap-1 text-center">
          <p className="text-caption font-semibold text-paper-muted-foreground">Before the</p>
          <p className="text-body font-semibold">{kase.court}</p>
          {kase.stNumber || kase.cnr ? (
            <p className="font-mono text-caption tabular-nums text-paper-muted-foreground">
              {[kase.stNumber, kase.cnr].filter(Boolean).join(" · ")}
            </p>
          ) : (
            <p className="text-caption text-paper-muted-foreground">Not yet numbered</p>
          )}
        </header>

        <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-body-compact">
          <p className="font-medium">{complainant ?? kase.parties}</p>
          <p className="text-paper-muted-foreground">Complainant</p>
          <p className="text-paper-muted-foreground">v.</p>
          <p />
          <p className="font-medium">{accused ?? "—"}</p>
          <p className="text-paper-muted-foreground">Accused</p>
        </div>

        <h2 className="text-center text-title-s font-semibold text-balance">{documentTitleOf(task)}</h2>

        <div className="flex flex-col gap-4 leading-relaxed text-pretty">
          <p>{words.opening}</p>
          <p>{task.whatToDo}</p>
          {task.documentsNeeded?.length ? (
            <p>
              Documents relied on:{" "}
              {task.documentsNeeded.map((d, i) => (
                <span key={d}>
                  {i ? "; " : ""}
                  {d}
                </span>
              ))}
              .
            </p>
          ) : null}
          <p className="text-paper-muted-foreground">{words.closing}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 border-t border-hairline pt-6 text-body-compact sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="text-caption font-semibold text-paper-muted-foreground">Place · date</p>
            <p>
              Sample District · <span className="tabular-nums">{longDate(task.completion?.at ?? new Date().toISOString())}</span>
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-caption font-semibold text-paper-muted-foreground">{words.role}</p>
            {signed && signedBy ? (
              <p className="flex items-start gap-1.5 text-success-ink">
                <CircleCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  Digitally signed by {signedBy.name}
                  <span className="block font-mono text-caption tabular-nums">
                    {dateTime(task.completion!.at)} · {task.completion?.receipt}
                  </span>
                </span>
              </p>
            ) : (
              <p className="text-paper-muted-foreground">
                {signatories.map((s) => s.name).join(" / ") || "—"}
                <span className="block text-caption">Signature pending</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
