/**
 * The demo spreadsheets, served from the repo's `demo-files/` so the upload can offer
 * them without the filer finding them on disk. Only the files named here are served.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Sample key → file in `demo-files/`. */
const SAMPLES: Record<string, string> = {
  template: "tata-capital-bulk-filing-template.xlsx",
  custom: "tata-capital-recovery-mis.xlsx",
};

export async function GET(_req: Request, ctx: { params: Promise<{ sample: string }> }) {
  const { sample } = await ctx.params;
  const name = SAMPLES[sample];
  if (!name) return new Response("Not found", { status: 404 });
  try {
    // The app runs from `apps/dristi-app`; the demo files sit at the repo root.
    const bytes = await fs.readFile(path.resolve(process.cwd(), "..", "..", "demo-files", name));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": XLSX,
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
