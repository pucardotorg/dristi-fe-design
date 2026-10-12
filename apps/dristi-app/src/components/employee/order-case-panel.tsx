"use client";

import * as React from "react";
import { CheckIcon, LinkIcon, PlusIcon, XIcon } from "lucide-react";

import { PANEL_CLASS } from "@/components/shell/panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CASE_FILE_TREE,
  caseFilePdfSrc,
  flattenLeaves,
  isCaseFileFolder,
  type CaseFileNode,
} from "@/lib/cases/case-file";
import { cn } from "@/lib/utils";

/** An application standing on the matter, as the case file lists it. */
export type PanelApplication = {
  id: string;
  label: string;
  detail: string;
  /** Decided in this order — linked by deciding it, so it cannot be unlinked here. */
  decided: boolean;
  onOpen: () => void;
};

type DocumentRow = {
  id: string;
  label: string;
  detail?: string;
  node?: CaseFileNode;
  application?: PanelApplication;
};

/**
 * The case file beside the order — Abhirami's right-hand panel (v14).
 *
 * **Documents**: the case file's own index (`CASE_FILE_TREE`, the tree the advocate's
 * case file reads), searchable, with the applications standing on the matter first. Any
 * document can be **linked to the order**; an application decided in the order is linked
 * by deciding it. A document opens in one viewer, with Link in its header.
 *
 * **Overview**: the facts of the matter, as the screen that opened the order knows them.
 *
 * Abhirami's third tab, Case history, is not built: the employee side carries no history
 * of a matter's earlier hearings and orders to show, and borrowing the advocate fixture's
 * would put another case's history beside this one.
 */
