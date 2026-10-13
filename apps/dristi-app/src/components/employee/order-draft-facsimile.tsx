import { useCourtLocalized } from "@/components/court/court-provider";
import type { OrderDocument } from "@/lib/employee/order-draft";

/**
 * The draft order as paper — the same facsimile treatment the signing queues use
 * (`sign-order-dialog.tsx`'s `OrderFacsimile`), bound to an order still being drafted.
 *
 * One component for both doors onto the composer (a hearing, a complaint at
 * cognizance), reading the one `OrderDocument` shape `order-draft.ts` builds — two
 * renderings of the same draft would be two answers to what the order says.
 */
export function OrderDraftFacsimile({
  document: storedDocument,
}: {
  document: OrderDocument;
}) {
  /* Voiced for the court chosen in settings, as every paper on the court side is. */
  const document = useCourtLocalized(storedDocument);
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{document.court}</p>
        <p className="text-body font-semibold">Case no. {document.caseNumber}</p>
        <p className="text-body font-semibold">{document.matter}</p>
      </header>

      <h3 className="text-center text-body font-semibold">{document.title}</h3>

      {document.paragraphs.length === 0 ? (
        <p className="text-body text-paper-muted-foreground">
          No order has been written.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {document.paragraphs.map((paragraph, index) => (
            <p key={index} className="text-body whitespace-pre-wrap">
              {paragraph}
            </p>
          ))}
        </div>
      )}

      <p className="text-body">Dated this the {document.dated}.</p>

      <p className="text-body text-paper-muted-foreground">{document.signature}</p>
    </article>
  );
}
