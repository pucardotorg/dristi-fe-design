/**
 * Reads case documents for the AI-assisted upload: one Word file or PDF per case, each
 * read for the bulk sheet's fields (`lib/bulk/case-doc.ts`, a stand-in for the model).
 * Nothing is stored; the filer reviews every case before a batch is made.
 */

import { NextResponse } from "next/server";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import { caseDocText, extractCase } from "@/lib/bulk/case-doc";

export const dynamic = "force-dynamic";

const MAX_FILES = 200;

export async function POST(req: Request) {
  const form = await req.formData();
  // Reading documents is AI: with AI off or unavailable the route says so and does nothing.
  const ai = aiModeFrom(form.get("ai")?.toString() ?? null);
  if (ai !== "on") return NextResponse.json({ error: "AI reading is not available. Upload an Excel file instead." }, { status: 409 });
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "No files were sent." }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `At most ${MAX_FILES} documents at a time.` }, { status: 413 });
  const cases = await Promise.all(
    files.map(async (f) => {
      const bytes = new Uint8Array(await f.arrayBuffer());
      let text: string | null = null;
      try {
        text = await caseDocText(bytes, f.name, f.type);
      } catch {
        text = null;
      }
      return extractCase(f.name, text);
    }),
  );
  return NextResponse.json({ cases });
}
