"use client";

import * as React from "react"

import { canSaveDraft } from "@/lib/employee/scrutiny/field"
import type {
  Draft,
  FlagMap,
  LinkedDoc,
  ScrutinyCase,
  ScrutinyLookups,
} from "@/lib/employee/scrutiny/types"

/** Whether the note box takes the caret when the composer opens — resolved once. */
export type PendingFocus = "note" | null

export interface ScrutinyState {
  flags: FlagMap
  selectedId: string | null
  composeField: string | null
  draft: Draft | null
  pendingFocus: PendingFocus
}

const EMPTY: ScrutinyState = {
  flags: {},
  selectedId: null,
  composeField: null,
  draft: null,
  pendingFocus: null,
}

/** What the composer leaves behind when it closes, however it closes. */
const CLOSED = {
  composeField: null,
  draft: null,
} as const

/* ── pure transitions ────────────────────────────────────────────────────── */
/*
 * The state changes live here as plain functions of (state, event) so the flow that
 * writes two items in one act can be read — and tested — without a renderer. The hook
 * below is the React wrapper around them, nothing more.
 */

/**
 * Saving writes the field item and, when one was linked, the document item — in one act,
 * because they were composed as one thought.
 */
export function applySaveFlag(s: ScrutinyState, look: ScrutinyLookups): ScrutinyState {
  const id = s.composeField
  const draft = s.draft
  if (!id || !draft) return s
  const field = look.fieldById[id]
  if (!field || !canSaveDraft(field, draft)) return s

  const flags: FlagMap = { ...s.flags }
  const previous = flags[id]
  const linked = draft.linked

  // "Don't flag the upload" on an item that had one: the partner goes at save time, not
  // at the click — nothing is destroyed until the officer commits.
  const dropped = previous?.linkedTo
  if (dropped && dropped !== linked?.rowId && flags[dropped]?.linkedFrom === id) {
    delete flags[dropped]
  }

  flags[id] = {
    reason: draft.reason,
    comment: draft.text.trim() || null,
    linkedTo: linked ? linked.rowId : null,
    linkedFrom: previous?.linkedFrom ?? null,
  }

  if (linked) {
    flags[linked.rowId] = {
      reason: linked.reason,
      // Never the field note: that one is about the value, this one is about the file.
      // Two items repeating one sentence leave the advocate unable to tell what answers
      // what.
      comment: linked.note.trim() || null,
      linkedTo: null,
      linkedFrom: id,
    }
  }

  return { ...s, flags, ...CLOSED }
}

/**
 * Removing an item never removes its partner. A bad scan is still a bad scan after the
 * field flag goes; the link is what is cut, not the other grant.
 */
export function applyRemoveFlag(s: ScrutinyState, id: string): ScrutinyState {
  const removed = s.flags[id]
  if (!removed) return s

  const flags: FlagMap = { ...s.flags }
  delete flags[id]

  for (const partnerId of [removed.linkedTo, removed.linkedFrom]) {
    const partner = partnerId ? flags[partnerId] : undefined
    if (!partnerId || !partner) continue
    flags[partnerId] = {
      ...partner,
      linkedTo: partner.linkedTo === id ? null : partner.linkedTo,
      linkedFrom: partner.linkedFrom === id ? null : partner.linkedFrom,
    }
  }

  return {
    ...s,
    flags,
    ...(s.composeField === id ? CLOSED : null),
  }
}

/**
 * The document item left standing when this one is removed — what the toast has to be
 * honest about. Removing the document item strands nothing, so it answers null.
 */
export function survivingPartner(flags: FlagMap, id: string): string | null {
  const partnerId = flags[id]?.linkedTo
  return partnerId && flags[partnerId] ? partnerId : null
}

/** Open the linked sub-composer for a document. Nothing is created until Save. */
export function applyLinkDoc(
  s: ScrutinyState,
  docId: string,
  look: ScrutinyLookups,
): ScrutinyState {
  const rowId = look.docRow[docId]
  if (!s.draft || !rowId) return s
  return {
    ...s,
    draft: {
      ...s.draft,
      linked: s.draft.linked?.rowId === rowId
        ? s.draft.linked
        : { rowId, docId, reason: null, note: "" },
    },
  }
}

/* ── the hook ────────────────────────────────────────────────────────────── */

