"use client";

/**
 * Alternate addresses for an accused party or a witness — scenarios 11a and
 * 11b of the party-actions spec. A system action, not an application: the
 * complainant's side may always tell the court of another address to try, so
 * adding one needs no approval and takes effect at once. The new address
 * appears in the pane the moment it is added — that is the confirmation, so
 * the dialog closes without a done stage.
 *
 * Addresses live in client state for now; the record seam is the participants
 * service. What the record already holds (the complaint's own addresses) is
 * not repeated here — this section is only what has been added since.
 */

import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { DiscardQuestion, useDiscardGuard } from "@/components/chrome/discard-guard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import {
  emptyStructuredAddress,
  structuredAddressComplete,
  StructuredAddressFields,
  type StructuredAddress,
} from "@/components/cases/structured-address";

export type AlternateAddress = {
  id: string;
  address: StructuredAddress;
  policeStation?: string;
};

export function AlternateAddresses({ subjectName }: { subjectName: string }) {
  const [addresses, setAddresses] = useState<AlternateAddress[]>([]);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {addresses.map((address) => (
        <div
          key={address.id}
          className="flex min-h-12 min-w-0 items-center gap-2 rounded-md bg-surface-sunken py-2 pr-2 pl-3"
        >
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <span className="block truncate text-body-compact font-medium text-foreground">
              {[address.address.door, address.address.building, address.address.locality]
                .map((part) => part.trim())
                .filter(Boolean)
                .join(", ")}
            </span>
            <span className="block truncate text-caption font-medium text-muted-foreground">
              {[
                `${address.address.city}, ${address.address.district}`,
                `${address.address.state} ${address.address.pin}`.trim(),
                address.policeStation,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            aria-label={`Remove the address in ${address.address.locality}`}
            onClick={() =>
              setAddresses((current) =>
                current.filter((item) => item.id !== address.id)
              )
            }
          >
            <Trash2Icon aria-hidden />
          </Button>
        </div>
      ))}

      <p className="text-body-compact text-muted-foreground">
        {addresses.length === 0
          ? "Give the court another address to try, beyond what the complaint holds."
          : "The court tries every address listed here."}
      </p>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-sm:h-10"
          onClick={() => setOpen(true)}
        >
          <PlusIcon data-icon="inline-start" aria-hidden />
          Add address
        </Button>
      </div>

      <AddAddressDialog
        open={open}
        onOpenChange={setOpen}
        subjectName={subjectName}
        onAdd={(address) => setAddresses((current) => [...current, address])}
      />
    </div>
  );
}

function AddAddressDialog({
  open,
  onOpenChange,
  subjectName,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  onAdd: (address: AlternateAddress) => void;
}) {
  const [address, setAddress] = useState<StructuredAddress>(
    emptyStructuredAddress
  );
  const [policeStation, setPoliceStation] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  function reset() {
    setAddress(emptyStructuredAddress());
    setPoliceStation("");
    setError(undefined);
  }

  const guard = useDiscardGuard(
    Object.values(address).some((part) => part.trim() !== "") || policeStation.trim() !== "",
    () => {
      reset();
      onOpenChange(false);
    },
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!structuredAddressComplete(address)) {
      setError("Complete the address. Only the building name is optional.");
      return;
    }
    if (!/^\d{6}$/.test(address.pin.trim())) {
      setError("PIN codes are 6 digits.");
      return;
    }
    onAdd({
      id: `alt-${Date.now()}`,
      address,
      policeStation: policeStation.trim() || undefined,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      {/* xl, not md: the structured grid runs two columns. */}
      <FlowDialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        {...guard.contentProps}
      >
        <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-title-s font-semibold text-balance">
            Add an address for {subjectName}
          </DialogTitle>
          <DialogDescription>
            Another address the court can try. No approval is involved; it
            takes effect at once.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <form
            id="alternate-address-form"
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            {/* The app's one structured address grammar — the same grid the
                profile settings and the edit-litigant dialog use. */}
            <StructuredAddressFields
              idPrefix="alt-address"
              value={address}
              onChange={(next) => {
                setAddress(next);
                setError(undefined);
              }}
            />
            {error ? (
              <p className="text-body-compact text-destructive-ink">{error}</p>
            ) : null}

            <Field>
              <FieldLabel htmlFor="alt-address-station">
                Police station (optional)
              </FieldLabel>
              <Input
                id="alt-address-station"
                placeholder="The station this address falls under"
                value={policeStation}
                onChange={(event) => setPoliceStation(event.target.value)}
              />
            </Field>
          </form>
        </div>

        <footer className="flex shrink-0 justify-end border-t border-hairline px-6 py-4">
          <Button type="submit" form="alternate-address-form">
            Add address
          </Button>
        </footer>
        <DiscardQuestion guard={guard} />
      </FlowDialogContent>
    </Dialog>
  );
}
