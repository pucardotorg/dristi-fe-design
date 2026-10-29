"use client";

import * as React from "react";
import Link from "next/link";
import { CheckIcon, ChevronRightIcon, RotateCcwIcon } from "lucide-react";

import type {
  Filing,
  Flag,
  FlagMap,
  FlatField,
} from "@/lib/employee/scrutiny/types";
import { markArrival } from "@/components/employee/use-arrival";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  StagedOverlay,
  useStagedFlow,
} from "@/components/chrome/staged-overlay";
import { useScrutinyCase } from "@/components/employee/scrutiny/scrutiny-case-context";
import { useCourt } from "@/components/court/court-provider";
import type { RegistrationType } from "@/lib/court/profiles";

/**
 * `forward` hands the case to Registration, for a Case registerer; `register` registers it
 * here and skips Registration. The workbench offers register wherever this court
 * registers at scrutiny, and forward only where someone else registers (`SCR-06`,
 * `SCR-11`).
 */
export type Decision = "send-back" | "forward" | "register";

interface Item {
  field: FlatField;
  flag: Flag;
  where: string;
  /** The partner item this one was raised with, if any. */
  linked: FlatField | null;
}

/* Named for what the advocate has to do with each, since that is what differs between
   them (owner, 2026-10-09: "have proper sections for flagged, then document issue"). */
const GROUP_ORDER = ["Fields to correct", "Documents to re-upload"] as const;

function group(
  flags: FlagMap,
  allFields: FlatField[],
  fieldById: Record<string, FlatField>,
): Record<string, Item[]> {
  const out: Record<string, Item[]> = Object.fromEntries(
    GROUP_ORDER.map((g) => [g, []]),
  );
  for (const field of allFields) {
    const flag = flags[field.id];
    if (!flag) continue;
    const partnerId = flag.linkedTo ?? flag.linkedFrom ?? null;
    const item: Item = {
      field,
      flag,
      where: `${field.group} · ${field.label}`,
      linked: partnerId ? (fieldById[partnerId] ?? null) : null,
    };
    if (field.docrow) out[GROUP_ORDER[1]].push(item);
    else out[GROUP_ORDER[0]].push(item);
  }
  return out;
}

/**
 * The act's two stages, in the order it moves through them: everything the officer
 * raised, and what happened when they decided on it.
 */
const STAGES = ["review", "done"] as const;

type Stage = (typeof STAGES)[number];

/**
 * **A scene each, so the act travels.**
 *
 * The owner asked for exactly this (2026-09-17): *"when you send back to the advocate, I
 * want that information to have a slight motion animation and go to the confirmation
 * stage of either registered or sent back."* A different scene is what makes the frame
 * remount and play its entrance, so the list leaves and the confirmation arrives — one
 * move, in the direction the act is going. A band stamped on the list where it stood was
 * the alternative, and it read as an annotation rather than as a decision taken.
 */
const SCENE: Record<Stage, string> = { review: "review", done: "done" };

/**
 * Review &amp; decide. Everything the officer did, before it leaves their hands.
 *
 * Registering with open items is allowed — never block — but it takes an explicit
 * acknowledgement, which is what gates the primary button.
 *
 * **Both stages are one window** (`StagedOverlay`), the frame every other court-side act
 * moves inside. The decision and its outcome used to be two wholesale swaps inside one
 * `Dialog`, and the confirmation dropped the header entirely to draw its own heading —
 * which is precisely the moment an overlay stops looking like the overlay. Now the chrome
 * holds still and only the stage between header and footer travels, from the list to the
 * confirmation.
 */
