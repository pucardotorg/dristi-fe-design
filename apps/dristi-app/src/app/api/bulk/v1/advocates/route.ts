/**
 * Bulk Filing API v1 — `GET /api/bulk/v1/advocates`: the advocates registered on this
 * court who may file for the client, so a litigation system can assign cases to them
 * before pushing. Each push then lands in that advocate's own login.
 *
 * Demo: the signed-in advocate's office (their People page), in this deployment's names
 * and Bar numbers. The live service answers from the court's advocate registry.
 */

import { NextResponse } from "next/server";

import { OFFICE_ADVOCATES } from "@/lib/bulk/clients";
import { localizeCourtText } from "@/lib/court/localize";

const API_KEY = process.env.BULK_API_KEY ?? "dristi-demo-key";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${API_KEY}`) {
    return NextResponse.json({ error: "Missing or wrong API key." }, { status: 401 });
  }
  return NextResponse.json({
    court: "SARAS 2.0, Gujarat",
    advocates: OFFICE_ADVOCATES.map((a) => ({
      name: localizeCourtText(a.name, "gujarat"),
      barNumber: localizeCourtText(a.barNumber, "gujarat"),
    })),
  });
}
