import type { Metadata } from "next";

import { TasksProvider } from "@/lib/tasks/store";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "Take action",
};

/** The tasks area: one store, one shell, one toaster for every screen under `/tasks`. */
export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <TasksProvider>
      <AppShell>{children}</AppShell>
    </TasksProvider>
  );
}
