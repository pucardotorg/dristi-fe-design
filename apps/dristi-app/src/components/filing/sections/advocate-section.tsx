"use client";

/**
 * Advocate details — the advocates on the Vakalatnama, and which complainant each acts for.
 *
 * An advocate is found once, not described twice: one search box takes a name, a bar
 * number or a full mobile number and looks it up in the register
 * (`lib/filing/registry.ts` — a stand-in for the real one). What it finds is then shown as a result — name, number and bar
 * council — so the spelling that reaches the Vakalatnama is the register's rather than a
 * re-keying of it. An advocate the register does not list is entered by hand instead, one
 * click away. An advocate filing for themselves starts with their own row filled from
 * their profile, and the panel beside the form reads the uploaded Vakalatnama.
 */

import * as React from "react";
import Link from "next/link";
import { CheckIcon, ChevronDownIcon, PlusIcon, UserRoundIcon } from "lucide-react";

import { blankAdvocate, isAdvocateProfile } from "@/lib/filing/blank";
import { useProfile } from "@/lib/filing/profile";
import {
  findAdvocate,
  searchAdvocates,
  type RegisteredAdvocate,
} from "@/lib/filing/registry";
import {
  complainantChoices,
  isPartyInPerson,
  partySourceSlot,
  representedIndices,
} from "@/lib/filing/selectors";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { Identifier } from "@/components/chrome/identifier";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard, HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { ComboField } from "@/components/filing/inputs";
import { SectionNotice } from "@/components/filing/notices";
import { RemoveButton } from "@/components/filing/repeat-lists";
import {
  SourcePanel,
  useSourceOpenState,
  ViewSourceButton,
} from "@/components/filing/source-panel";

/** A filing carries at most six advocates. */
const MAX_ADVOCATES = 6;

const sameBarNumber = (a: string, b: string) =>
  a.trim().toUpperCase() === b.trim().toUpperCase();

