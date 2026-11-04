"use client";

import { ColumnsMenu } from "@/components/employee/columns-menu";
import {
  causeListColumn,
  type CauseListColumnId,
} from "@/lib/employee/cause-list-columns";

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
    <ColumnsMenu
      idPrefix="cause-list-column"
      items={columns.order.map((id) => {
        const column = causeListColumn(id);
        return {
          id,
          label: column.label,
          locked: column.locked,
          shown: columns.visible.includes(id),
        };
      })}
      onToggle={(id) => toggle(id as CauseListColumnId)}
      onShowAll={showAll}
      onReset={reset}
      isDefault={isDefault}
      isAllVisible={isAllVisible}
    />
  );
}
