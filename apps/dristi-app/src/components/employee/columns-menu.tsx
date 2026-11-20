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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ColumnsMenuItem = {
  id: string;
  label: string;
  /** Always shown; its box is ticked and cannot be cleared. */
  locked: boolean;
  shown: boolean;
};

/**
 * The court tables' Edit columns: an icon at the row's far end, a tick per column in the
 * table's order, Show all and Reset to default. Today's hearings (`CauseListColumnsMenu`)
 * and Pending orders share it. Order is not set here.
 */
export function ColumnsMenu({
  idPrefix,
  items,
  onToggle,
  onShowAll,
  onReset,
  isDefault,
  isAllVisible,
}: {
  /** Keeps each table's checkbox ids apart. */
  idPrefix: string;
  items: readonly ColumnsMenuItem[];
  onToggle: (id: string) => void;
  onShowAll: () => void;
  onReset: () => void;
  isDefault: boolean;
  isAllVisible: boolean;
}) {
  return (
    <Popover>
      {/* An icon at the row's far end (owner, 2026-11-02): it changes how the list looks,
          not what is in it, so it gives its words up to the controls that narrow. The
          name stays for screen readers and comes back on hover and focus. */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Edit columns"
                className="shrink-0"
              >
                <Columns3Icon aria-hidden />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Edit columns</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" className="w-64">
        <PopoverHeader className="px-2 pt-1">
          <PopoverTitle className="text-body-compact font-medium">
            Show or hide columns
          </PopoverTitle>
        </PopoverHeader>
        <ul className="flex flex-col">
          {items.map((item) => {
            const checkboxId = `${idPrefix}-${item.id}`;
            return (
              <li key={item.id}>
                <Label
                  htmlFor={checkboxId}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 text-body-compact font-normal hover:bg-accent has-disabled:cursor-default has-disabled:hover:bg-transparent"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={item.shown}
                    disabled={item.locked}
                    onCheckedChange={() => onToggle(item.id)}
                  />
                  {item.label}
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
            onClick={onShowAll}
          >
            Show all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2 text-body-compact"
            disabled={isDefault}
            onClick={onReset}
          >
            Reset to default
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
