"use client";

import * as React from "react";
import { CheckCircle2Icon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CaseAccessList } from "@/components/access/access-list";
import {
  directoryOptions,
  PeopleInviteField,
  type InvitePerson,
} from "@/components/access/people-invite-field";
import { useAccess, type InviteResult } from "@/components/access/access-state";
import { RemoveAdvocateDialog } from "@/components/cases/remove-advocate-dialog";
import { ChromeAlertDialogContent } from "@/components/chrome/app-chrome";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { pick, type Locale } from "@/lib/onboarding/content";
import { fill } from "@/lib/join/content";
import {
  caseLabel,
  fillCopy,
  inviteFieldCopy,
  peopleCopy,
  shareCopy,
  type AccessCase,
  type AccessPerson,
} from "@/lib/access/content";
import { Identifier } from "@/components/chrome/identifier";

/**
 * The share-access modal — the single surface behind every entry point.
 *
 * Sharing only ever adds OFFICE STAFF: the vakalatnama is per-case and already
 * carries its advocates, so there is no role choice anywhere. Bulk mode (2+
 * cases) is additionally grant-only — no access list, no removal. "Already has
 * access" is handled by granting idempotently and saying so in the
 * confirmation, never by blocking upfront.
 *
 * People are found by typing (`PeopleInviteField`, `registeredOnly`): the office
 * is suggested first, and any registered advocate or clerk can be searched by
 * name, number or Bar ID (owner, 2026-10-21, OFC-20). Whoever is added here
 * joins the advocate's office on the People page with this case (OFC-51).
 */

type Chip = InvitePerson;

