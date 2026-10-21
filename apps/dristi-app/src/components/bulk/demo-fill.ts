/**
 * Demo helpers: values and files that let a case be walked to filing in a demo without
 * typing. Dates are counted back from today so the case is filable now, inside the
 * one-month limit, with no condonation reason needed. Values are saved as any edit in the
 * case is; files once the upload completes.
 */

import { blankRepresentative } from "@/lib/filing/blank";
import {
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  RETURN_REASONS,
} from "@/lib/filing/options";
import type { Address, FilingDraft } from "@/lib/filing/types";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const or = (v: string, fallback: string) => (v.trim() ? v : fallback);

function address(a: Address) {
  a.line1 = or(a.line1, "14, Shanti Nagar Society, Navrangpura");
  a.city = or(a.city, "Ahmedabad");
  a.pin = or(a.pin, "380009");
}

/**
 * Fill a case for a demo, in the draft the filing sections edit: every date (cheque
 * dated, presented, returned; notice sent and delivered; cause of action 13 days ago, so
 * no condonation reason is needed), and every required field still empty. Values already
 * there are kept, except the dates, which have to agree with one another.
 */
export function demoFill(d: FilingDraft): void {
  d.cheques.forEach((q) => {
    q.dateOnCheque = daysAgo(60);
    q.presentDate = daysAgo(50);
    q.returnDate = daysAgo(46);
    q.chequeNumber = or(q.chequeNumber, "123456");
    q.amount = or(q.amount, "125000");
    q.ifsc = or(q.ifsc, "SBIN0060421");
    q.returnReason = or(q.returnReason, RETURN_REASONS[0].value);
  });
  d.notices.forEach((n) => {
    n.dispatchDate = daysAgo(36);
    n.natureDebt = or(n.natureDebt, NATURE_OF_DEBT[0].value);
    n.modeService = or(n.modeService, MODE_OF_SERVICE[0].value);
    n.delivered = "yes";
    n.deliveryDate = daysAgo(28);
    n.returnDate = "";
    n.nonDeliveryReason = "";
    n.replied = n.replied || "no";
    n.paymentStatus = n.paymentStatus || "none";
  });
  d.accused.forEach((a) => {
    a.name = or(a.name, "Demo Person");
    if (!a.contacts.length) a.contacts.push({ mobile: "", email: "" });
    if (!a.contacts[0].mobile.trim() && !a.contacts[0].email.trim())
      a.contacts[0].mobile = "9879012399";
    a.addresses.forEach((b) => address(b.addr));
    if (a.type === "institution") {
      if (!a.reps.length) a.reps.push(blankRepresentative());
      a.reps[0].name = or(a.reps[0].name, "Demo Person");
      a.reps[0].designation = or(a.reps[0].designation, "Director");
    }
  });
  const j = d.jurisdiction;
  if (j.deposited === "yes") j.ifsc = or(j.ifsc, "SBIN0060421");
  else j.drawerPolice = or(j.drawerPolice, "Navrangpura Police Station");
  d.witnesses.forEach((w) => {
    if (w.fullName.trim() && w.addresses[0]) address(w.addresses[0].addr);
  });
}

/** A one-page PDF saying it is a demo document, named for its slot. */
export function demoPdf(name: string): File {
  const text = `Demo document: ${name}`.replace(/[()\\]/g, "");
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new File(
    [body],
    `${name.replace(/[^\w]+/g, "-").toLowerCase()}-demo.pdf`,
    { type: "application/pdf" },
  );
}
