"use client";

import * as React from "react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ChromeDialogContent mobileSheet className="sm:max-w-md">
        {/* Mounted per open, so the form always starts from the stored profile. */}
        {open ? <ProfileForm onClose={() => onOpenChange(false)} /> : null}
      </ChromeDialogContent>
    </Dialog>
  );
}

function ProfileForm({ onClose }: { onClose: () => void }) {
  const { profile, save } = useProfile();
  const [form, setForm] = React.useState<UserProfile>(profile ?? EMPTY_PROFILE);
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
            placeholder="name@domain.com"
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
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !form.name.trim()}>
          Save details
        </Button>
      </DialogFooter>
    </form>
  );
}