export function ShareDialog({
  open,
  onOpenChange,
  cases,
  locale,
  readOnly = false,
  extraPeople,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One case = full share+manage surface; several = bulk grant-only. */
  cases: AccessCase[];
  locale: Locale;
  /**
   * The viewer holds only office access on this case (owner, Sept 2):
   * they can see who has access, but adding and removing people belongs
   * to the vakalatnama holders. Inputs and removes disable; the list
   * stays readable.
   */
  readOnly?: boolean;
  /**
   * The case's own people, derived from its record (nama advocates and
   * office staff) — merged with the access store so "Who has access"
   * matches the case file. The store never held them, so removing one is
   * this dialog's local state.
   */
  extraPeople?: AccessPerson[];
}) {
  const { invite, removeGrant, personsOnCase, office } = useAccess();

  const [chips, setChips] = React.useState<Chip[]>([]);
  const [result, setResult] = React.useState<InviteResult | null>(null);
  const [accessQuery, setAccessQuery] = React.useState("");
  /* An on-nama advocate whose Remove was clicked; opens the formal removal
     flow (3a/3b) over this dialog. Staff removal stays the one-click revoke. */
  const [removeTarget, setRemoveTarget] = React.useState<string | null>(null);
  /* Office access about to be removed: confirmed first, like every removal
     (OFC-36), in the People tab's own words. */
  const [confirmTarget, setConfirmTarget] = React.useState<AccessPerson | null>(null);
  const [removedDerived, setRemovedDerived] = React.useState<ReadonlySet<string>>(
    new Set(),
  );

  const bulk = cases.length > 1;
  const single = cases.length === 1 ? cases[0] : null;
  const storePeople = single ? personsOnCase(single.id) : [];
  const storeNames = new Set(storePeople.map((p) => p.name));
  const onCase = single
    ? [
        ...storePeople,
        ...(extraPeople ?? []).filter(
          (p) => !storeNames.has(p.name) && !removedDerived.has(p.id),
        ),
      ]
    : [];


  function handleOpenChange(nextOpen: boolean) {
    // Closing clears transient invite state so reopening any case scope starts
    // clean without synchronously cascading state updates from an effect.
    if (!nextOpen) {
      setChips([]);
      setResult(null);
      setAccessQuery("");
      setRemovedDerived(new Set());
    }
    onOpenChange(nextOpen);
  }

  function confirmRemove() {
    if (!single || !confirmTarget) return;
    const personId = confirmTarget.id;
    removeGrant(personId, single.id);
    if (personId.startsWith("derived-")) {
      setRemovedDerived((current) => new Set(current).add(personId));
    }
    toast.success(
      fillCopy(peopleCopy.removedNote, locale, {
        name: confirmTarget.name,
        case: caseLabel(single),
      }),
    );
    setConfirmTarget(null);
  }

  function send() {
    const batch = chips;
    if (!batch.length) return;
    const result = invite(batch.map((c) => c.phone ?? ""), cases.map((c) => c.id));
    setResult(result);
    toast.success(fill(shareCopy.inviteToast, locale, { names: result.names.join(", ") }));
    setChips([]);
  }

  // The registered directory, office first, less (single case) anyone already
  // holding access — a suggestion you can't act on is just noise.
  // People on All cases already hold every case and are not offered (OFC-51).
  const known = directoryOptions(office.map((p) => p.phone)).filter(
    (option) =>
      !(single && onCase.some((p) => p.phone === option.phone)) &&
      !office.some((p) => p.allCases && p.phone === option.phone),
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FlowDialogContent className="flex max-h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Header: what this is, then exactly what it applies to. */}
        <DialogHeader className="gap-2.5 border-b border-hairline px-6 py-5 text-left">
          <DialogTitle className="text-title-s font-semibold">
            {pick(shareCopy.title, locale)}
          </DialogTitle>
          {/* The one-line boundary against Add people (PM, Sept 2): what
              sharing grants, and what it does not. */}
          <p className="text-caption text-pretty text-muted-foreground">
            {readOnly
              ? pick(shareCopy.readOnlyNote, locale)
              : pick(shareCopy.bodySingle, locale)}
          </p>
          {single ? (
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate text-body-compact font-medium">{single.title}</p>
              <Identifier
                value={single.caseNumber}
                label="case number"
                className="self-start text-caption text-muted-foreground"
              />
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-body-compact font-medium">
                {fillCopy(shareCopy.scopeManyTitle, locale, { count: String(cases.length) })}
              </p>
              {/* Split rather than joined, so each number keeps the identifier face
                  and can be taken on its own. */}
              <p className="truncate text-caption text-muted-foreground">
                {cases.map((c, i) => (
                  <React.Fragment key={c.id}>
                    {i > 0 ? <span aria-hidden> · </span> : null}
                    <Identifier value={c.caseNumber} label="case number" />
                  </React.Fragment>
                ))}
              </p>
            </div>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          {/* ------------------------------------------------ invite controls */}
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <PeopleInviteField
                  id="share-people"
                  label={pick(inviteFieldCopy.placeholder, locale)}
                  known={known}
                  value={chips}
                  onValueChange={(next) => {
                    setChips(next);
                    setResult(null);
                  }}
                  locale={locale}
                  disabled={readOnly}
                  registeredOnly
                />
              </div>
              <Button type="button" disabled={readOnly || !chips.length} onClick={send}>
                {pick(shareCopy.send, locale)}
              </Button>
            </div>

            {result ? (
              <p className="flex items-start gap-1.5 rounded-lg border border-success bg-success-muted px-3 py-2 text-body-compact font-medium text-success-muted-foreground">
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {pick(shareCopy.sentNote, locale)} {result.names.join(", ")}
                  {bulk ? (
                    <>
                      {" — "}
                      {result.added === 0
                        ? pick(shareCopy.alreadyHadAllNote, locale)
                        : result.skipped === 0
                          ? fillCopy(shareCopy.sentBulkAllNote, locale, {
                              total: String(result.total),
                            })
                          : fillCopy(shareCopy.sentBulkNote, locale, {
                              added: String(result.added),
                              total: String(result.total),
                              skipped: String(result.skipped),
                            })}
                    </>
                  ) : null}
                </span>
              </p>
            ) : null}
          </div>

          {/* --------------------------- who has access (single case only) */}
          {single ? (
            <>
              <Separator />
              <section className="flex flex-col gap-1" aria-label={pick(shareCopy.whoHasAccess, locale)}>
                <div className="flex flex-col items-stretch gap-3 pb-2 sm:flex-row sm:items-center">
                  <h3
                    id="access-list-heading"
                    className="min-w-0 flex-1 text-body-compact font-semibold"
                  >
                    {pick(shareCopy.whoHasAccess, locale)}
                  </h3>
                  <div className="relative w-full sm:w-56">
                    <SearchIcon
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      type="search"
                      aria-labelledby="access-list-heading"
                      className="h-9 pl-9"
                      placeholder={pick(shareCopy.accessSearchPlaceholder, locale)}
                      value={accessQuery}
                      onChange={(event) => setAccessQuery(event.target.value)}
                    />
                  </div>
                </div>
                <CaseAccessList
                  caseId={single.id}
                  people={onCase}
                  locale={locale}
                  query={accessQuery}
                  onRemove={
                    readOnly
                      ? undefined
                      : (personId) =>
                          setConfirmTarget(onCase.find((p) => p.id === personId) ?? null)
                  }
                  onRemoveVakalat={
                    readOnly
                      ? undefined
                      : (person) => setRemoveTarget(person.name)
                  }
                  selfAccessLabel={
                    readOnly ? pick(shareCopy.selfOfficeAccess, locale) : undefined
                  }
                />
              </section>
            </>
          ) : null}
        </div>
      </FlowDialogContent>

      <AlertDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(next) => {
          if (!next) setConfirmTarget(null);
        }}
      >
        <ChromeAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {fillCopy(peopleCopy.removeOneTitle, locale, {
                name: confirmTarget?.name ?? "",
                case: single ? caseLabel(single) : "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>{pick(peopleCopy.removeBodyOne, locale)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{pick(peopleCopy.removeAllCancel, locale)}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRemove}>
              {pick(peopleCopy.removeFromCase, locale)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>

      <RemoveAdvocateDialog
        open={Boolean(removeTarget)}
        onOpenChange={(next) => {
          if (!next) setRemoveTarget(null);
        }}
        advocateName={removeTarget ?? ""}
        caseRef={{
          title: single?.title ?? "",
          caseNumber: single?.caseNumber ?? "",
          court: single?.court ?? "",
        }}
      />
    </Dialog>
  );
}
