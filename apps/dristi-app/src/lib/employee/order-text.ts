/**
 * The order as one body of rich text — version B of the order composer
 * (`order-screen-b.tsx`), the text-box screen kept beside the block composer for A/B
 * testing (owner, 2026-10-12).
 *
 * Each order item's words are marked with the item's id (`ORDER_ITEM_ATTRIBUTE`), so a
 * re-answered item can write its corrected sentence where the old one stood and a removed
 * item can take out exactly what it wrote; the attendance and next-hearing lines are
 * marked as facts of the sitting (`upsertRichTextFact`). Carried over unchanged from the
 * text-box composer this replaced as version A.
 */

import type { RichTextValue } from "@/components/cases/rich-text-field";

import type { OrderRecitalLine } from "./order-draft";

/**
 * A plain sentence as the editor's own markup. `item` marks the paragraph as the words
 * one order item contributed — see `ORDER_ITEM_ATTRIBUTE`.
 */
export function richTextFromPlain(
  value: string,
  item?: string,
): RichTextValue {
  if (!value) return { html: "", text: "" };
  const mark = item ? ` ${ORDER_ITEM_ATTRIBUTE}="${item}"` : "";
  return { html: `<p${mark}>${escapeText(value)}</p>`, text: value };
}

/** The same escape, reachable on its own: a sentence is matched inside existing markup
 *  in the escaped form the editor holds it in, not in the plain form it was written
 *  in. */
function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Join what a template contributes onto what the order already says.
 *
 * A blank line between passages, not a space: the templates are whole directions and
 * running two of them into one paragraph would make the court say something neither of
 * them says. An empty side returns the other unchanged, so inserting `others` — which
 * has no standing words — leaves the box exactly as the typist left it.
 *
 * `text` is joined on the plain side and `html` on the markup side, because the two
 * halves answer different questions (`RichTextValue`): the markup is what the editor
 * shows, the text is what "has anything been written" is measured on.
 */
export function appendRichText(
  current: RichTextValue,
  addition: RichTextValue,
): RichTextValue {
  if (!addition.text && !addition.html) return current;
  if (!current.text && !current.html) return addition;
  /* **Above the line that closes the order, when one is there.** The posting is written
     into the passage as the sitting settles it (`upsertRichTextFact`), and on the
     ordinary flow it is settled *before* the first template is pulled in — the sheet is
     answered top to bottom. A plain concatenation would then put every direction the
     court passed after "Posted to 6 October 2026 for evidence.", which is an order
     closing before it says anything. What is added goes above that line; everything
     else appends as it did. */
  const closing = factBlock(CLOSING_FACT).exec(current.html);
  if (closing) {
    const html = `${current.html.slice(0, closing.index)}${addition.html}${current.html.slice(closing.index)}`;
    return { html, text: plainTextOfRichText(html) };
  }
  return {
    html: `${current.html}${addition.html}`,
    text: `${current.text}\n\n${addition.text}`,
  };
}

/**
 * Write a generated sentence into the passage, replacing the version of it already
 * there.
 *
 * A disposal is generated from a decision the bench made — "The application of the
 * accused for bail (CMP/312/2026) is allowed." — and a decision can be made twice: the
 * typist opens the answered row, looks at the application again, and dismisses what they
 * had allowed. Appending blindly would leave the order carrying both sentences, which is
 * a court record contradicting itself; skipping the second would leave it carrying the
 * wrong one. So the earlier wordings are passed in and the new sentence takes their
 * place, wherever they sit in the passage.
 *
 * `supersedes` carries every wording the same fact could have had, the new one included
 * — a second press of the same answer must not duplicate the sentence it already wrote.
 *
 * Only the sentence is swapped, not the paragraph around it, so a disposal the typist
 * has moved into a list or joined onto their own words keeps that shape. The limit of
 * that is stated rather than papered over: a sentence whose *words* have been edited no
 * longer matches, and a later change of decision appends a fresh one instead of
 * correcting the typist's own text. Rewriting a sentence somebody has taken over is the
 * worse failure of the two.
 */
export function upsertRichTextSentence(
  current: RichTextValue,
  sentence: string,
  supersedes: readonly string[],
): RichTextValue {
  for (const earlier of supersedes) {
    if (!earlier || !current.text.includes(earlier)) continue;
    return {
      html: current.html.split(escapeText(earlier)).join(escapeText(sentence)),
      text: current.text.split(earlier).join(sentence),
    };
  }
  return appendRichText(current, richTextFromPlain(sentence));
}

