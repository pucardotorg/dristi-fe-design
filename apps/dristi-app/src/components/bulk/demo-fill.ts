/**
 * Demo helpers: values and files that let a case be walked to filing in a demo without
 * typing. Dates are counted back from today so the case is filable now, inside the
 * one-month limit, with no condonation reason needed. Nothing is saved until the filer
 * presses Save (values) or the upload completes (files).
 */

import type { CaseField } from "@/lib/bulk/case-fields";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/** Cheque dated, presented, returned; notice sent, delivered; cause of action 13 days ago. */
const DATES: [RegExp, number][] = [
  [/\.dateOnCheque$/, 60],
  [/^cheques\.\d+\.presentDate$/, 50],
  [/^cheques\.\d+\.returnDate$/, 46],
  [/\.dispatchDate$/, 36],
  [/\.deliveryDate$/, 28],
  [/^notices\.\d+\.returnDate$/, 28],
];

const TEXT: [RegExp, string][] = [
  [/\.chequeNumber$/, "123456"],
  [/\.amount$/, "125000"],
  [/\.partAmount$/, "10000"],
  [/\.ifsc$/, "SBIN0060421"],
  [/(mobile)$/, "9879012399"],
  [/email$/, "demo.accused@mail.example"],
  [/addr\.line1$|\.line1$/, "14, Shanti Nagar Society, Navrangpura"],
  [/\.city$/, "Ahmedabad"],
  [/\.pin$/, "380009"],
  [/Police$|drawerPolice$|payeePolice$/, "Navrangpura Police Station"],
  [/\.(name|fullName|entName)$|reps\.0\.name$/, "Demo Person"],
  [/designation$/, "Director"],
  [/\.tracking$/, "RG204599901IN"],
  [/\.age$/, "40"],
  [/entCinPan$/, "AAACT1234A"],
];

/** A demo value for a field, or `null` to leave it. */
export function demoValue(f: CaseField): string | null {
  if (f.kind === "date") {
    const hit = DATES.find(([re]) => re.test(f.path));
    return hit ? daysAgo(hit[1]) : null;
  }
  if (f.kind === "select") {
    if (/\.delivered$/.test(f.path)) return "yes";
    if (/\.replied$/.test(f.path)) return "no";
    if (/\.paymentStatus$/.test(f.path)) return "none";
    return f.options?.[0]?.value ?? null;
  }
  if (f.kind === "textarea") return null;
  return TEXT.find(([re]) => re.test(f.path))?.[1] ?? null;
}

/**
 * The edits that fill a case for a demo: every date (so they agree with one another),
 * and every required field still empty.
 */
export function demoEdits(
  groups: { fields: CaseField[] }[],
  edits: Record<string, string>,
  /** Fields a problem sits on, filled whether required or not. */
  flagged: Set<string> = new Set(),
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of groups.flatMap((g) => g.fields)) {
    const now = edits[f.path] ?? f.value;
    if (
      f.kind !== "date" &&
      !flagged.has(f.path) &&
      (!f.required || now.trim())
    )
      continue;
    const v = demoValue(f);
    if (v !== null && v !== now) out[f.path] = v;
  }
  return out;
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
