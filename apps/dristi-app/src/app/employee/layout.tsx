import type { Metadata } from "next";

import { serverCourtText } from "@/lib/court/server";

/**
 * `/employee/*` — the court-staff area: magistrate, bench clerk, scrutiny officer,
 * typist.
 *
 * Kept apart from `/citizen/*` (advocates, litigants, clerks, parties in person) so the
 * two can be built in parallel without colliding. Nothing here reaches into the citizen
 * screens and nothing there reaches in here — including the app shell, which is the
 * advocate's product and not the bench's.
 *
 * This layout carries the segment's metadata and nothing else. The chrome belongs one
 * level down, to the `(court)` group, so that `/employee/login` can be an `/employee`
 * route without wearing the bench's rail — see `(court)/layout.tsx`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const courtText = await serverCourtText();
  return {
    title: {
      default: "Court staff",
      template: `%s · ${courtText("DRISTI")}`,
    },
  };
}

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
