"use client";

import * as React from "react";
import { CheckCircle2Icon, CheckIcon, ChevronsUpDownIcon, FileTextIcon, PencilIcon, PlusIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddIdForm, SubmittedIdSummary, type SubmittedId } from "@/components/home/add-id-dialog";
import { DocumentPreviewDialog, DocumentRowValue, DocumentThumbnailButton, useObjectUrl } from "@/components/document-preview";
import { DocumentSlot } from "@/components/ui/document-slot";
import { DescriptionDetails, DescriptionList, DescriptionRow, DescriptionTerm } from "@/components/ui/description-list";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Locale } from "@/lib/onboarding/content";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";
import type { ProfileRole } from "@/components/shell/profile";

const REQUIRED_MARK = <span className="text-destructive">*</span>;

export type AdvocateRequestDetails = {
  barNumber: string;
  idFile: File;
};

const ACCOUNT_LABEL: Record<ProfileRole, string> = {
  advocate: "Advocate account",
  litigant: "Litigant account",
  clerk: "Clerk account",
};

export function ProfileSettings({ locale, profileName, idSubmitted, submittedId, advocateRequest, profileRole, advocateProfileAvailable, onIdSubmitted, onProfileCompleted, onAdvocateRequest, onSwitchProfile }: {
  locale: Locale;
  profileName: string;
  idSubmitted: boolean;
  submittedId: SubmittedId | null;
  advocateRequest: AdvocateRequestDetails | null;
  profileRole: ProfileRole;
  advocateProfileAvailable: boolean;
  onIdSubmitted: (submission: SubmittedId) => void;
  onProfileCompleted: () => void;
  onAdvocateRequest: (details: AdvocateRequestDetails) => void;
  onSwitchProfile: (role: ProfileRole) => void;
}) {
  const [addressSaved, setAddressSaved] = React.useState(false);
  const [addressOpen, setAddressOpen] = React.useState(false);
  const [idOpen, setIdOpen] = React.useState(false);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const [upgradeTouched, setUpgradeTouched] = React.useState(false);
  const [upgradeDetailsOpen, setUpgradeDetailsOpen] = React.useState(false);
  const [barNumber, setBarNumber] = React.useState("");
  const [barId, setBarId] = React.useState<File | null>(null);
  const [barIdPreviewOpen, setBarIdPreviewOpen] = React.useState(false);
  const barIdInputRef = React.useRef<HTMLInputElement>(null);
  const barIdUrl = useObjectUrl(barId);
  const initials = profileName.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const upgradeIncomplete = !barNumber.trim() || !barId;

  function submitUpgrade(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpgradeTouched(true);
    if (upgradeIncomplete) return;
    setUpgradeOpen(false);
    onAdvocateRequest({
      barNumber,
      idFile: barId,
    });
  }

  return (
    <main lang={locale} className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar className="size-24"><AvatarFallback className="bg-brand-muted text-title font-semibold text-brand-muted-foreground">{initials}</AvatarFallback></Avatar>
          <div className="flex flex-col items-center gap-2">
            {profileRole === "litigant" ? (
              <EditableName value={profileName} />
            ) : (
              <h1 className="text-title-l font-semibold">{profileName}</h1>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Switch profile">
                  {ACCOUNT_LABEL[profileRole]}
                  <ChevronsUpDownIcon data-icon="inline-end" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-64 p-2">
                <p className="px-2 py-1.5 text-caption font-semibold text-muted-foreground">Switch profile</p>
                <Button variant="ghost" className="w-full justify-start" onClick={() => onSwitchProfile("litigant")}>
                  <Avatar size="sm"><AvatarFallback>L</AvatarFallback></Avatar>
                  <span className="flex-1 text-left">Litigant</span>
                  {profileRole === "litigant" ? <CheckIcon aria-hidden /> : null}
                </Button>
                {advocateProfileAvailable ? (
                  <Button variant="ghost" className="w-full justify-start" onClick={() => onSwitchProfile("advocate")}>
                    <Avatar size="sm"><AvatarFallback>A</AvatarFallback></Avatar>
                    <span className="flex-1 text-left">Advocate</span>
                    {profileRole === "advocate" ? <CheckIcon aria-hidden /> : null}
                  </Button>
                ) : null}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-title-s font-semibold">Address</h2><p className="text-body-compact text-muted-foreground">Add the address the court should use for records and communications.</p></div>
          <div className="flex items-center gap-2">
            {addressSaved ? <Badge variant="success">Address added</Badge> : null}
            {!addressOpen ? <Button variant="outline" onClick={() => setAddressOpen(true)}>{!addressSaved ? <PlusIcon data-icon="inline-start" aria-hidden /> : null}{addressSaved ? "Edit address" : "Add address"}</Button> : null}
          </div>
        </div>
        {addressOpen || addressSaved ? (
          <form className={addressOpen ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : "hidden"} onSubmit={(event) => { event.preventDefault(); setAddressSaved(true); setAddressOpen(false); onProfileCompleted(); }}>
            <Field><FieldLabel>PIN code {REQUIRED_MARK}</FieldLabel><Input required inputMode="numeric" maxLength={6} /></Field>
            <Field><FieldLabel>State {REQUIRED_MARK}</FieldLabel><Input required /></Field>
            <Field><FieldLabel>District {REQUIRED_MARK}</FieldLabel><Input required /></Field>
            <Field><FieldLabel>City or town {REQUIRED_MARK}</FieldLabel><Input required /></Field>
            <Field className="sm:col-span-2"><FieldLabel>Locality, street or area {REQUIRED_MARK}</FieldLabel><Input required /></Field>
            <Field><FieldLabel>Building name (optional)</FieldLabel><Input /></Field>
            <Field><FieldLabel>Door or house number {REQUIRED_MARK}</FieldLabel><Input required /></Field>
            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setAddressOpen(false)}>Cancel</Button>
              <Button type="submit">Save address</Button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-title-s font-semibold">Official ID</h2><p className="text-body-compact text-muted-foreground">Add one official ID to your profile.</p></div>
          {idSubmitted ? <Badge variant="success">ID submitted</Badge> : !idOpen ? <Button variant="outline" onClick={() => setIdOpen(true)}><PlusIcon data-icon="inline-start" aria-hidden /> Add ID</Button> : null}
        </div>
        {submittedId ? <SubmittedIdSummary submission={submittedId} locale={locale} /> : idOpen ? <AddIdForm locale={locale} onCancel={() => setIdOpen(false)} onSubmitted={(submission) => { setIdOpen(false); onIdSubmitted(submission); }} /> : null}
      </section>

      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-title-s font-semibold">
              {advocateProfileAvailable ? "Advocate details" : "Request an advocate profile"}
            </h2>
            <p className="text-body-compact text-muted-foreground">
              {advocateProfileAvailable
                ? "Your advocate enrolment details on file."
                : "Request an advocate profile along with your current litigant access."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {advocateProfileAvailable ? <Badge variant="success"><CheckIcon data-icon="inline-start" aria-hidden /> Approved</Badge> : null}
            {advocateRequest ? (
              <Button variant="outline" onClick={() => setUpgradeDetailsOpen((current) => !current)}>
                {advocateProfileAvailable
                  ? (upgradeDetailsOpen ? "Hide details" : "Edit advocate details")
                  : (upgradeDetailsOpen ? "Hide submitted information" : "View submitted information")}
              </Button>
            ) : advocateProfileAvailable ? (
              <Button variant="outline" onClick={() => setUpgradeOpen(true)}>Edit advocate details</Button>
            ) : !upgradeOpen ? (
              <Button variant="outline" onClick={() => setUpgradeOpen(true)}>Request advocate profile</Button>
            ) : null}
          </div>
        </div>
        {advocateRequest && !advocateProfileAvailable ? <Alert variant="success"><CheckCircle2Icon aria-hidden /><AlertTitle>Your request has been submitted</AlertTitle><AlertDescription>We will notify you when your advocate profile is approved. Your litigant profile remains active.</AlertDescription></Alert> : null}
        {upgradeDetailsOpen && advocateRequest ? (
          <DescriptionList className="rounded-lg bg-muted px-4">
            <DescriptionRow><DescriptionTerm>Bar registration number</DescriptionTerm><DescriptionDetails><Identifier value={advocateRequest.barNumber} label="bar registration number" /></DescriptionDetails></DescriptionRow>
            <DescriptionRow className="items-center"><DescriptionTerm>Bar Council ID</DescriptionTerm><DescriptionDetails><DocumentRowValue file={advocateRequest.idFile} locale={locale} /></DescriptionDetails></DescriptionRow>
          </DescriptionList>
        ) : null}
        {upgradeOpen && !advocateRequest ? (
          <form className="flex flex-col gap-4 rounded-lg bg-muted p-6" noValidate onSubmit={submitUpgrade}>
            <p className="text-body-compact text-muted-foreground">These details let the court verify your enrolment.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={upgradeTouched && !barNumber.trim()}>
                <FieldLabel>Bar registration number {REQUIRED_MARK}</FieldLabel>
                <Input value={barNumber} onChange={(event) => { setBarNumber(event.target.value); setUpgradeTouched(false); }} placeholder="For example K/1234/2020" />
                <FieldError>{upgradeTouched && !barNumber.trim() ? "Enter your Bar registration number." : null}</FieldError>
              </Field>
            </div>
            <Field data-invalid={upgradeTouched && !barId}>
              <FieldLabel>Bar Council ID {REQUIRED_MARK}</FieldLabel>
              <input ref={barIdInputRef} type="file" className="hidden" tabIndex={-1} aria-hidden="true" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={(event) => { setBarId(event.target.files?.[0] ?? null); setUpgradeTouched(false); }} />
              <DocumentSlot status={barId ? "filled" : "empty"} media={barId && barIdUrl ? "thumbnail" : "icon"} label="Bar Council ID" required filename={barId?.name} thumbnail={barId && barIdUrl ? <DocumentThumbnailButton file={barId} url={barIdUrl} locale={locale} onOpen={() => setBarIdPreviewOpen(true)} className="size-full" /> : <FileTextIcon className="size-5" aria-hidden />} onChooseFile={() => barIdInputRef.current?.click()} copy={{ noFile: "No file chosen yet", chooseFile: "Choose file" }} />
              <div className="flex items-start justify-between gap-4"><FieldDescription>Ensure the registration number is clearly visible. JPG, JPEG, PNG or PDF · up to 10 MB.</FieldDescription>{barId ? <Button type="button" variant="link" className="h-auto shrink-0 p-0" onClick={() => barIdInputRef.current?.click()}>Change file</Button> : null}</div>
              <FieldError>{upgradeTouched && !barId ? "Upload your Bar Council ID." : null}</FieldError>
            </Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => { setUpgradeOpen(false); setUpgradeTouched(false); }}>Cancel</Button><Button type="submit">Send request</Button></div>
            <DocumentPreviewDialog open={barIdPreviewOpen} onOpenChange={setBarIdPreviewOpen} file={barId} url={barIdUrl} locale={locale} />
          </form>
        ) : null}
      </section>

      {/* Password */}
      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-title-s font-semibold">Password</h2>
            <p className="text-body-compact text-muted-foreground">Set or change the password you use to sign in.</p>
          </div>
          <Button variant="outline">Set password</Button>
        </div>
      </section>

    </main>
  );
}

/* ────────────────────────── Helpers ────────────────────────── */

/**
 * The profile name, editable in-place for litigants (whose names are self-reported).
 * Advocates' names come from the Bar Council register and must not be changed here.
 */
function EditableName({ value }: { value: string }) {
  const [editing, setEditing] = React.useState(false);
  // The field opens on the name as the heading shows it (Settings' court switch).
  const courtText = useCourtText();
  const [name, setName] = React.useState(() => courtText(value));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className="group flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted"
        onClick={() => setEditing(true)}
        aria-label="Edit name"
      >
        <h1 className="text-title-l font-semibold">{name || value}</h1>
        <PencilIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); setEditing(false); }}
    >
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="text-title-l font-semibold text-center"
        onBlur={() => setEditing(false)}
        aria-label="Full name"
      />
    </form>
  );
}