/**
 * **The mark that ties a passage in the order to the row that pulled it in.**
 *
 * The composer had no Remove for a pulled-in order until 2026-09-16, and the reason was
 * sound: the words become part of one passage the moment they land, so a Remove would
 * have had to *guess* which sentences were once a template's, and would either take out
 * text the typist had since written or leave text it claimed to have removed.
 *
 * The mark answers the objection instead of overriding it. The paragraph a template
 * writes carries the item's id, so the passage can be found exactly — and, just as
 * importantly, the reverse question can be asked exactly too: a row belongs in *Pulled
 * into this order* while a marked paragraph for it survives in the body, and not after.
 * A typist who selects the direction in the editor and deletes it has removed the row by
 * removing what the row was a record of (owner, 2026-09-16).
 *
 * It rides in the markup because that is the only thing the editor round-trips: the
 * field emits `innerHTML` verbatim (`components/cases/rich-text-field.tsx`), so an
 * attribute on a block survives typing inside it, splitting it, and formatting it, and
 * disappears exactly when the block does. Editing the *words* inside the paragraph
 * therefore keeps the row, which is the honest reading — the direction is still in the
 * order, in the court's or the typist's words.
 *
 * The one case it cannot answer: a browser command that replaces the block rather than
 * editing it — turning the paragraph into a list item, on some engines — drops the
 * attribute with it, and the row goes while the words stay. A row that has lost its
 * passage is the safer failure of the two, since the words are on the page beside it
 * where they can be read and deleted by hand.
 */
export const ORDER_ITEM_ATTRIBUTE = "data-order-item";

/** Does the order's markup still carry the passage this item wrote? */
export function richTextCarriesItem(html: string, id: string): boolean {
  return html.includes(`${ORDER_ITEM_ATTRIBUTE}="${id}"`);
}

/**
 * The order's markup with this item's passage taken out of it.
 *
 * Every block carrying the mark, not the first: pressing Enter inside a paragraph splits
 * it and the browser copies the attribute onto both halves, so one item can hold two
 * blocks by the time it is removed. The tag is whatever the block has become — a
 * paragraph the typist turned into a list item is still that item's passage.
 *
 * String surgery rather than a parse, so this stays pure and testable: the only thing
 * that has to be exact is the boundary of a marked block, and a block's own closing tag
 * is that boundary. Anything the typist nested *inside* it goes with it, which is the
 * point — the passage is being removed, not just the sentence it opened on.
 */
export function stripRichTextItem(html: string, id: string): string {
  const mark = `${ORDER_ITEM_ATTRIBUTE}="${escapeForPattern(id)}"`;
  const block = new RegExp(
    `<([a-z][a-z0-9]*)\\b[^>]*\\b${mark}[^>]*>[\\s\\S]*?</\\1>`,
    "gi",
  );
  return html.replace(block, "");
}

/** An id is a slug and a counter today; escaped anyway, so it cannot become syntax. */
function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The plain side of some markup, with the blocks joined the way `appendRichText` joins
 * them.
 *
 * `RichTextValue` carries both halves and they have to stay in step: `text` is what
 * "has anything been written" and the count of unfilled `[…]` slots are measured on, so
 * markup that has had a passage taken out of it needs its plain side rebuilt rather than
 * left describing the version before. The editor itself produces this half with
 * `innerText`; this is the same thing computed without a DOM, which keeps the removal
 * pure and testable — and the next keystroke replaces it with the browser's own reading
 * either way.
 */
export function plainTextOfRichText(html: string): string {
  return html
    .split(/<\/(?:p|li|div|h[1-6]|blockquote)>/i)
    .map((block) =>
      unescapeText(
        /* A break inside a block is a line inside it — which is what the recitals are
           made of (`OrderRecitalLine`), and what the editor's own `innerText` reads a
           `<br>` as. Before the tags are stripped, or it would vanish and run two
           labelled lines into one. */
        block.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""),
      ).trim(),
    )
    .filter(Boolean)
    .join("\n\n");
}

/** The inverse of `escapeText`, for reading the plain sentence back out of markup. */
function unescapeText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * The order with one pulled-in item's passage replaced by a freshly resolved one, in
 * place — what reopening the delivery-channel confirmation writes.
 *
 * The mark is what makes this safe where a disposal has to match on wording
 * (`upsertRichTextSentence`): an order item's passage is found by its id, exactly, so
 * correcting the addressee or the channels rewrites just that sentence and does not
 * reshuffle it to the end of the order the way remove-then-append would. Falls back to
 * appending when the mark is not there at all — the confirmation's first save, before
 * anything has been inserted.
 *
 * **The limit is the same one `upsertRichTextSentence` states.** Only the marked block
 * is replaced; if the drafter has since edited the words inside it, those words are
 * what gets replaced too. A screen that wants to preserve a hand edit instead has to
 * decide that for itself before calling this — nothing here can tell the difference.
 */
