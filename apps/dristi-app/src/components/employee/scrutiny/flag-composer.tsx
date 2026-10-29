"use client";

import * as React from "react";
import { CheckIcon, FileUpIcon } from "lucide-react";

import {
  canSaveDraft,
  docName,
  isDraftDirty,
  saysSomething,
} from "@/lib/employee/scrutiny/field";
import { DOC_REASONS } from "@/lib/employee/scrutiny/sections";
import type { FlatField } from "@/lib/employee/scrutiny/types";
import type { ScrutinyController } from "@/lib/employee/scrutiny/use-scrutiny-state";
import { cn } from "@/lib/utils";
import { useScrutinyCase } from "@/components/employee/scrutiny/scrutiny-case-context";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * The composer.
 *
 * The officer says what is wrong — a typed note, plus a reason chip on a document row —
 * and the advocate fixes it. The officer neither proposes a value, records a voice note,
 * nor annotates the document (owner, 2026-10-08), so the note is the whole instruction
 * and it is required.
 *
 * It renders as a third grid item spanning both columns of its description row, so it
 * gets the whole panel width instead of the ~380px the value column can spare.
 *
 * One sunken well, two tiers: the note, then one action row — the whole-document switch
 * on the start side, the commit pair on the end. No rule and no question caption between
 * them; the old middle tier was most of the height (owner, 2026-10-28).
 */
