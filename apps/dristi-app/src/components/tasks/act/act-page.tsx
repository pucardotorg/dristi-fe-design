"use client";

/**
 * The full-page act frame — for the flows that do NOT act in the list's modal (the
 * owner's rule: apart from uploading files and making payments, nothing happens in a
 * modal). Signing, fixing a scrutiny return and filing-flow drafts continue here, in
 * their own page: breadcrumb Tasks › task title › action, a back link, the quiet
 * sandbox/interim notice, and the act body inside one lifted panel. On completion the
 * toast fires and the page returns to `/tasks?task=<id>` with the row focused.
 */

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";

import { canComplete, canView } from "@/lib/tasks/permissions";
import { useTasks } from "@/lib/tasks/store";
import type { Task } from "@/lib/tasks/types";
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
import { Breadcrumbs } from "@/components/shell/chrome";
import { useOrigin } from "@/components/shell/origin";
import { SectionNotice } from "@/components/shell/notices";
import { PANEL_CLASS } from "@/components/shell/panel";
import { type ActContext } from "@/components/tasks/act/shared";
import { FileBody } from "@/components/tasks/act/file-page";
import { PayBody } from "@/components/tasks/act/pay-page";
import { SignBody } from "@/components/tasks/act/sign-page";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

export type ActPageAction = "sign" | "continue";

const CRUMB: Record<ActPageAction, string> = {
  sign: "Sign",
  continue: "Continue",
};

/** The one quiet notice per page: what is interim, and what is not real here. */
function Notice({ action, task }: { action: ActPageAction; task: Task }) {
  if (action === "sign" || (action === "continue" && task.kind === "sign")) {
    return (
      <SectionNotice variant="neutral" title="Sandbox">
        Any 6-digit OTP is accepted and the signature stamp is generated locally — nothing
        reaches a court.
      </SectionNotice>
    );
  }
  return (
    <SectionNotice variant="neutral" title="Interim screen">
      The e-filing flow is not built yet — this stands in for it. Sandbox: uploads stay in
      this browser and the registry&apos;s answer is whatever you pick.
    </SectionNotice>
  );
}

/** A draft continues in the experience its kind asks for; deep links land safely too. */
function Body({ ctx, action }: { ctx: ActContext; action: ActPageAction }) {
  const kind = ctx.task.kind;
  if (action === "sign" || kind === "sign") return <SignBody ctx={ctx} />;
  if (kind === "pay") return <PayBody ctx={ctx} />;
  return <FileBody ctx={ctx} />;
}

export function TaskActPage({ action }: { action: ActPageAction }) {
  const courtText = useCourtText();
  const params = useParams<{ taskId: string }>();
  const router = useRouter();
  const origin = useOrigin();
  const { state, tasks, cases, people, user, online, requestHighlight } = useTasks();
  const id = decodeURIComponent(params.taskId);
  const task = tasks.find((t) => t.id === id) ?? null;
  const kase = task ? (cases.find((c) => c.id === task.caseId) ?? null) : null;

  const finish = React.useCallback(
    (message?: string, taskId?: string) => {
      const target = taskId ?? id;
      requestHighlight(target);
      if (message) toast.success(message);
      router.push(`/tasks?task=${encodeURIComponent(target)}`);
    },
    [id, requestHighlight, router]
  );

  const missing = state === "ready" && (!task || !kase);
  const forbidden = state === "ready" && !!task && !!kase && !canView(user, kase);

  if (state !== "ready" || missing || forbidden || !task || !kase) {
    return (
      <main className="flex min-w-0 flex-1 flex-col">
        <Breadcrumbs root={origin} crumbs={[{ label: CRUMB[action] }]} />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
          {state !== "ready" ? (
            <>
              <Skeleton className="h-8 w-96" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </>
          ) : (
            <Card className={cn(PANEL_CLASS, "py-0")}>
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileTextIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>{forbidden ? "Not on your access" : "This task is not here"}</EmptyTitle>
                  <EmptyDescription>
                    {forbidden
                      ? "You are not on this case's vakalatnama or its access list."
                      : "It may have been reset with the sandbox, or the link is wrong."}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild variant="outline">
                    <Link href="/tasks">Back to tasks</Link>
                  </Button>
                </EmptyContent>
              </Empty>
            </Card>
          )}
        </div>
      </main>
    );
  }

  const ctx: ActContext = {
    task,
    kase,
    user,
    people,
    online,
    signatory: canComplete(user, kase),
    finish,
  };
  // The door, if the link that opened this page recorded one; the task's detail if not.
  const back = origin?.href ?? `/tasks?task=${encodeURIComponent(task.id)}`;

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <Breadcrumbs
        root={origin}
        crumbs={
          origin
            ? [{ label: CRUMB[action] }]
            : [{ label: task.title, href: back }, { label: CRUMB[action] }]
        }
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <Button asChild variant="ghost" size="xs" className="self-start text-muted-foreground">
            <Link href={back}>
              <ArrowLeftIcon data-icon="inline-start" aria-hidden />
              Back to tasks
            </Link>
          </Button>
          <header className="flex flex-col gap-1">
            <h1 className="text-title font-semibold text-foreground text-balance">{task.title}</h1>
            <p className="text-body-compact text-muted-foreground">
              {kase.parties}
              {kase.stNumber ? (
                <>
                  {" · "}
                  <Identifier value={kase.stNumber} label="case number" />
                </>
              ) : (
                " · Not yet numbered"
              )}
              {" · "}
              {courtText(kase.court)}
            </p>
          </header>
        </div>

        <Notice action={action} task={task} />

        {/* One lifted panel holds the flow; its wells sit inside it, per the layering.
            The Card's own --card-spacing supplies the vertical padding. */}
        <Card className={cn(PANEL_CLASS, "px-6")}>
          <Body ctx={ctx} action={action} />
        </Card>
      </div>
    </main>
  );
}
