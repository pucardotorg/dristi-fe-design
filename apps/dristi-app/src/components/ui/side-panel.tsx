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
 * - Below `sm` (or wherever `drawerWhen` says) it rises as a bottom drawer instead.
 */

const PHONE_QUERY = "(max-width: 639.98px)"
const EXIT_MS = 300

/** For chrome that steps aside while the panel is open (from `sm` up). */
export const SIDE_PANEL_PUSH =
  "transition-[margin] duration-300 ease-out motion-reduce:transition-none sm:mr-[var(--side-panel-mr,0px)]"

/**
 * The panel's own side padding, for a row in `header` that runs edge to edge (a tab
 * row with its divider) but keeps its content in line with the title.
 */
export const SIDE_PANEL_INSET = "px-(--side-panel-inset)"

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
  /**
   * Whether the page makes room for the panel (from `sm` up). Pass false where the
   * panel is a drawer (`drawerWhen`), so nothing steps aside behind it.
   */
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
     product's list screens) moves the full panel width and keeps its edge gap.
     Measured from the content edge, inside the region's own padding: the padding is
     already a gap, and counting the border edge pushed a padded page 2rem too far. */
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
      const style = getComputedStyle(el)
      const contentRight =
        el.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth)
      const gap = window.innerWidth - contentRight
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
  subtitle,
  header,
  drawerWhen = PHONE_QUERY,
  id,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Required: names the region and sits on the header's first line. */
  title: React.ReactNode
  /** Lines under the title, in the title's column beside the close button. */
  subtitle?: React.ReactNode
  /**
   * Pinned under the title row; only the body below it scrolls. It runs edge to edge:
   * give padded content `SIDE_PANEL_INSET`, and let a tab row draw its own divider.
   */
  header?: React.ReactNode
  /** Where it rises as a bottom drawer instead. Defaults to below `sm`. */
  drawerWhen?: string
  /** For `aria-controls` on the controls that open it. */
  id?: string
  children?: React.ReactNode
  className?: string
}) {
  const drawer = useMediaQuery(drawerWhen)
  const { rendered, closing } = usePresence(open)
  const titleId = React.useId()
  const panelRef = React.useRef<HTMLElement>(null)
  const returnFocus = React.useRef<HTMLElement | null>(null)
  // Read through a ref so a caller's inline handler does not re-run the effect below,
  // which would hand focus back to the opener mid-use.
  const onOpenChangeRef = React.useRef(onOpenChange)
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  })

  /* Docked: focus stays where the person is, so the list stays usable and the next
     row is one keypress away. Escape closes from anywhere. On close, focus goes back
     to the opener only if it was inside the panel (or lost to the page), never
     pulled away from something the person moved to. */
  React.useEffect(() => {
    if (!open || drawer) return
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChangeRef.current(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      const active = document.activeElement
      const inside = active === document.body || (active && panel?.contains(active))
      if (inside && returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
    }
  }, [open, drawer])

  const titleRow = (Title: React.ElementType, closeSize: "icon" | "icon-sm") => (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Title id={titleId} className="text-title-s font-semibold text-balance">
          {title}
        </Title>
        {subtitle}
      </div>
      <Button variant="ghost" size={closeSize} className="-mt-1 -mr-1 shrink-0 text-muted-foreground" onClick={() => onOpenChange(false)} aria-label="Close">
        <XIcon aria-hidden />
      </Button>
    </div>
  )

  if (drawer) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} autoFocus>
        <DrawerContent
          id={id}
          data-slot="side-panel"
          aria-labelledby={titleId}
          aria-describedby={undefined}
          className={cn(
            "h-[80dvh] overflow-hidden [--side-panel-inset:--spacing(4)] data-[vaul-drawer-direction=bottom]:max-h-[80dvh]",
            className
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          onCloseAutoFocus={(event) => {
            // Opened from the page, not a DrawerTrigger: Radix has nothing to return
            // to, so hand focus back to whatever opened it.
            event.preventDefault()
            if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
          }}
        >
          <div data-orientation="horizontal" className="group/tabs shrink-0">
            <header className="p-4">{titleRow(DrawerTitle, "icon")}</header>
            {header}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  if (!rendered || typeof document === "undefined") return null

  return createPortal(
    <aside
      ref={panelRef}
      id={id}
      tabIndex={-1}
      role="region"
      aria-labelledby={titleId}
      data-slot="side-panel"
      data-state={closing ? "closed" : "open"}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden border-l border-hairline bg-popover text-popover-foreground shadow-modal outline-none fill-mode-forwards duration-300 ease-out [--side-panel-inset:--spacing(6)] motion-reduce:animate-none sm:w-[27rem]",
        closing ? "animate-out slide-out-to-right-full" : "animate-in slide-in-from-right-full",
        className
      )}
    >
      {/* The panel portals away from the page, so line tabs in `header` are cut off
          from their Tabs root, whose horizontal `group/tabs` places the active mark.
          This wrapper stands in for it, in both shapes. */}
      <div data-orientation="horizontal" className="group/tabs shrink-0">
        <header className="p-6 pb-4">{titleRow("h2", "icon-sm")}</header>
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
    </aside>,
    document.body
  )
}

export { SidePanel, SidePanelRegion }
