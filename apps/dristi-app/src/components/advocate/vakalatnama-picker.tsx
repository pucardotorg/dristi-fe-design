"use client";

import * as React from "react";
import { FileTextIcon, Maximize2Icon, SearchIcon } from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { pick, type Locale } from "@/lib/onboarding/content";
import { advDialog, fillCopy, type Vakalatnama } from "@/lib/advocate/content";

/**
 * Saved-vakalatnama chooser for the advocate join flow.
 *
 * Advocates and clerks generate vakalatnamas in bulk elsewhere in the portal; at
 * join time they only pick the right one. Every row therefore carries a preview —
 * the failure this guards against is selecting a neighbouring case's document from
 * a list of near-identical titles.
 */

export function VakalatnamaPicker({
  items,
  selectedId,
  onSelect,
  locale,
}: {
  items: Vakalatnama[];
  selectedId: string;
  onSelect: (id: string) => void;
  locale: Locale;
}) {
  const [previewItem, setPreviewItem] = React.useState<Vakalatnama | null>(null);
  const [query, setQuery] = React.useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredItems = normalizedQuery
    ? items.filter((item) =>
        [item.name, item.parties]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
    : items;

  return (
    <>
      <div className="relative w-full">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={pick(advDialog.vkSearchPlaceholder, locale)}
          aria-label={pick(advDialog.vkSearchLabel, locale)}
          className="pl-9"
        />
      </div>

      {filteredItems.length ? (
        <ScrollArea className="h-64 rounded-lg border border-hairline">
          <RadioGroup value={selectedId} onValueChange={onSelect} className="flex flex-col gap-0">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b border-hairline px-3 py-2.5 last:border-b-0"
              >
                <RadioGroupItem value={item.id} id={`vk-${item.id}`} />
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-muted-foreground"
                >
                  <FileTextIcon className="size-4" />
                </span>
                <Label
                  htmlFor={`vk-${item.id}`}
                  className="flex min-w-0 flex-1 flex-col items-start gap-0.5 leading-snug"
                >
                  <span className="w-full truncate text-body-compact font-medium">
                    {item.name}
                  </span>
                  <span className="w-full truncate text-caption font-normal text-muted-foreground">
                    {item.parties} ·{" "}
                    {fillCopy(advDialog.advocatesCount, locale, {
                      count: String(item.advocates.length),
                    })}
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label={`${pick(advDialog.preview, locale)} · ${item.parties}`}
                  onClick={() => setPreviewItem(item)}
                >
                  <Maximize2Icon aria-hidden />
                </Button>
              </div>
            ))}
          </RadioGroup>
        </ScrollArea>
      ) : (
        <p className="rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-body-compact text-muted-foreground">
          {pick(advDialog.vkSearchEmpty, locale)}
        </p>
      )}

      <VakalatnamaPreviewDialog
        item={previewItem}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
        locale={locale}
      />
    </>
  );
}

/**
 * Prototype preview: renders the generated document's substance (court, litigants,
 * advocates, date) as a paper sheet. The real portal will render the stored PDF —
 * same dialog, same trigger.
 */
function VakalatnamaPreviewDialog({
  item,
  onOpenChange,
  locale,
}: {
  item: Vakalatnama | null;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <ChromeDialogContent lang={locale} className="flex max-h-[90dvh] flex-col gap-4 overflow-hidden sm:max-w-lg">
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>{pick(advDialog.previewTitle, locale)}</DialogTitle>
          <DialogDescription className="text-pretty">
            {pick(advDialog.previewBody, locale)}
          </DialogDescription>
        </DialogHeader>
        {item ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-surface-sunken p-4">
            <div className="mx-auto flex max-w-sm flex-col gap-5 rounded-md border border-hairline bg-surface px-6 py-8">
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-caption tracking-widest text-muted-foreground uppercase">
                  Vakalatnama
                </p>
                <p className="text-caption text-pretty text-muted-foreground">
                  In the Court of the Judicial First Class Magistrate I
                </p>
                <p className="text-body-compact font-semibold">{item.caseRef}</p>
              </div>
              <dl className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-caption text-muted-foreground">
                    {pick(advDialog.partiesLabel, locale)}
                  </dt>
                  <dd className="text-body-compact font-medium">{item.parties}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-caption text-muted-foreground">
                    {pick(advDialog.advocatesLabel, locale)}
                  </dt>
                  <dd className="text-body-compact font-medium">
                    {item.advocates.join(", ")}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-caption text-muted-foreground">
                    {pick(advDialog.generatedOn, locale)}
                  </dt>
                  <dd className="text-body-compact font-medium">{item.generatedOn}</dd>
                </div>
              </dl>
              <div className="flex items-end justify-between gap-6 pt-4">
                <div className="flex w-full flex-col gap-1">
                  <div className="h-px w-full bg-border" aria-hidden />
                  <p className="text-caption text-muted-foreground">Signature of party</p>
                </div>
                <div className="flex w-full flex-col gap-1">
                  <div className="h-px w-full bg-border" aria-hidden />
                  <p className="text-caption text-muted-foreground">Accepted by advocate</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </ChromeDialogContent>
    </Dialog>
  );
}
