"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** A hearing's business of the day: two lines, then "Read more" opens the rest. */
export function BotdText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);

  // Only offer the toggle when the clamp is actually hiding text.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (!open) setLong(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, text]);

  return (
    <div className="mt-2 flex flex-col items-start gap-1 rounded-md bg-surface-sunken px-3 py-2.5">
      <span className="mb-1 text-caption font-medium text-foreground">Business of the day</span>
      <p
        ref={ref}
        className={cn("text-body-compact text-muted-foreground", !open && "line-clamp-2")}
      >
        {text}
      </p>
      {long || open ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="relative mt-2 flex items-center gap-1 text-caption font-medium text-foreground underline-offset-2 after:absolute after:-inset-2 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {open ? "Show less" : "Read more"}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
          />
        </button>
      ) : null}
    </div>
  );
}
