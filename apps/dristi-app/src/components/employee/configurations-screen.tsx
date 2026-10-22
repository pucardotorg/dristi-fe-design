"use client";

import * as React from "react";
import {
  ChevronDownIcon,
  FileTextIcon,
  LockIcon,
  PlusIcon,
  CopyIcon,
  TrashIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  INITIAL_TEMPLATES,
  TEMPLATE_GROUPS,
  GENERAL_VARIABLES,
  HEARING_PURPOSES,
  ORDER_CATEGORIES,
  allDetectedVariables,
  classifyVariable,
  resolutionLabel,
  initHearingPurposeIds,
  generateId,
  type OrderTemplate,
  type OrderCategory,
} from "@/lib/employee/order-config-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Variable insertion menu
// ---------------------------------------------------------------------------

function InsertVariableMenu({
  template,
  onInsert,
}: {
  template: OrderTemplate;
  onInsert: (name: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="gap-1.5 text-caption"
      >
        <PlusIcon aria-hidden className="size-3.5" />
        Insert variable
      </Button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-80 max-h-96 overflow-y-auto rounded-lg border border-hairline bg-popover shadow-overlay">
          {/* General variables */}
          <div className="border-b border-hairline px-3 py-1.5">
            <span className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
              General — any template
            </span>
          </div>
          {GENERAL_VARIABLES.map((gv) => (
            <button
              key={gv.name}
              type="button"
              onClick={() => {
                onInsert(gv.name);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body-compact hover:bg-accent/50"
            >
              <span
                className={cn("size-2 shrink-0 rounded-full", {
                  "bg-success-muted-foreground":
                    gv.resolution === "auto-fill",
                  "bg-info-muted-foreground": gv.resolution === "select",
                  "bg-warning-muted-foreground": gv.resolution === "input",
                })}
              />
              <span className="min-w-0 flex-1">{gv.name}</span>
              <span className="text-caption text-muted-foreground">
                {gv.resolution === "auto-fill"
                  ? "auto"
                  : gv.source || gv.inputType || ""}
              </span>
            </button>
          ))}
          {/* Locked variables */}
          {template.lockedVars.length > 0 && (
            <>
              <div className="border-t border-b border-hairline px-3 py-1.5">
                <span className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                  🔒 Locked — this template
                </span>
              </div>
              {template.lockedVars.map((lv) => (
                <button
                  key={lv.name}
                  type="button"
                  onClick={() => {
                    onInsert(lv.name);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body-compact hover:bg-accent/50"
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-full", {
                      "bg-success-muted-foreground":
                        lv.resolution === "auto-fill",
                      "bg-info-muted-foreground":
                        lv.resolution === "select",
                      "bg-warning-muted-foreground":
                        lv.resolution === "input",
                    })}
                  />
                  <span className="min-w-0 flex-1">{lv.name}</span>
                  <span className="text-caption text-muted-foreground">
                    {lv.resolution === "auto-fill"
                      ? "auto"
                      : lv.source || lv.inputType || ""}
                  </span>
                </button>
              ))}
            </>
          )}
          {/* Optional variables */}
          {(template.optionalVars ?? []).length > 0 && (
            <>
              <div className="border-t border-b border-hairline px-3 py-1.5">
                <span className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                  Optional — this template
                </span>
              </div>
              {(template.optionalVars ?? []).map((ov) => (
                <button
                  key={ov.name}
                  type="button"
                  onClick={() => {
                    onInsert(ov.name);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body-compact hover:bg-accent/50"
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-full", {
                      "bg-info-muted-foreground":
                        ov.resolution === "select",
                      "bg-warning-muted-foreground":
                        ov.resolution === "input",
                    })}
                  />
                  <span className="min-w-0 flex-1">{ov.name}</span>
                  <span className="text-caption text-muted-foreground">
                    {ov.source || ov.inputType || ""}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variable list — derived from the current text content
// ---------------------------------------------------------------------------

function VariableList({ template }: { template: OrderTemplate }) {
  const detected = allDetectedVariables(template);
  // Locked vars not in the text are still shown — they're required by the workflow
  const lockedNotInText = template.lockedVars.filter(
    (lv) => !detected.includes(lv.name),
  );
  const total = detected.length + lockedNotInText.length;

  if (total === 0 && !template.freeText) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center text-body-compact text-muted-foreground italic">
        No [variables] in the template text
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {detected.map((name) => {
        const info = classifyVariable(name, template);
        return (
          <div
            key={name}
            className="flex items-center gap-2 rounded-md border border-hairline bg-card px-3 py-2 text-body-compact"
          >
            <span
              className={cn("size-2 shrink-0 rounded-full", {
                "bg-success-muted-foreground":
                  info.resolution === "auto-fill",
                "bg-info-muted-foreground":
                  info.resolution === "select",
                "bg-warning-muted-foreground":
                  info.resolution === "input" && info.scope !== "unknown",
                "bg-muted-foreground": info.scope === "unknown",
              })}
            />
            <span className="font-mono text-caption font-medium">{name}</span>
            <span className="text-caption text-muted-foreground">
              {resolutionLabel(info)}
            </span>
            <span className="flex-1" />
            {info.scope === "general" && (
              <Badge variant="success" className="h-5 px-1.5 text-caption">
                general
              </Badge>
            )}
            {info.scope === "locked" && (
              <Badge variant="secondary" className="h-5 px-1.5 text-caption">
                🔒 locked
              </Badge>
            )}
            {info.scope === "optional" && (
              <Badge variant="info" className="h-5 px-1.5 text-caption">
                optional
              </Badge>
            )}
            {info.scope === "unknown" && (
              <Badge
                variant="outline"
                className="h-5 border-dashed px-1.5 text-caption"
              >
                not recognised
              </Badge>
            )}
          </div>
        );
      })}
      {/* Locked vars not in text — always shown because the workflow collects them */}
      {lockedNotInText.map((lv) => (
        <div
          key={lv.name}
          className="flex items-center gap-2 rounded-md border border-dashed border-hairline bg-card px-3 py-2 text-body-compact"
        >
          <span
            className={cn("size-2 shrink-0 rounded-full", {
              "bg-success-muted-foreground": lv.resolution === "auto-fill",
              "bg-info-muted-foreground": lv.resolution === "select",
              "bg-warning-muted-foreground": lv.resolution === "input",
            })}
          />
          <span className="font-mono text-caption font-medium">{lv.name}</span>
          <span className="text-caption text-muted-foreground">
            {resolutionLabel(lv)}
          </span>
          <span className="flex-1" />
          <Badge variant="secondary" className="h-5 px-1.5 text-caption">
            🔒 locked
          </Badge>
          <span className="text-caption text-muted-foreground italic">
            collected separately
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function VariableLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-caption text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-success-muted-foreground" />
        Auto-fill
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-info-muted-foreground" />
        Select from list
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-warning-muted-foreground" />
        Magistrate enters
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function TemplateSidebar({
  templates,
  selectedId,
  onSelect,
  onNew,
}: {
  templates: OrderTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-0.5 p-3">
        {TEMPLATE_GROUPS.map((g) => {
          const items = templates.filter((t) => t.group === g.key);
          if (items.length === 0) return null;
          return (
            <div key={g.key} className="mb-1">
              <div className="px-2 py-1.5 text-caption font-bold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </div>
              {items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect(t.id)}
                  aria-current={selectedId === t.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body-compact leading-snug transition-colors",
                    selectedId === t.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <FileTextIcon aria-hidden className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                </button>
              ))}
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNew}
          className="mx-2 mt-2 gap-1.5"
        >
          <PlusIcon aria-hidden className="size-3.5" />
          New template
        </Button>
      </div>
    </ScrollArea>
  );
}

// ---------------------------------------------------------------------------
// Detail editor — the core of the configuration screen
// ---------------------------------------------------------------------------

function TemplateEditor({
  template,
  onUpdate,
  onDuplicate,
  onDelete,
}: {
  template: OrderTemplate;
  onUpdate: (patch: Partial<OrderTemplate>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  // Track which textarea is active for variable insertion
  const [activeField, setActiveField] = React.useState<
    "botdText" | "orderText"
  >("orderText");
  const botdRef = React.useRef<HTMLTextAreaElement>(null);
  const orderRef = React.useRef<HTMLTextAreaElement>(null);

  function insertVariable(name: string) {
    const fieldKey = activeField;
    const ta =
      fieldKey === "botdText" ? botdRef.current : orderRef.current;
    const current = template[fieldKey] || "";
    const pos = ta?.selectionStart ?? current.length;
    const before = current.slice(0, pos);
    const after = current.slice(pos);
    const spacer =
      before.length &&
      !before.endsWith(" ") &&
      !before.endsWith("\n")
        ? " "
        : "";
    const insert = spacer + "[" + name + "]";
    onUpdate({ [fieldKey]: before + insert + after });
    // Restore cursor position
    setTimeout(() => {
      const ref =
        fieldKey === "botdText" ? botdRef.current : orderRef.current;
      if (ref) {
        const p = pos + insert.length;
        ref.focus();
        ref.setSelectionRange(p, p);
      }
    }, 30);
  }

  // Hearing purpose associations — derived from template state
  const associatedIds = React.useMemo(
    () => new Set(template.hearingPurposeIds ?? []),
    [template.hearingPurposeIds],
  );

  function toggleHearingPurpose(hpId: number) {
    const current = template.hearingPurposeIds ?? [];
    const next = current.includes(hpId)
      ? current.filter((id) => id !== hpId)
      : [...current, hpId];
    onUpdate({ hearingPurposeIds: next });
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-6 md:p-8">
        {/* ── Name ── */}
        <Input
          value={template.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="text-title font-semibold"
          aria-label="Template name"
        />

        {/* ── Workflow block ── */}
        <div className="rounded-lg border border-hairline bg-surface-sunken p-3">
          <div className="flex items-center gap-2 text-body-compact">
            <span className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
              Workflow
            </span>
            <span
              className={cn(
                "font-semibold",
                template.workflow
                  ? "text-primary"
                  : "text-muted-foreground italic",
              )}
            >
              {template.workflow || "None"}
            </span>
            <span className="ml-auto flex items-center gap-1 text-caption text-muted-foreground">
              <LockIcon aria-hidden className="size-3" />
              Defined in code
            </span>
          </div>
          {template.lockedVars.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-2">
              <span className="text-caption font-medium text-muted-foreground">
                Requires:
              </span>
              {template.lockedVars.map((lv) => (
                <span
                  key={lv.name}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-caption font-medium",
                    lv.resolution === "auto-fill"
                      ? "bg-success-muted text-success-muted-foreground"
                      : lv.resolution === "select"
                        ? "bg-info-muted text-info-muted-foreground"
                        : "bg-warning-muted text-warning-muted-foreground",
                  )}
                >
                  <LockIcon aria-hidden className="size-2.5" />
                  {lv.name}
                  <span className="text-caption opacity-70">
                    {lv.inputType || lv.source || ""}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── BOTD Text ── */}
        <section className="flex flex-col gap-2">
          <Label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
            BOTD text
          </Label>
          <Textarea
            ref={botdRef}
            value={template.botdText}
            onFocus={() => setActiveField("botdText")}
            onChange={(e) => onUpdate({ botdText: e.target.value })}
            placeholder="Short board text, e.g. Summons issued to [Party Name]"
            className="min-h-10 resize-y text-body-compact"
          />
          <p className="text-caption text-muted-foreground">
            Brief entry for the Business of the Day board.
          </p>
        </section>

        {/* ── Order Text ── */}
        <section className="flex flex-col gap-2">
          <Label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
            Order text
          </Label>
          {template.freeText && !template.orderText && (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-body-compact text-muted-foreground italic">
              Free text — no template. The magistrate writes the full order.
            </div>
          )}
          <Textarea
            ref={orderRef}
            value={template.orderText}
            onFocus={() => setActiveField("orderText")}
            onChange={(e) => onUpdate({ orderText: e.target.value })}
            placeholder="Full order template text. Use [brackets] for variables."
            className="min-h-20 resize-y text-body-compact"
          />
          <p className="text-caption text-muted-foreground">
            Variables in [brackets] are resolved when the magistrate selects
            this order.
          </p>
        </section>

        {/* ── Legend ── */}
        <VariableLegend />

        {/* ── Variables (detected from text) ── */}
        <section className="flex flex-col gap-2">
          <Label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
            Variables
          </Label>
          <VariableList template={template} />
          <InsertVariableMenu
            template={template}
            onInsert={insertVariable}
          />
        </section>

        <Separator />

        {/* ── Category ── */}
        {template.inDropdown && (
          <section className="flex flex-col gap-2">
            <Label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
              Category
            </Label>
            <Select
              value={template.category ?? ""}
              onValueChange={(v) =>
                onUpdate({ category: v as OrderCategory })
              }
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Categories</SelectLabel>
                  {ORDER_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-caption text-muted-foreground">
              Groups this order on the issuance screen dropdown.
            </p>
          </section>
        )}

        {/* ── Hearing purpose associations ── */}
        <section className="flex flex-col gap-2">
          <Label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
            Hearing purpose associations
          </Label>
          <p className="text-caption text-muted-foreground">
            Hearing purposes where this order is likely to be issued. Generic
            orders are always available.
          </p>
          <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
            {HEARING_PURPOSES.map((hp) => {
              const checked = associatedIds.has(hp.id);
              return (
                <label
                  key={hp.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                    checked
                      ? "border-primary/30 bg-primary/5"
                      : "border-transparent hover:bg-accent/30",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleHearingPurpose(hp.id)}
                    className="mt-0.5"
                    aria-label={`Associate with ${hp.name}`}
                  />
                  <span className="min-w-0 flex-1 text-body-compact">{hp.name}</span>
                </label>
              );
            })}
          </div>
        </section>

        <Separator />

        {/* ── Actions ── */}
        <div className="flex items-center gap-2">
          <Button type="button" size="sm">
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDuplicate}
            className="gap-1.5"
          >
            <CopyIcon aria-hidden className="size-3.5" />
            Duplicate
          </Button>
          <span className="flex-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="gap-1.5 text-destructive hover:bg-destructive-muted"
          >
            <TrashIcon aria-hidden className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function ConfigurationsScreen() {
  const [templates, setTemplates] = React.useState<OrderTemplate[]>(
    () => initHearingPurposeIds([...INITIAL_TEMPLATES]),
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(
    templates[0]?.id ?? null,
  );

  const selected = React.useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  function updateTemplate(patch: Partial<OrderTemplate>) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === selectedId ? { ...t, ...patch } : t)),
    );
  }

  function createNew() {
    const id = generateId();
    const newT: OrderTemplate = {
      id,
      name: "New template",
      group: "contextual",
      inDropdown: true,
      category: undefined,
      workflow: "",
      botdText: "",
      orderText: "",
      lockedVars: [],
    };
    setTemplates((prev) => [...prev, newT]);
    setSelectedId(id);
  }

  function duplicate() {
    if (!selected) return;
    const id = generateId();
    const copy: OrderTemplate = {
      ...structuredClone(selected),
      id,
      name: selected.name + " (copy)",
    };
    setTemplates((prev) => [...prev, copy]);
    setSelectedId(id);
  }

  function deleteCurrent() {
    if (!selected) return;
    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== selectedId);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-balance font-semibold sm:text-title-l">
          Order template configuration
        </h1>
        <p className="text-body text-muted-foreground">
          Configure templates, variables, and workflow associations for the{" "}
          {templates.length} order types.
        </p>
      </header>

      <Card className="flex min-h-0 flex-1 overflow-hidden border-hairline shadow-raised">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0 md:flex-row">
          {/* Sidebar */}
          <div className="flex min-h-0 w-full flex-col border-b border-hairline md:w-60 md:shrink-0 md:border-r md:border-b-0 lg:w-64">
            <div className="max-h-[40vh] min-h-0 flex-1 overflow-hidden md:max-h-none">
              <TemplateSidebar
                templates={templates}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onNew={createNew}
              />
            </div>
          </div>

          {/* Editor */}
          <div className="min-h-0 min-w-0 flex-1">
            {selected ? (
              <TemplateEditor
                key={selected.id}
                template={selected}
                onUpdate={updateTemplate}
                onDuplicate={duplicate}
                onDelete={deleteCurrent}
              />
            ) : (
              <div className="flex min-h-64 items-center justify-center text-body-compact text-muted-foreground">
                Select a template to edit
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
