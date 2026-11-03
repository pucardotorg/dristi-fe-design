/**
 * The two rules behind an inline completion in a `contentEditable` region: when the
 * reader has asked for one, and how the preview is kept out of the document.
 *
 * Both are here as pure functions rather than inside the field, because both are
 * load-bearing in ways a rendered check cannot prove. The trigger has to be wrong on
 * none of the slash-bearing text this court writes, and the strip is the only thing
 * standing between a *preview* and the words of a signed order.
 */

/**
 * The mark on a preview node. Everything carrying it is decoration: it is
 * `contentEditable={false}`, `aria-hidden`, and removed before the field reports a
 * value.
 */
export const GHOST_ATTRIBUTE = "data-ghost";

/**
 * The markup with every preview node taken out of it.
 *
 * The field removes the node from the DOM before it reads a value, so in the ordinary
 * path this finds nothing. It runs anyway, at the one place a value leaves the field: a
 * preview that reached `onChange` would be saved into the draft, printed on the page
 * beside the composer, and signed — so the cost of being wrong here is not a visual
 * defect, and one guarded chokepoint is cheaper than an argument about whether every
 * path removes the node first.
 */
export function stripGhostHtml(html: string): string {
  const node = new RegExp(
    `<([a-z][a-z0-9]*)\\b[^>]*\\b${GHOST_ATTRIBUTE}\\b[^>]*>[\\s\\S]*?</\\1>`,
    "gi",
  );
  return html.replace(node, "");
}

/** How long a word can get before it stops being a search for a standing order. */
const MAX_QUERY = 40;

/**
 * How much has to be typed before anything is offered: nothing past the slash.
 *
 * **The bare slash opens the list** (owner, 2026-10-29: *a small container opens up and
 * shows all the shortcuts*, as Notion's slash menu does). It used to wait for two
 * characters (owner, 2026-09-16), because what it offered then was one inline guess, and
 * a guess before a word is typed is arbitrary. A list is not a guess — it shows every
 * answer and lets the typing narrow it — so the reason for the wait went with the guess.
 */
const MIN_QUERY = 0;

/**
 * What the reader has typed after the trigger, or `null` when they have not asked for a
 * suggestion at all.
 *
 * `before` is the text of the current block up to the caret.
 *
 * **The trigger only counts at a word boundary, and this is not a detail in this court.**
 * An order sheet is full of slashes: the case is `ST/241/2026`, the application is
 * `CMP/312/2026`, and the court's own standing words include *"Particulars of offences
 * u/s.138 of NI Act were read over"*. A completion that armed on every slash would fire
 * in the middle of a case number several times a page. So the character before it must
 * be nothing or a space, and:
 *
 * - a digit straight after it is a date or a fraction, not a search (`/2026`);
 * - a space straight after it is prose — "and / or" — and never a search;
 * - past `MAX_QUERY` the reader is writing, and a stray slash a paragraph ago should not
 *   still be arming anything.
 *
 * Spaces *inside* the query are allowed, because "issue of summons" is a reasonable way
 * to look for it. What ends the search then is the corpus rather than this rule: the
 * caller drops the suggestion the moment nothing answers what has been typed.
 *
 * The slash alone is a search for everything (`MIN_QUERY`); the word narrows it.
 */
export function readSuggestTrigger(before: string): string | null {
  const slash = before.lastIndexOf("/");
  if (slash < 0) return null;
  const preceding = before[slash - 1];
  if (preceding !== undefined && !/\s/.test(preceding)) return null;
  const query = before.slice(slash + 1);
  if (query.length > MAX_QUERY || query.length < MIN_QUERY) return null;
  if (/^[\s\d]/.test(query)) return null;
  return query;
}

/**
 * Which answer to show, given the one already showing.
 *
 * **Hysteresis, and it is the difference between this feeling finished and feeling
 * broken.** The answers are recomputed on every keystroke and the best of them moves as
 * the query narrows, so a completion that always showed the top match would swap the
 * passage under the reader's eyes while they typed into it. This holds the one they are
 * looking at for as long as it is still an answer, and moves only when it stops being
 * one.
 *
 * `index` is the reader's own cycling, and it wins outright: having asked for the second
 * answer they keep it, and it comes round at the end rather than dead-ending.
 */
