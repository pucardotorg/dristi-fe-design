import type { Metadata } from "next";

import { DetailsFormatsScreen } from "@/components/filing/details-format-config";

export const metadata: Metadata = { title: "Additional details formats" };

export default function DetailsFormatsPage() {
  // The shell owns the header and nav landmarks, so the screen owns `main`.
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <DetailsFormatsScreen />
    </main>
  );
}
