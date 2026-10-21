"use client";

import * as React from "react";
import { UserPlusIcon, XIcon } from "lucide-react";

import { ADVOCATES } from "@/provakil/lib/matters";

import { provakilFetch } from "@/provakil/lib/workspace";
import type { Row } from "./cases-screen";
import { Button } from "./ui";

/** Assign one empanelled advocate to the selected cases. */
export function AssignDialog({ open, rows, onClose, onDone }: { open: boolean; rows: Row[]; onClose: () => void; onDone: () => void }) {
  const [bar, setBar] = React.useState(ADVOCATES[0].enrolment);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (!open) return null;

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await provakilFetch("/api/assign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matterIds: rows.map((r) => r.id), enrolment: bar }),
    });
    setBusy(false);
    if (res.ok) onDone();
    else setError((await res.json()).error ?? "Could not assign.");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-(--pv-navy)/40 p-4" role="dialog" aria-modal="true" aria-labelledby="assign-title">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-(--pv-line) px-5 py-4">
          <UserPlusIcon className="size-5 text-(--pv-blue)" aria-hidden />
          <h2 id="assign-title" className="text-[16px] font-medium">
            Assign advocate to {rows.length} case{rows.length === 1 ? "" : "s"}
          </h2>
          <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-(--pv-muted) hover:bg-(--pv-ground)" aria-label="Close">
            <XIcon className="size-5" />
          </button>
        </div>
        <div className="flex flex-col gap-2 px-5 py-4" role="radiogroup" aria-label="Empanelled advocates">
          {ADVOCATES.map((a) => (
            <label key={a.enrolment} className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 ${bar === a.enrolment ? "border-(--pv-blue) bg-(--pv-blue-50)" : "border-(--pv-line)"}`}>
              <input type="radio" name="advocate" value={a.enrolment} checked={bar === a.enrolment} onChange={() => setBar(a.enrolment)} className="accent-(--pv-blue)" />
              <span className="flex flex-col">
                <span className="text-[13px] font-medium">{a.name}</span>
                <span className="num text-[11px] text-(--pv-muted)">{a.enrolment} · Empanelled, Ahmedabad</span>
              </span>
            </label>
          ))}
          {error ? <p className="text-[13px] text-(--pv-red)">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-(--pv-line) px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            Assign
          </Button>
        </div>
      </div>
    </div>
  );
}
