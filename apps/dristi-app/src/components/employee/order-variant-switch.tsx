"use client";

import { LayoutTemplateIcon } from "lucide-react";

import { useOrderFlow } from "@/components/employee/use-order-flow";
import { useOrderLayout } from "@/components/employee/use-order-layout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CLASSIC_ORDER_LAYOUT_OPTIONS,
  type OrderLayout,
} from "@/lib/employee/order-layout";
import { cn } from "@/lib/utils";

/** The order screens the variant switch rides on: a hearing's order, cognizance's. */
export function isOrderScreenPath(pathname: string): boolean {
  return /^\/employee\/(?:hearings|cognizance)\/[^/]+\/order\/?$/.test(
    pathname,
  );
}

/**
 * Which variant of the order screen is open — one icon at the right end of the court's
 * bar, so the variants can be compared without leaving the order (owner, 2026-10-13). The
 * court switch's shape. A demo control: the same choice as Court settings' "Order
 * screen", read from the one list of variants.
 */
export function OrderVariantSwitch({ className }: { className?: string }) {
  const [flow] = useOrderFlow();
  const [layout, setLayout] = useOrderLayout();
  /* The Pending orders flow has one order screen, E — nothing to switch between. */
  if (flow === "pending") return null;
  /* The court's bar has no tooltip provider above it, so this brings its own. */
  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Switch order screen variant"
                className={cn(
                  "relative after:absolute after:-inset-1",
                  className,
                )}
              >
                <LayoutTemplateIcon className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Switch order screen variant
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          side="bottom"
          align="start"
          className="w-auto min-w-48"
        >
          <DropdownMenuLabel>Order screen</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={layout}
            onValueChange={(next) => setLayout(next as OrderLayout)}
          >
            {CLASSIC_ORDER_LAYOUT_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.id} value={option.id}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
