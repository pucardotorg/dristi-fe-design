"use client";

/**
 * Confirm who a process goes to and how, before its sentence is written into the order —
 * `PRC-03` of `handovers/process-handover.md`, `ITM-11` of
 * `handovers/order-generation.md`, and the popup the owner asked for (2026-09-26):
 * "create a pop-up to show the name of the accused and their address and allow you to
 * select the channels ... only after they confirm this will the text be added."
 *
 * It opens pre-selected (§5.1 of the handover, `defaultProcessVariables`) and says why,
 * so the drafter can check the default rather than rebuild it. The footer counts the
 * processes confirming will create, because several recipients chosen together are
 * still one process per recipient, per channel, per address (`AUT-09`).
 *
 * One dialog, shared by the hearing composer's catalogue (`order-screen.tsx`) and the
 * cognizance composite (`cognizance-order-screen.tsx`) — the same confirmation either
 * door reaches, on the same reasoning `fillPartyVariables` states for the substitution
 * itself: two copies would risk two answers to what the order asks the drafter to
 * confirm.
 *
 * A single stage, not a staged flow (`ui-craft`'s motion reference): there is one
 * decision here, addressees and channels together, so a wizard would only be adding
 * steps between the drafter and a confirmation that fits on one screen.
 */

import * as React from "react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useCourt } from "@/components/court/court-provider";
import { policeStationsFor } from "@/lib/employee/case-people";
import {
  channelsFor,
  formatStructuredAddress,
  needsPoliceStation,
  processesFor,
  processVariablesComplete,
  selectedChannels,
  selectedRecipients,
  unreachableChannels,
  type ProcessRecipient,
  type ProcessVariables,
} from "@/lib/employee/process-variables";

export function OrderVariableDialog({
  open,
  onOpenChange,
  /** What to key the body on — an item id when reopening one, the type when adding.
   *  Keyed the way `ListingApplicationDialog` keys its own body: remounting is what
   *  starts the draft fresh on the values it was just handed, rather than carrying
   *  over whatever a previous confirmation left mid-edit. */
  dialogKey,
  label,
  variables,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogKey: string | null;
  /** The template's own label — "Issue of summons" / "Issue of warrants" — as the title. */
  label: string;
  /** `null` while there is nothing to confirm yet; the dialog stays closed either way. */
  variables: ProcessVariables | null;
  onConfirm: (variables: ProcessVariables) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {variables ? (
        <OrderVariableDialogBody
          key={dialogKey}
          label={label}
          variables={variables}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
        />
      ) : null}
    </Dialog>
  );
}

/** Why the pop-up opened on who it did, in the drafter's terms (`AUT-05`, `AUT-06`). */
function reasonText(variables: ProcessVariables): string {
  switch (variables.reason) {
    case "accused-not-joined": {
      const many =
        variables.recipients.filter((entry) => entry.kind === "accused").length > 1;
      return many
        ? "The accused have not joined the case, so every accused is selected."
        : "The accused has not joined the case, so the accused is selected.";
    }
    case "one-witness-unexamined": {
      const witness = selectedRecipients(variables)[0];
      return `The accused has joined the case. ${witness?.role ?? "The witness"}, the one witness not yet examined, is selected.`;
    }
    case "open":
      return "The accused has joined the case. Choose who this goes to.";
  }
}

/** What still stops Confirm, said plainly — every state offers the next action. */
function blockerText(variables: ProcessVariables): string | null {
  if (selectedRecipients(variables).length === 0) return "Select at least one person.";
  if (selectedChannels(variables).length === 0) return "Select at least one delivery channel.";
  const processes = processesFor(variables);
  if (processes.length === 0) {
    return "None of the people selected can be reached on the channels selected. Add a channel or an address.";
  }
  if (processes.some((entry) => entry.policeStation === "")) {
    return "Choose a police station for every address going through the police.";
  }
  return null;
}

