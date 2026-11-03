"use client";

import * as React from "react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

import { DiscardQuestion, useDiscardGuard } from "@/components/chrome/discard-guard";
import { EMPTY_PROFILE, useProfile } from "@/lib/filing/profile";
import type { UserProfile } from "@/lib/filing/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/filing/form-field";
import { PrefixInput, TextField } from "@/components/filing/inputs";

/**
 * "Your details" — the stand-in for the product's account. What is entered here greets
 * the person on the dashboard, marks "you" among the signatories, and prefills the
 * advocate card on a new filing.
 */
export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile } = useProfile();
  const stored = profile ?? EMPTY_PROFILE;
  /* The form lives here rather than in `ProfileForm`, so a close can ask before it
     throws changes away. It starts from the stored profile on every opening. */
  const [form, setForm] = React.useState<UserProfile>(stored);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(stored);
  }
  const changed = (Object.keys(stored) as (keyof UserProfile)[]).some(
    (key) => String(form[key] ?? "").trim() !== String(stored[key] ?? "").trim(),
  );
  const guard = useDiscardGuard(changed, () => onOpenChange(false));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ChromeDialogContent
        mobileSheet
        className="sm:max-w-md"
        {...guard.contentProps}
        {...guard.outsideProps}
      >
        {/* Mounted per open, so the form always starts from the stored profile. */}
        {open ? (
          <ProfileForm form={form} setForm={setForm} onCancel={guard.close} onClose={() => onOpenChange(false)} />
        ) : null}
        <DiscardQuestion guard={guard} />
      </ChromeDialogContent>
    </Dialog>
  );
}

function ProfileForm({
  form,
  setForm,
  onCancel,
  onClose,
}: {
  form: UserProfile;
  setForm: React.Dispatch<React.SetStateAction<UserProfile>>;
  onCancel: () => void;
  onClose: () => void;
}) {
  const { save } = useProfile();
  const [saving, setSaving] = React.useState(false);

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await save({
        name: form.name.trim(),
        mobile: form.mobile.replace(/\D/g, "").slice(-10),
        email: form.email.trim(),
        barNumber: form.barNumber.trim().toUpperCase(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Your details</DialogTitle>
        <DialogDescription>
          Used to greet you, mark your signature and prefill your advocate details on new
          filings. Kept in this browser until sign-in is connected.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <FormField label="Full name" required>
          <TextField
            value={form.name}
            onChange={(v) => set("name", v)}
            placeholder="As on your bar enrolment"
            autoComplete="name"
            required
          />
        </FormField>
        <FormField label="Mobile number">
          <PrefixInput
            prefix="+91"
            value={form.mobile}
            onChange={(v) => set("mobile", v.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit number"
          />
        </FormField>
        <FormField label="Email" optional>
          <TextField
            type="email"
            value={form.email}
            onChange={(v) => set("email", v)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </FormField>
        <FormField
          label="Bar registration number"
          optional
          help="Leave empty if you file as a party in person."
        >
          <TextField
            value={form.barNumber}
            onChange={(v) => set("barNumber", v.toUpperCase())}
            placeholder="e.g. K/1234/2015"
            autoComplete="off"
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !form.name.trim()}>
          Save details
        </Button>
      </DialogFooter>
    </form>
  );
}
