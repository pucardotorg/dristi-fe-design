"use client";

/**
 * The vakalatnama instrument, rendered from the draft — the paper as it would read. Shown
 * on Preview (before signing) and on the executed screen. Case number shows blank where
 * the matter is not yet filed, exactly as the executed form carries "C.C. No. ___".
 */

import * as React from "react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  advocateNames,
  executantIntro,
  executantName,
  serviceAdvocate,
} from "@/lib/vakalatnama/format";
import type { Vakalatnama } from "@/lib/vakalatnama/types";
import { configFor } from "@/lib/vakalatnama/data";

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-body-compact tabular-nums">{value}</span>
    </div>
  );
}

export function VakalatnamaDocument({
  vak,
  className,
}: {
  vak: Vakalatnama;
  className?: string;
}) {
  const service = serviceAdvocate(vak);
  const config = configFor(vak.scope.court);
  const caseNo =
    vak.scope.type === "standing"
      ? "All cases under this appointment"
      : vak.scope.caseState === "filed"
        ? vak.scope.caseNumber.trim() || "—"
        : vak.boundCaseNumber?.trim() || "______ of " + new Date().getFullYear();

  return (
    <Card variant="raised" className={cn("gap-8 p-8 md:p-12", className)}>
      {/* Court header */}
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
          Before the
        </p>
        <h2 className="text-title-s font-semibold">
          {vak.scope.court || config.court}
        </h2>
        <p className="text-body-compact text-muted-foreground">
          Cheque bounce — Section 138, Negotiable Instruments Act, 1881
        </p>
        <p className="mt-2 text-body-compact tabular-nums">Case No. {caseNo}</p>
        <p className="mt-4 text-title-s font-semibold tracking-tight">VAKALATNAMA</p>
      </header>

      <div className="h-px w-full bg-hairline" />

      {/* Body */}
      <div className="flex flex-col gap-4 text-body leading-relaxed">
        <p>
          <span className="font-medium">{executantIntro(vak.executant)}</span>, do hereby
          appoint and retain{" "}
          <span className="font-medium">{advocateNames(vak)}</span>
          {vak.advocates.length > 1 ? ", Advocates," : ", Advocate,"} to appear and act for
          me/us in the above matter, and empower them:
        </p>

        <ol className="flex list-decimal flex-col gap-2 pl-6 text-body-compact">
          {vak.terms.clauses.map((c, i) => (
            <li key={i} className="pl-1 leading-relaxed">
              {c}
            </li>
          ))}
        </ol>

        {vak.terms.source === "edited" ? (
          <p className="text-caption text-warning-ink">
            These terms have been edited from the standard set.
          </p>
        ) : null}
      </div>

      <div className="h-px w-full bg-hairline" />

      {/* Execution block */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
              Executant
            </span>
            <span className="text-body font-medium">
              {executantName(vak.executant)}
            </span>
            <span className="text-caption text-muted-foreground">
              Signature of the party
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
              I know the party
            </span>
            <span className="text-body-compact">{service?.name || "—"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
              Signed before me / accepted
            </span>
            {vak.advocates.length === 0 ? (
              <span className="text-body-compact text-muted-foreground">—</span>
            ) : (
              vak.advocates.map((a) => (
                <span key={a.id} className="text-body-compact">
                  {a.name.trim() || "[advocate]"}
                  {a.enrolmentNo ? (
                    <span className="ml-1 font-mono text-caption text-muted-foreground">
                      ({a.enrolmentNo})
                    </span>
                  ) : null}
                  {a.forService ? (
                    <span className="ml-1 text-caption text-muted-foreground">
                      · for service
                    </span>
                  ) : null}
                </span>
              ))
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
              Witness
            </span>
            {vak.attestation.hasWitness ? (
              <span className="text-body-compact">
                {vak.attestation.name.trim() ||
                  (vak.attestation.kind === "notary" ? "Notary" : "Witness")}
                {vak.attestation.kind === "notary" ? (
                  <span className="ml-1 text-caption text-muted-foreground">· Notary</span>
                ) : null}
              </span>
            ) : (
              <span className="text-body-compact text-muted-foreground">No witness</span>
            )}
          </div>
        </div>
      </div>

      {service ? (
        <div className="rounded-lg bg-surface-sunken p-4">
          <Line label="Address for service" value={service.name} />
          <p className="mt-1 text-body-compact text-muted-foreground">
            {service.address.line1
              ? [
                  service.address.line1,
                  service.address.city,
                  service.address.district,
                  service.address.state,
                  service.address.pin,
                ]
                  .filter((s) => s && s.trim())
                  .join(", ")
              : "Address on record"}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
