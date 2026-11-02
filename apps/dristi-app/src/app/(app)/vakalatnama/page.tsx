"use client";

/** Vakalatnama — list of instruments in this browser, and the entry point to create one. */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSignatureIcon, PlusIcon, ScrollTextIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useProfile } from "@/components/shell/profile";
import { createVak, discardVak, useVakList, useStoreReady } from "@/lib/vakalatnama/store";
import { executantName, scopeLabel, statusLabel } from "@/lib/vakalatnama/format";
import type { CreatorRole, Vakalatnama } from "@/lib/vakalatnama/types";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_SUBTITLE,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { cn } from "@/lib/utils";

export default function VakalatnamaListPage() {
  const router = useRouter();
  const list = useVakList();
  const ready = useStoreReady();
  const { profileRole } = useProfile();

  // The creator is whoever is signed in — never asked. Prefill follows from it.
  const creatorRole: CreatorRole = profileRole === "litigant" ? "litigant" : "advocate";

  const create = () => {
    const id = createVak(creatorRole);
    router.push(`/vakalatnama/${id}`);
  };

  return (
    <div className={cn("min-w-0 flex-1", PAGE_GROUND, PAGE_GUTTER)}>
      <div className="flex w-full flex-col gap-6">
        {/* The page's one action rides the heading's row, at its far end, as
            Join a case does on Cases. Held upright, phone or tablet, it drops under the description instead
            (owner, Sept 21): beside a two-line subtitle it crowded the heading. */}
        <header className="flex flex-col gap-4 sm:landscape:flex-row sm:landscape:items-start sm:landscape:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className={PAGE_TITLE}>Vakalatnama</h1>
            <p className={PAGE_SUBTITLE}>
              Appoint advocates for a litigant, for one case or all cases. You can start one
              before a case is filed.
            </p>
          </div>
          <Button type="button" onClick={create} className="shrink-0 self-start max-sm:w-full max-sm:self-stretch">
            <PlusIcon aria-hidden />
            New vakalatnama
          </Button>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-body font-semibold">Your vakalatnamas</h2>

          {!ready ? null : list.length === 0 ? (
            <Card variant="raised">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ScrollTextIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>Nothing here yet</EmptyTitle>
                  <EmptyDescription>
                    Create your first vakalatnama to appoint an advocate.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((v) => (
                <VakRow key={v.id} vak={v} onDiscard={() => discardVak(v.id)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function VakRow({ vak, onDiscard }: { vak: Vakalatnama; onDiscard: () => void }) {
  const name = executantName(vak.executant);
  const advocates = vak.advocates.length;

  return (
    <li>
      <Card variant="raised" className="p-0">
        <div className="flex items-center gap-4 p-4">
          <Link
            href={`/vakalatnama/${vak.id}`}
            className="flex min-w-0 flex-1 items-center gap-4 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-muted-foreground">
              <FileSignatureIcon aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-body font-medium">
                {name === "the litigant" ? "Untitled vakalatnama" : name}
              </span>
              <span className="truncate text-caption text-muted-foreground">
                {scopeLabel(vak)} · {advocates} advocate{advocates === 1 ? "" : "s"}
              </span>
            </div>
          </Link>

          <Badge variant={vak.status === "executed" ? "success" : "secondary"}>
            {statusLabel(vak.status)}
          </Badge>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Discard"
            onClick={onDiscard}
            className="text-muted-foreground"
          >
            <Trash2Icon aria-hidden />
          </Button>
        </div>
      </Card>
    </li>
  );
}
