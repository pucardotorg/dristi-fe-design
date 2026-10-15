import type { ApplicationView } from "@/lib/employee/application-queue";

const VIEWS = ["all", "onboard", "decide", "later", "closed", "archive"] as const;

/** A `?view=` value read off the URL, or the default for that route. */
export function readView(
  value: string | string[] | undefined,
  fallback: ApplicationView | "archive",
): ApplicationView | "archive" {
  const raw = Array.isArray(value) ? value[0] : value;
  return (VIEWS as readonly string[]).includes(raw ?? "")
    ? (raw as ApplicationView | "archive")
    : fallback;
}
