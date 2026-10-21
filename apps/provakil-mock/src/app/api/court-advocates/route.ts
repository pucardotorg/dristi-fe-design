/**
 * The advocates who may file for Tata Capital on a court, asked of that court: SARAS 2.0
 * answers through its Bulk Filing API. Other courts are not connected in this demo.
 */

import { NextResponse } from "next/server";

import { DRISTI_API_KEY, DRISTI_URL } from "@/lib/config.server";

export async function GET(req: Request) {
  const court = new URL(req.url).searchParams.get("court");
  if (court !== "saras") return NextResponse.json({ error: "This court is not connected." }, { status: 404 });
  try {
    const res = await fetch(`${DRISTI_URL}/api/bulk/v1/advocates`, {
      headers: { authorization: `Bearer ${DRISTI_API_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(String(res.status));
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: `SARAS 2.0 could not be reached at ${DRISTI_URL}.` }, { status: 502 });
  }
}