export function replaceOrderItemText(
  body: RichTextValue,
  id: string,
  next: RichTextValue,
): RichTextValue {
  const mark = `${ORDER_ITEM_ATTRIBUTE}="${escapeForPattern(id)}"`;
  const block = new RegExp(
    `<([a-z][a-z0-9]*)\\b[^>]*\\b${mark}[^>]*>[\\s\\S]*?</\\1>`,
    "i",
  );
  const found = block.exec(body.html);
  if (!found) return appendRichText(body, next);
  const html = `${body.html.slice(0, found.index)}${next.html}${body.html.slice(found.index + found[0].length)}`;
  return { html, text: plainTextOfRichText(html) };
}

/**
 * The order without the passage one pulled-in item wrote — both halves of it.
 *
 * Unchanged when the passage is already gone, so a removal the typist has performed for
 * themselves in the editor is not a second edit to the document.
 */
export function richTextWithoutItem(
  body: RichTextValue,
  id: string,
): RichTextValue {
  if (!richTextCarriesItem(body.html, id)) return body;
  const html = stripRichTextItem(body.html, id);
  return { html, text: plainTextOfRichText(html) };
}

/**
 * The items the order still carries, in the order they were pulled in.
 *
 * This is what the screen shows, counts and gates on, rather than the raw record of
 * every add: the list is a statement about what the document says now, and a row whose
 * passage the typist has deleted is a claim the page beside it contradicts. The record
 * itself keeps the removed entries, so an id is never handed out twice in one draft.
 */
export function orderItemsInBody<Item extends { id: string }>(
  items: readonly Item[],
  html: string,
): Item[] {
  return items.filter((item) => richTextCarriesItem(html, item.id));
}

/**
 * **The mark on a line the order carries because the sitting is known, not because
 * anybody wrote it.**
 *
 * Two of them: the roll, as attendance opens an order, and the posting, as the next date
 * closes it (owner, 2026-09-16 — marking attendance and setting the next hearing "should
 * also show up in the text box"). Both were printed beside the writing and nowhere in
 * it, which made them the two facts of the sitting a typist could read on the screen and
 * not correct in the order — the same objection that moved the application disposals
 * into the passage a day earlier.
 *
 * It is a *different* attribute from `ORDER_ITEM_ATTRIBUTE` on purpose. That mark means
 * "a row in the catalogue put these words here", and it is what *Pulled into this order*
 * lists and offers to take back out. A recital is not a pulled-in order and must not
 * appear in that list: nothing in the catalogue produced it, and removing it would mean
 * unmarking the roll rather than deleting a direction.
 */
const ORDER_FACT_ATTRIBUTE = "data-order-fact";

/** Which known fact of the sitting a marked line carries. */
export type OrderFactId = "attendance" | "next";


/** The recital as the order renders it: a bold label, its value, one line each. */
function recitalHtml(lines: readonly OrderRecitalLine[]): string {
  return lines
    .map(
      (line) =>
        `<strong>${escapeText(line.label)}:</strong> ${escapeText(line.value)}`,
    )
    .join("<br>");
}

/** The one that closes the order, and so the one a new passage is added above. */
const CLOSING_FACT: OrderFactId = "next";

/**
 * An empty line, as the editor itself writes one.
 *
 * `<p><br></p>` is what pressing Enter on an empty line produces in a contentEditable
 * region, so this is the same object the typist would have made by hand rather than a
 * shape only this code knows about. It carries nothing on the plain side —
 * `plainTextOfRichText` drops a block with no words in it — so an empty line is never
 * mistaken for an order having been written.
 */
const BLANK_BLOCK = "<p><br></p>";

/** Does the passage open on an empty line? */
function startsBlank(html: string): boolean {
  return /^\s*<p>(?:<br\s*\/?>|&nbsp;|\s)*<\/p>/i.test(html);
}

/** The passage without the empty line it opens on. */
function trimStartBlank(html: string): string {
  return html.replace(/^\s*<p>(?:<br\s*\/?>|&nbsp;|\s)*<\/p>/i, "");
}

/**
 * The passage with a stale mark taken off a block, its words left where they are.
 *
 * **The typist's sentence is never deleted to keep a recital tidy.** Pressing Enter
 * inside the recital splits it and the browser copies the mark onto both halves, so a
 * typist who put the caret at the end of the roll and wrote the order from there is
 * writing *inside a marked block* — and re-marking one office would then replace their
 * words along with the recital. The recital is rebuilt from the first marked block and
 * every other one simply stops being the roll's: the words stay on the page, in the
 * order, where they can be read and moved.
 *
 * The leftover is honest rather than invisible — half a recital may survive as ordinary
 * text for the typist to delete. That is the safer failure of the two, and the same
 * reading `ORDER_ITEM_ATTRIBUTE` takes about a row that has lost its passage.
 */
