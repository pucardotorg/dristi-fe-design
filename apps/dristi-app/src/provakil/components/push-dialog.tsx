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

import { OFFICERS, causeOfAction, formatDate, formatINR, type Matter } from "@/provakil/lib/matters";

import { provakilFetch } from "@/provakil/lib/workspace";
import type { Row } from "./cases-screen";
import { missingDocs } from "./cases-screen";
import { Button, Chip } from "./ui";

type Advocate = { name: string; enrolment: string };

type Sent = {
  pushId: string;
  advocate: Advocate;
  request: unknown;
  response: {
    batchId: string;
    batchNumber: string;
    receivedAt: string;
    url: string;
    cases: { reference: string; caseId: string; status: string }[];
  };
};

/** Courts the workspace can file in. Only the one with jurisdiction over these cases is open. */
export const COURTS = [
  { id: "saras", name: "SARAS 2.0", where: "Gujarat", open: true },
  { id: "kerala", name: "24×7 ON Court", where: "Kerala", open: false },
  { id: "nact", name: "NACT e-filing", where: "Punjab & Haryana", open: false },
  { id: "ecourts", name: "eCourts e-filing", where: "Other states", open: false },
];

/** What Provakil can see from its side before sending; the court runs the filing rules. */
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

const STEPS = ["Court", "Advocates", "Filed"] as const;

