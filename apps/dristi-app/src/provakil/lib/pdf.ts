/**
 * A one-page PDF with a heading and some lines of text — enough to stand in for the
 * scanned documents a matter holds. Plain PDF 1.4, Helvetica, no dependencies.
 */

function esc(s: string): string {
  return s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7E]/g, "");
}

export function simplePdf(title: string, lines: string[]): Uint8Array {
  const body: string[] = ["BT", "/F1 18 Tf", "56 780 Td", `(${esc(title)}) Tj`, "/F1 11 Tf", "0 -30 Td"];
  for (const line of lines) body.push(`(${esc(line)}) Tj`, "0 -18 Td");
  body.push("ET", "0.8 G", "56 60 m 539 60 l S");
  const stream = body.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}
