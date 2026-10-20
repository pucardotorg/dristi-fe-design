"use client";

import { FlagIcon } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * Data flags (`ORD-15`): named, and nothing more — what it shows is not decided. One
 * empty state for the order screen's Data flags tab and the case overview's
 * (`CLS-11`), so the two say the same thing until it is.
 */
export function OrderDataFlags() {
  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FlagIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-body-compact font-semibold tracking-normal">
          Data flags are not defined yet
        </EmptyTitle>
        <EmptyDescription className="text-body-compact">
          This tab will flag things in the case&rsquo;s data, such as
          attendance history. What it shows has not been decided.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