function contactLine(recipient: ProcessRecipient): string {
  const parts = [
    recipient.mobile ? `Mobile ${recipient.mobile}` : null,
    recipient.email ? `Email ${recipient.email}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No mobile or email on record";
}

function OrderVariableDialogBody({
  label,
  variables,
  onOpenChange,
  onConfirm,
}: {
  label: string;
  variables: ProcessVariables;
  onOpenChange: (open: boolean) => void;
  onConfirm: (variables: ProcessVariables) => void;
}) {
  const { court } = useCourt();
  const [draft, setDraft] = React.useState(variables);
  const complete = processVariablesComplete(draft);
  const blocker = blockerText(draft);
  const count = processesFor(draft).length;
  const police = needsPoliceStation(draft);
  /* A mobile or email only matters where the type can go by SMS or Email; a warrant
     cannot, so it is not shown there. */
  const contacts = channelsFor(draft.template).some(
    (channel) => channel.destination !== "address",
  );

  function updateRecipient(id: string, change: (entry: ProcessRecipient) => ProcessRecipient) {
    setDraft((current) => ({
      ...current,
      recipients: current.recipients.map((entry) => (entry.id === id ? change(entry) : entry)),
    }));
  }

  function toggleChannel(id: keyof ProcessVariables["channels"], checked: boolean) {
    setDraft((current) => ({
      ...current,
      channels: { ...current.channels, [id]: checked },
    }));
  }

  return (
    <ChromeDialogContent className="flex max-h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
      <DialogHeader className="gap-1 border-b border-hairline px-6 py-4 text-left">
        <DialogTitle className="text-title-s font-semibold">{label}</DialogTitle>
        <p className="text-body-compact text-muted-foreground">
          Confirm who this goes to and how it is delivered. The order is written only
          after you confirm.
        </p>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-6 overflow-y-auto px-6 py-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-caption mb-1 font-semibold text-muted-foreground">
            Send to
          </legend>
          <p className="text-caption text-muted-foreground">{reasonText(variables)}</p>
          <div className="flex flex-col gap-1 rounded-lg bg-surface-sunken p-3">
            {draft.recipients.map((recipient) => {
              const id = `order-variable-recipient-${recipient.id}`;
              const unreachable = recipient.selected
                ? unreachableChannels(draft, recipient)
                : [];
              return (
                <div key={recipient.id} className="flex flex-col gap-1 py-1">
                  <div className="flex min-h-10 items-start gap-2">
                    <Checkbox
                      id={id}
                      checked={recipient.selected}
                      onCheckedChange={(checked) =>
                        updateRecipient(recipient.id, (entry) => ({
                          ...entry,
                          selected: checked === true,
                        }))
                      }
                      className="mt-0.5"
                    />
                    <Label htmlFor={id} className="flex min-w-0 flex-col items-start gap-0.5 text-left font-normal">
                      <span className="text-body-compact font-medium text-foreground">
                        {recipient.name}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {recipient.role}
                        {recipient.kind === "witness"
                          ? recipient.examined
                            ? " · examined"
                            : " · not yet examined"
                          : ""}
                      </span>
                    </Label>
                  </div>

                  {recipient.selected ? (
                    <div className="ml-6 flex flex-col gap-1 border-l border-hairline pl-4">
                      {contacts ? (
                        <p className="text-caption text-muted-foreground">{contactLine(recipient)}</p>
                      ) : null}
                      {recipient.addresses.map((place) => {
                        const addressId = `${id}-${place.id}`;
                        return (
                          <div key={place.id} className="flex flex-col gap-2">
                            <div className="flex min-h-10 items-center gap-2">
                              <Checkbox
                                id={addressId}
                                checked={place.selected}
                                onCheckedChange={(checked) =>
                                  updateRecipient(recipient.id, (entry) => ({
                                    ...entry,
                                    addresses: entry.addresses.map((other) =>
                                      other.id === place.id
                                        ? { ...other, selected: checked === true }
                                        : other,
                                    ),
                                  }))
                                }
                              />
                              <Label
                                htmlFor={addressId}
                                className="text-caption font-normal text-foreground"
                              >
                                {formatStructuredAddress(place.address)}
                              </Label>
                            </div>
                            {police && place.selected ? (
                              <div className="ml-6 flex flex-col gap-1">
                                <Label
                                  htmlFor={`${addressId}-station`}
                                  className="text-caption text-muted-foreground"
                                >
                                  Police station
                                </Label>
                                <NativeSelect
                                  id={`${addressId}-station`}
                                  value={place.policeStation}
                                  aria-invalid={place.policeStation === "" || undefined}
                                  onChange={(event) => {
                                    const station = event.target.value;
                                    updateRecipient(recipient.id, (entry) => ({
                                      ...entry,
                                      addresses: entry.addresses.map((other) =>
                                        other.id === place.id
                                          ? { ...other, policeStation: station }
                                          : other,
                                      ),
                                    }));
                                  }}
                                  className="w-full sm:w-64"
                                >
                                  <NativeSelectOption value="">Choose a station</NativeSelectOption>
                                  {policeStationsFor(court).map((station) => (
                                    <NativeSelectOption key={station} value={station}>
                                      {station}
                                    </NativeSelectOption>
                                  ))}
                                </NativeSelect>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {unreachable.length > 0 ? (
                        <p className="text-caption text-muted-foreground">
                          Not sent by {unreachable.join(" or ")}: nothing on record for it.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-caption mb-1 font-semibold text-muted-foreground">
            Delivery channels
          </legend>
          <div className="flex flex-col gap-1 rounded-lg bg-surface-sunken p-3">
            {channelsFor(draft.template).map((channel) => (
              <div key={channel.id} className="flex min-h-10 items-center gap-2">
                <Checkbox
                  id={`order-variable-channel-${channel.id}`}
                  checked={draft.channels[channel.id]}
                  onCheckedChange={(checked) => toggleChannel(channel.id, checked === true)}
                />
                <Label htmlFor={`order-variable-channel-${channel.id}`}>{channel.label}</Label>
              </div>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-muted-foreground" aria-live="polite">
          {blocker ??
            `Creates ${count} ${count === 1 ? "process" : "processes"} — one per person, channel and address.`}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!complete}
            onClick={() => {
              onConfirm(draft);
              onOpenChange(false);
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    </ChromeDialogContent>
  );
}
