"use client";

import { type ReactNode } from "react";
import { CaseLink as Link } from "@/components/cases/case-reader";
import { InfoIcon } from "lucide-react";

import { Identifier } from "@/components/chrome/identifier";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import {
  complaintDocumentHref,
  complaintDocumentSrc,
  type ComplaintDocument,
  type ComplaintField,
  type ComplaintPane,
} from "@/lib/cases/complaint";
import { cn } from "@/lib/utils";
import { DOCUMENT_GROUND } from "@/components/cases/document-ground";

import { PdfViewer, parsePdfSrc } from "./pdf-viewer";

/**
 * Structured read of a filed record — DescriptionList, narrative blocks,
 * people, and a paper strip. Used by Complaint and by Case file digital
 * view. Papers preview as a look at the page; a filed preview opens that
 * paper in Case file.
 */
export function DigitalRecord({
  caseId,
  pane,
  emptyTitle = "No record selected",
  emptyDescription = "Choose an item from the complaint to open it here.",
}: {
  caseId: string;
  pane: ComplaintPane | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!pane) {
    return (
      <Empty className="min-h-0 flex-1 border border-dashed border-border">
        <EmptyHeader>
          <EmptyTitle className="text-body font-semibold">
            {emptyTitle}
          </EmptyTitle>
          <EmptyDescription>
            {emptyDescription}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const documents = pane.documents ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      {pane.notice ? (
        <Alert variant="info">
          <InfoIcon aria-hidden />
          <AlertDescription className="group-has-[>svg]/alert:col-start-2">
            {pane.notice}
          </AlertDescription>
        </Alert>
      ) : null}

      {pane.fields && pane.fields.length > 0 ? (
        <DescriptionList>
          {pane.fields.map((item, index) => (
            <FieldRow key={`${item.term}-${index}`} field={item} />
          ))}
        </DescriptionList>
      ) : null}

      {pane.blocks?.map((block) => (
        <div key={block.title} className="flex flex-col gap-2">
          <h3 className="text-body-compact font-semibold text-foreground">
            {block.title}
          </h3>
          <p className="text-body-compact text-muted-foreground">{block.body}</p>
        </div>
      ))}

      {pane.people && pane.people.length > 0 ? (
        <ItemGroup>
          {pane.people.map((person, index) => (
            <FragmentRow key={person.title} first={index === 0}>
              <Item
                role="listitem"
                size="sm"
                className="items-start px-0 hover:bg-transparent"
              >
                <ItemContent className="gap-2">
                  <ItemTitle className="line-clamp-none min-w-0">
                    {person.title}
                  </ItemTitle>
                  <ItemDescription className="line-clamp-none">
                    {person.detail}
                  </ItemDescription>
                </ItemContent>
              </Item>
            </FragmentRow>
          ))}
        </ItemGroup>
      ) : null}

      {documents.length > 0 ? (
        <DocumentStrip caseId={caseId} documents={documents} />
      ) : null}
    </div>
  );
}

function FieldRow({ field }: { field: ComplaintField }) {
  return (
    <DescriptionRow>
      <DescriptionTerm>{field.term}</DescriptionTerm>
      <DescriptionDetails
        className={cn(
          field.empty ? "text-muted-foreground" : "font-medium"
        )}
      >
        {field.id ? (
          <Identifier value={field.value} label={field.term} />
        ) : (
          field.value
        )}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

function DocumentStrip({
  caseId,
  documents,
}: {
  caseId: string;
  documents: ComplaintDocument[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-body-compact font-semibold text-foreground">Documents</h3>
      <ul aria-label="Documents" className="flex gap-4 overflow-x-auto pb-1">
        {documents.map((doc) => (
          <li key={doc.id} className="w-48 shrink-0">
            <DocumentTile caseId={caseId} document={doc} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocumentTile({
  caseId,
  document,
}: {
  caseId: string;
  document: ComplaintDocument;
}) {
  const src = complaintDocumentSrc(document);
  const href = complaintDocumentHref(caseId, document);
  const preview = (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border",
        DOCUMENT_GROUND
      )}
    >
      <AspectRatio ratio={3 / 4}>
        {src ? (
          <DocumentThumbnail src={src} />
        ) : (
          <div className="flex size-full items-center justify-center">
            <p className="text-body-compact text-muted-foreground">Not uploaded</p>
          </div>
        )}
      </AspectRatio>
    </div>
  );

  if (!href) {
    return (
      <div className="flex flex-col gap-2">
        {preview}
        <p className="text-body-compact font-medium text-foreground">
          {document.label}
        </p>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {preview}
      <span className="text-body-compact font-medium text-foreground">
        {document.label}
      </span>
      <span className="text-caption font-medium text-muted-foreground">
        Open in case file
      </span>
    </Link>
  );
}

/** The first page as a still image; the tile's own link opens the document. */
function DocumentThumbnail({ src }: { src: string }) {
  const { url, page } = parsePdfSrc(src);
  return (
    <PdfViewer
      src={url}
      title=""
      thumbnail
      pages={page ? { from: page, to: page } : undefined}
      className="absolute inset-0 rounded-none"
    />
  );
}

function FragmentRow({
  first,
  children,
}: {
  first: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {first ? null : <ItemSeparator className="my-0" />}
      {children}
    </>
  );
}
