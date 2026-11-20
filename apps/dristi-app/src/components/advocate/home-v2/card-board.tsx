"use client";

import "./board.css";

import * as React from "react";
import {
  AutoScrollActivator,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type DropAnimation,
  type PointerSensorOptions,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDownIcon, ArrowUpIcon, GripHorizontalIcon } from "lucide-react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * Home's cards in an order the advocate sets (lead designer, 2026-11-20): pick a card up by its
 * handle and put it somewhere else. The order is kept on this device across visits (owner,
 * 2026-11-20: resetting it on refresh would annoy people); see `dashboard-home-v2`.
 *
 * - Handle: a grip centred in the card's top padding, where no card keeps anything. With a mouse
 *   it shows on hover; on touch it is always there (there is no hover).
 * - Mouse: press the handle and move 4px. Touch: hold the handle (260ms; the card sinks a little
 *   while you hold so you know it is working), then drag. Android buzzes on pick-up, at each new
 *   place and on drop; iPhones and iPads do not let web pages vibrate, so the lift does that job.
 * - While dragging, the whole card rides under your finger, lifted a little, its handle staying
 *   where you hold it (owner, 2026-11-20: a title strip read as something else). A card taller
 *   than 60% of the screen is carried clipped with a fade. Its place turns into a dashed slot, which moves through the list to where it will land. Near the
 *   top or bottom of the screen the page scrolls. Escape puts everything back.
 * - Without dragging (WCAG 2.5.7, voice control, keyboards): click or tap the handle for Move up /
 *   Move down (a menu with a mouse, a bottom drawer on touch). Keyboard: Space picks the card up,
 *   arrows move it, Space drops it, Escape cancels.
 *
 * Cards slide to their new places (a FLIP: measure, move, animate the difference), so nothing
 * jumps; reduced motion moves them instantly.
 */

export type SlotId = "hearings" | "todos" | "updates" | "week" | "recent";

export const SLOT_NAMES: Record<SlotId, string> = {
  hearings: "Your hearings today",
  todos: "Your to-dos",
  updates: "Updates on your cases",
  week: "Your week ahead",
  recent: "Recent cases",
};

/** Cards that sit two across on an iPad (1024 to 1279px) when they are next to each other. */
const HALF: ReadonlySet<SlotId> = new Set(["updates", "week"]);

/** A card taller than this share of the screen is carried clipped, fading out at the bottom, so
    the place it will land stays in view (a phone's to-dos list is longer than the screen). */
const LIFT_CAP = 0.6;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const HOLD_MS = 260;

/** Mouse and pen only: touch goes through the hold-to-lift sensor. */
class MouseSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: React.PointerEvent, { onActivation }: PointerSensorOptions) => {
        if (!event.isPrimary || event.button !== 0 || event.pointerType === "touch") return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not allowed here: the lift is the feedback */
  }
}

/** Layout spans in the iPad grid: two half cards side by side when adjacent, else full width. */
function fullWidth(ids: SlotId[]): Set<SlotId> {
  const full = new Set<SlotId>();
  for (let i = 0; i < ids.length; i++) {
    if (HALF.has(ids[i]) && HALF.has(ids[i + 1])) i++;
    else full.add(ids[i]);
  }
  return full;
}

