import { Suspense } from "react";
import { ListChecksIcon } from "lucide-react";

import { TasksScreen, TasksScreenFallback } from "@/components/tasks/tasks-screen";
import { ProfileScopedEmpty } from "@/components/shell/profile-scoped-empty";

/** All pending tasks. `useSearchParams` needs a Suspense boundary above it. */
export default function TasksPage() {
  return (
    <Suspense fallback={<TasksScreenFallback />}>
      <ProfileScopedEmpty
        title="Nothing to act on"
        description="Filings, payments, and signatures that need your action appear here."
        icon={<ListChecksIcon aria-hidden />}
      >
        <TasksScreen />
      </ProfileScopedEmpty>
    </Suspense>
  );
}
