import type { Metadata } from "next";
import { CheckCircle2Icon, ChevronRightIcon, ScaleIcon } from "lucide-react";

import { DRISTI_URL } from "@/lib/config.server";
import { MAPPING } from "@/lib/connector";
import { ADVOCATES, BANK, OFFICERS } from "@/lib/matters";

export const metadata: Metadata = { title: "SARAS 2.0 connector" };

/** Settings › Integrations › SARAS 2.0: what the connector sends, and from where. */
export default function Page() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <nav className="flex items-center gap-1 text-[12px] text-muted" aria-label="Breadcrumb">
          <span>Settings</span>
          <ChevronRightIcon className="size-3" aria-hidden />
          <span>Integrations</span>
        </nav>
        <div className="mt-1 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-plum-50 text-plum">
            <ScaleIcon className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-[22px] font-medium">SARAS 2.0 e-filing connector</h1>
            <p className="text-[13px] text-muted">Section 138 complaints to SARAS 2.0, Gujarat, through its Bulk Filing API</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-[12px] font-medium text-[#00796b]">
            <CheckCircle2Icon className="size-4" aria-hidden />
            Connected
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-medium">Connection</h2>
          <dl className="flex flex-col gap-2 text-[13px]">
            <div><dt className="text-[11px] text-muted uppercase">Endpoint</dt><dd className="num break-all">{DRISTI_URL}/api/bulk/v1/batches</dd></div>
            <div><dt className="text-[11px] text-muted uppercase">API key</dt><dd className="num">••••••••••••-key</dd></div>
            <div><dt className="text-[11px] text-muted uppercase">Court</dt><dd>Ahmedabad, Gujarat (S-138 NI Act)</dd></div>
            <div><dt className="text-[11px] text-muted uppercase">Willing to settle by ADR</dt><dd>No</dd></div>
          </dl>
        </section>
        <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-medium">Complainant (company profile)</h2>
          <dl className="flex flex-col gap-2 text-[13px]">
            <div><dt className="text-[11px] text-muted uppercase">Legal name</dt><dd>{BANK.legalName}</dd></div>
            <div><dt className="text-[11px] text-muted uppercase">CIN</dt><dd className="num">{BANK.cin}</dd></div>
            <div><dt className="text-[11px] text-muted uppercase">Registered office</dt><dd>{BANK.registeredOffice.line}, {BANK.registeredOffice.city} {BANK.registeredOffice.pincode}</dd></div>
          </dl>
        </section>
        <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-medium">Authorised officers</h2>
          <ul className="flex flex-col gap-2 text-[13px]">
            {Object.entries(OFFICERS).map(([region, o]) => (
              <li key={region}>
                <div className="font-medium">{o.name}</div>
                <div className="text-[12px] text-muted">{o.designation} · {region}</div>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 mb-2 text-[11px] text-muted uppercase">Empanelled advocates</h3>
          <ul className="flex flex-col gap-1 text-[13px]">
            {ADVOCATES.map((a) => (
              <li key={a.enrolment}>{a.name} <span className="num text-muted">{a.enrolment}</span></li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="border-b border-line p-4">
          <h2 className="font-medium">Field mapping</h2>
          <p className="text-[13px] text-muted">Fixed rules. A value no rule covers is sent as it is and held by SARAS 2.0 for review.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="bg-[#f7f9fc] text-[11px] tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">SARAS 2.0 field</th>
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Provakil source</th>
                <th className="px-4 py-2.5">Rule</th>
              </tr>
            </thead>
            {MAPPING.map((g) => (
              <tbody key={g.group}>
                <tr>
                  <th colSpan={4} className="bg-ground px-4 py-2 text-left text-[12px] font-medium text-slate">{g.group}</th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.id + r.dristi} className="border-t border-line">
                    <td className="px-4 py-2">{r.dristi}</td>
                    <td className="num px-4 py-2 text-muted">{r.id}</td>
                    <td className="px-4 py-2">{r.provakil}</td>
                    <td className="px-4 py-2 text-slate">{r.rule}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    </div>
  );
}
