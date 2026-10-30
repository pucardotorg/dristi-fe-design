"use client";

import * as React from "react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { StatusLine, notify } from "@/components/feedback";
import { useCaseNumber, useCourtText } from "@/components/court/court-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CASE_FILE_TREE } from "@/lib/cases/case-file";
import { buildCaseFileBundle } from "@/lib/cases/case-file-bundle";

type Format = "pdf" | "zip" | "sections";

const FORMATS: { value: Format; label: string }[] = [
  {
    value: "pdf",
    label: "Full case file, one PDF",
  },
  {
    value: "zip",
    label: "Full case file, separate files",
  },
  {
    value: "sections",
    label: "Only some sections",
  },
];

/**
 * ACT-01. The PRD documents one compiled PDF; the ZIP and the section picker
 * are a working guess (open question Q-2). The one PDF and the chosen
 * sections are compiled in the browser (`case-file-bundle`); the ZIP is not
 * built yet and only confirms the request.
 */
export function DownloadCaseFileDialog({
  open,
  onOpenChange,
  caseNumber,
  title,
  court,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseNumber: string;
  title: string;
  court: string;
}) {
  const [format, setFormat] = React.useState<Format>("pdf");
  const [sections, setSections] = React.useState<string[]>([]);
  const [preparing, setPreparing] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  /* A failure belongs to the attempt that failed: a reopened window starts clean. */
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFailed(false);
  }
  // The PDF is drawn outside the DOM, so the court text layer never reaches
  // it: re-voice for the selected state here, as the header shows them.
  const localNumber = useCaseNumber();
  const localText = useCourtText();
  const blocked = (format === "sections" && sections.length === 0) || preparing;

  function toggleSection(id: string, checked: boolean) {
    setFailed(false);
    setSections((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id)
    );
  }

  async function download() {
    if (format === "zip") {
      notify.success("Preparing your download", {
        description: `${caseNumber}. It will start in a moment.`,
      });
      onOpenChange(false);
      return;
    }
    setPreparing(true);
    setFailed(false);
    try {
      // Picked sections keep their case-file numbers, so the docket pages
      // still point at the same place in the tree.
      const tree =
        format === "sections"
          ? CASE_FILE_TREE.filter((node) => sections.includes(node.id))
          : CASE_FILE_TREE;
      const number = localNumber(caseNumber);
      const blob = await buildCaseFileBundle(tree, {
        caseNumber: number,
        title: localText(title),
        court: localText(court),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${number.replace(/[^\w-]+/g, "-")}-case-file.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      onOpenChange(false);
    } catch {
      /* The window is still open, so the failure is said inside it, never as a toast
         behind it (skill `feedback-states`). */
      setFailed(true);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ChromeDialogContent className="flex max-h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1 border-b border-hairline px-6 py-4 text-left">
          <DialogTitle className="text-title-s font-semibold">
            Download case file
          </DialogTitle>
          <p className="font-mono text-caption font-medium text-muted-foreground">
            {caseNumber}
          </p>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-4">
          <RadioGroup
            value={format}
            onValueChange={(value) => {
              setFormat(value as Format);
              setFailed(false);
            }}
            aria-label="What to download"
            className="flex flex-col gap-1"
          >
            {FORMATS.map((item) => (
              <div key={item.value} className="flex min-h-8 items-center gap-2">
                <RadioGroupItem
                  value={item.value}
                  id={`download-${item.value}`}
                />
                <Label htmlFor={`download-${item.value}`}>{item.label}</Label>
              </div>
            ))}
          </RadioGroup>

          {format === "sections" ? (
            <fieldset className="flex flex-col gap-1 rounded-lg bg-surface-sunken p-3">
              <legend className="sr-only">Sections to include</legend>
              {CASE_FILE_TREE.map((node) => (
                <div key={node.id} className="flex min-h-8 items-center gap-2">
                  <Checkbox
                    id={`download-section-${node.id}`}
                    checked={sections.includes(node.id)}
                    onCheckedChange={(checked) =>
                      toggleSection(node.id, checked === true)
                    }
                  />
                  <Label
                    htmlFor={`download-section-${node.id}`}
                    className="font-normal"
                  >
                    {node.label}
                  </Label>
                </div>
              ))}
            </fieldset>
          ) : null}

          {failed ? (
            <StatusLine tone="error" title="The case file could not be prepared">
              Try again. Nothing was downloaded.
            </StatusLine>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={blocked} onClick={download}>
            {preparing ? "Preparing…" : "Download"}
          </Button>
        </div>
      </ChromeDialogContent>
    </Dialog>
  );
}
