"use client";

import { Columns3Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { causeListColumn } from "@/lib/employee/cause-list-columns";

import type { useCauseListColumns } from "./use-cause-list-columns";

/**
 * Which cause-list columns show — the advocate Cases list's Edit columns, on the court
 * side (owner, 2026-10-15). A tick per column in the board's current order, Show all and
 * Reset to default; order is the grip on each heading, not this menu. S. no. and Case
 * name are locked on.
 */
export function CauseListColumnsMenu({
  state,
}: {
  state: ReturnType<typeof useCauseListColumns>;
}) {
  const { columns, toggle, showAll, reset, isDefault, isAllVisible } = state;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="shrink-0">
          <Columns3Icon aria-hidden />
          Edit columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <PopoverHeader className="px-2 pt-1">
          <PopoverTitle className="text-body-compact font-medium">
            Show or hide columns
          </PopoverTitle>
        </PopoverHeader>
        <ul className="flex flex-col">
          {columns.order.map((id) => {
            const column = causeListColumn(id);
            const checkboxId = `cause-list-column-${id}`;
            return (
              <li key={id}>
                <Label
                  htmlFor={checkboxId}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 text-body-compact font-normal hover:bg-accent has-disabled:cursor-default has-disabled:hover:bg-transparent"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={columns.visible.includes(id)}
                    disabled={column.locked}
                    onCheckedChange={() => toggle(id)}
                  />
                  {column.label}
                </Label>
              </li>
            );
          })}
        </ul>
        <Separator />
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2 text-body-compact"
            disabled={isAllVisible}
            onClick={showAll}
          >
            Show all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2 text-body-compact"
            disabled={isDefault}
            onClick={reset}
          >
            Reset to default
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
