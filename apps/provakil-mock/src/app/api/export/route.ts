/**
 * Export matters in the SARAS 2.0 bulk filing template, for an advocate who uploads the
 * file on SARAS 2.0 instead of filing through the connector. Same mapping as the connector.
 */

import ExcelJS from "exceljs";

import { PROVAKIL_URL } from "@/lib/config.server";
import { mapMatter } from "@/lib/connector";
import { CASES_SHEET, COLUMNS, LISTS, toSheetDate, type ListName } from "@/lib/saras-template";
import type { Matter } from "@/lib/matters";
import { currentMatters } from "@/lib/workspace.server";

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
  const matters = (await currentMatters()).filter((m) => ids.includes(m.id));
  if (params.get("format") === "provakil") return provakilReport(matters);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Provakil";
  const cases = wb.addWorksheet(CASES_SHEET);
  cases.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: Math.max(14, c.header.length + 4) }));
  cases.getRow(1).font = { bold: true };
  const chequeCols = COLUMNS.filter((c) => ["reference", "chequeNumber", "chequeDate", "chequeAmount", "chequeIfsc", "chequeAccount", "presentDate", "returnDate", "returnReason"].includes(c.key));
  const extra = wb.addWorksheet("Extra cheques");
  extra.columns = chequeCols.map((c) => ({ header: c.header, key: c.key, width: Math.max(14, c.header.length + 4) }));
  extra.getRow(1).font = { bold: true };

  for (const m of matters) {
    const c = mapMatter(m, PROVAKIL_URL);
    const a = c.accused[0];
    const ad = a.addresses[0];
    const n = c.notices[0];
    const cheque = (q: (typeof c.cheques)[number]) => ({
      chequeNumber: q.number,
      chequeDate: toSheetDate(q.date),
      chequeAmount: q.amount,
      chequeIfsc: q.ifsc,
      chequeAccount: q.accountNumber,
      presentDate: toSheetDate(q.presentedOn),
      returnDate: toSheetDate(q.returnedOn),
      returnReason: label("returnReason", q.returnReason),
    });
    cases.addRow({
      reference: c.reference,
      accusedType: label("accusedType", a.type),
      accusedName: a.name,
      accusedEntity: a.institutionType ? label("accusedEntity", a.institutionType) : "",
      accusedAge: a.age ?? "",
      accusedMobile: a.mobile ?? "",
      accusedEmail: a.email ?? "",
      accusedAddress: ad?.line1 ?? "",
      accusedCity: ad?.city ?? "",
      accusedPin: ad?.pin ?? "",
      accusedPolice: ad?.policeStation ?? "",
      personName: a.personsResponsible?.[0]?.name ?? "",
      personDesignation: a.personsResponsible?.[0]?.designation ?? "",
      ...cheque(c.cheques[0]),
      deposited: yn(c.jurisdiction.depositedInOwnAccount),
      payeeIfsc: c.jurisdiction.complainantBranchIfsc,
      drawerPolice: "",
      natureDebt: label("natureOfDebt", n.natureOfDebt),
      dispatchDate: toSheetDate(n.dispatchedOn),
      mode: label("modeOfService", n.mode),
      tracking: n.trackingNumber,
      delivered: n.delivered === null ? "" : yn(n.delivered),
      deliveryDate: n.deliveredOn ? toSheetDate(n.deliveredOn) : "",
      noticeReturnDate: n.returnedOn ? toSheetDate(n.returnedOn) : "",
      nonDelivery: n.nonDeliveryReason ? label("nonDelivery", n.nonDeliveryReason) : "",
      replied: yn(n.replied),
      payment: label("payment", n.payment.status),
      paidAmount: n.payment.amount ?? "",
      condonation: c.condonationReason ?? "",
    });
    for (const q of c.cheques.slice(1)) extra.addRow({ reference: c.reference, ...cheque(q) });
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
