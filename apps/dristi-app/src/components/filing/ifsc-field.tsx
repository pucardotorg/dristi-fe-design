"use client";

import * as React from "react";
import { RefreshCwIcon } from "lucide-react";

import { IFSC_PATTERN, lookupIfsc, type IfscResult } from "@/lib/filing/lookups";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FormField } from "@/components/filing/form-field";
import { TextField } from "@/components/filing/inputs";
import { LookupStatus } from "@/components/filing/lookup-status";
import { useFieldLock, useFieldReadOnly } from "@/components/filing/posture";

/**
 * Its own component so it can read the correction lock, which `FormField` provides
 * *below* `IfscField` in the tree — a hook called in `IfscField`'s own body would read
 * the value outside that provider and stay enabled on a locked cheque.
 */
function FetchDetailsButton({
  onClick,
  canFetch,
  busy,
}: {
  onClick: () => void;
  canFetch: boolean;
  busy: boolean;
}) {
  /* A flagged IFSC is answered in its inset, and the fetch it would otherwise run writes
     the bank name and branch — fields this round did not flag (brief D3, §15.2). */
  const inCorrectionLock = useFieldLock();
  const flagged = useFieldReadOnly();
  const locked = inCorrectionLock || flagged;
  return (
    /* Stays focusable while it works — disabling mid-click would drop a keyboard user's
       place. The guard in the handler stops a second run. */
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={!canFetch || locked}
      aria-busy={busy}
    >
      {busy ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <RefreshCwIcon data-icon="inline-start" aria-hidden />
      )}
      Fetch details
    </Button>
  );
}

/** How the last lookup ended. Success is not kept here — it is `fetched` on the draft. */
type IfscStatus = "idle" | "loading" | "not-found" | "error";

/**
 * The IFSC code, its 11-character gate, the registry fetch, and what the fetch found.
 *
 * Both the drawer's bank (Cheque) and the payee's collecting branch (Jurisdiction) ask for
 * the same thing in the same way, so they ask with the same control; only the copy about
 * *whose* bank it is differs, and that arrives as `tip` and `placeholder`.
 *
 * Mount this with `key` on the record it belongs to — switching cheque tabs must never
 * carry one cheque's result onto another.
 */
export function IfscField({
  value,
  onChange,
  onFetched,
  fetched,
  tip,
  placeholder = "e.g. SBIN0001234",
  prefilled = false,
  onViewSource,
}: {
  value: string;
  /** Typing — the caller keeps the value and drops whatever the last lookup filled. */
  onChange: (value: string) => void;
  /** The registry answered — the caller writes the bank name and branch onto the draft. */
  onFetched: (hit: IfscResult) => void;
  /** A lookup has already filled the bank fields on this record. */
  fetched: boolean;
  tip?: React.ReactNode;
  placeholder?: string;
  prefilled?: boolean;
  onViewSource?: () => void;
}) {
  const [status, setStatus] = React.useState<IfscStatus>("idle");
  const statusId = React.useId();

  const code = value.trim().toUpperCase();
  const canFetch = IFSC_PATTERN.test(code);

  // The value can also change from outside — the source panel corrects the same field —
  // so the reset lives here rather than in the change handler.
  const [lastValue, setLastValue] = React.useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    if (status !== "idle") setStatus("idle");
  }

  // Read by the resolved lookup to check the code is still the one that was asked about.
  const latestCode = React.useRef(code);
  React.useEffect(() => {
    latestCode.current = code;
  });

  const fetchDetails = async () => {
    if (!canFetch || status === "loading") return;
    const asked = code;
    setStatus("loading");
    try {
      const hit = await lookupIfsc(asked);
      if (latestCode.current !== asked) return;
      if (!hit) {
        setStatus("not-found");
        return;
      }
      onFetched(hit);
      // Success is said by `fetched` on the draft, which survives leaving the section.
      setStatus("idle");
    } catch {
      if (latestCode.current === asked) setStatus("error");
    }
  };

  // Only success claims something was filled; the other two hand the work back to the
  // person in the same breath. While the lookup runs, the button carries the state.
  const result =
    status === "not-found"
      ? {
          tone: "warning" as const,
          text: "We couldn't find this IFSC. Check the code, or type the bank details",
        }
      : status === "error"
        ? {
            tone: "warning" as const,
            text: "Couldn't reach the IFSC registry. Type the bank details below",
          }
        : fetched && status === "idle"
          ? {
              tone: "success" as const,
              text: "Bank name and branch filled from the IFSC registry",
            }
          : null;

  return (
    <FormField label="IFSC code" name="ifsc" required tip={tip} empty={!value.trim()}>
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <TextField
            value={value}
            onChange={(v) => onChange(v.toUpperCase())}
            prefilled={prefilled}
            onViewSource={onViewSource}
            placeholder={placeholder}
            autoComplete="off"
            aria-describedby={result ? statusId : undefined}
          />
          <FetchDetailsButton
            onClick={fetchDetails}
            canFetch={canFetch}
            busy={status === "loading"}
          />
        </div>
        <LookupStatus id={statusId} tone={result?.tone ?? "success"}>
          {result?.text}
        </LookupStatus>
      </div>
    </FormField>
  );
}