export function OrderCasePanel({
  className,
  overview,
  applications = [],
  links,
  onLinksChange,
  disabled,
}: {
  className?: string;
  overview: { label: string; value: string }[];
  applications?: PanelApplication[];
  links: readonly string[];
  onLinksChange: (links: string[]) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [viewing, setViewing] = React.useState<DocumentRow | null>(null);
  const searchId = React.useId();

  const sections = React.useMemo(() => {
    const filed = CASE_FILE_TREE.map((node) => ({
      id: node.id,
      label: node.label,
      rows: (isCaseFileFolder(node) ? flattenLeaves(node.children ?? []) : [node]).map(
        (leaf): DocumentRow => ({ id: leaf.id, label: leaf.label, node: leaf }),
      ),
    }));
    return applications.length > 0
      ? [
          {
            id: "applications",
            label: "Applications",
            rows: applications.map(
              (application): DocumentRow => ({
                id: application.id,
                label: application.label,
                detail: application.detail,
                application,
              }),
            ),
          },
          ...filed,
        ]
      : filed;
  }, [applications]);

  const allRows = sections.flatMap((section) => section.rows);
  const decidedIds = applications
    .filter((application) => application.decided)
    .map((application) => application.id);
  const linkedIds = [...new Set([...decidedIds, ...links])];
  const linkedRows = linkedIds
    .map((id) => allRows.find((row) => row.id === id))
    .filter((row): row is DocumentRow => row !== undefined);

  const needle = query.trim().toLowerCase();
  const shown = sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter(
        (row) =>
          !needle ||
          `${row.label} ${row.detail ?? ""} ${section.label}`
            .toLowerCase()
            .includes(needle),
      ),
    }))
    .filter((section) => section.rows.length > 0);

  function toggle(id: string) {
    onLinksChange(
      links.includes(id) ? links.filter((entry) => entry !== id) : [...links, id],
    );
  }

  function open(row: DocumentRow) {
    if (row.application) row.application.onOpen();
    else setViewing(row);
  }

  return (
    <Card
      className={cn(
        PANEL_CLASS,
        "min-w-0 flex-col gap-0 overflow-hidden py-0",
        className,
      )}
    >
      <h2 className="shrink-0 px-4 pt-4 text-body-compact font-semibold">
        Case file
      </h2>
      <Tabs defaultValue="documents" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList
          variant="line"
          className="h-10 w-full shrink-0 justify-start border-b border-hairline px-2"
        >
          <TabsTrigger
            value="documents"
            className="h-10 flex-none px-3 text-body-compact group-data-horizontal/tabs:after:-bottom-px"
          >
            Documents
          </TabsTrigger>
          <TabsTrigger
            value="overview"
            className="h-10 flex-none px-3 text-body-compact group-data-horizontal/tabs:after:-bottom-px"
          >
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="documents"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor={searchId} className="sr-only">
              Search the case file
            </Label>
            <Input
              id={searchId}
              type="search"
              placeholder="Search the case file"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {needle ? null : (
            <section
              aria-labelledby={`${searchId}-linked`}
              className="flex min-w-0 flex-col gap-2 rounded-lg border border-hairline bg-surface-sunken p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3
                  id={`${searchId}-linked`}
                  className="text-body-compact font-semibold"
                >
                  Linked to this order
                </h3>
                {linkedRows.length > 0 ? (
                  <span className="text-body-compact tabular-nums text-muted-foreground">
                    {linkedRows.length}
                  </span>
                ) : null}
              </div>
              {linkedRows.length === 0 ? (
                <p className="text-body-compact text-muted-foreground">
                  Nothing yet. Choose Link on a document below.
                </p>
              ) : (
                <ul className="flex min-w-0 flex-col gap-1">
                  {linkedRows.map((row) => {
                    const decided = decidedIds.includes(row.id);
                    return (
                      <li
                        key={row.id}
                        className="flex min-w-0 items-center justify-between gap-2"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          className="-ml-2 min-w-0 justify-start px-2 font-medium"
                          onClick={() => open(row)}
                        >
                          <span className="truncate">{row.label}</span>
                        </Button>
                        {decided ? (
                          <span className="shrink-0 text-caption text-muted-foreground">
                            Decided here
                          </span>
                        ) : disabled ? null : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Unlink ${row.label}`}
                            onClick={() => toggle(row.id)}
                          >
                            <XIcon aria-hidden />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {shown.length === 0 ? (
            <p className="text-body-compact text-muted-foreground">
              Nothing in the case file matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            shown.map((section) => (
              <section
                key={section.id}
                aria-labelledby={`${searchId}-${section.id}`}
                className="flex min-w-0 flex-col gap-1"
              >
                <h3
                  id={`${searchId}-${section.id}`}
                  className="px-2 text-body-compact font-semibold"
                >
                  {section.label}
                </h3>
                <ul className="flex min-w-0 flex-col">
                  {section.rows.map((row) => {
                    const linked = linkedIds.includes(row.id);
                    const decided = decidedIds.includes(row.id);
                    return (
                      <li
                        key={row.id}
                        className={cn(
                          "flex min-w-0 items-center gap-1 rounded-lg",
                          linked && "bg-accent",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => open(row)}
                          className="flex min-h-10 min-w-0 flex-1 flex-col justify-center rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <span
                            className={cn(
                              "text-body-compact",
                              linked && "font-medium",
                            )}
                          >
                            {row.label}
                          </span>
                          {row.detail ? (
                            <span className="text-caption text-muted-foreground">
                              {row.detail}
                            </span>
                          ) : null}
                        </button>
                        {decided ? (
                          <span className="inline-flex shrink-0 items-center gap-1 px-2 text-caption font-medium">
                            <CheckIcon className="size-4" aria-hidden />
                            Linked
                          </span>
                        ) : disabled ? null : (
                          <Button
                            type="button"
                            variant="ghost"
                            aria-pressed={linked}
                            aria-label={`${linked ? "Unlink" : "Link"} ${row.label} ${linked ? "from" : "to"} the order`}
                            className="shrink-0 px-2 text-body-compact"
                            onClick={() => toggle(row.id)}
                          >
                            {linked ? (
                              <CheckIcon data-icon="inline-start" aria-hidden />
                            ) : (
                              <PlusIcon data-icon="inline-start" aria-hidden />
                            )}
                            {linked ? "Linked" : "Link"}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </TabsContent>

        <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto p-4">
          <DescriptionList>
            {overview.map((row) => (
              <DescriptionRow key={row.label}>
                <DescriptionTerm className="text-body-compact">
                  {row.label}
                </DescriptionTerm>
                <DescriptionDetails className="text-body-compact">
                  {row.value}
                </DescriptionDetails>
              </DescriptionRow>
            ))}
          </DescriptionList>
        </TabsContent>
      </Tabs>

      <Dialog
        open={viewing !== null}
        onOpenChange={(next) => {
          if (!next) setViewing(null);
        }}
      >
        <DialogContent className="flex h-[85dvh] flex-col gap-4 sm:max-w-5xl">
          <DialogHeader className="flex-row items-start justify-between gap-4 pr-12">
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle className="text-title-s font-semibold">
                {viewing?.label}
              </DialogTitle>
              <DialogDescription>From the case file</DialogDescription>
            </div>
            {viewing && !disabled ? (
              <Button
                type="button"
                variant={links.includes(viewing.id) ? "outline" : "default"}
                aria-pressed={links.includes(viewing.id)}
                onClick={() => toggle(viewing.id)}
              >
                {links.includes(viewing.id) ? (
                  <CheckIcon data-icon="inline-start" aria-hidden />
                ) : (
                  <LinkIcon data-icon="inline-start" aria-hidden />
                )}
                {links.includes(viewing.id)
                  ? "Linked to the order"
                  : "Link to the order"}
              </Button>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-surface-sunken p-2">
            {viewing?.node && caseFilePdfSrc(viewing.node) ? (
              <iframe
                key={viewing.id}
                src={caseFilePdfSrc(viewing.node)}
                title={viewing.label}
                className="size-full rounded-md border-0 bg-card"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
