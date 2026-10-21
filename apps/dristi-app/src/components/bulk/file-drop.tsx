"use client";

import * as React from "react";
import { FileSpreadsheetIcon, UploadIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function sizeOf(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/**
 * A drop zone for one or more files: drag them onto it, or press the button. Once chosen,
 * it names what was picked and offers to change it. The native input stays hidden; the
 * zone and the button are the visible, labelled controls.
 */
export function FileDrop({
  id,
  accept,
  multiple = false,
  files,
  onFiles,
  prompt,
  hint,
  disabled = false,
}: {
  id: string;
  accept: string;
  multiple?: boolean;
  files: File[];
  onFiles: (files: File[]) => void;
  /** "Drag your Excel file here". */
  prompt: string;
  /** What it takes: ".xlsx or .csv". */
  hint: string;
  disabled?: boolean;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const chosen = files.length > 0;
  const choose = () => !disabled && input.current?.click();

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
        over ? "border-ring bg-accent" : chosen ? "border-input bg-surface-sunken" : "border-input",
        disabled && "opacity-50"
      )}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        const dropped = Array.from(e.dataTransfer.files ?? []);
        if (dropped.length) onFiles(multiple ? dropped : dropped.slice(0, 1));
      }}
    >
      {chosen ? (
        <>
          <FileSpreadsheetIcon className="size-8 text-success-ink" aria-hidden />
          <div className="flex flex-col gap-0.5">
            {files.slice(0, 3).map((f) => (
              <span key={f.name} className="text-body-compact font-medium">
                {f.name} <span className="font-normal text-muted-foreground tabular-nums">· {sizeOf(f.size)}</span>
              </span>
            ))}
            {files.length > 3 ? (
              <span className="text-caption text-muted-foreground tabular-nums">and {files.length - 3} more</span>
            ) : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={choose} disabled={disabled}>
            Change
          </Button>
        </>
      ) : (
        <>
          <UploadIcon className="size-8 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span className="text-body-compact font-medium">{prompt}</span>
            <span className="text-caption text-muted-foreground">or choose {multiple ? "them" : "it"} from your computer · {hint}</span>
          </div>
          <Button type="button" variant="outline" onClick={choose} disabled={disabled}>
            Choose {multiple ? "files" : "file"}
          </Button>
        </>
      )}
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (picked.length) onFiles(picked);
        }}
      />
    </div>
  );
}