export function pickSuggestion<Answer extends { key: string }>(
  answers: readonly Answer[],
  held: string | null,
  index: number,
): Answer | null {
  if (answers.length === 0) return null;
  if (index > 0) return answers[index % answers.length] ?? null;
  const keep = held && answers.find((answer) => answer.key === held);
  return keep || answers[0];
}

/**
 * Where in a name the typed query was found — what the slash menu sets in bold — by the
 * same order the shortcuts are ranked in: the start of the name, then the start of a
 * word, then anywhere. `null` when the query is empty or not in the name.
 */
export function matchSpan(
  name: string,
  query: string,
): { start: number; end: number } | null {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return null;
  const lower = name.toLowerCase();
  let start = lower.startsWith(wanted) ? 0 : -1;
  if (start < 0) {
    const word = new RegExp(`\\s${escapeRegExp(wanted)}`).exec(lower);
    start = word ? word.index + 1 : lower.indexOf(wanted);
  }
  return start < 0 ? null : { start, end: start + wanted.length };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `Node.ELEMENT_NODE`, spelled out: this module is read by tests that have no DOM. */
const ELEMENT_NODE = 1;

/**
 * Which node the preview can be appended to, for a caret sitting anywhere in an editor.
 *
 * **This decision broke the feature twice, which is why it is a function with tests
 * rather than four lines inside a handler.**
 *
 * - An empty order box holds no paragraph, so the caret's container is a bare *text
 *   node* — and a text node cannot take a child, so appending the preview to it threw
 *   and typing `/` did nothing at all.
 * - An empty box that has not been typed into at all puts the caret *on the editor*, and
 *   a walk looking for "the child of the editor I am under" then leaves the editor and
 *   climbs to `<html>`, which is where the preview would have gone.
 *
 * So: the nearest child of the editor, if that child is an element; the editor itself for
 * a bare text node or a caret on the editor; and nothing at all for a caret outside it.
 * `before` is measured from whatever comes back and the trigger is searched for in the
 * same node, so the two always agree about coordinates.
 */
export function suggestionHost(editor: Node, caret: Node): Node | null {
  let child: Node | null = caret;
  while (child && child !== editor && child.parentNode !== editor) {
    child = child.parentNode;
  }
  if (!child) return null;
  return child !== editor && child.nodeType === ELEMENT_NODE ? child : editor;
}

/**
 * How much of a sentence has to be typed before it is completed unasked.
 *
 * Four, and higher than the trigger's two on purpose: a completion the reader asked for
 * with a slash can afford to be eager, while one that arrives *while they are writing*
 * is interrupting. "At the request of the complainant…" begins with "At", which opens a
 * great many sentences a court writes; four characters is where the prefix starts to be
 * about that sentence rather than about the language.
 */
const MIN_PROSE = 4;

/**
 * The sentence being typed, for completing prose with no trigger at all.
 *
 * **Why there is a second rule.** The slash is the right way to name one of the court's
 * twenty-seven standing orders, because the typist is not writing those words — they are
 * choosing a form. It is the wrong way to write a sentence they *are* in the middle of:
 * typing `/hea` to get "Heard both sides." means typing a character you did not want,
 * having it deleted again, and reading a menu of one (owner, 2026-09-16: *the
 * interaction is not fluid at all, looks forced*). So prose completes from itself.
 *
 * What comes back is the text since the last sentence ended, which is what a sentence in
 * the corpus would have to begin with to be the one being written. A slash anywhere in
 * it hands the question back to `readSuggestTrigger`, so the two rules never both answer.
 */
export function readProsePrefix(before: string): string | null {
  const ended = Math.max(
    before.lastIndexOf(". "),
    before.lastIndexOf("? "),
    before.lastIndexOf("! "),
  );
  const prefix = (ended < 0 ? before : before.slice(ended + 2)).trimStart();
  if (!prefix || prefix.includes("/")) return null;
  if (prefix.length < MIN_PROSE) return null;
  return prefix;
}
