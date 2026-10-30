"use client";

/**
 * Add advocates — scenario 1 of the party-actions spec: an advocate already
 * on the case brings colleagues onto it. A **system action**: the
 * vakalatnama the parties sign is the authority, so there is no approval
 * step and the review says so.
 *
 * **Composed in the owner's dialog grammar** (join-case dialog, share
 * dialog), after the first cut aped the witness dialog's oversized case-
 * screen style and was rejected (Sept 1): sm:max-w-xl, hairline header with
 * a title-s heading, sections as semibold field labels on the body fill
 * (no nested cards), people as compact chips, uploads as DocumentSlot,
 * plain hairline footer (never the bg-muted DialogFooter primitive).
 *
 * **One flow = one vakalatnama.** A single vakalatnama can name several
 * advocates for the same parties, so the dialog stacks advocates as chips
 * over ONE party set and ONE upload. Advocates for different parties are a
 * second deed, so a second pass; that scoping is what keeps the
 * advocate-to-party mapping honest with no per-row matching UI.
 *
 * **Own side only.** The party choices are the signed-in advocate's own
 * clients; you cannot put an advocate on record for the opposing party.
 *
 * The lookup resolves registered advocates on the tenth digit, the share
 * dialog's gesture. An unknown number is an invite, not a dead end: the
 * phone field itself morphs to ask for their name (the number moves into
 * the field's prefix, so whose name is never a question), and the chip
 * stacks once the name lands. Chips carry no "invited" tag; nothing is
 * sent until the review is submitted, and saying otherwise would claim an
 * act that has not happened (owner's call, Sept 1).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2Icon, XIcon, FileXIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { initials } from "@/components/access/access-list";
import { VakalatnamaPicker } from "@/components/advocate/vakalatnama-picker";
import { FlowStepper } from "@/components/cases/flow-stepper";
import { usePartiesLive } from "@/components/cases/parties-live";
import {
  ChromeAlertDialogContent,
} from "@/components/chrome/app-chrome";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import {
  ReviewDocValue,
  UPLOAD_HELP,
  UploadedDocField,
} from "@/components/cases/uploaded-doc-field";
import { VAKALATNAMAS } from "@/lib/advocate/content";
import { createVak } from "@/lib/vakalatnama/store";
import {
  ADVOCATE_DEMO_NUMBERS,
  ADVOCATE_LOOKUP,
  PARTY_SIDE_LABEL,
  formatAdvocatePhone,
  type PartyOption,
} from "@/lib/cases/party-actions";
import { Identifier } from "@/components/chrome/identifier";
import { ConfirmMark, OutcomeHeader, StatusFieldControl, StatusFieldError, useRefusal } from "@/components/feedback";

type AdvocateStep = 1 | 2 | 3;

const STEPS = [
  {
    step: 1,
    title: "Advocates and parties",
    description:
      "Find the advocates by mobile number and pick which of your parties they will represent.",
  },
  {
    step: 2,
    title: "Vakalatnama",
    description: "Attach the vakalatnama signed by the parties.",
  },
  {
    step: 3,
    title: "Review",
    description:
      "The advocates can act on this case as soon as the vakalatnama is on record.",
  },
] as const;

/** `barId` absent = not on DRISTI yet; the name is typed, not resolved. */
type SelectedAdvocate = { phone: string; name: string; barId?: string };

type Errors = {
  advocates?: string;
  parties?: string;
  vakalatnama?: string;
};