export function AdvocateSection() {
  const { draft, update, hrefFor } = useFiling();
  const { prev, next } = neighbours("advocate");
  const { profile } = useProfile();

  const advocates = draft.advocates;
  const choices = complainantChoices(draft.complainants);

  /**
   * A complainant who conducts the case themselves has no advocate on record, so those
   * indices leave the "Advocate for" list. They stay in it as disabled rows rather than
   * vanishing — the absence is a consequence of an answer they gave, and the row is where
   * that reads. When every complainant is a party in person there is nothing to fill in
   * at all, so the section says so instead of showing an unfillable form.
   */
  const represented = representedIndices(draft.complainants);
  const pipLabels = draft.complainants.flatMap((c, i) =>
    isPartyInPerson(c) ? [`Complainant ${i + 1}`] : []
  );
  const allInPerson = draft.complainants.length > 0 && represented.length === 0;

  /**
   * The source rail is a column beside the form from `xl` up, so it starts expanded
   * there as in the demo; collapsed, it stays in the layout as a strip. Below that it
   * is a sheet over the form — opened on request ("View source document") rather than
   * covering the screen on arrival.
   */
  const [sourceOpen, setSourceOpen] = useSourceOpenState();

  /**
   * The rows the register field offers, live-searched as the person types — in either
   * the bar number box or the name box, since either one is a real way to search for an
   * advocate and the register is keyed on neither exclusively. `searchAdvocates` already
   * matches on both; what changed is that the screen now asks it again on every
   * keystroke instead of filtering one list fetched at mount, which used to leave rows
   * past the first page unreachable no matter what was typed.
   */
  const [register, setRegister] = React.useState<RegisteredAdvocate[]>([]);
  React.useEffect(() => {
    let live = true;
    void searchAdvocates("").then((rows) => {
      if (live) setRegister(rows);
    });
    return () => {
      live = false;
    };
  }, []);
  const searchRegister = React.useCallback((query: string) => {
    void searchAdvocates(query).then(setRegister);
  }, []);

  /**
   * What is typed into the search box, per advocate row. It is not the advocate's name:
   * searching and having-found are different states, and conflating them is what made
   * the field look like two boxes for one answer.
   */
  const [queries, setQueries] = React.useState<Record<string, string>>({});
  const setQuery = (id: string, value: string) =>
    setQueries((q) => ({ ...q, [id]: value }));


  // One Vakalatnama is uploaded per complainant; show the one belonging to the complainant
  // the first advocate acts for (clamped, since indices survive a complainant's removal).
  const vakalatnamaParty = Math.min(
    advocates[0]?.forComplainants[0] ?? 0,
    Math.max(0, draft.complainants.length - 1)
  );
  const vakalatnama = partySourceSlot(draft, vakalatnamaParty, "vakalatnama");

  /**
   * The signed-in advocate filling in their own row — name and bar number in one action.
   * A new draft already starts with them as Advocate 1, so this is the way back after
   * removing themselves; once they are on the filing it is offered nowhere.
   */
  const canUseProfile =
    isAdvocateProfile(profile) &&
    !advocates.some((a) => sameBarNumber(a.barNumber, profile.barNumber));
  const fillFromProfile = (index: number) =>
    update((d) => {
      if (!isAdvocateProfile(profile)) return;
      d.advocates[index].name = profile.name.trim();
      d.advocates[index].barNumber = profile.barNumber.trim();
    });

  const toggleComplainant = (index: number, choice: number) =>
    update((d) => {
      const current = d.advocates[index].forComplainants;
      d.advocates[index].forComplainants = current.includes(choice)
        ? current.filter((k) => k !== choice)
        : [...current, choice].sort((a, b) => a - b);
    });

  const toggleAll = (index: number, allSelected: boolean) =>
    update((d) => {
      d.advocates[index].forComplainants = allSelected
        ? []
        : representedIndices(d.complainants);
    });

  const addAdvocate = () =>
    update((d) => {
      if (d.advocates.length >= MAX_ADVOCATES) return;
      d.advocates.push(blankAdvocate());
    });

  const removeAdvocate = (index: number) =>
    update((d) => {
      if (d.advocates.length <= 1) return;
      d.advocates.splice(index, 1);
    });

  return (
    <>
      <FilingMain sourceOpen={sourceOpen}>
        <FilingPageHeader
          title="Advocate details"
          description="Add the advocates representing the complainant, as listed on the Vakalatnama."
          actions={
            !sourceOpen ? (
              <ViewSourceButton onClick={() => setSourceOpen(true)} />
            ) : null
          }
        />

        {/* Stated, not enforced: appearing in person is the complainant's own answer on
            the previous screen, so this reports the consequence rather than blocking. */}
        {pipLabels.length ? (
          <SectionNotice
            variant="info"
            title={
              allInPerson ? "The complainant appears in person" : "Appearing as a party in person"
            }
          >
            {allInPerson
              ? "This filing has no advocate on record. The complainant conducts the case in person."
              : `${pipLabels.join(" and ")} ${
                  pipLabels.length > 1 ? "conduct" : "conducts"
                } the case in person, so no advocate goes on record for them.`}{" "}
            Change this under{" "}
            <Link
              href={hrefFor("complainant")}
              className="font-medium text-current underline underline-offset-2"
            >
              Complainant details
            </Link>
            .
          </SectionNotice>
        ) : null}

        {/* The register is a stand-in and incomplete, so the notice states the
            requirement without implying this screen enforces it. */}
        {allInPerson || draft.dismissed.advocateInfo ? null : (
          <SectionNotice
            variant="neutral"
            title="Adding an advocate"
            onDismiss={() =>
              update((d) => {
                d.dismissed.advocateInfo = true;
              })
            }
          >
            Only advocates registered on the court portal can appear on a filing.
          </SectionNotice>
        )}

        {allInPerson ? null : advocates.map((a, i) => {
          // Indices are kept even if a complainant is removed or turns party-in-person;
          // only the ones an advocate may still act for count as selected.
          const selected = a.forComplainants.filter((k) => represented.includes(k));
          // A row that holds an advocate shows them as found, in the register's spelling
          // where it lists them. The demo register is incomplete, so a draft's own name and
          // bar number (a sample, or the signed-in advocate) must not read as a blank box.
          const onRegister =
            findAdvocate(a.barNumber) ??
            (a.name.trim() && a.barNumber.trim()
              ? { name: a.name, barNumber: a.barNumber }
              : undefined);
          const allSelected =
            represented.length > 0 && selected.length === represented.length;
          // "All complainants" is only true when none were held back for appearing in
          // person; otherwise the ones actually covered are named.
          const forLabel =
            selected.length === 0
              ? "Select complainants"
              : allSelected && represented.length === choices.length
                ? "All complainants"
                : selected.map((k) => choices[k]).join(", ");

          return (
            <FormCard
              key={a.id}
              title={`Advocate ${i + 1}`}
              action={
                advocates.length > 1 ? (
                  <RemoveButton
                    label={`Remove advocate ${i + 1}`}
                    onClick={() => removeAdvocate(i)}
                  />
                ) : undefined
              }
            >
              {/* A lone short answer takes half the card, like every other one. */}
              <HalfWidth>
                <FormField asGroup label="Advocate for" name={`advocates.${i}.for`} required>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      aria-label="Advocate for"
                      className="w-full justify-between font-normal"
                    >
                      <span
                        className={
                          selected.length === 0
                            ? "min-w-0 truncate text-muted-foreground"
                            : "min-w-0 truncate"
                        }
                      >
                        {forLabel}
                      </span>
                      <ChevronDownIcon
                        data-icon="inline-end"
                        aria-hidden
                        className="text-muted-foreground"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuCheckboxItem
                      checked={allSelected}
                      onCheckedChange={() => toggleAll(i, allSelected)}
                      onSelect={(event) => event.preventDefault()}
                    >
                      All complainants
                    </DropdownMenuCheckboxItem>
                    {choices.map((label, k) => {
                      const inPerson = isPartyInPerson(draft.complainants[k]);
                      return (
                        <DropdownMenuCheckboxItem
                          key={label}
                          checked={!inPerson && selected.includes(k)}
                          disabled={inPerson}
                          onCheckedChange={() => toggleComplainant(i, k)}
                          onSelect={(event) => event.preventDefault()}
                        >
                          <span className="min-w-0 truncate">{label}</span>
                          {inPerson ? (
                            <span className="ml-auto pl-3 text-caption font-medium text-muted-foreground">
                              In person
                            </span>
                          ) : null}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                  </DropdownMenu>
                </FormField>
              </HalfWidth>

              {/*
                One search, not two fields. The bar number, the name and the mobile
                number are the same lookup from different directions, so asking for each
                would put one register behind several boxes. Only advocates on the register can appear on a filing, so the
                register is the whole path — there is nothing to type by hand.
              */}
              {onRegister ? (
                <FormField asGroup label="Advocate" name={`advocates.${i}.advocate`} required>
                  <div className="flex items-start gap-3 rounded-lg bg-surface-sunken p-4">
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-success bg-success-muted text-success-muted-foreground"
                    >
                      <CheckIcon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold text-foreground">
                        {onRegister.name}
                      </p>
                      <p className="truncate text-caption text-muted-foreground">
                        <Identifier
                          value={onRegister.barNumber}
                          label="bar registration"
                        />
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Change advocate ${i + 1}`}
                      onClick={() => {
                        setQuery(a.id, "");
                        update((d) => {
                          d.advocates[i].barNumber = "";
                          d.advocates[i].name = "";
                        });
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </FormField>
              ) : (
                <FormField label="Advocate" name={`advocates.${i}.advocate`} required>
                  <ComboField
                    value={queries[a.id] ?? ""}
                    onChange={(v: string) => {
                      setQuery(a.id, v);
                      searchRegister(v);
                    }}
                    items={register}
                    filter={null}
                    onSelect={(item) => {
                      const adv = item as RegisteredAdvocate;
                      setQuery(a.id, "");
                      update((d) => {
                        d.advocates[i].barNumber = adv.barNumber;
                        d.advocates[i].name = adv.name;
                      });
                    }}
                    itemKey={(item) => (item as RegisteredAdvocate).barNumber}
                    itemLabel={(item) => (item as RegisteredAdvocate).name}
                    renderItem={(item) => {
                      const adv = item as RegisteredAdvocate;
                      return (
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{adv.name}</span>
                          <span className="truncate text-caption text-muted-foreground">
                            {/* A combobox row is an option — no control nested inside it. */}
                            <Identifier
                              value={adv.barNumber}
                              label="bar registration"
                              copyable={false}
                            />
                          </span>
                        </span>
                      );
                    }}
                    placeholder="Name, bar number or mobile"
                    emptyLabel="No one on the register by that name or number."
                    ariaLabel="Advocate"
                  />
                </FormField>
              )}

              {canUseProfile && !onRegister ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit"
                  // Six identical "Use my details" in a row otherwise; the visible label
                  // stays inside the accessible name, so voice control still works.
                  aria-label={`Use my details for advocate ${i + 1}`}
                  onClick={() => fillFromProfile(i)}
                >
                  <UserRoundIcon data-icon="inline-start" aria-hidden />
                  Use my details
                </Button>
              ) : null}
            </FormCard>
          );
        })}

        {allInPerson ? null : (
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={addAdvocate}
            disabled={advocates.length >= MAX_ADVOCATES}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            Add another advocate
          </Button>
        )}
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        continueHref={next ? hrefFor(next) : undefined}
      />

      <SourcePanel
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        eyebrow="Uploaded document"
        title="Vakalatnama"
        chips={
          vakalatnama?.file
            ? [
                {
                  label: vakalatnama.file.name,
                  active: true,
                  onClick: () => setSourceOpen(true),
                },
              ]
            : []
        }
        file={vakalatnama?.file ?? null}
        uploadHref={hrefFor("upload")}
        imageAlt="Uploaded Vakalatnama"
        note="Copy the advocate's name and bar number from this document."
      />
    </>
  );
}
