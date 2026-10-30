"use client";

import * as React from "react";
import { CodeIcon, ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Canvas, useAnchor } from "./canvas";
import { ITEMS, PATTERNS, type Item } from "./data";
import { EXAMPLES } from "./examples";

/* Feedback coverage board: every confirm, form error and success/failure moment on main,
   checked on screen (Oct 30), reviewed independently, grouped by what would change.
   Before = real screenshots. After = the same screen with the fix built on this branch. */

const AREA: Record<string, string> = {
  citizen: "Filing and cases",
  court: "Court",
  access: "People, sign-in, bulk",
};

const OTHER_LANES = [
  { id: "done", status: "done", name: "Already right", change: "Uses the right shared piece and tone. Checked on screen unless marked code only." },
  { id: "exception", status: "exception", name: "Left on purpose", change: "Another designer's screen (order editor), wording waiting on the PM, or a call you already made." },
  { id: "removed", status: "removed", name: "Taken off the list after the review", change: "Code nothing in the app opens, duplicates, or acts that can be undone. Each card says why. Pull any back if you disagree." },
  { id: "notmoment", status: "not a moment", name: "Not really feedback", change: "Checked and found not to be a feedback moment." },
] as const;

/** Per-viewer marks: "skip" or "different call". Board-only convenience. */
const MARKS_KEY = "coverage-board-marks";
const marksListeners = new Set<() => void>();
const readMarks = () => {
  try {
    return localStorage.getItem(MARKS_KEY) ?? "{}";
  } catch {
    return "{}";
  }
};

