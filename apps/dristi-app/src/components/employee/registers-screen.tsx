"use client";

import Link from "next/link";

import { useCourtText } from "@/components/court/court-provider";
import { useCourtDocket } from "@/components/employee/docket-table";
import { useCourtSession } from "@/components/employee/use-court-role";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Badge } from "@/components/ui/badge";
import { formatCount, registerIndexCount } from "@/lib/employee/register-rows";
import { REGISTER_GROUPS, REGISTERS, registerHref } from "@/lib/employee/registers";
import { cn } from "@/lib/utils";

/**
 * `/employee/registers` — the eighteen registers of the owner's note (section B), in
 * its seven groups. Each card opens its register. Registers 1–10 are kept from the
 * generated court and show their entry count; 11–18 show the note's columns and say
 * their source is still to be confirmed, rather than a count of nothing.
 */
export function RegistersScreen() {
  const docket = useCourtDocket();
  const courtText = useCourtText();
  const { court } = useCourtSession();
  const kept = REGISTERS.filter((r) => !r.sourceToConfirm).length;
  const toConfirm = REGISTERS.length - kept;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-12 p-6 md:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-title text-balance font-semibold">Registers</h1>
        <p className="text-body text-muted-foreground tabular-nums">
          {courtText(court)} · {kept} registers with entries, {toConfirm} with their source to confirm
        </p>
      </header>

      {REGISTER_GROUPS.map((group) => {
        const registers = REGISTERS.filter((r) => r.group === group);
        const headingId = `registers-${group.toLowerCase().replace(/[^a-z]+/g, "-")}`;
        return (
          <section key={group} aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4">
            <h2 id={headingId} className="text-title-s font-semibold">
              {group}
            </h2>
            <ul className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {registers.map((register) => {
                const count = registerIndexCount(docket, register);
                return (
                  <li key={register.id} className="flex min-w-0">
                    <Link
                      href={registerHref(register.id)}
                      className={cn(
                        "flex min-w-0 flex-1 flex-col gap-2 rounded-xl border bg-card p-6 text-left transition-colors outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        PANEL_CLASS,
                      )}
                    >
                      <span className="flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="text-caption text-muted-foreground tabular-nums">
                          Register {register.no}
                        </span>
                        {count ? (
                          <span className="text-caption text-muted-foreground tabular-nums">
                            {formatCount(count.count)} {count.count === 1 ? count.unit[0] : count.unit[1]}
                          </span>
                        ) : (
                          <Badge variant="outline">Source to confirm</Badge>
                        )}
                      </span>
                      <span className="text-body font-semibold">{register.name}</span>
                      <span className="text-body-compact text-muted-foreground">{register.description}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