function unmarkFacts(html: string, fact: OrderFactId): string {
  return html.replace(
    new RegExp(`\\s*${ORDER_FACT_ATTRIBUTE}="${escapeForPattern(fact)}"`, "gi"),
    "",
  );
}

/**
 * One marked block, with its tag and its attributes kept apart from its contents.
 *
 * The tag and the attribute list are captured because an upsert reuses them: a recital
 * the typist has turned into a list item or emphasised stays that, and only the words
 * inside it are re-written. Same string surgery and the same reasoning as
 * `stripRichTextItem` — a block's own closing tag is the one boundary that has to be
 * exact.
 */
function factBlock(fact: OrderFactId): RegExp {
  return new RegExp(
    `<([a-z][a-z0-9]*)\\b([^>]*\\b${ORDER_FACT_ATTRIBUTE}="${escapeForPattern(fact)}"[^>]*)>[\\s\\S]*?</\\1>`,
    "i",
  );
}

/**
 * Write what the sitting now says into the order, over the version of it already there.
 *
 * The roll is re-recited as it is called — one office at a time, so the line grows under
 * the typist's hand — and the posting is re-recited when it changes. The mark is what
 * makes that safe where `upsertRichTextSentence` had to match on words: the line can be
 * found exactly, so re-marking an appearance corrects the recital instead of leaving the
 * order carrying two versions of who was present.
 *
 * **The limit, stated rather than papered over:** words the typist has written *inside*
 * the recital are replaced when the roll changes, because the roll is where that line
 * comes from. The trade is the opposite of the one a disposal makes, and deliberately:
 * a disposal is identified only by its own wording, so rewriting it would risk taking
 * over a sentence somebody else now owns, while a recital is identified by its mark and
 * a stale roll in a court order is the worse failure. The typist's own prose belongs in
 * the paragraphs around it, which are never touched.
 *
 * No lines takes the recital out — an unmarked roll recites nothing rather than standing
 * in the order as a line about nobody. Every marked block goes and one comes back where
 * the first of them stood: pressing Enter inside the recital splits it and the browser
 * copies the mark onto both halves, so a lone replacement would leave the second half
 * behind as a stale copy of the roll.
 *
 * The plain half is rebuilt from the markup rather than tracked alongside it, for the
 * reason `plainTextOfRichText` exists: the two halves of a `RichTextValue` answer
 * different questions and have to stay in step.
 */
export function upsertRichTextFact(
  body: RichTextValue,
  fact: OrderFactId,
  lines: readonly OrderRecitalLine[],
): RichTextValue {
  const inner = recitalHtml(lines);
  const found = factBlock(fact).exec(body.html);
  if (found) {
    const line = inner ? `<${found[1]}${found[2]}>${inner}</${found[1]}>` : "";
    const head = body.html.slice(0, found.index);
    /* The block being replaced goes; anything else still wearing the mark only loses it
       (`unmarkFacts`). And when the recital itself is going and it stood at the head of
       the passage, the empty line it was given to write under goes with it rather than
       leaving the order opening on a blank. */
    let rest = unmarkFacts(
      body.html.slice(found.index).replace(factBlock(fact), ""),
      fact,
    );
    if (!inner && !head) rest = trimStartBlank(rest);
    const html = `${head}${line}${rest}`;
    return { html, text: plainTextOfRichText(html) };
  }
  if (!inner) return body;
  const line = `<p ${ORDER_FACT_ATTRIBUTE}="${fact}">${inner}</p>`;
  /* The roll opens the order and the posting closes it, which is the order a court reads
     them in and the only placement either line has. Where the typist has since *moved*
     one, the branch above keeps it there: this decides where a line first lands, not
     where it must stay.

     **The roll arrives with an empty line under it** (owner, 2026-09-16: after marking
     attendance "I should always start at least two lines below"). It is not there for the
     gap — the box spaces its blocks itself — but for the caret: without it the nearest
     place to write is the end of the recital, which is inside a marked block, and what
     gets written there is the roll's to overwrite. One empty line makes the natural place
     to click a paragraph of the typist's own. Only on the first calling, and only when
     the passage does not already open on one, so it can never stack up. */
  const html =
    fact === CLOSING_FACT
      ? `${body.html}${line}`
      : `${line}${startsBlank(body.html) ? "" : BLANK_BLOCK}${body.html}`;
  return { html, text: plainTextOfRichText(html) };
}

/** One order in the draft: what it is, and the words it carries. */
