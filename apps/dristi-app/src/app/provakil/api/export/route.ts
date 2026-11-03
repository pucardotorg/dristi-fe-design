/**
 * Export matters in the SARAS 2.0 bulk filing template, for an advocate who uploads the
 * file on SARAS 2.0 instead of filing through the connector. Same mapping as the connector.
 */

import ExcelJS from "exceljs";

import { mapMatter } from "@/provakil/lib/connector";
import {
  CASES_SHEET,
  LISTS,
  TEMPLATE_COUNTS,
  templateColumns,
  toSheetDate,
  type Instance,
  type ListName,
} from "@/provakil/lib/saras-template";
import { ADVOCATES, allMatters, type Matter } from "@/provakil/lib/matters";

const label = (list: ListName, value: string) => LISTS[list].find((o) => o.value === value)?.label ?? value;
const yn = (b: boolean) => (b ? "Yes" : "No");

/** Provakil's own case report: its column names and values, not the court's. */
async function provakilReport(matters: Matter[]): Promise<Response> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Provakil";
  const ws = wb.addWorksheet("Section 138 cases");
  const cols = [
    "LAN", "Borrower Name", "Constitution", "Product", "Branch", "Mobile", "Email", "Address", "City", "Pincode",
    "Cheque No", "Cheque Date", "Cheque Amount", "Drawee IFSC", "Drawer A/c No", "Deposit Date", "Collecting IFSC",
    "Return Date", "Return Reason", "Notice Date", "Dispatch Mode", "Consignment No", "Notice Status", "Status Date",
    "Reply Received", "Amount Received After Notice", "Advocate", "Enrolment No",
  ];
  ws.columns = cols.map((h) => ({ header: h, key: h, width: Math.max(14, h.length + 4) }));
  ws.getRow(1).font = { bold: true };
  const d = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`) : "");
  for (const m of matters) {
    const q = m.instruments[0];
    const a = m.borrower.addresses[0];
    ws.addRow({
      LAN: m.lan,
      "Borrower Name": m.borrower.name,
      Constitution: m.borrower.constitution,
      Product: m.product,
      Branch: m.branch,
      Mobile: m.borrower.mobile ?? "",
      Email: m.borrower.email ?? "",
      Address: a?.line ?? "",
      City: a?.city ?? "",
      Pincode: a?.pincode ?? "",
      "Cheque No": q.chequeNo,
      "Cheque Date": d(q.chequeDate),
      "Cheque Amount": q.amount,
      "Drawee IFSC": q.draweeIfsc,
      "Drawer A/c No": q.drawerAccount,
      "Deposit Date": d(q.depositDate),
      "Collecting IFSC": q.collectingIfsc,
      "Return Date": d(q.returnDate),
      "Return Reason": q.returnReason,
      "Notice Date": d(m.notice.dispatchDate),
      "Dispatch Mode": m.notice.mode,
      "Consignment No": m.notice.consignmentNo,
      "Notice Status": m.notice.status,
      "Status Date": d(m.notice.statusDate),
      "Reply Received": m.notice.replyReceived ? "Yes" : "No",
      "Amount Received After Notice": m.receivedAfterNotice,
      Advocate: m.advocate?.name ?? "",
      "Enrolment No": m.advocate?.enrolment ?? "",
    });
  }
  ["Cheque Date", "Deposit Date", "Return Date", "Notice Date", "Status Date"].forEach((h) => (ws.getColumn(h).numFmt = "dd-mmm-yyyy"));
  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="provakil-s138-report-${stamp}.xlsx"`,
    },
  });
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  // The advocate on each case, as the workspace holds it (`provakil/lib/workspace.ts`).
  const adv = (params.get("adv") ?? "").split(",");
  const matters = allMatters()
    .filter((m) => ids.includes(m.id))
    .map((m) => {
      const a = ADVOCATES.find((x) => x.enrolment === adv[ids.indexOf(m.id)]);
      return a ? { ...m, advocate: a } : m;
    });
  const docBase = `${new URL(req.url).origin}/provakil`;
  if (params.get("format") === "provakil") return provakilReport(matters);

  // The template's columns, with as many cheques, accused and addresses as the busiest
  // matter has: further instances are numbered as the template numbers them.
  const mapped = matters.map((m) => mapMatter(m, docBase));
  const most = (f: (c: (typeof mapped)[number]) => number, floor = 1) => Math.max(floor, ...mapped.map(f));
  const all = templateColumns({
    ...TEMPLATE_COUNTS,
    accused: most((c) => c.accused.length, TEMPLATE_COUNTS.accused),
    address: most((c) => Math.max(...c.accused.map((a) => a.addresses.length))),
    person: most((c) => Math.max(...c.accused.map((a) => a.personsResponsible?.length ?? 0))),
    cheque: most((c) => c.cheques.length),
    notice: most((c) => c.notices.length),
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Provakil";
  const cases = wb.addWorksheet(CASES_SHEET);
  cases.columns = all.map((t) => ({ header: t.header, key: t.header, width: Math.max(14, t.header.length + 4) }));
  cases.getRow(1).font = { bold: true };

  for (const c of mapped) {
    const at = <T,>(list: T[] | undefined, i: Instance, k = 0) => list?.[(i[k] ?? 1) - 1];
    const value = (key: string, i: Instance): string | number => {
      const a = at(c.accused, i);
      const ad = a ? at(a.addresses, i, 1) : undefined;
      const p = a ? at(a.personsResponsible, i, 1) : undefined;
      const q = at(c.cheques, i);
      const n = at(c.notices, i);
      const first = i[0] === 1;
      const j = c.jurisdiction;
      switch (key) {
        case "reference": return c.reference;
        case "accusedType": return a ? label("accusedType", a.type) : "";
        case "accusedName": return a?.name ?? "";
        case "accusedAge": return a?.age ?? "";
        case "accusedEntity": return a?.institutionType ? label("accusedEntity", a.institutionType) : "";
        case "accusedMobile": return a?.mobile ?? "";
        case "accusedEmail": return a?.email ?? "";
        case "accusedAddress": return ad?.line1 ?? "";
        case "accusedCity": return ad?.city ?? "";
        case "accusedPin": return ad?.pin ?? "";
        case "accusedPolice": return ad?.policeStation ?? "";
        case "personName": return p?.name ?? "";
        case "personDesignation": return p?.designation ?? "";
        case "personMobile": return p?.mobile ?? "";
        case "personEmail": return p?.email ?? "";
        case "personAddress": return p?.address?.line1 ?? "";
        case "personCity": return p?.address?.city ?? "";
        case "personPin": return p?.address?.pin ?? "";
        case "personPolice": return p?.address?.policeStation ?? "";
        case "chequeNumber": return q?.number ?? "";
        case "chequeDate": return q ? toSheetDate(q.date) : "";
        case "chequeAmount": return q?.amount ?? "";
        case "chequeIfsc": return q?.ifsc ?? "";
        case "chequeAccount": return q?.accountNumber ?? "";
        case "presentDate": return q ? toSheetDate(q.presentedOn) : "";
        case "returnDate": return q ? toSheetDate(q.returnedOn) : "";
        case "returnReason": return q ? label("returnReason", q.returnReason) : "";
        // One set of jurisdiction bank details per case: written against the first cheque.
        case "payeeIfsc": return q && first ? (j.complainantBranchIfsc ?? "") : "";
        case "natureDebt": return n ? label("natureOfDebt", n.natureOfDebt) : "";
        case "dispatchDate": return n ? toSheetDate(n.dispatchedOn) : "";
        case "mode": return n ? label("modeOfService", n.mode) : "";
        case "tracking": return n?.trackingNumber ?? "";
        case "delivered": return !n || n.delivered === null ? "" : yn(n.delivered);
        case "deliveryDate": return n?.deliveredOn ? toSheetDate(n.deliveredOn) : "";
        case "noticeReturnDate": return n?.returnedOn ? toSheetDate(n.returnedOn) : "";
        case "nonDelivery": return n?.nonDeliveryReason ? label("nonDelivery", n.nonDeliveryReason) : "";
        case "replied": return n && n.replied != null ? yn(n.replied) : "";
        case "payment": return n ? label("payment", n.payment.status) : "";
        case "paidAmount": return n?.payment.amount ?? "";
        case "deposited": return j.depositedInOwnAccount == null ? "" : yn(j.depositedInOwnAccount);
        case "condonation": return c.condonationReason ?? "";
        // Provakil holds nothing for the rest; the filer completes them on SARAS 2.0.
        default: return "";
      }
    };
    cases.addRow(Object.fromEntries(all.map((t) => [t.header, value(t.column.key, t.instance)])));
  }

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="saras-bulk-filing-${stamp}.xlsx"`,
    },
  });
}
