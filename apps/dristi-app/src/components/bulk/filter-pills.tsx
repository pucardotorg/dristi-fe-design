"use client";

import {
  PILL_COUNT,
  PILL_ITEM,
  PILL_ROW,
} from "@/components/chrome/pill-plate";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * A bulk list's filter: the product's one pill row (`chrome/pill-plate.ts`, born on
 * pending tasks), not a segmented control (owner, 2026-11-11: one filter pattern across
 * screens). "All" first, then each filter with what pressing it yields; one with nothing
 * in it is left out. Pressing the chosen pill again goes back to All.
 */
export function FilterPills({
  value,
  onChange,
  total,
  filters,
  label = "Show cases",
  size = "lg",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  total: number;
  filters: { id: string; label: string; count: number }[];
  label?: string;
  /** `sm` inside a popover's toolbar (the case finder); lists keep the full size. */
  size?: "sm" | "lg";
  /** The wrapper's sizing in its row, e.g. `sm:min-w-fit` to wrap whole rather than scroll. */
  className?: string;
}) {
  // Takes what the row leaves beside the search, and scrolls sideways inside it on a phone.
  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <ToggleGroup
        type="single"
        size={size === "sm" ? "default" : "lg"}
        variant="ghost"
        value={value}
        onValueChange={(v) => onChange(v || "all")}
        aria-label={label}
        className={PILL_ROW}
      >
        <Pill value="all" label="All" count={total} />
        {filters
          .filter((f) => f.count > 0 || f.id === value)
          .map((f) => (
            <Pill key={f.id} value={f.id} label={f.label} count={f.count} />
          ))}
      </ToggleGroup>
    </div>
  );
}

function Pill({
  value,
  label,
  count,
}: {
  value: string;
  label: string;
  count: number;
}) {
  return (
    <ToggleGroupItem
      value={value}
      aria-label={`${label}, ${count}`}
      className={PILL_ITEM}
    >
      <span>{label}</span>
      <span aria-hidden className={PILL_COUNT}>
        {count}
      </span>
    </ToggleGroupItem>
  );
}