export function AddAdvocateDialog({
  open,
  onOpenChange,
  litigants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The viewer's own clients only; never the opposing side. */
  litigants: PartyOption[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<AdvocateStep>(1);
  const [phoneInput, setPhoneInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [chips, setChips] = useState<SelectedAdvocate[]>([]);
  /** The unregistered number whose name is being asked for, pre-chip. */
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [partyIds, setPartyIds] = useState<string[]>([]);
  /** The vakalatnama, from one of the three sources the join flow offers. */
  const [vkTab, setVkTab] = useState<"upload" | "saved">("upload");
  const [vakalatFile, setVakalatFile] = useState<File | null>(null);
  const [vkSavedId, setVkSavedId] = useState("");
  const [done, setDone] = useState(false);
  const partiesLive = usePartiesLive();
  const [errors, setErrors] = useState<Errors>({});
  /* A refused Continue points at the first missing field (skill `feedback-states`): it
     takes focus and its line drops in; a repeat press on the same field shakes it. */
  const { attempt, refuse, reset: resetRefusal } = useRefusal();
  const [refused, setRefused] = useState<keyof Errors | null>(null);
  const pointAt = (field: keyof Errors) => {
    if (field !== refused) {
      setRefused(field);
      resetRefusal();
    }
    refuse();
  };
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);

  const current = STEPS.find((item) => item.step === step) ?? STEPS[0];
  const isDirty = useMemo(
    () =>
      Boolean(
        phoneInput ||
          chips.length > 0 ||
          pendingInvite ||
          partyIds.length > 0 ||
          vakalatFile ||
          vkSavedId
      ),
    [phoneInput, chips, pendingInvite, partyIds, vakalatFile, vkSavedId]
  );

  const inputValid = /^\d{10}$/.test(phoneInput);
  const alreadyStacked = chips.some((chip) => chip.phone === phoneInput);
  const lookup =
    inputValid && !alreadyStacked ? (ADVOCATE_LOOKUP[phoneInput] ?? null) : null;

  function resetForm() {
    setStep(1);
    setPhoneInput("");
    setChips([]);
    setPendingInvite(null);
    setInviteName("");
    setPartyIds([]);
    setVkTab("upload");
    setVakalatFile(null);
    setVkSavedId("");
    setDone(false);
    setErrors({});
    setExitConfirmationOpen(false);
  }

  function closeClean() {
    resetForm();
    onOpenChange(false);
  }

  function requestExit() {
    if (isDirty && !done) {
      setExitConfirmationOpen(true);
      return;
    }
    closeClean();
  }

  function stack(chip: SelectedAdvocate) {
    setChips((existing) =>
      existing.some((c) => c.phone === chip.phone) ? existing : [...existing, chip]
    );
    setErrors((c) => ({ ...c, advocates: undefined }));
  }

  /** The one gesture on a resolved number: chip it, or open the name ask. */
  function takeCandidate() {
    if (!inputValid || alreadyStacked) return;
    if (lookup) {
      stack({ phone: phoneInput, ...lookup });
    } else {
      setPendingInvite(phoneInput);
      setInviteName("");
    }
    setPhoneInput("");
  }

  function commitInvite() {
    if (!pendingInvite) return;
    if (!inviteName.trim()) {
      setErrors((c) => ({ ...c, advocates: "Enter the advocate's name." }));
      return;
    }
    stack({ phone: pendingInvite, name: inviteName.trim() });
    setPendingInvite(null);
    setInviteName("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step === 1) {
      // A half-finished invite with a name counts; without one it blocks.
      if (pendingInvite) {
        if (!inviteName.trim()) {
          setErrors((c) => ({ ...c, advocates: "Enter the advocate's name." }));
          pointAt("advocates");
          return;
        }
        commitInvite();
      }
      const stacked = pendingInvite && inviteName.trim() ? chips.length + 1 : chips.length;
      const next: Errors = {};
      if (stacked === 0) {
        next.advocates = "Add at least one advocate by their mobile number.";
      }
      if (partyIds.length === 0) {
        next.parties = "Pick at least one party for the advocates to represent.";
      }
      setErrors(next);
      if (next.advocates || next.parties) {
        pointAt(next.advocates ? "advocates" : "parties");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      const attached = vkTab === "upload" ? Boolean(vakalatFile) : Boolean(vkSavedId);
      if (!attached) {
        setErrors((c) => ({
          ...c,
          vakalatnama: "Attach a vakalatnama to continue.",
        }));
        pointAt("vakalatnama");
        return;
      }
      setStep(3);
    }
  }

  const chosenParties = litigants.filter((party) => partyIds.includes(party.id));
  const advocateNames = chips.map((chip) => chip.name);
  const savedVakalatnama = VAKALATNAMAS.find((item) => item.id === vkSavedId);
  const vakalatnamaName =
    vkTab === "upload" ? vakalatFile?.name : savedVakalatnama?.name;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestExit();
        }}
      >
        <FlowDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          {done ? (
            /* The join dialog's done stage: icon, outcome, one action. A
               dead disabled button asked the reader to imagine the ending
               (owner, Sept 1). */
            <>
              <OutcomeHeader
                titleFrom="dialog"
                focusTitle
                title={chips.length === 1 ? "Advocate added" : "Advocates added"}
                body={
                  <>
                    <NamesWithOthers
                      names={advocateNames}
                      othersLabel="Other advocates"
                    />{" "}
                    can now act on this case for{" "}
                    <NamesWithOthers
                      names={chosenParties.map((p) => p.name)}
                      othersLabel="Other parties"
                    />
                    .
                  </>
                }
              />
              <footer className="flex shrink-0 justify-end border-t border-hairline bg-surface-sunken px-6 py-4">
                <Button type="button" onClick={closeClean}>
                  Done
                </Button>
              </footer>
            </>
          ) : (
            <>
          {/* The stepper gets its own full-width band with symmetric
              padding and a hairline under it: inside the header, the
              close button's pr-14 pushed it off the dialog's center and
              it sat crammed against the step heading (owner, Sept 1). */}
          <div className="shrink-0 border-b border-hairline px-6 pt-6 pb-4">
            <FlowStepper
              steps={STEPS}
              current={step}
              label="Add advocates progress"
            />
          </div>
          <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-5 pr-14 text-left">
            <DialogTitle className="text-title-s font-semibold text-balance">
              {current.title}
            </DialogTitle>
            <DialogDescription className="text-pretty">
              {/* Step 2's description carries the deed's own facts, so the
                  body below needs no second "Vakalatnama" heading over an
                  executed-by line (the heading appeared three deep:
                  stepper, title, section - owner, Sept 1). */}
              {step === 2 ? (
                <>
                  Attach the vakalatnama executed by{" "}
                  <NamesWithOthers
                    names={chosenParties.map((p) => p.name)}
                    othersLabel="Other parties"
                  />{" "}
                  in favour of{" "}
                  <NamesWithOthers
                    names={advocateNames}
                    othersLabel="Other advocates"
                  />
                  .
                </>
              ) : (
                current.description
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <form
              id="add-advocates-form"
              noValidate
              onSubmit={handleSubmit}
              className="flex flex-col gap-6"
            >
              {step === 1 ? (
                <>
                  <Field data-invalid={Boolean(errors.advocates)}>
                    <FieldLabel
                      className="block w-full text-body font-semibold leading-snug"
                      htmlFor="advocate-phone"
                    >
                      Advocates
                    </FieldLabel>
                    <FieldDescription>
                      Everyone added here goes on the same vakalatnama.
                    </FieldDescription>

                    {chips.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {chips.map((chip) => (
                          <span
                            key={chip.phone}
                            className="inline-flex items-center gap-1.5 rounded-md bg-muted py-1 pr-1 pl-2.5 text-caption text-foreground"
                          >
                            <span className="flex flex-col">
                              <span className="font-medium">{chip.name}</span>
                              <span className="text-muted-foreground tabular-nums">
                                {formatAdvocatePhone(chip.phone)}
                              </span>
                            </span>
                            {/* Centered on the chip, not self-start: with
                                two lines of text a top-pinned cross reads
                                misaligned (owner's call, Sept 1). */}
                            <button
                              type="button"
                              aria-label={`Remove ${chip.name}`}
                              className="flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setChips((existing) =>
                                  existing.filter((c) => c.phone !== chip.phone)
                                )
                              }
                            >
                              <XIcon className="size-3.5" aria-hidden />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <StatusFieldControl attempt={refused === "advocates" ? attempt : 0}>
                    {pendingInvite ? (
                      /* The picked number keeps its own box, read-only,
                         and the name gets its own box beside it. One
                         combined field ran the two together with nothing
                         separating them (owner, Sept 1). */
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          tabIndex={-1}
                          aria-label="Mobile number"
                          className="w-40 shrink-0 text-muted-foreground tabular-nums"
                          value={`+91 ${formatAdvocatePhone(pendingInvite)}`}
                        />
                        <Input
                          id="advocate-phone"
                          aria-invalid={Boolean(errors.advocates)}
                          autoFocus
                          autoComplete="off"
                          className="min-w-0 flex-1"
                          placeholder="Advocate's name"
                          aria-label={`Name for +91 ${formatAdvocatePhone(pendingInvite)}`}
                          value={inviteName}
                          onChange={(event) => {
                            setInviteName(event.target.value);
                            setErrors((c) => ({
                              ...c,
                              advocates: undefined,
                            }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitInvite();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={commitInvite}
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground"
                          aria-label="Cancel this invite"
                          onClick={() => {
                            setPendingInvite(null);
                            setInviteName("");
                            setErrors((c) => ({ ...c, advocates: undefined }));
                          }}
                        >
                          <XIcon aria-hidden />
                        </Button>
                      </div>
                    ) : (
                    <div className="relative">
                      <InputGroup>
                        <InputGroupAddon>
                          <InputGroupText>+91</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          id="advocate-phone"
                          aria-invalid={Boolean(errors.advocates)}
                          type="tel"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={10}
                          placeholder="10-digit mobile number"
                          value={phoneInput}
                          onFocus={() => setFocused(true)}
                          onBlur={() => setFocused(false)}
                          onChange={(event) => {
                            setPhoneInput(
                              event.target.value.replace(/\D/g, "").slice(0, 10)
                            );
                            setErrors((c) => ({ ...c, advocates: undefined }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              takeCandidate();
                            }
                          }}
                        />
                      </InputGroup>

                      {/* The tenth digit resolves against the registry; the
                          dropdown anchors to the input, share-dialog style.
                          A registered advocate chips at once; an unknown
                          number opens the one-time name ask below. */}
                      {inputValid && !alreadyStacked && focused ? (
                        <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-overlay">
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              takeCandidate();
                            }}
                          >
                            <Avatar className="size-8 shrink-0">
                              <AvatarFallback className="text-caption font-medium">
                                {lookup ? initials(lookup.name) : "#"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-body-compact font-medium">
                                {lookup
                                  ? lookup.name
                                  : `+91 ${formatAdvocatePhone(phoneInput)}`}
                              </span>
                              <span className="truncate text-caption text-muted-foreground">
                                {lookup ? (
                                  <>
                                    <span className="tabular-nums">
                                      {formatAdvocatePhone(phoneInput)}
                                    </span>
                                    {" · Bar ID "}
                                    {/* The whole lookup result is the button. */}
                                    <Identifier
                                      value={lookup.barId}
                                      label="bar id"
                                      copyable={false}
                                    />
                                  </>
                                ) : (
                                  "Not on DRISTI yet. They'll be asked to register when they join."
                                )}
                              </span>
                            </span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                    )}
                    </StatusFieldControl>

                    {alreadyStacked ? (
                      <FieldDescription>
                        This advocate is already in the list.
                      </FieldDescription>
                    ) : null}

                    {errors.advocates ? (
                      <StatusFieldError
                        attempt={refused === "advocates" ? attempt : undefined}
                        still={refused !== "advocates"}
                      >
                        {errors.advocates}
                      </StatusFieldError>
                    ) : null}
                    {/* While naming an invitee the demo numbers are noise;
                        the line explains the register-on-join instead. */}
                    <p className="text-caption text-muted-foreground tabular-nums">
                      {pendingInvite
                        ? "Not on DRISTI yet. They'll be asked to register when they join."
                        : ADVOCATE_DEMO_NUMBERS}
                    </p>
                  </Field>

                  <Separator />

                  <Field data-invalid={Boolean(errors.parties)}>
                    <FieldLabel className="block w-full text-body font-semibold leading-snug">
                      Who will they represent?
                    </FieldLabel>
                    <FieldDescription>
                      Your clients on this case. The vakalatnama must be signed
                      by every party picked here.
                    </FieldDescription>
                    <StatusFieldControl attempt={refused === "parties" ? attempt : 0}>
                    <div className="flex flex-col gap-1">
                      {litigants.map((party) => (
                        <div
                          key={party.id}
                          className="flex min-h-10 items-center gap-2"
                        >
                          <Checkbox
                            id={`represent-${party.id}`}
                            checked={partyIds.includes(party.id)}
                            onCheckedChange={() => {
                              setPartyIds((existing) =>
                                existing.includes(party.id)
                                  ? existing.filter((id) => id !== party.id)
                                  : [...existing, party.id]
                              );
                              setErrors((c) => ({ ...c, parties: undefined }));
                            }}
                            aria-invalid={Boolean(errors.parties)}
                          />
                          <Label htmlFor={`represent-${party.id}`}>
                            {party.name}
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {PARTY_SIDE_LABEL[party.side]}
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                    </StatusFieldControl>
                    {errors.parties ? (
                      <StatusFieldError
                        attempt={refused === "parties" ? attempt : undefined}
                        still={refused !== "parties"}
                      >
                        {errors.parties}
                      </StatusFieldError>
                    ) : null}
                  </Field>
                </>
              ) : step === 2 ? (
                <>
                  <div className="flex flex-col gap-3">
                    {/* Same three sources as the join flow: upload a signed
                        copy, pick a generated one, or make one below. The
                        header above already says whose deed this is. */}
                    <Tabs
                      value={vkTab}
                      onValueChange={(value) => {
                        setVkTab(value as "upload" | "saved");
                        setErrors((c) => ({ ...c, vakalatnama: undefined }));
                      }}
                    >
                      <TabsList className="w-full border border-hairline bg-surface-sunken">
                        <TabsTrigger value="upload" className="flex-1">
                          Upload a file
                        </TabsTrigger>
                        <TabsTrigger value="saved" className="flex-1">
                          Generated vakalatnamas
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="upload" className="pt-3">
                        <Field data-invalid={Boolean(errors.vakalatnama)}>
                          <UploadedDocField
                            label="Signed vakalatnama"
                            required
                            file={vakalatFile}
                            onFileChange={(file) => {
                              setVakalatFile(file);
                              setErrors((c) => ({
                                ...c,
                                vakalatnama: undefined,
                              }));
                            }}
                          />
                          <FieldDescription>{UPLOAD_HELP}</FieldDescription>
                          {errors.vakalatnama ? (
                            <StatusFieldError
                              attempt={refused === "vakalatnama" ? attempt : undefined}
                              still={refused !== "vakalatnama"}
                            >
                              {errors.vakalatnama}
                            </StatusFieldError>
                          ) : null}
                        </Field>
                      </TabsContent>
                      <TabsContent value="saved" className="flex flex-col gap-2 pt-3">
                        <Field data-invalid={Boolean(errors.vakalatnama)}>
                          <VakalatnamaPicker
                            items={VAKALATNAMAS}
                            selectedId={vkSavedId}
                            onSelect={(id) => {
                              setVkSavedId(id);
                              setErrors((c) => ({
                                ...c,
                                vakalatnama: undefined,
                              }));
                            }}
                            locale="en"
                          />
                          {errors.vakalatnama ? (
                            <StatusFieldError
                              attempt={refused === "vakalatnama" ? attempt : undefined}
                              still={refused !== "vakalatnama"}
                            >
                              {errors.vakalatnama}
                            </StatusFieldError>
                          ) : null}
                        </Field>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-body-compact font-medium">
                      Don&apos;t have a vakalatnama yet?
                    </p>
                    {/* Straight into a fresh e-sign draft, the same way the
                        Vakalatnama section's own New button starts one. The
                        dialog draft is lost on navigation, the same trade
                        the person makes by going off to prepare a deed. */}
                    <Button
                      type="button"
                      variant="outline"
                      data-icon="inline-start"
                      onClick={() =>
                        router.push(`/vakalatnama/${createVak("advocate")}`)
                      }
                    >
                      <FilePlus2Icon aria-hidden />
                      Generate one in the portal
                    </Button>
                  </div>
                </>
              ) : (
                <DescriptionList>
                  <ReviewRow term={chips.length === 1 ? "Advocate" : "Advocates"}>
                    <span className="flex flex-col gap-1">
                      {chips.map((chip) => (
                        <span key={chip.phone}>
                          {chip.name}
                          {chip.barId ? (
                            <span className="text-muted-foreground">
                              {" · Bar ID "}
                              <Identifier value={chip.barId} label="bar id" />
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {" "}
                              (not yet registered)
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                  </ReviewRow>
                  <ReviewRow term="Representing">
                    <NamesWithOthers
                      names={chosenParties.map((p) => p.name)}
                      othersLabel="Other parties"
                    />
                  </ReviewRow>
                  <ReviewRow term="Vakalatnama">
                    {vkTab === "upload" ? (
                      <ReviewDocValue file={vakalatFile} />
                    ) : (
                      vakalatnamaName
                    )}
                  </ReviewRow>
                </DescriptionList>
              )}
            </form>
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => (s - 1) as AdvocateStep)}
              >
                Back
              </Button>
            ) : (
              <span aria-hidden className="hidden sm:block" />
            )}
            {step < 3 ? (
              <Button type="submit" form="add-advocates-form">
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  /* Report the addition so the Parties list updates at once
                     (session-local; the participants service is the seam). */
                  partiesLive?.addAdvocates(advocateNames, partyIds);
                  setDone(true);
                }}
              >
                {chips.length === 1 ? "Add advocate" : "Add advocates"}
              </Button>
            )}
          </footer>
            </>
          )}
        </FlowDialogContent>
      </Dialog>

      <AlertDialog
        open={exitConfirmationOpen}
        onOpenChange={setExitConfirmationOpen}
      >
        <ChromeAlertDialogContent>
          <AlertDialogHeader>
            <ConfirmMark danger icon={FileXIcon} />
            <AlertDialogTitle>Discard advocate draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The details entered here will be lost if you discard this draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={closeClean}>
              Discard draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ReviewRow({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <DescriptionRow className="grid-cols-1 sm:grid-cols-[minmax(7rem,10rem)_1fr]">
      <DescriptionTerm className="text-body-compact">{term}</DescriptionTerm>
      <DescriptionDetails className="text-body-compact">
        {children}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

/** "A", "A and B", "A, B and C" — a list of people reads as a sentence. */
function formatNames(names: string[]): string {
  return new Intl.ListFormat("en-IN", {
    style: "long",
    type: "conjunction",
  }).format(names);
}

/**
 * Two names at most in running copy; the rest fold into an explorable
 * "N more" popover, the join flow's "and 1 other" pattern. Ten advocates
 * would otherwise turn a one-line sentence into a paragraph.
 */
function NamesWithOthers({
  names,
  othersLabel,
}: {
  names: string[];
  othersLabel: string;
}) {
  if (names.length <= 2) return <>{formatNames(names)}</>;
  const rest = names.slice(2);
  return (
    <>
      {names.slice(0, 2).join(", ")} and{" "}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center rounded-sm underline decoration-dotted underline-offset-4 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={othersLabel}
          >
            {rest.length} more
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <p className="text-caption font-semibold text-muted-foreground">
            {othersLabel}
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-body-compact">
            {rest.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </>
  );
}
