"use client";

/**
 * The route body for a scrutiny return: find the task, open the filing it corrects, and
 * hand both to the correction screen.
 *
 * It refuses to render a half-loaded correction round. A partially loaded form can show a
 * field as clean when scrutiny flagged it, which is the one failure this screen must not
 * have — so a missing task, a missing filing or a return with no defects each get their
 * own honest end state with a route back (brief §10).
 */

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileTextIcon, InboxIcon } from "lucide-react";

import { ensureScrutinyDraft } from "@/lib/filing/scrutiny-demo";
import { FilingProvider } from "@/lib/filing/store";
import { ProfileProvider } from "@/lib/filing/profile";
import { canView } from "@/lib/tasks/permissions";
import { useTasks } from "@/lib/tasks/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { PANEL_CLASS } from "@/components/shell/panel";
import { CorrectionScreen } from "@/components/scrutiny/correction-screen";
import { Breadcrumbs, type Crumb } from "@/components/shell/chrome";
import { useOrigin } from "@/components/shell/origin";

/**
 * Every state of this route, dead ends included, sits under the same trail — rooted at
 * the door it was reached through when the link recorded one.
 */
function Frame({ children, root }: { children: React.ReactNode; root?: Crumb | null }) {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <Breadcrumbs root={root} crumbs={[{ label: "Scrutiny return" }]} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}

function Dead({
  title,
  description,
  taskId,
  origin,
}: {
  title: string;
  description: string;
  taskId?: string;
  origin?: Crumb | null;
}) {
  // The way out is the door, when one was recorded — a dead end is the worst place to
  // put someone down in an area they did not come from.
  const back = origin?.href ?? (taskId ? `/tasks?task=${encodeURIComponent(taskId)}` : "/tasks");
  return (
    <Frame root={origin}>
      <Card className={cn(PANEL_CLASS, "py-0")}>
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link href={back}>{origin ? `Back to ${origin.label}` : "Back to tasks"}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </Card>
    </Frame>
  );
}

function Loading({ root }: { root?: Crumb | null }) {
  return (
    <Frame root={root}>
      <Skeleton className="h-8 w-96" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </Frame>
  );
}

export function ScrutinyReturnPage() {
  const params = useParams<{ taskId: string }>();
  const origin = useOrigin();
  const { state, tasks, cases, user } = useTasks();
  const id = decodeURIComponent(params.taskId);
  const task = tasks.find((t) => t.id === id) ?? null;
  const kase = task ? (cases.find((c) => c.id === task.caseId) ?? null) : null;
  const draftId = task?.draftId;

  /* The demonstrated return's filing is seeded into this browser on first arrival. */
  const [seeded, setSeeded] = React.useState(false);
  React.useEffect(() => {
    if (!draftId) return;
    let live = true;
    void ensureScrutinyDraft(draftId).then(() => {
      if (live) setSeeded(true);
    });
    return () => {
      live = false;
    };
  }, [draftId]);

  if (state !== "ready") return <Loading root={origin} />;

  if (!task || !kase) {
    return (
      <Dead
        title="This task is not here"
        description="It may have been reset with the sandbox, or the link is wrong."
        origin={origin}
      />
    );
  }
  if (!canView(user, kase)) {
    return (
      <Dead
        title="Not on your access"
        description="You are not on this case's vakalatnama or its access list."
        taskId={task.id}
        origin={origin}
      />
    );
  }
  if (task.kind !== "returned" || !task.returned?.defects.length) {
    return (
      <Dead
        title="Nothing was returned for correction"
        description="This task carries no scrutiny defects, so there is nothing to correct here."
        taskId={task.id}
        origin={origin}
      />
    );
  }

  /*
   * A return on a filing that was not made in DRISTI: the remarks are real, but there is
   * no draft to open, so the screen says so rather than showing an empty form. The
   * officer's remarks stay readable on the task itself.
   */
  if (!draftId) {
    return (
      <Frame root={origin}>
        <Card className={cn(PANEL_CLASS, "py-0")}>
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>This filing was not made in DRISTI</EmptyTitle>
              <EmptyDescription>
                Scrutiny&apos;s remarks are on the task, but there is no draft here to
                correct — the corrected papers go back through the counter.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline">
                <Link href={`/tasks?task=${encodeURIComponent(task.id)}`}>
                  Read the remarks
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      </Frame>
    );
  }

  if (!seeded) return <Loading root={origin} />;

  return (
    <FilingProvider
      draftId={draftId}
      fallback={<Loading />}
      notFound={
        <Dead
          title="We couldn't open the filing"
          description="The returned filing is not in this browser's storage, so it cannot be corrected here."
          taskId={task.id}
          origin={origin}
        />
      }
    >
      {/* The filer's profile, as the filings area mounts it: the signing window that
          now opens over this screen reads who is signing from it. */}
      <ProfileProvider>
        <CorrectionScreen task={task} kase={kase} />
      </ProfileProvider>
    </FilingProvider>
  );
}
