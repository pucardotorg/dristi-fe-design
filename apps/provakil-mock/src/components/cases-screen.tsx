"use client";

import * as React from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  FilterIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  XIcon,
} from "lucide-react";

import { REQUIRED_TAGS } from "@/lib/connector";
import {
  causeOfAction,
  formatDate,
  formatINR,
  limitationEnds,
  type Matter,
  type Stage,
} from "@/lib/matters";

import { AssignDialog } from "./assign-dialog";
import { MatterDrawer } from "./matter-drawer";
import { PushDialog } from "./push-dialog";
import { Button, Chip, STAGE_TONE } from "./ui";

export type Row = Matter & {
  push: { pushId: string; at: string; batchId: string; batchNumber: string; url: string } | null;
  dristi: { status: "draft" | "filed"; caseFileNumber: string | null } | null;
};

/** Courts the workspace can file in. Only the one with jurisdiction over these cases is open. */
const COURTS = [
  { id: "saras", name: "SARAS 2.0", where: "Gujarat", open: true },
  { id: "kerala", name: "24×7 ON Court", where: "Kerala", open: false },
  { id: "nact", name: "NACT e-filing", where: "Punjab & Haryana", open: false },
  { id: "ecourts", name: "eCourts e-filing", where: "Other states", open: false },
];

const STAGES: (Stage | "All")[] = ["All", "Notice Sent", "Notice Served", "Ready for Filing", "Filed"];
const WORKFLOWS = ["Section 138/25", "SARFAESI", "Arbitration", "DRT", "Vehicle Repossession"];

/** A matter can be acted on until it is filed. */
const pushable = (r: Row) => r.stage !== "Filed";

export function missingDocs(m: Matter): string[] {
  return REQUIRED_TAGS.filter((t) => !m.documents.some((d) => d.tag === t));
}

