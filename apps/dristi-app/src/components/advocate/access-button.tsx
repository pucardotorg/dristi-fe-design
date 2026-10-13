"use client";

import * as React from "react";
import type { SVGProps } from "react";
import { UserRound } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/onboarding/content";
import { pick } from "@/lib/onboarding/content";
import { advHome } from "@/lib/advocate/content";
import type { HearingAccess } from "@/lib/advocate/home";
import { cn } from "@/lib/utils";

/**
 * A profile with a verified seal at its foot: "you are on the Vakalatnama". Drawn
 * on lucide's 24 grid at its 2px stroke so it sits beside the plain `UserRound`
 * (office access) as a pair. The seal is solid with its tick knocked out, and the
 * figure is cut back around it, so the two never blur together at 16px.
 *
 * The cut-back is a clip path (a hard geometric edge), not a luminance mask: a
 * mask's soft edge left the clipped head half-transparent at 16px. The seal
 * reaches 23.8 of the 24 grid, so the svg lets it draw past its box rather than
 * shaving its edge.
 */
export function VakalatnamaIcon(props: SVGProps<SVGSVGElement>) {
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      overflow="visible"
      {...props}
    >
      <defs>
        {/* Everything but a disc around the seal (even-odd: the grid minus it). */}
        <clipPath id={`${id}-figure`} clipPathUnits="userSpaceOnUse">
          <path clipRule="evenodd" d="M-2 -2 H26 V26 H-2 Z M17 8.5 a8.5 8.5 0 1 0 0.001 0 Z" />
        </clipPath>
        <mask id={`${id}-seal`} maskUnits="userSpaceOnUse" x="0" y="0" width="26" height="26">
          <rect width="26" height="26" fill="white" />
          <path d="m13.9 17.1 2.1 2.1 4-4.3" stroke="black" strokeWidth="1.6" />
        </mask>
      </defs>
      <g clipPath={`url(#${id}-figure)`}>
        <circle cx="9.5" cy="8" r="5" />
        <path d="M17 21a7.5 7.5 0 0 0-15 0" />
      </g>
      {/* A solid round seal with a thin tick cut out of it: large enough that the
          tick reads at 16px. */}
      {/* System blue, the access chip's colour (owner, Oct 8; was green). */}
      <circle cx="17" cy="17" r="6.8" fill="var(--color-info-ink)" stroke="none" mask={`url(#${id}-seal)`} />
    </svg>
  );
}

/**
 * The button reads as a tag, not an action (lead designer, Oct 8): a soft fill
 * with a light hairline in its own tone. System blue when the viewer is on the Vakalatnama, so their own
 * matters stand out down the list; grey when they reach it by office access
 * only. Green stays the primary action colour, so it is not used here.
 */
const VAKALAT_CHIP =
  "border-info-ink/20 bg-info-muted text-info-ink hover:bg-info-muted-hover hover:text-info-ink data-[state=open]:bg-info-muted-hover data-[state=open]:text-info-ink";
const OFFICE_CHIP =
  "border-hairline bg-surface-sunken text-muted-foreground hover:bg-accent-strong hover:text-foreground data-[state=open]:bg-accent-strong";

/**
 * How the viewer reaches this matter, as one quiet icon button beside the
 * cause-list jump. The plain profile means office access only; the verified
 * profile means the viewer is on the Vakalatnama. Pressing it lists who holds the
 * Vakalatnama, and, under a divider, "Office access · You" when that is the
 * viewer's only way in. Everyone else with office access stays unnamed: it is
 * handed out widely, and the list would bury the names that matter.
 */
export function AccessButton({
  access,
  locale,
  className,
  iconClassName,
  label,
  variant = "outline",
}: {
  access: HearingAccess;
  locale: Locale;
  className?: string;
  iconClassName?: string;
  /** A visible word beside the icon, where the surface has room for one (the phone tray). */
  label?: string;
  variant?: "outline" | "ghost";
}) {
  const [open, setOpen] = React.useState(false);
  const name = pick(access.office ? advHome.accessOfficeLabel : advHome.accessMineLabel, locale);
  const Icon = access.office ? UserRound : VakalatnamaIcon;
  const you = pick(advHome.accessYou, locale);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={variant}
              size="icon"
              aria-label={name}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "relative z-10 gap-2",
                className,
                // Last, so the tone wins over a call site's outline colours.
                access.office ? OFFICE_CHIP : VAKALAT_CHIP
              )}
            >
              <Icon aria-hidden="true" className={cn("size-4", iconClassName)} />
              {label ? <span>{label}</span> : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        {/* The tooltip names the state; the popover names the people. Hidden
            while the popover is open so the two never stack. */}
        {open ? null : (
          <TooltipContent side="top">
            {pick(access.office ? advHome.accessOffice : advHome.accessVakalatnama, locale)}
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent
        align="end"
        collisionPadding={16}
        onClick={(event) => event.stopPropagation()}
        className="w-64 gap-0 p-0"
      >
        <section className="flex flex-col gap-1 p-3">
          <h3 className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <VakalatnamaIcon aria-hidden="true" className="size-3.5" />
            {pick(advHome.accessVakalatnama, locale)}
          </h3>
          <ul className="flex flex-col">
            {access.vakalatnama.map((person) => (
              <li key={person.id} className="flex min-h-8 items-center gap-1.5 text-body-compact">
                <span className="min-w-0 truncate">{person.name}</span>
                {!access.office && person.id === access.youId ? (
                  <span className="shrink-0 text-muted-foreground">· {you}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        {access.office ? (
          <>
            <Separator />
            <section className="flex flex-col gap-1 p-3">
              <h3 className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <UserRound aria-hidden="true" className="size-3.5" />
                {pick(advHome.accessOffice, locale)}
              </h3>
              <p className="flex min-h-8 items-center text-body-compact">{you}</p>
            </section>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
