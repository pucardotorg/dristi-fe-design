"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { LANGUAGE_NAME, type SecondLanguage } from "@/lib/locale-config";
import type { Locale } from "@/lib/onboarding/content";
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
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";

/**
 * The product's language switch: English beside a second language, and a menu beside them
 * that changes which second language that is (owner, 2026-10-08). Choosing a language from
 * the menu also switches to it, since that is why anyone opens the menu; the caller does
 * both in `onSecondChange`.
 *
 * One switch for every place that offers a language — the top bar for the site, the oath
 * for the words read on camera (design feedback #40) — so it looks and works the same in
 * each. The caller holds the state and says which second languages it offers. With only
 * one to offer there is nothing to choose, so the menu is left out.
 */
export function LanguageToggle({
  value,
  onValueChange,
  second,
  onSecondChange,
  choices,
  ariaLabel,
  disabled = false,
  className,
}: {
  value: Locale;
  onValueChange: (language: Locale) => void;
  /** The language beside English. */
  second: SecondLanguage;
  /** Put another language beside English, and switch to it. */
  onSecondChange: (language: SecondLanguage) => void;
  /** The second languages the menu offers. */
  choices: readonly SecondLanguage[];
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const options: Locale[] = ["en", second];
  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      <SegmentedControl
        size="compact"
        type="single"
        value={value}
        onValueChange={(next) => next && onValueChange(next as Locale)}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {options.map((l) => (
          <SegmentedControlItem key={l} value={l} lang={l}>
            {LANGUAGE_NAME[l]}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      {choices.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Choose the second language"
              disabled={disabled}
              className="relative after:absolute after:-inset-1"
            >
              <ChevronDownIcon className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-40">
            <DropdownMenuLabel>Second language</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={second}
              onValueChange={(next) => {
                const language = choices.find((l) => l === next);
                if (language) onSecondChange(language);
              }}
            >
              {choices.map((l) => (
                <DropdownMenuRadioItem key={l} value={l} lang={l}>
                  {LANGUAGE_NAME[l]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
