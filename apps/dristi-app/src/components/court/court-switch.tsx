"use client";

import * as React from "react";
import { LandmarkIcon } from "lucide-react";

import { useCourt } from "@/components/court/court-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { COURT_IDS, courtProfile, isCourtId } from "@/lib/court/profiles";
import {
  BRAND_HUE_COOKIE,
  BRAND_HUES,
  courtHasHue,
  isBrandHue,
  resolveBrandHue,
  type BrandHue,
} from "@/lib/court/brand-hue";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * EXPERIMENT — the brand colour, for a court that may run in its own (Gujarat). The root
 * layout paints the first frame from the cookie; a change here re-paints at once by
 * moving `data-brand-hue` on <html>, with no reload — only CSS variables move.
 */
function useBrandHue(): [BrandHue | null, (hue: BrandHue) => void] {
  const { court } = useCourt();
  // Read lazily: the menu that shows it only renders once opened, on the client.
  const [hue, setHue] = React.useState<BrandHue | null>(() =>
    typeof document === "undefined"
      ? null
      : resolveBrandHue(court, document.documentElement.dataset.brandHue)
  );
  const choose = React.useCallback((next: BrandHue) => {
    setHue(next);
    document.documentElement.dataset.brandHue = next;
    document.cookie = `${BRAND_HUE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  }, []);
  return [hue, choose];
}

/**
 * Which state's court the whole app runs as — one quiet icon beside the Settings title in
 * the top bar.
 *
 * It used to be a Settings section of four choice cards, each spelling out what it would
 * change. The owner wanted it kept out of the way (2026-10-08): this is a deployment
 * switch for demos, not something an advocate sets, so it is a court icon beside the
 * Settings title that opens a menu of the four states. The menu names the state alone; the
 * screens behind it say the rest the moment the choice is made.
 *
 * The visible button is 32px, small enough to stay quiet; the `after:` inset widens its
 * hit area to the 40px the DS asks of a touch target.
 *
 * For Gujarat the same menu also offers the brand colour (`useBrandHue`), so the owner
 * can try the navies against the teal in place.
 *
 * `data-court-raw` keeps the text layer from re-voicing the other states' names into the
 * selected one's.
 */
export function CourtSwitch({
  className,
  side = "bottom",
  align = "end",
}: {
  className?: string;
  side?: "top" | "bottom";
  align?: "start" | "end";
}) {
  const { court, setCourt } = useCourt();
  const [hue, setHue] = useBrandHue();
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Switch court"
              className={cn("relative after:absolute after:-inset-1", className)}
            >
              <LandmarkIcon className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side={side}>Switch court</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side={side} align={align} className="w-auto min-w-48">
        <DropdownMenuLabel>Court</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          data-court-raw=""
          value={court}
          onValueChange={(next) => {
            if (isCourtId(next)) setCourt(next);
          }}
        >
          {COURT_IDS.map((id) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {courtProfile(id).state}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {courtHasHue(court) && hue ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Brand colour</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={hue}
              onValueChange={(next) => {
                if (isBrandHue(next)) setHue(next);
              }}
            >
              {BRAND_HUES.map((h) => (
                <DropdownMenuRadioItem key={h.id} value={h.id} className="gap-2">
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-full border border-hairline"
                    // A swatch is the colour itself, shown as data — not a styling choice.
                    style={{ backgroundColor: h.swatch }}
                  />
                  {h.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