function moveTo(ids: SlotId[], from: number, to: number): SlotId[] {
  const next = ids.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Where the dragged card should go, from the carried card's middle. A card swaps with the one under
 * the point only once the point is past that card's middle in the direction of travel; after the
 * swap the point sits before the other card's middle, so it never flips back and forth.
 */
function targetIndex(ids: SlotId[], active: SlotId, x: number, y: number, rects: Map<SlotId, DOMRect>): number | null {
  const from = ids.indexOf(active);
  const self = rects.get(active);
  if (!self) return null;
  /* Past the last card or above the first: the end or the start. */
  const all = [...rects.values()];
  if (y > Math.max(...all.map((r) => r.bottom))) return from === ids.length - 1 ? null : ids.length - 1;
  if (y < Math.min(...all.map((r) => r.top))) return from === 0 ? null : 0;
  for (let i = 0; i < ids.length; i++) {
    if (i === from) continue;
    const r = rects.get(ids[i]);
    if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const sameRow = Math.abs(r.top - self.top) < 4;
    const later = i > from;
    const past = sameRow
      ? later ? x > r.left + r.width / 2 : x < r.left + r.width / 2
      : later ? y > r.top + r.height / 2 : y < r.top + r.height / 2;
    return past ? i : null;
  }
  return null;
}

export function CardBoard({
  ids,
  onReorder,
  render,
  layout,
  label,
  className,
}: {
  ids: SlotId[];
  onReorder: (ids: SlotId[]) => void;
  render: (id: SlotId) => React.ReactNode;
  /** "column": one card under another. "pairs": the iPad grid, two half cards across. */
  layout: "column" | "pairs";
  label: string;
  className?: string;
}) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [active, setActive] = React.useState<SlotId | null>(null);
  /* A picture of the card being carried: a copy of its drawn DOM, so the card itself never
     remounts (its carousel slide, its played animations stay as they are). */
  const [lift, setLift] = React.useState<{ node: HTMLElement; height: number; capped: boolean } | null>(null);
  const [grabbed, setGrabbed] = React.useState<SlotId | null>(null);
  const [message, setMessage] = React.useState("");
  const nodes = React.useRef(new Map<SlotId, HTMLElement>());
  const handles = React.useRef(new Map<SlotId, HTMLButtonElement>());
  const carried = React.useRef<HTMLDivElement>(null);
  const idsRef = React.useRef(ids);
  React.useLayoutEffect(() => {
    idsRef.current = ids;
  }, [ids]);
  const start = React.useRef<SlotId[]>(ids);
  const touchDrag = React.useRef(false);
  /* Where each card was drawn just before a move, for the slide (FLIP). */
  const before = React.useRef<Map<SlotId, { left: number; top: number }> | null>(null);
  const refocus = React.useRef<SlotId | null>(null);
  /* The carried card's drawn height; its middle decides where it goes, so two cards trade places
     once they overlap by half. */
  const liftH = React.useRef(Infinity);
  const checkRef = React.useRef<((at?: { left: number; top: number; width: number; height: number } | null) => void) | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: HOLD_MS, tolerance: 8 } }),
  );

  const announce = (text: string) => setMessage((m) => (m === text ? `${text} ` : text));
  const place = (list: SlotId[], id: SlotId) => `${list.indexOf(id) + 1} of ${list.length}`;

  const commit = React.useCallback(
    (next: SlotId[]) => {
      const snap = new Map<SlotId, { left: number; top: number }>();
      nodes.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        snap.set(id, { left: r.left + window.scrollX, top: r.top + window.scrollY });
      });
      before.current = snap;
      idsRef.current = next;
      onReorder(next);
    },
    [onReorder],
  );

  /* The slide: each card starts where it was drawn and eases to its new place. Measured in page
     coordinates, so the page may scroll to follow a moved card at the same time. */
  React.useLayoutEffect(() => {
    const snap = before.current;
    before.current = null;
    if (!snap) return;
    nodes.current.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    const id = refocus.current;
    refocus.current = null;
    if (id) {
      /* Menu and keyboard moves: focus stays on the moved card's handle, and the page follows it
         (scroll-margin keeps it clear of the top bar). */
      const h = handles.current.get(id);
      if (h && document.activeElement !== h) h.focus({ preventScroll: true });
      h?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    }
    nodes.current.forEach((el, key) => {
      const was = snap.get(key);
      if (!was) return;
      const now = el.getBoundingClientRect();
      const dx = was.left - (now.left + window.scrollX);
      const dy = was.top - (now.top + window.scrollY);
      if (reduced || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: 320,
        easing: EASE,
      });
    });
  }, [ids, reduced]);

  /* While a card is up: each frame, and on every scroll, find where the carried card's middle
     says it goes. Not only on pointer moves, so the slot keeps up while the page auto-scrolls under a
     still finger. */
  React.useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      check();
    };
    const check = (at?: { left: number; top: number; width: number; height: number } | null) => {
      /* A move not yet drawn: the boxes on screen are the old order's. */
      if (before.current) return;
      const t = at ?? carried.current?.getBoundingClientRect();
      if (!t) return;
      const rects = new Map<SlotId, DOMRect>();
      /* Layout boxes, ignoring the slide's transforms, so a card mid-slide is judged where it
         will be. */
      nodes.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform);
        rects.set(id, new DOMRect(r.left - m.m41, r.top - m.m42, r.width, r.height));
      });
      const list = idsRef.current;
      const to = targetIndex(list, active, t.left + t.width / 2, t.top + Math.min(t.height, liftH.current) / 2, rects);
      if (to === null) return;
      const next = moveTo(list, list.indexOf(active), to);
      commit(next);
      if (touchDrag.current) buzz(6);
    };
    raf = requestAnimationFrame(loop);
    checkRef.current = check;
    const onScroll = () => check();
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.body.dataset.boardDragging = "";
    return () => {
      cancelAnimationFrame(raf);
      checkRef.current = null;
      window.removeEventListener("scroll", onScroll, { capture: true });
      delete document.body.dataset.boardDragging;
    };
  }, [active, commit]);

  const onDragStart = (e: DragStartEvent) => {
    const id = e.active.id as SlotId;
    const card = nodes.current.get(id)?.querySelector<HTMLElement>(".board-card");
    if (card) {
      const node = card.cloneNode(true) as HTMLElement;
      node.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      node.querySelectorAll("a, button, input, [tabindex]").forEach((el) => el.setAttribute("tabindex", "-1"));
      const full = card.getBoundingClientRect().height;
      const cap = Math.round(window.innerHeight * LIFT_CAP);
      liftH.current = Math.min(full, cap);
      setLift({ node, height: liftH.current, capped: full > cap });
    }
    start.current = idsRef.current;
    touchDrag.current = typeof TouchEvent !== "undefined" && e.activatorEvent instanceof TouchEvent;
    if (touchDrag.current) buzz(12);
    setGrabbed(null);
    setActive(id);
  };
  /* Pointer moves, and the drop itself, judge from the card's newest position, which the
     copy on screen may not have been drawn at yet. */
  const onDragMove = (e: DragMoveEvent) => checkRef.current?.(e.active.rect.current.translated);
  const onDragEnd = (e: DragEndEvent) => {
    checkRef.current?.(e.active.rect.current.translated);
    const id = active;
    setActive(null);
    if (!id) return;
    const list = idsRef.current;
    const moved = start.current.indexOf(id) !== list.indexOf(id);
    if (moved) {
      if (touchDrag.current) buzz(10);
      announce(`${SLOT_NAMES[id]} moved to ${place(list, id)}.`);
    }
  };
  const onDragCancel = () => {
    setActive(null);
    if (start.current.join() !== idsRef.current.join()) commit(start.current);
  };

  /* Move up / Move down, from the menu or the arrow keys. */
  const step = (id: SlotId, by: -1 | 1, focus = true) => {
    const list = idsRef.current;
    const from = list.indexOf(id);
    const to = from + by;
    if (to < 0 || to >= list.length) return;
    const next = moveTo(list, from, to);
    if (focus) refocus.current = id;
    commit(next);
    announce(`${SLOT_NAMES[id]} moved to ${place(next, id)}.`);
  };

  /* Keyboard pick-up: Space lifts, arrows move, Space or Enter drops, Escape restores. */
  const onHandleKey = (id: SlotId, e: React.KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      if (grabbed === id) {
        setGrabbed(null);
        announce(`${SLOT_NAMES[id]} dropped at ${place(idsRef.current, id)}.`);
      } else {
        start.current = idsRef.current;
        setGrabbed(id);
        announce(
          `${SLOT_NAMES[id]} picked up, ${place(idsRef.current, id)}. Up and down arrows move it, Space drops it, Escape cancels.`,
        );
      }
      return;
    }
    if (grabbed !== id) return;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      step(id, e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      setGrabbed(null);
      announce(`${SLOT_NAMES[id]} dropped at ${place(idsRef.current, id)}.`);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setGrabbed(null);
      refocus.current = id;
      commit(start.current);
      announce(`Move cancelled. ${SLOT_NAMES[id]} is back at ${place(start.current, id)}.`);
    }
  };

  const dropAnimation: DropAnimation | null = reduced
    ? null
    : {
        duration: 240,
        easing: EASE,
        /* The card settles back to its own size and shadow as it lands. */
        sideEffects: ({ dragOverlay }) => {
          dragOverlay.node.querySelector(".board-lift")?.setAttribute("data-dropping", "");
        },
        keyframes: ({ transform }) => [
          { transform: CSS.Transform.toString({ ...transform.initial, scaleX: 1, scaleY: 1 }) },
          { transform: CSS.Transform.toString({ ...transform.final, scaleX: 1, scaleY: 1 }) },
        ],
      };

  const full = layout === "pairs" ? fullWidth(ids) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={() => []}
      /* Scroll by where the finger is, not the carried card's edges: a tall card would touch the
         screen's edge long before the finger does. */
      autoScroll={{ activator: AutoScrollActivator.Pointer, threshold: { x: 0, y: 0.15 }, acceleration: 12 }}
      accessibility={{ announcements: NO_ANNOUNCEMENTS, screenReaderInstructions: { draggable: "" } }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <ul
        aria-label={label}
        className={cn("relative grid min-w-0 gap-6", layout === "pairs" && "lg:grid-cols-2", className)}
      >
        {ids.map((id, i) => (
          <BoardItem
            key={id}
            id={id}
            first={i === 0}
            last={i === ids.length - 1}
            full={full?.has(id) ?? true}
            lifted={active === id}
            grabbed={grabbed === id}
            dragging={active !== null}
            nodeRef={(el) => (el ? nodes.current.set(id, el) : nodes.current.delete(id))}
            handleRef={(el) => (el ? handles.current.set(id, el) : handles.current.delete(id))}
            onStep={(by) => step(id, by)}
            onHandleKey={(e) => onHandleKey(id, e)}
            onHandleBlur={() => {
              if (grabbed === id && refocus.current !== id) {
                setGrabbed(null);
              }
            }}
          >
            {render(id)}
          </BoardItem>
        ))}
      </ul>
      {/* Inside the page, not a portal: the card's copy keeps the page's container queries, so it
          is drawn exactly as the card is. The floating Quick actions step aside while dragging. */}
      <DragOverlay dropAnimation={dropAnimation} style={lift ? { height: lift.height } : undefined} zIndex={100}>
        {active && lift ? <Lifted ref={carried} node={lift.node} capped={lift.capped} still={reduced} /> : null}
      </DragOverlay>
      <p aria-live="polite" className="sr-only">
        {message}
      </p>
    </DndContext>
  );
}

