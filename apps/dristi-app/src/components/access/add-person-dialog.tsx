"use client";

import * as React from "react";
import { SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAccess } from "@/components/access/access-state";
import {
  directoryOptions,
  PeopleInviteField,
  type InvitePerson,
} from "@/components/access/people-invite-field";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { Identifier } from "@/components/chrome/identifier";
import { pick, type Locale } from "@/lib/onboarding/content";
import {
  ACCESS_CASES,
  addPersonCopy,
  fillCopy,
  inviteFieldCopy,
  viewerHoldsVakalat,
  type AccessPerson,
} from "@/lib/access/content";

type Scope = "all" | "specific";

/** The cases this advocate may share: those where they are on the vakalatnama (OFC-04). */
const SHAREABLE_CASES = ACCESS_CASES.filter((c) => viewerHoldsVakalat(c.id));

/**
 * Add person — the People tab's way into the office (OFC-20 to OFC-28).
 *
 * Who (registered advocates and clerks, searched by name, number or Bar ID),
 * and one kind of access (OFC-24): All cases — every current and future case —
 * or Specific cases picked here, with no future cases. Given `person`, the
 * same dialog extends a Specific-cases member (OFC-27, OFC-33): the who step
 * is fixed and the cases they already hold are shown ticked.
 */
export function AddPersonDialog({
  open,
  onOpenChange,
  locale,
  person,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  /** An office member to give more cases to; absent for a new person. */
  person?: AccessPerson | null;
}) {
  const { invite, office } = useAccess();
  const [chosen, setChosen] = React.useState<InvitePerson[]>([]);
  const [scope, setScope] = React.useState<Scope>("specific");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [caseQuery, setCaseQuery] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const held = new Set(person?.grants.map((g) => g.caseId) ?? []);
  // Anyone on All cases already holds every case, so is not offered (OFC-27).
  const known = directoryOptions(office.map((p) => p.phone)).filter(
    (option) => !office.some((p) => p.allCases && p.phone === option.phone),
  );

  const caseIds =
    scope === "all"
      ? SHAREABLE_CASES.map((c) => c.id).filter((id) => !held.has(id))
      : picked;
  const people = person ? [{ phone: person.phone }] : chosen;
  const missingPerson = people.length === 0;
  const missingCases = scope === "specific" && picked.length === 0;

  const q = caseQuery.trim().toLowerCase();
  const visibleCases = q
    ? SHAREABLE_CASES.filter(
        (c) => c.title.toLowerCase().includes(q) || c.caseNumber.toLowerCase().includes(q),
      )
    : SHAREABLE_CASES;

  function reset() {
    setChosen([]);
    setScope("specific");
    setPicked([]);
    setCaseQuery("");
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (missingPerson || missingCases) {
      setTouched(true);
      return;
    }
    const result = invite(
      people.map((p) => p.phone ?? ""),
      caseIds,
      scope === "all" ? { allCases: true } : undefined,
    );
    const names = result.names.join(", ");
    toast.success(
      result.total === 1
          ? fillCopy(addPersonCopy.doneToastOne, locale, { names })
          : fillCopy(addPersonCopy.doneToast, locale, {
              names,
              count: String(result.total),
            }),
      // Someone new to the office accepts once before access starts (OFC-07).
      person && !person.pending
        ? undefined
        : { description: fillCopy(addPersonCopy.doneToastPending, locale, { names }) },
    );
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FlowDialogContent className="flex max-h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader className="gap-2.5 border-b border-hairline px-6 py-5 text-left">
            <DialogTitle className="text-title-s font-semibold">
              {person
                ? fillCopy(addPersonCopy.titleMore, locale, { name: person.name })
                : pick(addPersonCopy.title, locale)}
            </DialogTitle>
            <p className="text-caption text-pretty text-muted-foreground">
              {pick(addPersonCopy.body, locale)}
            </p>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
            {person ? null : (
              <Field data-invalid={touched && missingPerson}>
                <FieldLabel htmlFor="add-person-who">
                  {pick(addPersonCopy.peopleLabel, locale)}
                </FieldLabel>
                <PeopleInviteField
                  id="add-person-who"
                  label={pick(inviteFieldCopy.placeholder, locale)}
                  known={known}
                  value={chosen}
                  onValueChange={setChosen}
                  locale={locale}
                  registeredOnly
                />
                <FieldError>
                  {touched && missingPerson ? pick(addPersonCopy.needPerson, locale) : null}
                </FieldError>
              </Field>
            )}

            <Field data-invalid={touched && missingCases}>
              <FieldLabel>{pick(addPersonCopy.casesLabel, locale)}</FieldLabel>
              <RadioGroup
                value={scope}
                onValueChange={(value) => setScope(value as Scope)}
                className="flex flex-col gap-3"
              >
                {(["all", "specific"] as const).map((value) => (
                  <Label
                    key={value}
                    htmlFor={`add-person-scope-${value}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-brand-muted"
                  >
                    <RadioGroupItem
                      id={`add-person-scope-${value}`}
                      value={value}
                      className="mt-0.5"
                    />
                    <span className="flex flex-col gap-1">
                      <span className="font-medium">
                        {pick(value === "all" ? addPersonCopy.allCurrent : addPersonCopy.specific, locale)}
                      </span>
                      <span className="text-caption font-normal text-muted-foreground">
                        {value === "all"
                          ? fillCopy(addPersonCopy.allCurrentHint, locale, {
                              count: String(SHAREABLE_CASES.length),
                            })
                          : pick(addPersonCopy.specificHint, locale)}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>

              {scope === "specific" ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border">
                  <div className="flex items-center gap-3 border-b border-hairline p-3">
                    <div className="relative min-w-0 flex-1">
                      <SearchIcon
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        type="search"
                        aria-label={pick(addPersonCopy.caseSearch, locale)}
                        className="h-9 pl-9"
                        placeholder={pick(addPersonCopy.caseSearch, locale)}
                        value={caseQuery}
                        onChange={(event) => setCaseQuery(event.target.value)}
                      />
                    </div>
                    <span className="shrink-0 text-caption text-muted-foreground tabular-nums" aria-live="polite">
                      {fillCopy(addPersonCopy.selectedCount, locale, { count: String(picked.length) })}
                    </span>
                  </div>
                  <ul className="flex max-h-64 flex-col overflow-y-auto px-3 pb-2">
                    {visibleCases.map((c) => {
                      const already = held.has(c.id);
                      const id = `add-person-case-${c.id}`;
                      return (
                        <li key={c.id} className="border-b border-hairline last:border-b-0">
                          <label
                            htmlFor={id}
                            className="flex cursor-pointer items-start gap-3 py-3 has-disabled:cursor-default"
                          >
                            <Checkbox
                              id={id}
                              className="mt-0.5"
                              disabled={already}
                              checked={already || picked.includes(c.id)}
                              onCheckedChange={(value) =>
                                setPicked((current) =>
                                  value === true
                                    ? [...current, c.id]
                                    : current.filter((entry) => entry !== c.id),
                                )
                              }
                            />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="text-body-compact font-medium text-pretty">{c.title}</span>
                              <span className="text-caption text-muted-foreground">
                                <Identifier value={c.caseNumber} label="case number" />
                                {already ? <> · {pick(addPersonCopy.alreadyHas, locale)}</> : null}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </Field>

            {touched && missingCases ? (
              <p className="text-body-compact text-destructive" role="alert">
                {pick(addPersonCopy.needCases, locale)}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-hairline px-6 py-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {pick(addPersonCopy.cancel, locale)}
            </Button>
            <Button type="submit">
              {pick(person ? addPersonCopy.submitMore : addPersonCopy.submit, locale)}
            </Button>
          </div>
        </form>
      </FlowDialogContent>
    </Dialog>
  );
}