function useMarks() {
  const raw = React.useSyncExternalStore(
    (cb) => {
      marksListeners.add(cb);
      return () => marksListeners.delete(cb);
    },
    readMarks,
    () => "{}"
  );
  const marks = React.useMemo<Record<number, string>>(() => {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, [raw]);
  const set = (n: number, v: string | null) => {
    const next = { ...marks };
    if (v) next[n] = v;
    else delete next[n];
    try {
      localStorage.setItem(MARKS_KEY, JSON.stringify(next));
    } catch {}
    marksListeners.forEach((l) => l());
  };
  return { marks, set };
}

export default function CoverageBoard() {
  const { marks, set } = useMarks();
  const missed = ITEMS.filter((i) => i.status === "missed");
  const count = (s: string) => ITEMS.filter((i) => i.status === s).length;
  const marked = Object.keys(marks).length;

  return (
    <Canvas
      jumps={[
        { id: "top", label: "Start" },
        ...PATTERNS.map((p) => ({ id: p.id, label: `${p.name} · ${p.count}` })),
        ...OTHER_LANES.map((l) => ({ id: l.id, label: `${l.name} · ${count(l.status)}` })),
      ]}
    >
      <div className="flex w-max flex-col gap-28 p-10 pt-24">
        <Intro
          stats={[
            [missed.length, "to change"],
            [count("done"), "already right"],
            [count("exception"), "left on purpose"],
            [count("removed"), "taken off after review"],
            [ITEMS.filter((i) => i.codeOnly).length, "checked in code only"],
          ]}
          marked={marked}
          onCopy={() => {
            const lines = Object.entries(marks).map(([n, v]) => {
              const it = ITEMS.find((i) => i.n === Number(n));
              return `${v}: #${n} ${it?.where ?? ""}`;
            });
            navigator.clipboard?.writeText(lines.join("\n"));
          }}
        />
        {PATTERNS.map((p) => (
          <Lane
            key={p.id}
            id={p.id}
            name={p.name}
            change={p.change}
            items={missed.filter((i) => i.pattern === p.id)}
            marks={marks}
            onMark={set}
            examples={EXAMPLES[p.id] ?? []}
          />
        ))}
        {OTHER_LANES.map((l) => (
          <Lane
            key={l.id}
            id={l.id}
            name={l.name}
            change={l.change}
            items={ITEMS.filter((i) => i.status === l.status)}
            marks={marks}
            onMark={set}
            muted
          />
        ))}
      </div>
    </Canvas>
  );
}

function Intro({
  stats,
  marked,
  onCopy,
}: {
  stats: [number, string][];
  marked: number;
  onCopy: () => void;
}) {
  const ref = useAnchor("top");
  return (
    <header ref={ref} className="flex max-w-[1600px] flex-col gap-6">
      <p className="text-title-s font-semibold text-muted-foreground">
        Feedback coverage · main 8d53f22 · checked 30 Oct 2026
      </p>
      <h1 className="text-[72px] leading-none font-semibold tracking-tight">What still needs the new feedback</h1>
      <p className="max-w-[1200px] text-title-s text-muted-foreground">
        Every confirm, form error and success or failure moment in the app, checked on screen and then by an
        independent reviewer. Each lane is one kind of change. The top of a lane shows a real example before and
        after. Under it is every place the change would apply, with its own screenshot. Nothing on this board is
        changed in the product yet.
      </p>
      <div className="flex flex-wrap gap-10">
        {stats.map(([n, l]) => (
          <div key={l} className="flex flex-col">
            <span className="text-[56px] leading-none font-semibold tabular-nums">{n}</span>
            <span className="text-title-s text-muted-foreground">{l}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-body text-muted-foreground">
        <span>
          Mark any card <b>Skip</b> or <b>Different call</b> to take it out of a lane decision. {marked} marked.
        </span>
        <Button variant="outline" size="sm" onClick={onCopy} disabled={marked === 0}>
          Copy marked list
        </Button>
      </div>
    </header>
  );
}

function Lane({
  id,
  name,
  change,
  items,
  marks,
  onMark,
  examples = [],
  muted,
}: {
  id: string;
  name: string;
  change: string;
  items: Item[];
  marks: Record<number, string>;
  onMark: (n: number, v: string | null) => void;
  examples?: { label: string; before: string; after: string | null; note: string }[];
  muted?: boolean;
}) {
  const ref = useAnchor(id);
  return (
    <section ref={ref} className="flex w-[2000px] flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className={cn("text-[44px] leading-tight font-semibold tracking-tight", muted && "text-muted-foreground")}>
          {name} <span className="text-muted-foreground tabular-nums">· {items.length}</span>
        </h2>
        <p className="max-w-[1400px] text-title-s text-muted-foreground">{change}</p>
      </div>

      {!muted && (
        <div className="flex flex-col gap-6">
          {examples.length === 0 ? (
            <p className="rounded-xl bg-card p-6 text-title-s text-muted-foreground ring-1 ring-hairline">
              No example yet. One fix is built on the branch (the download toast is now neutral), but there is no before screenshot of it to compare against.
            </p>
          ) : (
            examples.map((ex) => (
              <div key={ex.label} className="grid grid-cols-2 gap-6 rounded-2xl bg-card p-6 shadow-raised ring-1 ring-hairline">
                <p className="col-span-2 text-title-s font-semibold">{ex.label}</p>
                <Shot label="Before · on main today" src={ex.before} />
                {ex.after ? <Shot label="After · built on this branch" src={ex.after} /> : <Pending />}
                <p className="col-span-2 text-body text-muted-foreground">{ex.note}</p>
              </div>
            ))
          )}
        </div>
      )}

      <div className="grid grid-cols-5 gap-5">
        {items.map((it) => (
          <Card key={it.n} it={it} mark={marks[it.n]} onMark={onMark} />
        ))}
      </div>
    </section>
  );
}

function Shot({ label, src }: { label: string; src: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-body font-semibold text-muted-foreground">{label}</figcaption>
      <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-hairline">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="block w-full" />
      </a>
    </figure>
  );
}

function Pending() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body font-semibold text-muted-foreground">After</p>
      <div className="flex flex-1 items-center justify-center rounded-lg bg-muted text-body text-muted-foreground ring-1 ring-hairline">
        Not captured yet. See the note below.
      </div>
    </div>
  );
}

function Card({ it, mark, onMark }: { it: Item; mark?: string; onMark: (n: number, v: string | null) => void }) {
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-hairline",
        mark && "opacity-60 ring-2 ring-warning-ink"
      )}
    >
      {it.shot ? (
        <a href={it.shot} target="_blank" rel="noreferrer" className="block aspect-[1366/900] overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.shot} alt="" loading="lazy" className="block size-full object-cover object-top" />
        </a>
      ) : (
        <div className="flex aspect-[1366/900] flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
          <CodeIcon className="size-8" aria-hidden />
          <span className="text-body">Checked in code only</span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{AREA[it.area] ?? it.area}</Badge>
          <span className="text-caption text-muted-foreground tabular-nums">#{it.n}</span>
          {it.shot && <ExternalLinkIcon className="ms-auto size-3.5 text-muted-foreground" aria-hidden />}
        </div>
        <p className="text-body-compact font-semibold break-words">{it.where}</p>
        {it.today && (
          <p className="text-body-compact break-words">
            <span className="text-muted-foreground">Today: </span>
            {it.today}
          </p>
        )}
        {it.should && (
          <p className="text-body-compact break-words">
            <span className="text-muted-foreground">Becomes: </span>
            {it.should}
          </p>
        )}
        {it.note && <p className="text-caption break-words text-muted-foreground">{it.note}</p>}
        <div className="mt-auto flex gap-2 pt-2">
          {(["Skip", "Different call"] as const).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={mark === v ? "secondary" : "ghost"}
              aria-pressed={mark === v}
              onClick={() => onMark(it.n, mark === v ? null : v)}
            >
              {v}
            </Button>
          ))}
        </div>
      </div>
    </article>
  );
}