/**
 * Everything the officer does to one case. Kept out of the views so the
 * rendering stays a pure function of this state — the HTML reference tangled
 * the two in a single script and paid for it in re-render bugs.
 */
export function useScrutinyState(caseData: ScrutinyCase) {
  const [state, setState] = React.useState<ScrutinyState>(EMPTY)

  /* The two id→record maps the pure transitions resolve against, from this case. Built
     once per case so the callbacks below keep a stable identity between renders. */
  const { fieldById, docRow } = caseData
  const look = React.useMemo<ScrutinyLookups>(
    () => ({ fieldById, docRow }),
    [fieldById, docRow],
  )

  const patch = React.useCallback(
    (next: Partial<ScrutinyState>) => setState((s) => ({ ...s, ...next })),
    []
  )

  /* ── selection ─────────────────────────────────────────────────────────── */

  const selectField = React.useCallback((id: string) => {
    setState((s) => ({ ...s, selectedId: id }))
  }, [])

  /* ── composer ──────────────────────────────────────────────────────────── */

  const openComposer = React.useCallback(
    (id: string) => {
      setState((s) => {
        const field = fieldById[id]
        if (!field) return s
        const existing = s.flags[id]

        if (existing) {
          // Editing something already raised — start from what is there, never blank.
          // That includes the linked document item, restored to its saved state so
          // "Don't flag the upload" is a decision the officer can still take back.
          const partnerId = existing.linkedTo
          const partner = partnerId ? s.flags[partnerId] : undefined
          const linked: LinkedDoc | null =
            partnerId && partner
              ? {
                  rowId: partnerId,
                  docId: fieldById[partnerId]?.docrow ?? "",
                  reason: partner.reason,
                  note: partner.comment ?? "",
                }
              : null

          return {
            ...s,
            selectedId: id,
            composeField: id,
            pendingFocus: "note",
            draft: {
              text: existing.comment ?? "",
              reason: existing.reason,
              linked,
            },
          }
        }

        // The officer says what is wrong; the advocate enters the right value. There is
        // no proposed-value box to prefill, so the note takes the caret.
        return {
          ...s,
          selectedId: id,
          composeField: id,
          pendingFocus: "note",
          draft: {
            text: "",
            reason: null,
            linked: null,
          },
        }
      })
    },
    [fieldById]
  )

  const closeComposer = React.useCallback(() => {
    patch({ ...CLOSED })
  }, [patch])

  const updateDraft = React.useCallback((next: Partial<Draft>) => {
    setState((s) => (s.draft ? { ...s, draft: { ...s.draft, ...next } } : s))
  }, [])

  const clearPendingFocus = React.useCallback(() => {
    setState((s) => (s.pendingFocus ? { ...s, pendingFocus: null } : s))
  }, [])

  const saveFlag = React.useCallback(() => {
    setState((s) => applySaveFlag(s, look))
  }, [look])

  /**
   * Answers with the document item left standing, so the caller can say so. A removal
   * whose consequence is invisible is the one that needs stating.
   */
  const removeFlag = React.useCallback(
    (id: string): string | null => {
      const partner = survivingPartner(state.flags, id)
      setState((s) => applyRemoveFlag(s, id))
      return partner
    },
    [state.flags]
  )

  /* ── the linked document item ──────────────────────────────────────────── */

  /** Open the linked sub-composer — from the question, or from the standing link. */
  const linkDoc = React.useCallback((docId: string) => {
    setState((s) => applyLinkDoc(s, docId, look))
  }, [look])

  const updateLinked = React.useCallback((next: Partial<LinkedDoc>) => {
    setState((s) =>
      s.draft?.linked
        ? { ...s, draft: { ...s.draft, linked: { ...s.draft.linked, ...next } } }
        : s
    )
  }, [])

  const clearLinked = React.useCallback(() => {
    setState((s) =>
      s.draft ? { ...s, draft: { ...s.draft, linked: null } } : s
    )
  }, [])

  const reset = React.useCallback(() => {
    setState(EMPTY)
  }, [])

  return {
    ...state,
    selectField,
    openComposer,
    closeComposer,
    updateDraft,
    clearPendingFocus,
    saveFlag,
    removeFlag,
    linkDoc,
    updateLinked,
    clearLinked,
    reset,
  }
}

export type ScrutinyController = ReturnType<typeof useScrutinyState>
