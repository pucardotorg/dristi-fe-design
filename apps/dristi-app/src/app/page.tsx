import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";

export const metadata: Metadata = { title: "24×7 ON Courts" };

/**
 * `/` — the front door.
 *
 * The one job is to route the two people who arrive here — the citizen bringing or
 * answering a case, and the court staff who run the bench — to their own sign-in, and to
 * do it with the standing of a government court rather than the gloss of a product.
 *
 * So the whole page is the deep-teal institutional plate the two sign-ins already stand
 * on: the front door is made of the same material as the rooms behind it, and the two
 * entrances are the lit way in. It is mode-invariant by design (the `brand-canvas` tokens
 * are fixed in both themes — a court's front door does not go light or dark with a
 * preference). This replaces a generic two-card page; the earlier "what the platform
 * does" band is gone, because each entrance already says what its side is for and a
 * front door is not a brochure.
 *
 * English only, and the citizen sign-in past this door carries the Malayalam — a toggle
 * here would translate four sentences and then hand over to a screen with its own.
 */
const ENTRANCES = [
  {
    href: "/citizen",
    title: "Advocates, litigants and clerks",
    who: "File and follow a case — including as a party in person or a power-of-attorney holder.",
  },
  {
    href: "/employee/login",
    title: "Court staff",
    who: "For the magistrate, bench clerk, scrutiny officer and typist.",
  },
];

const POLICIES = [
  { label: "Terms of use", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Support", href: "/support" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-linear-160 from-brand-canvas to-brand-canvas-deep text-brand-canvas-foreground">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-12 px-6 py-12 md:px-8">
        <div className="flex flex-col gap-8">
          {/* Says what this page is, so nobody mistakes it for the finished site. */}
          <p className="rounded-lg bg-card px-4 py-3 text-body-compact text-foreground">
            This is a placeholder page. The 24×7 ON Courts website will appear here.
          </p>
          <BrandLockup onDark className="h-12" />
          <div className="flex max-w-2xl flex-col gap-4">
            <h1 className="text-title-l font-semibold tracking-tight text-balance sm:text-display-s">
              The district courts, online.
            </h1>
            <p className="text-body text-brand-canvas-muted-foreground">
              Bring a cheque-bounce case to court, follow it through every hearing, and
              receive the court&rsquo;s orders — start to finish, without a trip to the
              filing counter.
            </p>
          </div>
        </div>

        {/* The two ways in, stacked so each has the width to state who it is for. Light
            doorways on the dark plate: the whole panel is the link, "Sign in" and the
            chevron name the act, and the citizen door leads because that is who almost
            everyone arriving here is. Not a grid of cards — two entrances. */}
        <nav aria-label="Sign in" className="flex flex-col gap-4">
          {ENTRANCES.map((entrance) => (
            <Link
              key={entrance.href}
              href={entrance.href}
              className="group flex items-center justify-between gap-6 rounded-xl bg-card p-6 text-foreground transition-shadow hover:shadow-overlay focus-visible:ring-2 focus-visible:ring-brand-canvas-foreground focus-visible:outline-none"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-title-s font-semibold">{entrance.title}</span>
                <span className="text-body-compact text-muted-foreground">
                  {entrance.who}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-body-compact font-medium text-primary">
                Sign in
                <ChevronRightIcon
                  aria-hidden
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </nav>
      </main>

      <footer className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-6 pb-8 text-caption text-brand-canvas-muted-foreground md:px-8">
        <nav aria-label="About this site" className="flex flex-wrap gap-x-6 gap-y-2">
          {POLICIES.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-brand-canvas-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