export function FlagComposer({
  field,
  controller,
  onGoToItem,
}: {
  field: FlatField;
  controller: ScrutinyController;
  onGoToItem: (fieldId: string) => void;
}) {
  const { draft, pendingFocus } = controller;
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!pendingFocus) return;
    const el = noteRef.current;
    if (el) {
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
    }
    controller.clearPendingFocus();
  }, [pendingFocus, controller]);

  if (!draft) return null;

  const isDocRow = !!field.docrow;
  const canSave = canSaveDraft(field, draft);

  /*
   * The save gate, said out loud. Evidence alone no longer counts as saying something —
   * a red box with no words is the one-word remark, drawn instead of typed — so the
   * permanent description turns into the reason the button is dead. It has to be text
   * beside the field: a disabled control is not focusable, so a tooltip on it is
   * unreachable for exactly the people who need the reason.
   */
  const speechless = isDraftDirty(field, draft) && !saysSomething(field, draft);

  /** ⌘/Ctrl+Enter saves. */
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "Enter") return;
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      if (canSave) controller.saveFlag();
    }
  }

  return (
    /*
     * The sunken ground says editing is a mode (owner, 2026-10-28: keep the beige). It
     * holds controls, so it takes the hairline the DS asks of an interactive well, and it
     * is the same box as the raised record it replaces on Edit, so nothing jumps. The
     * DS textareas keep their own card fill, so the fields read as paper on the well.
     */
    <div
      className={cn(
        "col-span-full my-1 flex flex-col gap-3 rounded-lg border border-hairline bg-surface-sunken p-3",
        // Unfolds in place when the row opens — the same short expand Register cases uses
        // for a section opening, rather than snapping into the layout.
        "animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none",
      )}
      data-flag-composer=""
      onClick={(event) => event.stopPropagation()}
    >
      <Field data-invalid={speechless}>
        {/*
         * A visible label whenever the box is visible: placeholder-only fields are a
         * listed accessibility defect, and a voice user says the label.
         */}
        <FieldLabel>
          {isDocRow ? "What’s wrong with this document?" : "Note for the advocate"}
        </FieldLabel>

        <Textarea
          ref={noteRef}
          className="max-h-32 min-h-16"
          placeholder={
            isDocRow
              ? "e.g. Only the address side was uploaded — please upload the front."
              : "e.g. The amount does not match the cheque — check it against the instrument."
          }
          value={draft.text}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={onKeyDown}
          onChange={(event) =>
            controller.updateDraft({ text: event.target.value })
          }
        />

        {/* Structured reasons qualify the note; the note comes first. */}
        {isDocRow ? (
          <ReasonChips
            value={draft.reason}
            onChange={(reason) => controller.updateDraft({ reason })}
          />
        ) : null}

        {/*
         * The save gate, said out loud, only when it is actually holding the save:
         * a permanently visible helper was one more line on every open.
         */}
        {speechless ? (
          <FieldError>
            {isDocRow
              ? "Say what’s wrong — pick a reason or write a line."
              : "Say what’s wrong — one line is enough."}
          </FieldError>
        ) : null}
      </Field>

      {/* The second item, once asked for, sits between the note and the Save it joins. */}
      {draft.linked ? <LinkedBlock controller={controller} /> : null}

      {/*
       * One action row. The whole-document switch takes the start side, in view at rest
       * without standing between the note and Save; the commit pair keeps the end. Every
       * control here is default height, so the row reads as one line of acts. On a narrow
       * card the switch wraps above and the pair stays at the end.
       */}
      <div className="flex flex-wrap items-center gap-2">
        <DocSwitch
          field={field}
          controller={controller}
          onGoToItem={onGoToItem}
        />
        <div className="ms-auto flex items-center gap-2">
          <Button variant="ghost" onClick={() => controller.closeComposer()}>
            Cancel
          </Button>
          {/*
           * Primary, like the workbench's other inline Save (the case-title editor): the
           * card is its own region, and an officer mid-note is looking for one commit.
           */}
          <Button
            disabled={!canSave}
            aria-label={
              draft.linked ? "Save the flag and the document issue" : undefined
            }
            onClick={() => controller.saveFlag()}
          >
            {draft.linked ? "Save both" : isDocRow ? "Save issue" : "Save flag"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The three structured reasons a document itself can be wrong.
 *
 * A `ToggleGroup`, not three buttons wearing `aria-pressed`: exactly one reason can be
 * chosen, and the primitive is what makes the set one tab stop with arrow keys inside it
 * rather than three separate stops the officer has to walk past.
 */
function ReasonChips({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (reason: string | null) => void;
}) {
  return (
    /*
     * Selection is a mark, not a fill. The DS on-state for an outline toggle is
     * `accent-strong` — 235 against the card's 255, a 20-unit step on a neutral ramp
     * whose whole light half spans 255→229. Measured on the render it read as "slightly
     * greyer", which is not a selected state. So the chip states differ three ways at
     * once: a check appears, the fill goes to `secondary`, and the label takes 500.
     * Unset chips carry no fill of their own and take whatever surface hosts them, so
     * only the chosen one reads as a filled mark.
     */
    <ToggleGroup
      type="single"
      value={value ?? ""}
      onValueChange={(next) => onChange(next || null)}
      className="flex flex-wrap gap-1.5"
      aria-label="What is wrong with the document"
    >
      {DOC_REASONS.map((reason) => (
        <ToggleGroupItem
          key={reason}
          value={reason}
          variant="outline"
          className="h-10 gap-1.5 bg-transparent data-[state=on]:bg-secondary data-[state=on]:font-medium"
          onClick={(event) => event.stopPropagation()}
        >
          {value === reason ? (
            <CheckIcon className="size-3.5" aria-hidden="true" />
          ) : null}
          {reason}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * The start side of the action row: whether the whole document is the problem.
 *
 * The officer who types "re-upload the front side of the Aadhaar" into a field flag has
 * not asked for a re-upload — the transcripts say that is exactly what they do — so the
 * switch sits here at rest, always, on any field read from an uploaded document. Once
 * used, the linked block above carries it, so the row gives the space back.
 */
function DocSwitch({
  field,
  controller,
  onGoToItem,
}: {
  field: FlatField;
  controller: ScrutinyController;
  onGoToItem: (fieldId: string) => void;
}) {
  const { docById, docRow } = useScrutinyCase();
  const draft = controller.draft;
  if (!draft || draft.linked) return null;

  // The field's own source document, when that document is an upload someone could be
  // asked to send again. Generated pages ARE the fields, so they have no row to flag.
  const sourceDoc = field.doc ?? null;
  const rowId = sourceDoc ? docRow[sourceDoc] : null;
  if (!sourceDoc || !rowId) return null;
  const raised = !!controller.flags[rowId];

  /*
   * The question, as its answer. The button names the act, so a caption asking the
   * question above it was a third tier saying the same thing. Ghost, so it never competes
   * with Save; the re-upload glyph is the one the linked block's header carries, so the
   * click and what it opens read as one thing. The negative start margin lines the glyph
   * up with the label above, and the label may wrap: a long document name or a
   * translated string must never run out of the card.
   */
  const switchClass = "-ms-3 h-auto min-h-10 py-2 text-start whitespace-normal";

  if (raised) {
    return (
      <Button
        variant="ghost"
        className={switchClass}
        onClick={(event) => {
          event.stopPropagation();
          onGoToItem(rowId);
        }}
      >
        <FileUpIcon data-icon="inline-start" aria-hidden="true" />
        {`Open the re-upload flag on ${docName(sourceDoc, docById)}`}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      className={switchClass}
      data-doc-switch=""
      onClick={(event) => {
        event.stopPropagation();
        /*
         * Also the accessibility answer: a rectangle can only be drawn with a pointer
         * drag, so a keyboard-only officer can never reach the question. This reaches the
         * same outcome in one click, always.
         */
        const composer = event.currentTarget.closest("[data-flag-composer]");
        controller.linkDoc(sourceDoc);
        // This button leaves with the click, so focus goes where the work now is — the
        // first reason — rather than falling to the page.
        requestAnimationFrame(() =>
          composer
            ?.querySelector<HTMLElement>(
              "[data-linked-block] [data-slot=toggle-group-item]",
            )
            ?.focus(),
        );
      }}
    >
      <FileUpIcon data-icon="inline-start" aria-hidden="true" />
      Flag the entire document instead
    </Button>
  );
}

/**
 * The second item, written here rather than somewhere else.
 *
 * Nothing exists until Save, and Save writes both. The reason is required — it is what
 * makes the item legible on the advocate's side, and one click satisfies the save gate.
 * It is never pre-selected, not even on a poor scan: pre-filling a defect assertion on
 * the officer's behalf is the machine making the claim.
 */
function LinkedBlock({ controller }: { controller: ScrutinyController }) {
  const { docById } = useScrutinyCase();
  const linked = controller.draft?.linked;
  if (!linked) return null;
  const missing = !linked.reason;

  return (
    /*
     * Not a box in the box, and no rule: the well's edge is the only stroke. A wider step
     * above and the re-upload header row — glyph, item name, Undo — say a second item
     * starts here, so the two textareas never read as one note.
     */
    <div
      className="flex flex-col gap-2 pt-1"
      data-linked-block=""
    >
      <div className="flex flex-wrap items-center gap-2">
        <FileUpIcon
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 text-body-compact font-medium">
          Also raising: {docName(linked.docId, docById)} — re-upload
        </span>
        <Button
          variant="ghost"
          size="xs"
          className="[@media(pointer:coarse)]:h-10"
          onClick={(event) => {
            event.stopPropagation();
            const composer = event.currentTarget.closest("[data-flag-composer]");
            controller.clearLinked();
            // Undo removes this block, so focus returns to the switch that opened it.
            requestAnimationFrame(() =>
              composer?.querySelector<HTMLElement>("[data-doc-switch]")?.focus(),
            );
          }}
        >
          Undo
        </Button>
      </div>

      {/*
       * No `data-invalid` here, deliberately: what is missing is a reason chip, not the
       * note — marking the note `aria-invalid` before the officer has typed in it would
       * be a false statement about the wrong control. The message still carries
       * `role="alert"` and still says why Save is dead.
       */}
      <Field>
        {/*
         * One Field for the chip row and the note: the label is visible and belongs to
         * both, which is what keeps the note out of placeholder-only territory.
         */}
        <FieldLabel>What&rsquo;s wrong with the document?</FieldLabel>
        <ReasonChips
          value={linked.reason}
          onChange={(reason) => controller.updateLinked({ reason })}
        />
        <Textarea
          className="max-h-32 min-h-16"
          placeholder="Note for the advocate (optional)"
          value={linked.note}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) =>
            controller.updateLinked({ note: event.target.value })
          }
        />
        {/*
         * A description, not an error: the officer just chose to open this block and
         * has attempted nothing yet — red on arrival reads as a scolding. The dead
         * Save button plus this quiet line carry the requirement; the screen-reader
         * announcement already happened when the question appeared.
         */}
        {missing ? (
          <FieldDescription>
            Pick what&rsquo;s wrong to enable Save.
          </FieldDescription>
        ) : null}
      </Field>
    </div>
  );
}
