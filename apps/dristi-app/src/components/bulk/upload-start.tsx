"use client";

/**
 * "Upload cases" lands here: a new upload starts with the batch's complainants, in the
 * single filing's own Complainant section (`setup-flow.tsx`), filled in with the filer's
 * known client for the prototype (`prefillKnownComplainant`). The setup is made once and
 * the address replaced, so Back never returns to a page that would make another.
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  createSetupDraft,
  prefillKnownComplainant,
  writeSetupDraft,
} from "@/lib/bulk/setup-repository";
import { buildDocumentGroups } from "@/lib/filing/blank";
import { useProfile } from "@/lib/filing/profile";
import { Spinner } from "@/components/ui/spinner";

import { setupHref, uploadHref } from "./setup-flow";

export function UploadStart() {
  const router = useRouter();
  const params = useSearchParams();
  const { profile, ready } = useProfile();
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    // An older link to an upload already set up goes to its file step.
    const existing = params.get("setup");
    if (existing) {
      started.current = true;
      router.replace(uploadHref(existing, "file", params.get("ai")));
      return;
    }
    if (!ready) return;
    started.current = true;
    const draft = createSetupDraft(profile);
    // Prototype: the complainant is a known client, so it arrives filled in. Should the
    // demo file not store, the filer still gets the complainant and adds the proof.
    void prefillKnownComplainant(draft)
      .catch(() => undefined)
      .then(() => {
        draft.documents = buildDocumentGroups(draft);
        writeSetupDraft(draft);
        router.replace(setupHref(draft.id, "complainant"));
      });
  }, [params, ready, profile, router]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center py-16 text-body-compact text-muted-foreground"
    >
      <Spinner className="mr-2 size-4" />
      Starting an upload…
    </div>
  );
}
