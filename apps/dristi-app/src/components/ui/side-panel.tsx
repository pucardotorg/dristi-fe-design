"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

/**
 * A docked panel beside the page, for looking at one record without leaving the list
 * (the product's case peek). Unlike `Sheet`, it is not modal: there is no scrim, the
 * page stays usable, and on wide screens the page makes room for it instead of sitting
 * under it.
 *
 * - `SidePanelRegion` wraps the page. Its `push` says what makes room: "content" (the
 *   content is pushed), "none" (the panel goes over the content), or "marked" (only
 *   elements given `SIDE_PANEL_PUSH` step aside). Only light chrome should:
 *   a wide table re-measures every cell on every frame of a margin animation, so it
 *   keeps its width and the panel slides over its right edge.
 * - `SidePanel` slides in from the right over 300ms with no fade, and plays the same
 *   motion out before it unmounts, so nothing behind it snaps back in one frame.
 * - Below `sm` it rises as a bottom drawer instead.
 */

const PHONE_QUERY = "(max-width: 639.98px)"
const EXIT_MS = 300

/** For chrome that steps aside while the panel is open (from `sm` up). */
export const SIDE_PANEL_PUSH =
  "transition-[margin] duration-300 ease-out motion-reduce:transition-none sm:mr-[var(--side-panel-mr,0px)]"

function useMediaQuery(query: string) {
  return React.useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

/** Keeps the panel mounted through its exit, then lets it go. */
function usePresence(open: boolean) {
  const [rendered, setRendered] = React.useState(open)
  // Opening mounts at once (a guarded update during render, React's pattern for
  // state derived from a prop); closing is derived, and only the timer unmounts.
  if (open && !rendered) setRendered(true)
  const closing = rendered && !open
  React.useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => setRendered(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [closing])
  return { rendered: rendered || open, closing }
}

function SidePanelRegion({
  open,
  push = "marked",
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  /** Whether the panel is open; the page makes room for it from `sm` up. */
  open: boolean
  /**
   * What makes room for the panel, in the words a designer uses:
   * - `"content"`: the content is pushed. Everything in the region steps aside.
   * - `"none"`: the panel goes over the content. Nothing moves.
   * - `"marked"` (default): only the parts given `SIDE_PANEL_PUSH` step aside; the rest
   *   stays and the panel goes over its right edge (the Cases page: header moves, table
   *   stays).
   */
  push?: "content" | "none" | "marked"
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  /* Push only what the panel covers, plus a 2rem gutter. Content that already ends
     clear of the panel does not move; content that runs to the window's edge (the
     product's list screens) moves the full panel width and keeps its edge gap. */
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      if (!open || push === "none") {
        el.style.setProperty("--side-panel-mr", "0px")
        return
      }
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const panel = 27 * rem
      const gutter = 2 * rem
      const gap = window.innerWidth - el.getBoundingClientRect().right
      el.style.setProperty("--side-panel-mr", `${Math.max(0, panel + gutter - gap)}px`)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [open, push])
  return (
    <div
      ref={ref}
      data-slot="side-panel-region"
      data-panel-open={open || undefined}
      data-push={push}
      className={cn(
        // Each child steps aside, not the region: a full-width region would keep its
        // width and the margin would change nothing.
        push === "content" &&
          "[&>*]:transition-[margin] [&>*]:duration-300 [&>*]:ease-out motion-reduce:[&>*]:transition-none sm:[&>*]:mr-[var(--side-panel-mr,0px)]",
        className
      )}
      style={style}
      {...props}
    />
  )
}

function SidePanel({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Required: names the region and sits on the header's first line. */
  title: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const phone = useMediaQuery(PHONE_QUERY)
  const { rendered, closing } = usePresence(open)
  const titleId = React.useId()
  const panelRef = React.useRef<HTMLElement>(null)
  const returnFocus = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!open || phone) return
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
    }
  }, [open, phone, onOpenChange])

  if (phone) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          data-slot="side-panel"
          aria-describedby={undefined}
          className={cn("h-[80dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[80dvh]", className)}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 p-4">
            <DrawerTitle className="text-title-s font-semibold text-balance">{title}</DrawerTitle>
            <Button variant="ghost" size="icon" className="-mt-1 -mr-1 shrink-0 text-muted-foreground" onClick={() => onOpenChange(false)} aria-label="Close">
              <XIcon aria-hidden />
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  if (!rendered || typeof document === "undefined") return null

  return createPortal(
    <aside
      ref={panelRef}
      tabIndex={-1}
      role="region"
      aria-labelledby={titleId}
      data-slot="side-panel"
      data-state={closing ? "closed" : "open"}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden border-l border-hairline bg-popover text-popover-foreground shadow-modal outline-none fill-mode-forwards duration-300 ease-out motion-reduce:animate-none sm:w-[27rem]",
        closing ? "animate-out slide-out-to-right-full" : "animate-in slide-in-from-right-full",
        className
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 p-6 pb-4">
        <h2 id={titleId} className="text-title-s font-semibold text-balance">
          {title}
        </h2>
        <Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1 shrink-0 text-muted-foreground" onClick={() => onOpenChange(false)} aria-label="Close">
          <XIcon aria-hidden />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
    </aside>,
    document.body
  )
}

export { SidePanel, SidePanelRegion }
