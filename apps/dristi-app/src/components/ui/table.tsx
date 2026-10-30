"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-separate border-spacing-0 text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:hover:bg-transparent [&_th:first-child]:rounded-l-lg [&_th:last-child]:rounded-r-lg", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        /* A row cannot see its neighbours, so the body hides the rule above a lit row
           (the product's table treatment, promoted from its table-plate). */
        "[&_tr:last-child_td]:border-b-0 [&>tr:has(+_tr:hover)>td]:border-transparent [&>tr:has(+_tr:has([aria-expanded=true]))>td]:border-transparent [&>tr[data-state=selected]>td]:border-transparent [&>tr:has(+_tr[data-state=selected])>td]:border-transparent [&>tr:not([data-state=selected])+tr[data-state=selected]>td:first-child]:rounded-tl-lg [&>tr:not([data-state=selected])+tr[data-state=selected]>td:last-child]:rounded-tr-lg [&>tr[data-state=selected]:first-child>td:first-child]:rounded-tl-lg [&>tr[data-state=selected]:first-child>td:last-child]:rounded-tr-lg [&>tr[data-state=selected]:not(:has(+_tr[data-state=selected]))>td:first-child]:rounded-bl-lg [&>tr[data-state=selected]:not(:has(+_tr[data-state=selected]))>td:last-child]:rounded-br-lg",
        className
      )}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        /* Fills live on the cells: a row cannot round its corners. Hover and an open
           menu light the row in the warm well with rounded ends; selected is stronger. */
        "[&>td]:bg-card [&>td]:transition-[background-color,border-color,border-radius] hover:[&>td]:border-transparent hover:[&>td]:bg-surface-sunken hover:[&>td:first-child]:rounded-l-lg hover:[&>td:last-child]:rounded-r-lg has-aria-expanded:[&>td]:border-transparent has-aria-expanded:[&>td]:bg-surface-sunken has-aria-expanded:[&>td:first-child]:rounded-l-lg has-aria-expanded:[&>td:last-child]:rounded-r-lg data-[state=selected]:[&>td]:bg-accent-strong",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 bg-surface-sunken px-4 py-3 text-left align-middle text-body-compact font-semibold whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-16 border-b border-hairline px-4 py-2.5 text-left align-middle text-body-compact whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