const NO_ANNOUNCEMENTS = {
  onDragStart: () => undefined,
  onDragMove: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

/** The carried card: its copy, lifted a little, with its handle where it was, held. */
const Lifted = React.forwardRef<HTMLDivElement, { node: HTMLElement; capped: boolean; still: boolean }>(function Lifted(
  { node, capped, still },
  ref,
) {
  const holder = React.useCallback((el: HTMLDivElement | null) => el?.replaceChildren(node), [node]);
  return (
    <div ref={ref} aria-hidden="true" data-still={still || undefined} className="board-lift relative h-full cursor-grabbing">
      <div ref={holder} data-capped={capped || undefined} className="board-lift-card h-full overflow-hidden rounded-xl" />
      <span className="board-handle board-handle-ghost">
        <GripHorizontalIcon aria-hidden="true" className="size-4" />
      </span>
    </div>
  );
});

function BoardItem({
  id,
  first,
  last,
  full,
  lifted,
  grabbed,
  dragging,
  nodeRef,
  handleRef,
  onStep,
  onHandleKey,
  onHandleBlur,
  children,
}: {
  id: SlotId;
  first: boolean;
  last: boolean;
  full: boolean;
  lifted: boolean;
  grabbed: boolean;
  dragging: boolean;
  nodeRef: (el: HTMLElement | null) => void;
  handleRef: (el: HTMLButtonElement | null) => void;
  onStep: (by: -1 | 1) => void;
  onHandleKey: (e: React.KeyboardEvent) => void;
  onHandleBlur: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners } = useDraggable({ id });
  const touch = useMediaQuery("(pointer: coarse)");
  const [menu, setMenu] = React.useState(false);
  const [holding, setHolding] = React.useState(false);
  /* A click that ends a drag is not a request for the menu. */
  const dragged = React.useRef(false);
  React.useEffect(() => {
    if (lifted) {
      dragged.current = true;
    } else if (dragged.current) {
      const t = window.setTimeout(() => (dragged.current = false), 250);
      return () => window.clearTimeout(t);
    }
  }, [lifted]);

  const name = SLOT_NAMES[id];
  const handleProps = {
    ref: (el: HTMLButtonElement | null) => {
      setActivatorNodeRef(el);
      handleRef(el);
    },
    type: "button" as const,
    "aria-label": `Move ${name}`,
    className: "board-handle",
    "data-open": menu || undefined,
    onPointerDown: (e: React.PointerEvent) => {
      listeners?.onPointerDown?.(e);
      /* Radix opens its menu on pointer down; here a press may become a drag, so the menu waits
         for the click instead. */
      e.preventDefault();
    },
    onTouchStart: (e: React.TouchEvent) => {
      listeners?.onTouchStart?.(e);
      setHolding(true);
    },
    onTouchEnd: () => setHolding(false),
    onTouchCancel: () => setHolding(false),
    onTouchMove: () => setHolding(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (dragged.current || dragging) return;
      setMenu((m) => !m);
    },
    onKeyDown: onHandleKey,
    onBlur: onHandleBlur,
  };
  const grip = <GripHorizontalIcon aria-hidden="true" className="size-4" />;

  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        nodeRef(el);
      }}
      data-board-item={id}
      data-lifted={lifted || undefined}
      data-grabbed={grabbed || undefined}
      data-holding={(holding && !lifted) || undefined}
      className={cn("board-item group/slot relative min-w-0 list-none", full && "lg:col-span-2")}
    >
      <div className="board-card min-w-0 *:h-full">{children}</div>
      {touch ? (
        <>
          <button {...handleProps}>{grip}</button>
          <Drawer open={menu} onOpenChange={setMenu}>
            <DrawerContent style={{ paddingBottom: "calc(var(--spacing) * 4 + env(safe-area-inset-bottom))" }}>
              <DrawerHeader className="text-left">
                <DrawerTitle className="text-left">{name}</DrawerTitle>
                <DrawerDescription className="text-left">Or press and hold the handle, then drag.</DrawerDescription>
              </DrawerHeader>
              <div className="flex flex-col gap-2 px-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="justify-start"
                  disabled={first}
                  onClick={() => {
                    setMenu(false);
                    onStep(-1);
                  }}
                >
                  <ArrowUpIcon data-icon="inline-start" aria-hidden="true" />
                  Move up
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="justify-start"
                  disabled={last}
                  onClick={() => {
                    setMenu(false);
                    onStep(1);
                  }}
                >
                  <ArrowDownIcon data-icon="inline-start" aria-hidden="true" />
                  Move down
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <DropdownMenu open={menu} onOpenChange={setMenu} modal={false}>
          <DropdownMenuTrigger asChild>
            <button {...handleProps}>{grip}</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-auto min-w-40">
            <DropdownMenuItem disabled={first} onSelect={() => onStep(-1)}>
              <ArrowUpIcon aria-hidden="true" />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={last} onSelect={() => onStep(1)}>
              <ArrowDownIcon aria-hidden="true" />
              Move down
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
