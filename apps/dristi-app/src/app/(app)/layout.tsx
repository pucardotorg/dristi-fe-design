import type { Metadata } from "next";

import { TasksProvider } from "@/lib/tasks/store";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "Cases",
};

/**
 * Neer's Your-Cases flow (list + case file), grafted onto the one shared shell (D1).
 * His pages use absolute imports, so they run under this shell unchanged; DS-compliance
 * cleanup of his screens stays his to do.
 */
export default function CasesLayout({ children }: { children: React.ReactNode }) {
  return (
    <TasksProvider>
      <AppShell>{children}</AppShell>
    </TasksProvider>
  );
}
