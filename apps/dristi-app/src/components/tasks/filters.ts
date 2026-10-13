"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DEFAULT_FILTERS, CATEGORY_ORDER, type DueFilter, type Filters } from "@/lib/tasks/selectors";
import type { TaskCategory, TaskView } from "@/lib/tasks/types";

const VIEWS: TaskView[] = ["needs-action", "waiting", "completed", "archived"];
const DUES: DueFilter[] = ["overdue", "today", "week", "before-hearing"];

/** A comma list from the URL, kept to the allowed values when there is a list of them.
 *  One value is a list of one, so the older single-choice links still open. */
function manyOf<T extends string>(v: string | null, allowed?: readonly T[]): T[] {
  if (!v) return [];
  const parts = [...new Set(v.split(",").map((part) => part.trim()).filter(Boolean))];
  return (allowed ? parts.filter((part) => (allowed as readonly string[]).includes(part)) : parts) as T[];
}

function oneOf<T extends string>(v: string | null, allowed: readonly T[], fallback: T): T {
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** URL → filters. Unknown values fall back to defaults; nothing throws. */
export function parseFilters(params: URLSearchParams): Filters {
  return {
    view: oneOf(params.get("view"), VIEWS, DEFAULT_FILTERS.view),
    kinds: manyOf<TaskCategory>(params.get("kind"), CATEGORY_ORDER),
    dues: manyOf(params.get("due"), DUES),
    // Court names may carry commas, so they repeat the key instead.
    courts: [...new Set(params.getAll("court").filter(Boolean))],
    advocates: manyOf(params.get("adv")),
    query: params.get("q") ?? "",
  };
}

/** Filters → URL. Defaults are omitted so the shareable URL stays short. */
export function serializeFilters(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.view !== DEFAULT_FILTERS.view) p.set("view", f.view);
  if (f.kinds.length) p.set("kind", f.kinds.join(","));
  if (f.dues.length) p.set("due", f.dues.join(","));
  for (const court of f.courts) p.append("court", court);
  if (f.advocates.length) p.set("adv", f.advocates.join(","));
  if (f.query.trim()) p.set("q", f.query.trim());
  return p;
}

/**
 * The filters and the open task, read from and written to the URL. `replace` + no
 * scroll, so typing in the search box does not pile up history entries or jump the page.
 */
export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters = React.useMemo(() => parseFilters(params), [params]);
  const taskId = params.get("task");

  const write = React.useCallback(
    (next: Filters, nextTask: string | null) => {
      const p = serializeFilters(next);
      if (nextTask) p.set("task", nextTask);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const setFilters = React.useCallback(
    (patch: Partial<Filters> | ((prev: Filters) => Filters)) => {
      const next = typeof patch === "function" ? patch(filters) : { ...filters, ...patch };
      write(next, taskId);
    },
    [filters, taskId, write]
  );

  const setTaskId = React.useCallback((id: string | null) => write(filters, id), [filters, write]);

  return { filters, setFilters, taskId, setTaskId };
}
