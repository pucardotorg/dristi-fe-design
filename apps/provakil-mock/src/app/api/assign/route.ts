/** Assign an empanelled advocate to matters. */

import { NextResponse } from "next/server";

import { ADVOCATES } from "@/lib/matters";
import { assign } from "@/lib/pushes.server";

export async function POST(req: Request) {
  const { matterIds, enrolment } = (await req.json()) as { matterIds: string[]; enrolment: string };
  if (!ADVOCATES.some((a) => a.enrolment === enrolment) || !matterIds?.length) {
    return NextResponse.json({ error: "Choose an empanelled advocate and at least one case." }, { status: 400 });
  }
  await assign(matterIds, enrolment);
  return NextResponse.json({ ok: true });
}
