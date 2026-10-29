"use client";

import * as React from "react";
import { RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { type MarkStyle, SuccessMark } from "./proposed";

/* Pick how the error and warning marks look and move. Each tile replays on its own;
   "Use this" applies the choice to every mark on the board. */

type Option<K extends keyof MarkStyle> = { value: MarkStyle[K]; name: string; note: string };

const ROWS: {
  key: keyof MarkStyle;
  title: string;
  tone: "error" | "warning";
  options: Option<keyof MarkStyle>[];
}[] = [
  {
    key: "errorAnim",
    title: "Cross · motion",
    tone: "error",
    options: [
      { value: "spring", name: "Spring and shake", note: "Each stroke springs out from the centre, then one small sideways shake." },
      { value: "spin", name: "Spin in", note: "The cross turns half a circle into place and settles. No shake." },
      { value: "stamp", name: "Stamp", note: "The disc lands from slightly larger, like a rubber stamp, with a tiny thud." },
      { value: "nod", name: "Head shake", note: "Strokes spring out, then the disc tilts left-right once, like 'no'." },
    ],
  },
  {
    key: "warnGlyph",
    title: "Warning · icon",
    tone: "warning",
    options: [
      { value: "triangle", name: "Triangle", note: "The road-sign triangle, inside the disc. The most widely read warning." },
      { value: "flag", name: "Flag", note: "Flagged for a look. Softer than a triangle; reads as 'needs attention'." },
      { value: "minus", name: "Dash", note: "Neither done nor failed. The quietest; may read as 'partial'." },
      { value: "bang", name: "Exclamation", note: "Today's proposal, for comparison." },
    ],
  },
  {
    key: "warnAnim",
    title: "Warning · motion",
    tone: "warning",
    options: [
      { value: "swing", name: "Swing", note: "Hangs from the top and swings twice, like a sign in the wind." },
      { value: "glow", name: "Glow", note: "An amber halo breathes out twice around the disc." },
      { value: "drop", name: "Drop", note: "Falls in from above and bounces once." },
      { value: "pulse", name: "Pulse", note: "One soft ring pulse, like the success mark but quieter." },
    ],
  },
];

function Tile({
  tone,
  override,
  name,
  note,
  active,
  onUse,
}: {
  tone: "error" | "warning";
  override: Partial<MarkStyle>;
  name: string;
  note: string;
  active: boolean;
  onUse: () => void;
}) {
  const [run, setRun] = React.useState(0);
  return (
    <div className={cn("flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-raised", active ? "border-2 border-foreground" : "border-hairline")}>
      <div
        className="flex h-40 items-center justify-center"
        style={{ background: tone === "error" ? "var(--destructive-muted)" : "var(--warning-muted)" }}
      >
        <div key={run} className="flex items-center gap-6">
          <SuccessMark size={72} tone={tone} style={override} />
          <SuccessMark size={26} tone={tone} style={override} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-body font-semibold">{name}</p>
        <p className="text-body-compact text-pretty text-muted-foreground">{note}</p>
      </div>
      <div className="flex items-center gap-2 border-t border-hairline px-4 py-3" onPointerDown={(e) => e.stopPropagation()}>
        <Button size="sm" variant="outline" onClick={() => setRun((r) => r + 1)}>
          <RotateCcwIcon data-icon="inline-start" />Play
        </Button>
        {active ? (
          <span className="ml-auto text-body-compact font-semibold">In use</span>
        ) : (
          <Button size="sm" className="ml-auto" onClick={onUse}>Use this</Button>
        )}
      </div>
    </div>
  );
}

export function MarkPicker({ value, onChange }: { value: MarkStyle; onChange: (next: MarkStyle) => void }) {
  return (
    <section className="flex items-start gap-10">
      <div className="flex w-[420px] shrink-0 flex-col gap-3 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        <h2 className="text-title-s font-semibold">Pick the marks</h2>
        <p className="text-body-compact text-pretty text-muted-foreground">
          Choose one motion for the cross, one icon and one motion for the warning. Each tile plays on its own; Use this applies it to every mark on the board, so you can scroll down and see it in place. Each tile shows the mark at hero size and at toast size.
        </p>
      </div>
      <div className="flex flex-col gap-10">
        {ROWS.map((row) => (
          <div key={row.key} className="flex flex-col gap-3">
            <p className="text-title-s font-semibold">{row.title}</p>
            <div className="flex gap-6">
              {row.options.map((o) => (
                <Tile
                  key={String(o.value)}
                  tone={row.tone}
                  override={{ ...value, [row.key]: o.value }}
                  name={o.name}
                  note={o.note}
                  active={value[row.key] === o.value}
                  onUse={() => onChange({ ...value, [row.key]: o.value } as MarkStyle)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