/**
 * File the selected cases in court, in three steps: choose the court; assign each case to
 * one of the client's advocates registered there (asked of the court); file. Each
 * advocate's cases go to that advocate's own login as one batch.
 */
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
  const [step, setStep] = React.useState<"court" | "assign" | "sending" | "done" | "error">("court");
  const [court, setCourt] = React.useState("saras");
  const [advocates, setAdvocates] = React.useState<Advocate[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [assigned, setAssigned] = React.useState<Record<string, string>>({});
  const [ticked, setTicked] = React.useState<Set<string>>(new Set());
  const [bulkTo, setBulkTo] = React.useState("");
  const [sent, setSent] = React.useState<Sent[]>([]);
  const [error, setError] = React.useState<{ error: string; details?: string[] } | null>(null);
  const [showJson, setShowJson] = React.useState(false);
  const [list, setList] = React.useState<Row[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setStep("court");
    setAdvocates(null);
    setLoadError(null);
    setTicked(new Set());
    setBulkTo("");
    setSent([]);
    setError(null);
    setShowJson(false);
    setList(rows);
    // Rows are captured on open; the list behind refreshes after a send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const chosenCourt = COURTS.find((c) => c.id === court)!;
  const value = list.reduce((s, r) => s + r.instruments.reduce((a, i) => a + i.amount, 0), 0);
  const regionCount = new Map<Matter["region"], number>();
  list.forEach((m) => regionCount.set(m.region, (regionCount.get(m.region) ?? 0) + 1));
  const officer = OFFICERS[[...regionCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Ahmedabad West"];
  const unassigned = list.filter((m) => !assigned[m.id]).length;
  const perAdvocate = (advocates ?? [])
    .map((a) => ({ a, n: list.filter((m) => assigned[m.id] === a.enrolment).length }))
    .filter((x) => x.n > 0);
  const allTicked = list.length > 0 && list.every((m) => ticked.has(m.id));

  const loadAdvocates = async () => {
    setStep("assign");
    setLoadError(null);
    try {
      const res = await provakilFetch(`/api/court-advocates?court=${court}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load the court's advocates.");
      const advs: Advocate[] = json.advocates.map((a: { name: string; barNumber: string }) => ({ name: a.name, enrolment: a.barNumber }));
      setAdvocates(advs);
      // Start from the advocate already on each matter, where they are registered on this court.
      setAssigned(
        Object.fromEntries(
          list.flatMap((m) => (m.advocate && advs.some((a) => a.enrolment === m.advocate!.enrolment) ? [[m.id, m.advocate.enrolment]] : []))
        )
      );
    } catch (e) {
      setLoadError((e as Error).message);
    }
  };

  const send = async () => {
    setStep("sending");
    try {
      const by = Object.fromEntries((advocates ?? []).map((a) => [a.enrolment, a]));
      const res = await provakilFetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matterIds: list.map((m) => m.id),
          adr: "no",
          sentBy: "Priya Vyas",
          assignments: Object.fromEntries(list.map((m) => [m.id, by[assigned[m.id]]])),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json);
        setStep("error");
        return;
      }
      setSent(json.batches);
      setStep("done");
      onSent();
    } catch {
      setError({ error: "The request did not complete." });
      setStep("error");
    }
  };

  const stepIndex = step === "court" ? 0 : step === "done" ? 2 : 1;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-(--pv-navy)/40 p-4" role="dialog" aria-modal="true" aria-labelledby="push-title">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-(--pv-line) px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-(--pv-plum-50) text-(--pv-plum)">
            <ScaleIcon className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="push-title" className="text-[16px] font-medium">
              {step === "done" ? `Filed on ${chosenCourt.name}` : `File ${list.length} case${list.length === 1 ? "" : "s"} in court`}
            </h2>
            <ol className="mt-0.5 flex gap-3 text-[12px]" aria-label="Steps">
              {STEPS.map((s, i) => (
                <li key={s} className={i === stepIndex ? "font-medium text-(--pv-blue)" : i < stepIndex ? "text-(--pv-slate)" : "text-(--pv-muted)"}>
                  {i + 1}. {s}
                </li>
              ))}
            </ol>
          </div>
          <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-(--pv-muted) hover:bg-(--pv-ground)" aria-label="Close">
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "court" ? (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-(--pv-slate)">
                {list.length} cases · {formatINR(value)} · Tata Capital Ltd, through {officer.name}. Choose the court to file in.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Court">
                {COURTS.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-start gap-3 rounded-md border px-3 py-3 ${
                      !c.open ? "cursor-not-allowed border-(--pv-line) opacity-40" : court === c.id ? "cursor-pointer border-(--pv-blue) bg-(--pv-blue-50)" : "cursor-pointer border-(--pv-line)"
                    }`}
                  >
                    <input type="radio" name="court" value={c.id} checked={court === c.id} disabled={!c.open} onChange={() => setCourt(c.id)} className="mt-1 accent-(--pv-blue)" />
                    <span className="flex flex-col">
                      <span className="text-[14px] font-medium">{c.name}</span>
                      <span className="text-[12px] text-(--pv-muted)">{c.open ? c.where : `${c.where} · no jurisdiction over these cases`}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {step === "assign" || step === "sending" ? (
            <div className="flex flex-col gap-3">
              {loadError ? (
                <div className="flex gap-2 rounded-md bg-(--pv-red-50) px-3 py-2 text-[13px] text-(--pv-red)">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {loadError}
                </div>
              ) : advocates === null ? (
                <div className="flex items-center gap-2 text-[13px] text-(--pv-muted)">
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                  Asking {chosenCourt.name} for Tata Capital&apos;s advocates…
                </div>
              ) : (
                <>
                  <p className="text-[13px] text-(--pv-slate)">
                    {`${advocates.length} advocates are registered on ${chosenCourt.name} for Tata Capital. Each advocate's cases go to their own login as one batch.`}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 rounded-md bg-(--pv-ground) px-3 py-2 text-[13px]">
                    <span className="font-medium">{ticked.size ? `${ticked.size} ticked` : "Tick cases to assign them together"}</span>
                    <select
                      value={bulkTo}
                      onChange={(e) => setBulkTo(e.target.value)}
                      className="rounded-md border border-(--pv-line) bg-white px-2 py-1.5"
                      aria-label="Advocate for the ticked cases"
                    >
                      <option value="">Choose advocate</option>
                      {advocates.map((a) => (
                        <option key={a.enrolment} value={a.enrolment}>
                          {a.name} · {a.enrolment}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      disabled={!ticked.size || !bulkTo}
                      onClick={() => {
                        setAssigned((prev) => ({ ...prev, ...Object.fromEntries([...ticked].map((id) => [id, bulkTo])) }));
                        setTicked(new Set());
                      }}
                    >
                      Assign
                    </Button>
                    <span className="num ml-auto text-(--pv-muted)">{unassigned ? `${unassigned} without an advocate` : "Every case has an advocate"}</span>
                  </div>
                  <table className="w-full text-left text-[13px]">
                    <thead className="text-[11px] text-(--pv-muted) uppercase">
                      <tr className="border-b border-(--pv-line)">
                        <th className="w-8 py-2 pr-2">
                          <input
                            type="checkbox"
                            aria-label="Tick every case"
                            checked={allTicked}
                            onChange={() => setTicked(allTicked ? new Set() : new Set(list.map((m) => m.id)))}
                            className="size-4 accent-(--pv-blue)"
                          />
                        </th>
                        <th className="py-2 pr-3">LAN</th>
                        <th className="py-2 pr-3">Borrower</th>
                        <th className="py-2 pr-3 text-right">Amount</th>
                        <th className="py-2 pr-3">Advocate</th>
                        <th className="py-2">Before filing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((m) => {
                        const checks = preCheck(m);
                        return (
                          <tr key={m.id} className="border-b border-(--pv-line) last:border-0">
                            <td className="py-2 pr-2">
                              <input
                                type="checkbox"
                                aria-label={`Tick ${m.lan}`}
                                checked={ticked.has(m.id)}
                                onChange={() =>
                                  setTicked((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(m.id)) next.delete(m.id);
                                    else next.add(m.id);
                                    return next;
                                  })
                                }
                                className="size-4 accent-(--pv-blue)"
                              />
                            </td>
                            <td className="num py-2 pr-3 font-medium whitespace-nowrap">{m.lan}</td>
                            <td className="py-2 pr-3">{m.borrower.name}</td>
                            <td className="num py-2 pr-3 text-right">{formatINR(m.instruments.reduce((s, i) => s + i.amount, 0))}</td>
                            <td className="py-2 pr-3">
                              <select
                                value={assigned[m.id] ?? ""}
                                onChange={(e) => setAssigned((prev) => ({ ...prev, [m.id]: e.target.value }))}
                                className={`w-full rounded-md border bg-white px-2 py-1 ${assigned[m.id] ? "border-(--pv-line)" : "border-(--pv-amber)"}`}
                                aria-label={`Advocate for ${m.lan}`}
                              >
                                <option value="">Choose</option>
                                {advocates.map((a) => (
                                  <option key={a.enrolment} value={a.enrolment}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            </td>
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
                </>
              )}
            </div>
          ) : null}

          {step === "done" ? (
            <div className="flex flex-col gap-4">
              {sent.map((b) => (
                <section key={b.pushId} className="flex gap-3 rounded-md bg-(--pv-teal-50) p-4">
                  <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-(--pv-teal)" aria-hidden />
                  <div className="text-[13px]">
                    <div className="text-[15px] font-medium">
                      {b.response.cases.length} case{b.response.cases.length === 1 ? "" : "s"} to {b.advocate.name}
                    </div>
                    <div className="text-(--pv-slate)">
                      Batch <span className="num">{b.response.batchNumber}</span> in their {chosenCourt.name} login.
                    </div>
                    <a href={b.response.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-(--pv-blue) underline">
                      Open on {chosenCourt.name}
                      <ExternalLinkIcon className="size-3.5" aria-hidden />
                    </a>
                  </div>
                </section>
              ))}
              <button onClick={() => setShowJson((v) => !v)} className="flex items-center gap-1.5 self-start text-[13px] text-(--pv-blue)">
                <CodeIcon className="size-4" aria-hidden />
                {showJson ? "Hide API request" : "Show API request"}
              </button>
              {showJson ? (
                <pre className="max-h-80 overflow-auto rounded-md bg-(--pv-navy) p-3 text-[11px] leading-relaxed text-[#cfe3ff]">
                  {sent.map((b) => `POST /api/bulk/v1/batches\n\n${JSON.stringify(b.request, null, 2)}`).join("\n\n")}
                </pre>
              ) : null}
            </div>
          ) : null}

          {step === "error" && error ? (
            <div className="flex gap-3 rounded-md bg-(--pv-red-50) p-4 text-[13px] text-(--pv-red)">
              <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <div className="font-medium">{error.error}</div>
                {error.details?.map((d) => <div key={d}>{d}</div>)}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-(--pv-line) px-5 py-3">
          {step === "assign" && perAdvocate.length ? (
            <span className="text-[12px] text-(--pv-muted)">{perAdvocate.map(({ a, n }) => `${a.name} ${n}`).join(" · ")}</span>
          ) : null}
          {step === "done" ? (
            <Button onClick={onClose} className="ml-auto">
              Done
            </Button>
          ) : step === "court" ? (
            <>
              <Button variant="outline" onClick={onClose} className="ml-auto">
                Cancel
              </Button>
              <Button onClick={() => void loadAdvocates()} disabled={!chosenCourt.open}>
                Next: advocates
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("court")} className="ml-auto" disabled={step === "sending"}>
                Back
              </Button>
              <Button onClick={() => void send()} disabled={step === "sending" || !advocates || unassigned > 0}>
                {step === "sending" ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
                {step === "sending"
                  ? `Filing ${list.length} cases…`
                  : step === "error"
                    ? "Try again"
                    : `File ${list.length} case${list.length === 1 ? "" : "s"} on ${chosenCourt.name}`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
