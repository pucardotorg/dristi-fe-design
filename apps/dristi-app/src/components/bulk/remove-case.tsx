"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { EllipsisVerticalIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notify } from "@/components/ui/notify";
import { cn } from "@/lib/utils";

import { bulkApi, type BatchView, type CaseView } from "./api";

/** The batch list's query when a batch went with its last case: `?deleted=B7`. */
export const DELETED_PARAM = "deleted";

/**
 * Taking a case out of its batch, the same on every step that lists cases (Case details,
 * Documents, Review and sign, Pay). Any case not yet filed can leave, signed ones included
 * (BLK-08). The confirmation says what happens before it does: a signed case is named as
 * signed, and the batch's last case says the batch goes with it (BLK-08b), after which the
 * filer lands on the batch list.
 */
export function useRemoveCase(batch: BatchView, setBatch: (b: BatchView) => void) {
  const router = useRouter();
  const [removing, setRemoving] = React.useState<CaseView | null>(null);
  // Kept while the dialog closes, so its words don't change under the closing animation.
  const [shown, setShown] = React.useState<CaseView | null>(null);
  if (removing && removing !== shown) setShown(removing);
  const c = removing ?? shown;
  const last = batch.cases.length === 1;
  const signed = c?.stage === "signed";
  const name = c ? `${c.accused || c.title} · ${c.draftNumber}` : "";

  const remove = async (target: CaseView) => {
    try {
      const reply = await bulkApi.remove(batch.id, target.id);
      if ("deleted" in reply) {
        router.push(`/filings/bulk?${DELETED_PARAM}=${encodeURIComponent(reply.deleted)}`);
        return;
      }
      setBatch(reply);
      notify.success(`${target.draftNumber} removed from ${batch.number}`);
    } catch (e) {
      notify.error("The case could not be removed", { description: (e as Error).message });
    }
  };

  const dialog = (
    <ConfirmDialog
      open={!!removing}
      onOpenChange={(o) => {
        if (!o) setRemoving(null);
      }}
      title={last ? "Remove the batch's last case?" : signed ? "Remove this signed case?" : "Remove this case from the batch?"}
      description={
        last
          ? `${name} is the only case in ${batch.number}, so the batch will be deleted too.`
          : signed
            ? `${name} won't be filed with this batch. It isn't filed yet, so it can still be removed.`
            : `${name} won't be filed with this batch.`
      }
      confirmLabel={last ? `Remove and delete ${batch.number}` : "Remove"}
      cancelLabel="Back"
      onConfirm={() => {
        if (removing) void remove(removing);
        setRemoving(null);
      }}
    />
  );

  return { ask: setRemoving, dialog };
}

/**
 * The row menu's destructive item, last in the menu. The row already names the case, so
 * the item doesn't: a long party name would wrap the menu into a column.
 */
export function RemoveCaseItem({ c, onSelect }: { c: CaseView; onSelect: (c: CaseView) => void }) {
  return (
    <DropdownMenuItem variant="destructive" className="whitespace-nowrap" onSelect={() => onSelect(c)}>
      <Trash2Icon aria-hidden />
      Remove from this batch
    </DropdownMenuItem>
  );
}

/** A row's own menu where the step has no other: only Remove. */
export function RemoveCaseMenu({
  c,
  onSelect,
  disabled,
  className,
}: {
  c: CaseView;
  onSelect: (c: CaseView) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("text-muted-foreground", className)}
          aria-label={`More for ${c.accused || c.title}`}
          disabled={disabled}
        >
          <EllipsisVerticalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <RemoveCaseItem c={c} onSelect={onSelect} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