export function ReviewDialog({
  decision,
  flags,
  onOpenChange,
  nextFiling,
  onGoToItem,
}: {
  decision: Decision | null;
  flags: FlagMap;
  onOpenChange: (open: boolean) => void;
  /**
   * The next file to scrutinise, or `null` at the end of the list — what the settled
   * stage offers instead of the queue. See `nextFilingAfter`.
   */
  nextFiling: Filing | null;
  /** A record you can act on: closes the dialog and lands on the item. */
  onGoToItem: (fieldId: string) => void;
}) {
  const { party, allFields, fieldById } = useScrutinyCase();
  const [ack, setAck] = React.useState(false);
  /* The registration type (`SCR-13`), by its index in the state's list. Nothing is
     pre-selected: a wrong default would classify the case without anyone deciding it. */
  const [typeIndex, setTypeIndex] = React.useState<string>("");
  const { profile } = useCourt();

  /* Opening the dialog for a new decision starts from a clean slate — back to the list,
     and the acknowledgement is not inherited from the decision before it. The flow makes
     that adjustment during render, against the decision it last showed. */
  const flow = useStagedFlow({
    order: STAGES,
    scene: SCENE,
    record: decision ?? "closed",
    /* The "record" changing here *is* the overlay opening, not a second decision arriving
       in a window that stayed up — so the stage takes the frame's ordinary entrance and
       lets the panel's own rise be the gesture. On the default it would rise inside a
       rise. */
    arrival: "forward",
    onRecordChange: () => {
      setAck(false);
      setTypeIndex("");
    },
  });

  const groups = React.useMemo(
    () => group(flags, allFields, fieldById),
    [flags, allFields, fieldById],
  );
  const total = Object.values(groups).reduce((n, v) => n + v.length, 0);

  if (!decision) return null;

  /* Where the state has more than one type, Forward and Register both ask for it; with one,
     the case is registered as that type and nothing is asked (`SCR-13`). */
  const types = profile.registrationTypes;
  const choosing = decision !== "send-back" && types.length > 1;
  const chosen: RegistrationType | null =
    choosing && typeIndex !== "" ? (types[Number(typeIndex)] ?? null) : null;
  const chosenLine = chosen ? ` as ${typeLabel(chosen)}` : "";

  const head =
    decision === "send-back"
      ? {
          title: "Send back to advocate",
          body: `Goes to ${party.advocate}.`,
        }
      : decision === "forward"
      ? {
          title: "Forward for registration",
          body: total
            ? `The case moves to Register cases. ${total} open item${
                total > 1 ? "s travel" : " travels"
              } with it — forwarding does not clear ${total > 1 ? "them" : "it"}.`
            : "Every field was checked against the bundle. The case moves to Register cases.",
        }
      : {
          title: "Register case",
          body: total
            ? `The case moves to the Magistrate's list for cognizance. ${total} open item${
                total > 1 ? "s travel" : " travels"
              } with it — registering does not clear ${total > 1 ? "them" : "it"}.`
            : "Every field was checked against the bundle. The case moves to the Magistrate's list for cognizance.",
        };

  /*
   * **The confirmation's own words.**
   *
   * The title stays in the header, because it is the line the frame rewrites and the line
   * focus lands on. Everything else about the outcome lives on the stage, with the mark:
   * a state, and a sentence putting it in context. A glyph and one word was not a
   * confirmation — *"it shouldn't just say send back with an icon, it should have some
   * copy associated with it"* (owner, 2026-09-17) — and splitting the sentence between
   * the header and the stage would have said the same thing twice at two sizes.
   *
   * The register wording changes with the count because a case that travels with open
   * items is a materially different thing from a clean one, and the Magistrate is the
   * reason either way.
   */
  const settled =
    decision === "send-back"
      ? {
          title: `Sent back to ${party.advocate}`,
          state: "Sent back",
          /* One short line. The long version explained that the file comes back and
             that nothing more is needed — reassurance for a first-timer, and this is a
             desk somebody works all day (owner, 2026-09-17: *"that is enough. They'll do
             this on a daily basis. They don't need more reassurance from the system"*).
             "Act on" rather than "correct", because a third of these are re-uploads and a
             third are confirmations. */
          body: `${total} item${total > 1 ? "s" : ""} sent for the advocate to act on.`,
          /* **A return is not a completion.** Green with a tick said the act succeeded
             where it had handed the file on, and this is the ordinary route — most files
             take it at least once — not a failure and not a win. So the mark wears the
             product's neutral state fill (`secondary`, what every pending pill on these
             screens wears; the case history gives a return no colour at all). Colour
             keeps carrying one meaning.

             The glyph is the loop, not a corner arrow: the owner read that one as dated
             (2026-09-18), and it was the weaker reading anyway — an elbow pointing left
             is "back" in the browser sense, while this file has gone round for another
             round, which is the word the case history already uses. */
          tone: "bg-secondary text-secondary-foreground",
          Icon: RotateCcwIcon,
        }
      : decision === "forward"
      ? {
          title: "Forwarded for registration",
          state: "Forwarded",
          body: total
            ? `On Register cases${chosenLine}, with ${total} open item${
                total > 1 ? "s" : ""
              } attached.`
            : `On Register cases${chosenLine}.`,
          /* Scrutiny is done with the file, which is this desk's good outcome, so it
             wears the same mark as registering. */
          tone: "bg-success-muted text-success-muted-foreground",
          Icon: CheckIcon,
        }
      : {
          title: "Case registered",
          state: chosen ? `Registered${chosenLine}` : "Registered",
          body: total
            ? `On the Magistrate's list, with ${total} open item${
                total > 1 ? "s" : ""
              } attached.`
            : "On the Magistrate's list for cognizance.",
          /* Registering *is* a terminal good outcome, so this one keeps the success
             muted and the tick. */
          tone: "bg-success-muted text-success-muted-foreground",
          Icon: CheckIcon,
        };

  const needsAck = decision !== "send-back" && total > 0;
  const done = flow.stage === "done";

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <StagedOverlay
        /* The measure of a long list, and a **definite height** rather than a floor.
           Two things change between the stages now — the list becomes a confirmation, and
           the header's line becomes a shorter one — and a floor only holds the first of
           them: a header dropping a row moves the whole centred panel (measured at 48px,
           and 20px on the empty path). A definite height decouples both, and the stage
           absorbs the difference instead. It is what the registrations overlay and the
           order composer do, and for the same reason: this is a reading surface whose
           content is routinely taller than the window.

           Unconditional, not `md:` — where those two overlays hold long content on every
           stage and so barely move on a phone, this one goes from a list to a short
           confirmation, and at 390px that measured as a collapse from 680 to 422 with the
           panel re-centring 129px down the screen. A phone modal held at 85% height is an
           ordinary sheet; a sheet that shrinks by a third under the reader's thumb is not. */
        className="h-[85dvh] sm:max-w-2xl"
        /* One long list, not objects on a canvas: a panel the same shape as the surface
           under it is a card inside a card inside a modal (owner, 2026-09-17, and
           restated). The stage is the overlay's own white, framed by the header and
           footer hairlines, and the insets belong to this file because the confirmation
           centres itself while the list does not. */
        surface={done || (!total && !choosing) ? "card" : "canvas"}
        padded={false}
        title={done ? settled.title : head.title}
        titleRef={flow.titleRef}
        /* No line under the settled title: the sentence is on the stage with the mark it
           belongs to, and printing it here as well said the same thing twice at two
           sizes. The definite height is what makes that affordable — the header loses two
           rows and the stage absorbs them, so the panel does not move. */
        description={done ? undefined : head.body}
        sceneKey={flow.sceneKey}
        motion={flow.motion}
        footer={
          done ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Stay here
              </Button>
              {/*
               * **Next file opens the next file, not the list.** It used to push back to
               * the queue, which made the officer re-find their place in it for every one
               * of thirty decisions (owner, 2026-09-17: *"can you… bring up the next file
               * instead of taking me back to the list"*).
               *
               * A real `Link` rather than a router push, the way Take cognizance and
               * Register cases already walk their queues: it prefetches, it middle-clicks,
               * and `markArrival("next")` hands the workbench that mounts the entrance to
               * play — the file rising onto the desk, which is the same motion opening one
               * from the queue makes. At the end of the list there is nothing to rise, so
               * the button becomes the way back and says so.
               */}
              <Button asChild>
                {nextFiling ? (
                  <Link
                    href={`/employee/scrutiny/${encodeURIComponent(nextFiling.no)}`}
                    onClick={() => markArrival("next")}
                  >
                    Next file
                  </Link>
                ) : (
                  <Link
                    href="/employee/scrutiny"
                    onClick={() => markArrival("back")}
                  >
                    Back to scrutiny
                  </Link>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Keep reviewing
              </Button>
              <Button
                disabled={(needsAck && !ack) || (choosing && !chosen)}
                onClick={() => flow.go("done")}
              >
                {decision === "send-back"
                  ? "Send back"
                  : decision === "forward"
                    ? "Forward for registration"
                    : "Register case"}
              </Button>
              {/* The gate on the primary, beside the button it gates. It had its own
                  region above the footer before the frame, which has two regions and not
                  three — and it is chrome on either side of that seam, so what it loses
                  is a hairline, not its place in view.

                  **Last in the markup, first on screen.** The footer is
                  `flex-col-reverse` on a phone, so a gate written before the buttons
                  renders *under* the disabled primary it explains (measured at 390px).
                  Written after them it reads first on the phone, and `sm:order-first`
                  puts it back on the left of the row once the footer is a row. */}
              {needsAck ? (
                <Field
                  orientation="horizontal"
                  className="sm:order-first sm:mr-auto sm:w-auto sm:self-center"
                >
                  <Checkbox
                    id="ack"
                    checked={ack}
                    onCheckedChange={(value) => setAck(value === true)}
                  />
                  <FieldLabel htmlFor="ack" className="font-normal">
                    I have seen the open flags and choose to{" "}
                    {decision === "forward" ? "forward" : "register"}.
                  </FieldLabel>
                </Field>
              ) : null}
            </>
          )
        }
      >
        {done ? (
          /* **The confirmation, arriving.** A different scene, so the frame remounts this
             and it enters in the direction the act is going while the chrome holds still
             — the motion the owner asked for, one move rather than a mark appearing over
             a list that stayed. Centred by `my-auto` rather than `justify-center`, so it
             gives way to the scroll if a long advocate name ever grows it past the
             canvas. */
          <div className="my-auto flex flex-col items-center gap-4 p-6 text-center">
            <div
              className={cn(
                "flex size-14 items-center justify-center rounded-full",
                settled.tone,
              )}
            >
              <settled.Icon
                aria-hidden="true"
                className="size-7"
                strokeWidth={2.2}
              />
            </div>
            {/* The state, then what it means. `role="status"` is what gets the outcome
                spoken: focus lands on the header title, which announces itself and
                nothing under it. The measure is held to a readable line length — a
                sentence running the full width of a 2xl dialog under a centred mark
                reads as a paragraph that lost its column. */}
            <div role="status" className="flex max-w-sm flex-col gap-1">
              <p className="text-body font-semibold">{settled.state}</p>
              <p className="text-body-compact text-muted-foreground">
                {settled.body}
              </p>
            </div>
          </div>
        ) : total || choosing ? (
          /* The list, and **only the list scrolls** — the frame around it does not move,
             so a send-back with twenty items scrolls inside the stage. The insets are
             here rather than on the frame because the confirmation above centres itself
             and this does not. */
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {choosing ? (
              <TypeChoice
                types={types}
                value={typeIndex}
                onChange={setTypeIndex}
                final={decision === "register"}
              />
            ) : null}
            {GROUP_ORDER.filter((g) => groups[g].length).map((g) => (
              /*
               * A section per kind of work, on the overlay's tinted stage, its items in
               * lifted white cards — the registrations overlay's layering (owner,
               * 2026-10-09: "it reads too flat"). Fields are carded by party, so the
               * party is said once over its rows rather than under every field.
               */
              <section
                key={g}
                aria-labelledby={`rv-${g}`}
                className="flex flex-col gap-2 not-first:mt-6"
              >
                <h3
                  id={`rv-${g}`}
                  className="flex items-baseline gap-1.5 text-caption font-semibold text-muted-foreground"
                >
                  {g}
                  <span className="font-normal tabular-nums">
                    {groups[g].length}
                  </span>
                </h3>
                {byOwner(groups[g]).map(([owner, list]) => (
                  <Card
                    key={owner || g}
                    size="sm"
                    className="gap-0 border-hairline py-0 shadow-raised"
                  >
                    {owner ? (
                      <p className="border-b border-hairline px-4 py-3 text-body-compact font-semibold text-muted-foreground">
                        {owner}
                      </p>
                    ) : null}
                    <ul className="flex flex-col divide-y divide-hairline">
                      {list.map((item) => (
                        <SummaryItem
                          key={item.field.id}
                          item={item}
                          onGoToItem={(fieldId) => {
                            onOpenChange(false);
                            onGoToItem(fieldId);
                          }}
                        />
                      ))}
                    </ul>
                  </Card>
                ))}
              </section>
            ))}
          </div>
        ) : (
          /* Nothing raised, which is a state and not an absence: said in the middle of
             the stage, where the confirmation will arrive. */
          <Empty className="my-auto border-0 p-6">
            <EmptyHeader>
              <EmptyTitle className="text-title-s font-semibold">
                Nothing raised
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </StagedOverlay>
    </Dialog>
  );
}

/**
 * One correction as a row: the item and whose it is, what the officer said (nothing when
 * they left no note), what a document was raised with, and a way to it.
 */
/** Items under the party they belong to, in file order. Document rows share one card. */
function byOwner(items: Item[]): [string, Item[]][] {
  const out = new Map<string, Item[]>();
  for (const item of items) {
    const owner = item.field.docrow
      ? ""
      : item.field.group.replace(/ Details$/, "");
    out.set(owner, [...(out.get(owner) ?? []), item]);
  }
  return [...out];
}

/**
 * One correction: the row is the way to it (the chevron says so, quietly), the field's
 * name leads, and what the officer said follows it.
 */
function SummaryItem({
  item,
  onGoToItem,
}: {
  item: Item;
  onGoToItem: (fieldId: string) => void;
}) {
  const { field, flag } = item;
  /* Labelled, so the officer's words read as theirs (owner, 2026-10-09). */
  const said = [
    field.docrow && flag.reason ? ["Issue", flag.reason] : null,
    flag.comment ? ["Comment", flag.comment] : null,
  ].filter((line): line is [string, string] => line !== null);
  const also =
    field.docrow && item.linked
      ? `Raised with ${item.linked.group.replace(/ Details$/, "").toLowerCase()} ${item.linked.label.toLowerCase()}`
      : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => onGoToItem(field.id)}
        className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:gap-6">
          <span className="text-body-compact font-medium break-words sm:w-48 sm:shrink-0">
            {field.label}
          </span>
          {said.length || also ? (
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              {said.map(([label, text]) => (
                <span key={label} className="text-body-compact break-words">
                  <span className="text-muted-foreground">{label}: </span>
                  {text}
                </span>
              ))}
              {also ? (
                <span className="text-body-compact text-muted-foreground">
                  {also}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
        <ChevronRightIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
        <span className="sr-only">
          {field.docrow ? "Go to the document" : "Go to the field"}
        </span>
      </button>
    </li>
  );
}

/** A type as the number shows it, then its name: "eCC — Criminal Case". */
function typeLabel(type: RegistrationType): string {
  return type.code && type.code !== type.name ? `${type.code} — ${type.name}` : type.name;
}

/**
 * The registration type, first on the stage because it is the one thing still to decide
 * (`SCR-13`). Carded like the items below it, so the stage reads as one list. At Forward
 * the Case registerer may still change it; at Register it is final, and the line says so.
 */
function TypeChoice({
  types,
  value,
  onChange,
  final,
}: {
  types: RegistrationType[];
  value: string;
  onChange: (value: string) => void;
  final: boolean;
}) {
  return (
    <section aria-labelledby="rv-type" className="flex flex-col gap-2">
      <h3 id="rv-type" className="text-caption font-semibold text-muted-foreground">
        Register as
      </h3>
      <Card size="sm" className="gap-0 border-hairline py-0 shadow-raised">
        <RadioGroup
          value={value}
          onValueChange={onChange}
          aria-labelledby="rv-type"
          aria-describedby="rv-type-hint"
          className="gap-0 divide-y divide-hairline"
        >
          {types.map((type, index) => (
            <Field key={type.name} orientation="horizontal" className="px-4 py-3">
              <RadioGroupItem id={`rv-type-${index}`} value={String(index)} />
              <FieldLabel htmlFor={`rv-type-${index}`} className="font-normal">
                {type.code && type.code !== type.name ? (
                  <span className="w-16 shrink-0 font-medium">{type.code}</span>
                ) : null}
                {type.name}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      </Card>
      <p id="rv-type-hint" className="text-body-compact text-muted-foreground">
        {final
          ? "Final once registered. Each type has its own number series."
          : "The Case registerer can change it before registering."}
      </p>
    </section>
  );
}
