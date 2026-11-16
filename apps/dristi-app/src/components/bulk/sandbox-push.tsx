"use client";

/**
 * Sandbox, the product's flask: a client's system pushes one of three 300-case batches
 * (`lib/bulk/sandbox-scale.ts`), as a real push arrives, then the filer lands on its Facts
 * of the case (§3). Offered wherever cases come in from a client's system.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { FlaskConicalIcon, SendIcon } from "lucide-react";

import { SCALE_SCENARIOS } from "@/lib/bulk/sandbox-scale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notify } from "@/components/ui/notify";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { bulkApi } from "./api";

export function SandboxPushMenu({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const push = async (scenario: string) => {
    setBusy(true);
    try {
      const out = await bulkApi.sandboxPush(scenario);
      router.push(`/filings/bulk/${out.batchId}/start`);
    } catch (e) {
      notify.error("The sandbox push did not arrive", { description: (e as Error).message });
      setBusy(false);
    }
  };
  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Sandbox: a push from a client's system"
                disabled={busy}
                className={className ?? "relative text-muted-foreground after:absolute after:-inset-1"}
              >
                {busy ? <Spinner /> : <FlaskConicalIcon aria-hidden />}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Sandbox: a push from a client&apos;s system</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Provakil pushes · 300 cases</DropdownMenuLabel>
        {SCALE_SCENARIOS.map((s) => (
          <DropdownMenuItem key={s.id} className="items-start" disabled={busy} onSelect={() => void push(s.id)}>
            <SendIcon aria-hidden className="mt-0.5" />
            <span className="flex min-w-0 flex-col">
              <span>{s.label}</span>
              <span className="text-body-compact text-muted-foreground">{s.detail}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
