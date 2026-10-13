"use client";

import { useCourt } from "@/components/court/court-provider";
import { cn } from "@/lib/utils";

/**
 * The 24×7 ON Courts brand marks — or, when the court switch runs the app as a state
 * with a product of its own (Gujarat's SARAS 2.0), that product's placeholder
 * (`PlaceholderMark`).
 *
 * These are product brand assets, not design-system primitives — the SVGs live in
 * `public/brand`. Two files per mark so the artwork itself carries the right ink in
 * each theme; the wrong-theme copy stays in the DOM but is hidden with the `dark:`
 * variant (class-based dark mode), so no runtime theme read is needed.
 *
 * `BrandLockup` is the full wordmark (used wherever there is room); `BrandGlyph` is
 * the mark alone (used in the collapsed sidebar rail). Size is set by the caller via
 * height utilities so both stay crisp at any scale. `onDark` pins the light-ink
 * artwork for surfaces that stay dark in both themes (the sign-in canvas plate),
 * where the theme-driven swap would otherwise show the dark-ink copy in light mode.
 */

const LABEL = "24×7 ON Courts";

function Mark({
  base,
  onDark,
  className,
}: {
  base: string;
  onDark: boolean;
  className?: string;
}) {
  return (
    <span role="img" aria-label={LABEL} className={cn("inline-flex", className)}>
      {onDark ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${base}-dark.svg`} alt="" aria-hidden className="block h-full w-auto" />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${base}.svg`} alt="" aria-hidden className="block h-full w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${base}-dark.svg`}
            alt=""
            aria-hidden
            className="hidden h-full w-auto dark:block"
          />
        </>
      )}
    </span>
  );
}

/**
 * A product other than ON Courts — Gujarat's SARAS 2.0 — until it sends its own logo (owner,
 * 2026-10-08): a dashed square holding the name's initial where the logo will go, and the
 * name as the wordmark.
 *
 * Drawn in `currentColor` throughout, so it takes the ink of whatever plate it sits on —
 * the charcoal rail, the brand canvas, a light header — with no `onDark` artwork of its
 * own to keep in step. The dashed edge is what says "placeholder": a filled tile would
 * read as a finished logo, and a stakeholder screenshot must not mistake it for one.
 */
function PlaceholderGlyph({ name }: { name: string }) {
  return (
    <span className="flex aspect-square h-full shrink-0 items-center justify-center rounded-md border-2 border-dashed border-current">
      {/* An SVG initial, so it scales with the square from the rail's 24px to the
          sign-in canvas's 56px the way the lockup's own artwork does. */}
      <svg viewBox="0 0 20 20" aria-hidden className="size-full">
        <text
          x="10"
          y="14.5"
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          fill="currentColor"
        >
          {name.charAt(0)}
        </text>
      </svg>
    </span>
  );
}

function PlaceholderMark({
  name,
  wordmark,
  wordmarkClassName,
  className,
}: {
  name: string;
  wordmark: boolean;
  wordmarkClassName?: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <PlaceholderGlyph name={name} />
      {wordmark ? (
        <span
          aria-hidden
          className={cn("text-title-s font-semibold whitespace-nowrap", wordmarkClassName)}
        >
          {name}
        </span>
      ) : null}
    </span>
  );
}

export function BrandLockup({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  const { profile } = useCourt();
  if (profile.brandName) {
    return <PlaceholderMark name={profile.brandName} wordmark className={className} />;
  }
  return <Mark base="/brand/on-courts-logo" onDark={onDark} className={className} />;
}

/**
 * The mark alone. `named` adds a placeholder product's name beside it — ON Courts' own
 * wordmark stacks under its mark and cannot be read at rail size, but a placeholder's is
 * one line of text and can. `wordmarkClassName` lets the rail drop that name when it
 * folds to a strip.
 */
export function BrandGlyph({
  className,
  onDark = false,
  named = false,
  wordmarkClassName,
}: {
  className?: string;
  onDark?: boolean;
  named?: boolean;
  wordmarkClassName?: string;
}) {
  const { profile } = useCourt();
  if (profile.brandName) {
    return (
      <PlaceholderMark
        name={profile.brandName}
        wordmark={named}
        wordmarkClassName={wordmarkClassName}
        className={className}
      />
    );
  }
  return <Mark base="/brand/on-courts-glyph" onDark={onDark} className={className} />;
}
