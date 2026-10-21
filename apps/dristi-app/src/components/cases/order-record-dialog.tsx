"use client";

import { DownloadIcon, FileClockIcon, XIcon } from "lucide-react";

import { PdfViewer } from "@/components/cases/pdf-viewer";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { type OrderRecord } from "@/lib/cases/orders";
import { formatCaseDate } from "@/lib/cases/types";
import { cn } from "@/lib/utils";

/**
 * Opening an order shows the order (ORD-03): a tall dialog, a little short of
 * the screen so the case stays visible behind it, holding the PDF, Download
 * and close. The slim bar names the document, which a dialog needs anyway.
 */
export function OrderRecordDialog({
  order,
  onOpenChange,
}: {
  order: OrderRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  const doc = order?.issuedDocument;

  return (
    <Dialog open={Boolean(order)} onOpenChange={onOpenChange}>
      <FlowDialogContent
        showCloseButton={false}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          doc?.href
            ? "h-[calc(100dvh---spacing(12))] sm:max-w-5xl"
            : "max-h-[calc(100dvh---spacing(12))] sm:max-w-2xl"
        )}
      >
        {order ? (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-hairline py-3 pr-3 pl-6">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <DialogTitle className="text-body-compact font-semibold text-pretty sm:truncate">
                  {order.title}
                </DialogTitle>
                <DialogDescription className="text-caption font-medium tabular-nums text-muted-foreground">
                  {formatCaseDate(order.issuedOn)}
                </DialogDescription>
              </div>
              {doc?.href ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a href={doc.href} download aria-label="Download">
                          <DownloadIcon aria-hidden />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Download</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon-sm">
                  <XIcon aria-hidden />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
            {doc?.href ? (
              <PdfViewer
                key={`${doc.href}#${doc.page ?? 1}`}
                src={doc.href}
                /* The sample orders are single pages of one compiled file. */
                pages={doc.page ? { from: doc.page, to: doc.page } : undefined}
                title={order.title}
                className="flex-1 rounded-none"
              />
            ) : (
              /* A published order normally carries its PDF (ORD-10). This is
                 the gap between the court passing an order and the signed
                 copy being uploaded, so the reader still gets what was
                 ordered, from the business of the day. */
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto bg-surface-sunken p-6">
                <Empty className="flex-none">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileClockIcon aria-hidden />
                    </EmptyMedia>
                    <EmptyTitle className="text-body font-semibold">
                      The signed order is not uploaded yet
                    </EmptyTitle>
                    <EmptyDescription>
                      It appears here as soon as the court uploads it. You do
                      not need to do anything.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
                {order.botd ? (
                  <div className="flex w-full max-w-xl flex-col gap-1.5 rounded-lg border border-hairline bg-card p-4">
                    <p className="text-caption font-medium text-muted-foreground">
                      Business of the day
                    </p>
                    <p className="text-body-compact text-pretty text-foreground">
                      {order.botd}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </FlowDialogContent>
    </Dialog>
  );
}
