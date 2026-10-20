"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  CodeIcon,
  ExternalLinkIcon,
  Loader2Icon,
  ScaleIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import { OFFICERS, causeOfAction, formatDate, formatINR, type Matter } from "@/lib/matters";

import type { Row } from "./cases-screen";
import { missingDocs } from "./cases-screen";
import { Button, Chip } from "./ui";

type Sent = {
  pushId: string;
  advocate: { name: string; enrolment: string };
  request: unknown;
  response: {
    batchId: string;
    batchNumber: string;
    receivedAt: string;
    url: string;
    cases: { reference: string; caseId: string; status: string }[];
  };
};
type Result = { batches: Sent[] };

/**
 * What the connector can see from Provakil's side before sending. DRISTI runs the filing
 * rules; these are only the facts Provakil already holds.
 */
function preCheck(m: Matter): string[] {
  const out: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  if (m.notice.status === "In Transit") out.push("Notice in transit");
  const coa = causeOfAction(m);
  if (coa && coa > today) out.push(`Cause of action on ${formatDate(coa)}`);
  const missing = missingDocs(m);
  if (missing.length) out.push(`No ${missing.join(", ").toLowerCase()}`);
  return out;
}

export function PushDialog({
  open,
  rows,
  onClose,
  onSent,
}: {
  open: boolean;
  rows: Row[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [state, setState] = React.useState<"review" | "sending" | "done" | "error">("review");
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<{ error: string; details?: string[] } | null>(null);
  const [showJson, setShowJson] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState<Row[]>([]);

  React.useEffect(() => {
    if (open) {
      setState("review");
      setResult(null);
      setError(null);
      setShowJson(false);
      setSnapshot(rows);
    }
    // Rows are captured on open; the list behind refreshes after a send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const list = snapshot;
  const regionCount = new Map<Matter["region"], number>();
  list.forEach((m) => regionCount.set(m.region, (regionCount.get(m.region) ?? 0) + 1));
  const region = [...regionCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Ahmedabad West";
  const officer = OFFICERS[region];
  const advocates = [...new Map(list.filter((m) => m.advocate).map((m) => [m.advocate!.enrolment, m.advocate!])).values()];
  const value = list.reduce((s, r) => s + r.instruments.reduce((a, i) => a + i.amount, 0), 0);
  const flagged = list.filter((m) => preCheck(m).length > 0).length;

  const send = async () => {
    setState("sending");
    try {
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matterIds: list.map((m) => m.id), adr: "no", sentBy: "Priya Vyas" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json);
        setState("error");
        return;
      }
      setResult(json);
      setState("done");
      onSent();
    } catch {
      setError({ error: "The request did not complete." });
      setState("error");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy/40 p-4" role="dialog" aria-modal="true" aria-labelledby="push-title">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-plum-50 text-plum">
            <ScaleIcon className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="push-title" className="text-[16px] font-medium">
              {state === "done" ? "Filed on SARAS 2.0" : "File on SARAS 2.0"}
            </h2>
            <p className="text-[12px] text-muted">SARAS 2.0 · Gujarat · S-138 NI Act · Bulk Filing API</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-muted hover:bg-ground" aria-label="Close">
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {state === "review" || state === "sending" ? (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-1 gap-3 rounded-md bg-ground p-4 text-[13px] sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] text-muted uppercase">Complainant</dt>
                  <dd className="font-medium">Tata Capital Ltd</dd>
                  <dd className="text-[12px] text-muted">
                    Through {officer.name}, {officer.designation}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted uppercase">Advocate{advocates.length > 1 ? "s" : ""}</dt>
                  {advocates.map((a) => (
                    <dd key={a.enrolment}>
                      <span className="font-medium">{a.name}</span>{" "}
                      <span className="num text-[12px] text-muted">{a.enrolment}</span>
                    </dd>
                  ))}
                </div>
                <div>
                  <dt className="text-[11px] text-muted uppercase">Cases</dt>
                  <dd className="num font-medium">
                    {list.length} · {formatINR(value)}
                  </dd>
                  <dd className="text-[12px] text-muted">
                    {advocates.length > 1 ? `${advocates.length} batches, one per advocate` : "One batch"}, with all documents
                  </dd>
                </div>
              </dl>

              {flagged > 0 ? (
                <div className="flex gap-2 rounded-md border border-amber/30 bg-amber-50 px-3 py-2 text-[13px] text-amber">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {flagged} case{flagged === 1 ? " has" : "s have"} gaps Provakil can see. SARAS 2.0 holds such cases for review;
                    the rest of the batch carries on.
                  </span>
                </div>
              ) : null}

              <table className="w-full text-left text-[13px]">
                <thead className="text-[11px] text-muted uppercase">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3">LAN</th>
                    <th className="py-2 pr-3">Borrower</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 pr-3">Advocate</th>
                    <th className="py-2 pr-3">Documents</th>
                    <th className="py-2">Before sending</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => {
                    const checks = preCheck(m);
                    return (
                      <tr key={m.id} className="border-b border-line last:border-0">
                        <td className="num py-2 pr-3 font-medium">{m.lan}</td>
                        <td className="py-2 pr-3">{m.borrower.name}</td>
                        <td className="num py-2 pr-3 text-right">{formatINR(m.instruments.reduce((s, i) => s + i.amount, 0))}</td>
                        <td className="py-2 pr-3">{m.advocate?.name}</td>
                        <td className="num py-2 pr-3">{m.documents.length} files</td>
                        <td className="py-2">
                          {checks.length ? (
                            <div className="flex flex-wrap gap-1">
                              {checks.map((c) => (
                                <Chip key={c} tone="amber">
                                  {c}
                                </Chip>
                              ))}
                            </div>
                          ) : (
                            <Chip tone="teal">Complete</Chip>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {state === "done" && result ? (
            <div className="flex flex-col gap-4">
              {result.batches.map((sent) => (
                <section key={sent.pushId} className="flex flex-col gap-3">
                  <div className="flex gap-3 rounded-md bg-teal-50 p-4">
                    <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-teal" aria-hidden />
                    <div className="text-[13px]">
                      <div className="text-[15px] font-medium">
                        Batch <span className="num">{sent.response.batchNumber}</span> on SARAS 2.0
                      </div>
                      <div className="text-slate">
                        {sent.response.cases.length} case{sent.response.cases.length === 1 ? "" : "s"} in {sent.advocate.name}&apos;s account,{" "}
                        {new Date(sent.response.receivedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.
                      </div>
                      <a href={sent.response.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-blue underline">
                        Open on SARAS 2.0
                        <ExternalLinkIcon className="size-3.5" aria-hidden />
                      </a>
                    </div>
                  </div>
                  <table className="w-full text-left text-[13px]">
                    <thead className="text-[11px] text-muted uppercase">
                      <tr className="border-b border-line">
                        <th className="py-2 pr-3">LAN</th>
                        <th className="py-2 pr-3">SARAS 2.0 case id</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sent.response.cases.map((c) => (
                        <tr key={c.caseId} className="border-b border-line last:border-0">
                          <td className="num py-2 pr-3 font-medium">{c.reference}</td>
                          <td className="num py-2 pr-3 text-muted">{c.caseId}</td>
                          <td className="py-2">
                            <Chip tone="teal">Filed</Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
              <button onClick={() => setShowJson((v) => !v)} className="flex items-center gap-1.5 self-start text-[13px] text-blue">
                <CodeIcon className="size-4" aria-hidden />
                {showJson ? "Hide API request" : "Show API request"}
              </button>
              {showJson ? (
                <pre className="max-h-80 overflow-auto rounded-md bg-navy p-3 text-[11px] leading-relaxed text-[#cfe3ff]">
                  {result.batches.map((b) => `POST /api/bulk/v1/batches\n\n${JSON.stringify(b.request, null, 2)}`).join("\n\n")}
                </pre>
              ) : null}
            </div>
          ) : null}

          {state === "error" && error ? (
            <div className="flex gap-3 rounded-md bg-red-50 p-4 text-[13px] text-red">
              <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <div className="font-medium">{error.error}</div>
                {error.details?.map((d) => <div key={d}>{d}</div>)}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          {state === "done" && result ? (
            <>
              <Button onClick={onClose} className="ml-auto">
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} className="ml-auto" disabled={state === "sending"}>
                Cancel
              </Button>
              <Button onClick={() => void send()} disabled={state === "sending" || list.length === 0}>
                {state === "sending" ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
                {state === "sending"
                  ? `Sending ${list.length} cases…`
                  : state === "error"
                    ? "Try again"
                    : `File ${list.length} case${list.length === 1 ? "" : "s"} on SARAS 2.0`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
