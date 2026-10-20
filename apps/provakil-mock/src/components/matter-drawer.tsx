"use client";

import * as React from "react";
import { FileTextIcon, XIcon } from "lucide-react";

import { causeOfAction, formatDate, formatINR, limitationEnds, isoDaysAgo } from "@/lib/matters";

import type { Row } from "./cases-screen";
import { Chip, STAGE_TONE } from "./ui";

const TABS = ["Overview", "Instrument & notice", "Documents", "Activity"] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-muted uppercase">{label}</dt>
      <dd className="mt-0.5">{children || "—"}</dd>
    </div>
  );
}

/** One matter, as the case workspace shows it. */
export function MatterDrawer({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("Overview");
  React.useEffect(() => setTab("Overview"), [row?.id]);
  if (!row) return null;
  const m = row;
  const b = m.borrower;

  const activity = [
    { at: m.npaDate, text: "Account classified NPA" },
    { at: m.instruments[0].returnDate, text: `Cheque ${m.instruments[0].chequeNo} returned: ${m.instruments[0].returnReason.slice(5)}` },
    { at: m.notice.dispatchDate, text: `Demand notice dispatched by ${m.notice.mode}` },
    ...(m.notice.statusDate ? [{ at: m.notice.statusDate, text: `Notice ${m.notice.status.toLowerCase()}` }] : []),
    { at: isoDaysAgo(3), text: `Case assigned to Legal Manager ${m.legalManager}` },
    ...m.notes.map((n) => ({ at: n.at, text: `Note added by ${n.by}` })),
    ...(m.push ? [{ at: m.push.at.slice(0, 10), text: `Filed on SARAS 2.0 in ${m.push.batchNumber}` }] : []),
    ...(m.stage === "Filed" && m.cnr ? [{ at: isoDaysAgo(1), text: `Filed. CNR ${m.cnr}` }] : []),
  ].sort((a, c) => (a.at < c.at ? 1 : -1));

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-navy/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Case ${m.lan}`}
      >
        <div className="border-b border-line px-5 pt-4">
          <div className="flex items-start gap-3">
            <div>
              <div className="num text-[12px] text-muted">{m.lan} · {m.product}</div>
              <h2 className="text-[18px] font-medium">Tata Capital Ltd vs {b.name}</h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Chip tone={STAGE_TONE[m.stage]}>{m.stage}</Chip>
                <Chip>Section 138 NI Act</Chip>
                {m.labels.map((l) => (
                  <Chip key={l} tone="plum">
                    {l}
                  </Chip>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-muted hover:bg-ground" aria-label="Close">
              <XIcon className="size-5" />
            </button>
          </div>
          <div className="mt-3 flex gap-5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 pb-2 text-[13px] font-medium ${tab === t ? "border-blue text-blue" : "border-transparent text-muted"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-[13px]">
          {tab === "Overview" ? (
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Borrower">{b.name}</Field>
              <Field label="Constitution">{b.constitution}</Field>
              <Field label="Mobile">{b.mobile}</Field>
              <Field label="Email">{b.email}</Field>
              <div className="col-span-2">
                <Field label="Addresses">
                  {b.addresses.map((a) => (
                    <div key={a.line}>
                      <span className="text-muted">{a.type}:</span> {a.line}, {a.city} {a.pincode}
                    </div>
                  ))}
                </Field>
              </div>
              {b.persons.length ? (
                <div className="col-span-2">
                  <Field label="Directors / partners">
                    {b.persons.map((p) => (
                      <div key={p.name}>
                        {p.name}, {p.designation}
                      </div>
                    ))}
                  </Field>
                </div>
              ) : null}
              <Field label="Branch">{m.branch} · {m.region}</Field>
              <Field label="Legal manager">{m.legalManager}</Field>
              <Field label="Advocate">
                {m.advocate ? (
                  <>
                    {m.advocate.name} <span className="num text-muted">{m.advocate.enrolment}</span>
                  </>
                ) : (
                  <span className="font-medium text-amber">Unassigned</span>
                )}
              </Field>
              <Field label="DPD">
                <span className="num">{m.dpd}</span>
              </Field>
              <Field label="NPA since">{formatDate(m.npaDate)}</Field>
              <Field label="Outstanding">
                <span className="num">{formatINR(m.outstanding)}</span>
              </Field>
              <Field label="Cause of action">{formatDate(causeOfAction(m))}</Field>
              <Field label="File by">{formatDate(limitationEnds(m))}</Field>
              {m.push ? (
                <Field label="SARAS 2.0 batch">
                  <a href={m.push.url} target="_blank" rel="noreferrer" className="num text-blue underline">
                    {m.push.batchNumber}
                  </a>
                </Field>
              ) : null}
              {m.cnr ? <Field label="CNR">{m.cnr}</Field> : null}
            </dl>
          ) : null}

          {tab === "Instrument & notice" ? (
            <div className="flex flex-col gap-5">
              {m.instruments.map((q, i) => (
                <section key={q.chequeNo}>
                  <h3 className="mb-2 font-medium">Cheque {m.instruments.length > 1 ? i + 1 : ""}</h3>
                  <dl className="grid grid-cols-2 gap-4">
                    <Field label="Cheque no."><span className="num">{q.chequeNo}</span></Field>
                    <Field label="Amount"><span className="num">{formatINR(q.amount)}</span></Field>
                    <Field label="Cheque date">{formatDate(q.chequeDate)}</Field>
                    <Field label="Drawee IFSC"><span className="num">{q.draweeIfsc}</span></Field>
                    <Field label="Drawer account"><span className="num">{q.drawerAccount}</span></Field>
                    <Field label="Deposited">{formatDate(q.depositDate)} at <span className="num">{q.collectingIfsc}</span></Field>
                    <Field label="Returned">{formatDate(q.returnDate)}</Field>
                    <Field label="Return reason">{q.returnReason}</Field>
                  </dl>
                </section>
              ))}
              <section>
                <h3 className="mb-2 font-medium">Demand notice</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <Field label="Dispatched">{formatDate(m.notice.dispatchDate)}</Field>
                  <Field label="Mode">{m.notice.mode}</Field>
                  <Field label="Consignment no."><span className="num">{m.notice.consignmentNo}</span></Field>
                  <Field label="Status">{m.notice.status}{m.notice.statusDate ? `, ${formatDate(m.notice.statusDate)}` : ""}</Field>
                  <Field label="Reply received">{m.notice.replyReceived ? "Yes" : "No"}</Field>
                  <Field label="Received after notice"><span className="num">{formatINR(m.receivedAfterNotice)}</span></Field>
                </dl>
              </section>
              {m.notes.length ? (
                <section>
                  <h3 className="mb-2 font-medium">Notes</h3>
                  {m.notes.map((n) => (
                    <div key={n.at} className="rounded-md bg-ground p-3">
                      <div className="text-[11px] text-muted">
                        {n.by} · {formatDate(n.at)} {n.tag ? <Chip tone="plum">{n.tag}</Chip> : null}
                      </div>
                      <p className="mt-1">{n.text}</p>
                    </div>
                  ))}
                </section>
              ) : null}
            </div>
          ) : null}

          {tab === "Documents" ? (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
              {m.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                  <FileTextIcon className="size-4 text-red" aria-hidden />
                  <a href={`/api/documents/${encodeURIComponent(d.id)}`} target="_blank" rel="noreferrer" className="flex-1 hover:underline">
                    {d.name}
                  </a>
                  <Chip>{d.tag}</Chip>
                  <span className="num text-[11px] text-muted">{formatDate(d.uploadedOn)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "Activity" ? (
            <ol className="relative ml-2 border-l border-line">
              {activity.map((a, i) => (
                <li key={`${a.at}-${i}`} className="mb-4 ml-4">
                  <span className={`absolute -left-1.5 mt-1 size-3 rounded-full border-2 border-white ${i === 0 ? "bg-blue" : "bg-muted/50"}`} />
                  <div className="num text-[11px] text-muted">{formatDate(a.at)}</div>
                  <div>{a.text}</div>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