export function CasesScreen() {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [reachable, setReachable] = React.useState(true);
  const [courtUrl, setCourtUrl] = React.useState("");
  const [stage, setStage] = React.useState<Stage | "All">("Ready for Filing");
  const [region, setRegion] = React.useState("");
  const [advocate, setAdvocate] = React.useState("");
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [open, setOpen] = React.useState<Row | null>(null);
  const [pushing, setPushing] = React.useState(false);
  const [assigning, setAssigning] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const PAGE = 50;

  const load = React.useCallback(async () => {
    const res = await fetch("/api/matters", { cache: "no-store" });
    const json = await res.json();
    setRows(json.matters);
    setReachable(json.courtReachable);
    setCourtUrl(json.courtUrl);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const all = rows ?? [];
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { All: all.length };
    for (const r of all) c[r.stage] = (c[r.stage] ?? 0) + 1;
    return c;
  }, [all]);

  const shown = all.filter(
    (r) =>
      (stage === "All" || r.stage === stage) &&
      (!region || r.region === region) &&
      (!advocate || (advocate === "Unassigned" ? !r.advocate : r.advocate?.name === advocate)) &&
      (!q ||
        `${r.lan} ${r.borrower.name} ${r.branch} ${r.instruments.map((i) => i.chequeNo).join(" ")}`
          .toLowerCase()
          .includes(q.toLowerCase()))
  );
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const at = Math.min(page, pages - 1);
  const pageRows = shown.slice(at * PAGE, at * PAGE + PAGE);
  const selectable = pageRows.filter(pushable);
  const chosen = all.filter((r) => selected.has(r.id));
  const allTicked = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const unassigned = chosen.filter((r) => !r.advocate).length;
  const chosenValue = chosen.reduce((s, r) => s + r.instruments.reduce((a, i) => a + i.amount, 0), 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4 p-6 pb-28">
      {/* Title */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <nav className="flex items-center gap-1 text-[12px] text-muted" aria-label="Breadcrumb">
            <span>Legal Collections</span>
            <ChevronRightIcon className="size-3" aria-hidden />
            <span>Litigation</span>
          </nav>
          <h1 className="mt-1 text-[22px] font-medium">Section 138 / 25 cases</h1>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCwIcon className="size-4" aria-hidden />
            Refresh
          </Button>
          <div className="relative">
            <Button variant="outline" onClick={() => setExporting((v) => !v)} aria-haspopup="menu" aria-expanded={exporting}>
              <DownloadIcon className="size-4" aria-hidden />
              {chosen.length ? `Export ${chosen.length}` : "Export"}
              <ChevronDownIcon className="size-4" aria-hidden />
            </Button>
            {exporting ? (
              <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-md border border-line bg-white py-1 shadow-xl">
                {[
                  { format: "saras", title: "SARAS 2.0 bulk filing template", sub: "Uploads on SARAS 2.0 without matching" },
                  { format: "provakil", title: "Provakil case report", sub: "Provakil's own columns" },
                ].map((o) => (
                  <a
                    key={o.format}
                    role="menuitem"
                    href={`/api/export?format=${o.format}&ids=${(chosen.length ? chosen : shown.filter(pushable)).map((r) => r.id).join(",")}`}
                    onClick={() => setExporting(false)}
                    className="flex flex-col px-3 py-2 hover:bg-ground"
                  >
                    <span className="text-[13px] font-medium">{o.title}</span>
                    <span className="text-[11px] text-muted">{o.sub}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <Button variant="outline" disabled title="Not part of this demo">
            <PlusIcon className="size-4" aria-hidden />
            Add case
          </Button>
        </div>
      </div>

      {/* Workflow tabs */}
      <div className="flex gap-6 border-b border-line">
        {WORKFLOWS.map((w, i) => (
          <button
            key={w}
            disabled={i !== 0}
            title={i === 0 ? undefined : "Not part of this demo"}
            className={`-mb-px border-b-2 pb-2 text-[13px] font-medium ${
              i === 0 ? "border-blue text-blue" : "cursor-not-allowed border-transparent text-muted opacity-40"
            }`}
          >
            {w}
          </button>
        ))}
      </div>

      {!reachable && rows ? (
        <div className="rounded-md border border-amber/30 bg-amber-50 px-4 py-2 text-[13px] text-amber">
          SARAS 2.0 is not reachable at {courtUrl}. Filing statuses from the court are not shown.
        </div>
      ) : null}

      {/* Stage chips */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Stage">
        {STAGES.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={stage === s}
            onClick={() => {
              setStage(s);
              setPage(0);
            }}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] ${
              stage === s ? "border-blue bg-blue text-white" : "border-line bg-white text-slate hover:border-blue/40"
            }`}
          >
            {s}
            <span className={`num rounded-full px-1.5 text-[11px] ${stage === s ? "bg-white/20" : "bg-ground"}`}>
              {counts[s] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-lg border border-line bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex min-w-64 flex-1 items-center gap-2 rounded-md border border-line px-3 py-1.5">
            <SearchIcon className="size-4 text-muted" aria-hidden />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="LAN, borrower, branch, cheque no."
              className="w-full text-[13px] focus:outline-none"
              aria-label="Search cases"
            />
          </div>
          <FilterIcon className="size-4 text-muted" aria-hidden />
          <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(0); }} className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px]" aria-label="Region">
            <option value="">All regions</option>
            <option>Ahmedabad West</option>
            <option>Ahmedabad East</option>
            <option>Gandhinagar</option>
          </select>
          <select value={advocate} onChange={(e) => { setAdvocate(e.target.value); setPage(0); }} className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px]" aria-label="Advocate">
            <option value="">All advocates</option>
            {[...new Set(all.map((r) => r.advocate?.name ?? "Unassigned"))].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <span className="num ml-auto text-[12px] text-muted">
            {shown.length} of {all.length} cases
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-[13px]">
            <thead className="bg-[#f7f9fc] text-[11px] font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all shown"
                    checked={allTicked}
                    disabled={selectable.length === 0}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (allTicked) selectable.forEach((r) => next.delete(r.id));
                        else selectable.forEach((r) => next.add(r.id));
                        return next;
                      })
                    }
                    className="size-4 accent-blue"
                  />
                </th>
                <th className="px-3 py-2.5">LAN</th>
                <th className="px-3 py-2.5">Borrower</th>
                <th className="px-3 py-2.5">Branch</th>
                <th className="px-3 py-2.5 text-right">Cheque amount</th>
                <th className="px-3 py-2.5">Returned</th>
                <th className="px-3 py-2.5">Notice</th>
                <th className="px-3 py-2.5">Cause of action</th>
                <th className="px-3 py-2.5">File by</th>
                <th className="px-3 py-2.5">Advocate</th>
                <th className="px-3 py-2.5">Docs</th>
                <th className="px-3 py-2.5">Stage</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-muted">
                    Loading cases…
                  </td>
                </tr>
              ) : shown.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-muted">
                    No cases in this view.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const coa = causeOfAction(r);
                  const fileBy = limitationEnds(r);
                  const today = new Date().toISOString().slice(0, 10);
                  const overdue = fileBy && fileBy < today && r.stage !== "Filed";
                  const missing = missingDocs(r);
                  const docsHave = REQUIRED_TAGS.length - missing.length;
                  const can = pushable(r);
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-line ${selected.has(r.id) ? "bg-blue-50/60" : "hover:bg-[#f7f9fc]"} cursor-pointer`}
                      onClick={() => setOpen(r)}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.lan}`}
                          checked={selected.has(r.id)}
                          disabled={!can}
                          onChange={() => toggle(r.id)}
                          className="size-4 accent-blue disabled:opacity-30"
                        />
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2.5 font-medium text-blue">{r.lan}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{r.borrower.name}</div>
                        <div className="text-[11px] text-muted">
                          {r.borrower.constitution} · {r.product}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div>{r.branch}</div>
                        <div className="text-[11px] text-muted">{r.region}</div>
                      </td>
                      <td className="num px-3 py-2.5 text-right">
                        {formatINR(r.instruments.reduce((s, i) => s + i.amount, 0))}
                        {r.instruments.length > 1 ? <div className="text-[11px] text-muted">{r.instruments.length} cheques</div> : null}
                      </td>
                      <td className="num px-3 py-2.5">
                        <div>{formatDate(r.instruments[0].returnDate)}</div>
                        <div className="text-[11px] text-muted">{r.instruments[0].returnReason.slice(5)}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Chip tone={r.notice.status === "Delivered" ? "teal" : r.notice.status === "In Transit" ? "grey" : "amber"}>
                          {r.notice.status}
                        </Chip>
                        <div className="num mt-0.5 text-[11px] text-muted">{formatDate(r.notice.statusDate ?? r.notice.dispatchDate)}</div>
                      </td>
                      <td className="num px-3 py-2.5">{formatDate(coa)}</td>
                      <td className={`num px-3 py-2.5 ${overdue ? "font-medium text-red" : ""}`}>{formatDate(fileBy)}</td>
                      <td className="px-3 py-2.5">
                        {r.advocate ? r.advocate.name : <span className="font-medium text-amber">Unassigned</span>}
                      </td>
                      <td className="num px-3 py-2.5">
                        <span className={missing.length ? "font-medium text-amber" : "text-slate"}>
                          {docsHave}/{REQUIRED_TAGS.length}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Chip tone={STAGE_TONE[r.stage]}>{r.stage}</Chip>
                        {r.stage === "Filed" ? (
                          <div className="mt-0.5 text-[11px] text-muted">
                            On {r.filedOn ?? "SARAS 2.0"}
                            {r.push ? <span className="num"> · {r.push.batchNumber}</span> : null}
                          </div>
                        ) : null}
                        {r.stage === "Filed" && r.cnr ? <div className="num mt-0.5 text-[11px] text-muted">{r.cnr}</div> : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {shown.length > PAGE ? (
          <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-[13px]">
            <span className="num text-muted">
              {at * PAGE + 1}–{Math.min(shown.length, at * PAGE + PAGE)} of {shown.length}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" disabled={at === 0} onClick={() => setPage(at - 1)}>
                Previous
              </Button>
              <Button variant="outline" disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Selection bar */}
      {chosen.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white shadow-[0_-4px_16px_rgba(10,37,64,0.08)] lg:left-60">
          <div className="flex flex-wrap items-center gap-3 px-6 py-3">
            <span className="text-[14px] font-medium">
              {chosen.length} case{chosen.length === 1 ? "" : "s"} selected
            </span>
            <span className="num text-[13px] text-muted">Cheque value {formatINR(chosenValue)}</span>
            {unassigned ? <span className="text-[13px] font-medium text-amber">{unassigned} without an advocate</span> : null}
            <button onClick={() => setSelected(new Set())} className="flex items-center gap-1 text-[13px] text-muted hover:text-slate">
              <XIcon className="size-4" aria-hidden />
              Clear
            </button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" disabled title="Not part of this demo">Add label</Button>
              <Button variant="outline" onClick={() => setAssigning(true)}>
                Assign advocate
              </Button>
              <div className="relative">
                <Button
                  onClick={() => setMenu((v) => !v)}
                  disabled={unassigned > 0}
                  title={unassigned > 0 ? "Assign an advocate first" : undefined}
                  aria-haspopup="menu"
                  aria-expanded={menu}
                >
                  <SendIcon className="size-4" aria-hidden />
                  File in court
                  <ChevronDownIcon className="size-4" aria-hidden />
                </Button>
                {menu ? (
                  <div role="menu" className="absolute right-0 bottom-full z-30 mb-2 w-72 overflow-hidden rounded-md border border-line bg-white py-1 shadow-xl">
                    {COURTS.map((c) => (
                      <button
                        key={c.id}
                        role="menuitem"
                        disabled={!c.open}
                        onClick={() => {
                          setMenu(false);
                          setPushing(true);
                        }}
                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-ground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <span className="text-[13px] font-medium">{c.name}</span>
                        <span className="text-[11px] text-muted">
                          {c.where}
                          {c.open ? "" : " · no jurisdiction over these cases"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <MatterDrawer row={open} onClose={() => setOpen(null)} />
      <AssignDialog
        open={assigning}
        rows={chosen}
        onClose={() => setAssigning(false)}
        onDone={() => {
          setAssigning(false);
          void load();
        }}
      />
      <PushDialog
        open={pushing}
        rows={chosen}
        onClose={() => setPushing(false)}
        onSent={() => {
          setSelected(new Set());
          void load();
        }}
      />
    </div>
  );
}
