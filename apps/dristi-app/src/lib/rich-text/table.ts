/**
 * Tables in the rich text field — the markup a new one starts as, and the handful of
 * edits a typist makes to one once it is on the page.
 *
 * The field's other formatting comes from `document.execCommand`, which has no table
 * commands, so these work on the DOM directly. They only ever produce plain
 * `<table><thead>/<tbody><tr><th>/<td>` with no attributes: the field's value is
 * rendered later with `dangerouslySetInnerHTML`, and nothing that reaches it may carry
 * an inline style or a handler. Every cell is one cell — no `colspan` or `rowspan` is
 * ever written — so a column is simply "the n-th cell of each row".
 *
 * The string builder is pure and tested; the DOM edits run in the browser only.
 */

/** What "Insert table" puts in: three columns, a header row and two body rows. */
export const DEFAULT_TABLE = { columns: 3, rows: 3 } as const;

/** An empty cell holds a `<br>` so it has a line height and the caret can land in it. */
const EMPTY = "<br>";

/**
 * A blank table, `rows` counting the header row. Followed by an empty paragraph so a
 * table at the end of the text is never the last thing in it — there would be nowhere
 * to put the caret to carry on writing beneath it.
 */
export function tableHtml(
  columns: number = DEFAULT_TABLE.columns,
  rows: number = DEFAULT_TABLE.rows,
): string {
  const cols = Math.max(1, Math.floor(columns));
  const bodyRows = Math.max(0, Math.floor(rows) - 1);
  const row = (tag: "th" | "td") =>
    `<tr>${`<${tag}>${EMPTY}</${tag}>`.repeat(cols)}</tr>`;
  const head = `<thead>${row("th")}</thead>`;
  const body = bodyRows > 0 ? `<tbody>${row("td").repeat(bodyRows)}</tbody>` : "";
  return `<table>${head}${body}</table><p>${EMPTY}</p>`;
}

/** Whether a piece of markup carries a table — it must not be put inside another. */
export function hasTable(html: string): boolean {
  return /<table[\s>]/i.test(html);
}

/* ───────────────────────────── browser-only edits ───────────────────────────── */

type Cell = HTMLTableCellElement;

/** The cell the caret is in, if it is in a table inside `editor`. */
export function cellAt(editor: Node, node: Node | null): Cell | null {
  let current: Node | null = node;
  while (current && current !== editor) {
    if (
      current.nodeType === 1 &&
      ((current as Element).tagName === "TD" || (current as Element).tagName === "TH")
    ) {
      return editor.contains(current) ? (current as Cell) : null;
    }
    current = current.parentNode;
  }
  return null;
}

function tableOf(cell: Cell): HTMLTableElement | null {
  return cell.closest("table");
}

function cellsOf(table: HTMLTableElement): Cell[] {
  return Array.from(table.querySelectorAll<Cell>("th, td")).filter(
    (cell) => cell.closest("table") === table,
  );
}

function rowsOf(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.rows);
}

function blankCell(tag: "th" | "td"): Cell {
  const cell = document.createElement(tag) as Cell;
  cell.innerHTML = EMPTY;
  return cell;
}

/** Put the caret at the start of a cell. */
export function caretInto(cell: Element | null): void {
  if (!cell) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * The cell Tab (or Shift+Tab) moves to, in reading order. `null` past either end: at
 * the start the browser's own Shift+Tab leaves the field; at the end the caller adds a
 * row, the convention every word processor follows.
 */
export function siblingCell(cell: Cell, step: 1 | -1): Cell | null {
  const table = tableOf(cell);
  if (!table) return null;
  const cells = cellsOf(table);
  return cells[cells.indexOf(cell) + step] ?? null;
}

/**
 * A body row under the cell's row. Under the header row it opens the body (creating it
 * if the table had none), so a header row never grows a second header beneath it.
 */
export function addRowBelow(cell: Cell): Cell | null {
  const row = cell.parentElement as HTMLTableRowElement | null;
  const table = tableOf(cell);
  if (!row || !table) return null;
  const next = document.createElement("tr");
  for (let i = 0; i < row.cells.length; i++) next.appendChild(blankCell("td"));
  if (row.parentElement?.tagName === "THEAD") {
    let body = table.tBodies[0];
    if (!body) {
      body = document.createElement("tbody");
      table.appendChild(body);
    }
    body.insertBefore(next, body.firstChild);
  } else {
    row.after(next);
  }
  return next.cells[0] ?? null;
}

/** A column to the right of the cell's, with a header cell where the header row is. */
export function addColumnRight(cell: Cell): Cell | null {
  const table = tableOf(cell);
  if (!table) return null;
  const index = cell.cellIndex;
  let mine: Cell | null = null;
  for (const row of rowsOf(table)) {
    const tag = row.parentElement?.tagName === "THEAD" ? "th" : "td";
    const added = blankCell(tag);
    const anchor = row.cells[index];
    if (anchor) anchor.after(added);
    else row.appendChild(added);
    if (row === cell.parentElement) mine = added;
  }
  return mine;
}

/**
 * Remove a table and leave the caret where it stood. Returns the element the caret
 * should go to — the paragraph after it, which `tableHtml` always writes.
 */
export function deleteTable(cell: Cell): Element | null {
  const table = tableOf(cell);
  if (!table) return null;
  const after = table.nextElementSibling ?? table.previousElementSibling;
  table.remove();
  return after;
}

/** Remove the cell's row; the last row going takes the table with it. */
export function deleteRow(cell: Cell): Element | null {
  const row = cell.parentElement as HTMLTableRowElement | null;
  const table = tableOf(cell);
  if (!row || !table) return null;
  if (table.rows.length <= 1) return deleteTable(cell);
  const index = cell.cellIndex;
  const rows = rowsOf(table);
  const at = rows.indexOf(row);
  const section = row.parentElement;
  row.remove();
  if (section && section.children.length === 0) section.remove();
  const land = rowsOf(table)[Math.min(at, table.rows.length - 1)];
  return land?.cells[Math.min(index, land.cells.length - 1)] ?? null;
}

/** Remove the cell's column; the last column going takes the table with it. */
export function deleteColumn(cell: Cell): Element | null {
  const row = cell.parentElement as HTMLTableRowElement | null;
  const table = tableOf(cell);
  if (!row || !table) return null;
  if (row.cells.length <= 1) return deleteTable(cell);
  const index = cell.cellIndex;
  for (const each of rowsOf(table)) each.cells[index]?.remove();
  return row.cells[Math.min(index, row.cells.length - 1)] ?? null;
}

/**
 * A table must never be the editor's last child: with nothing after it, there is no
 * line to click into to write beneath it. Run after anything that may have put one at
 * the end.
 */
export function ensureLineAfterTables(editor: HTMLElement): void {
  const last = editor.lastElementChild;
  if (last?.tagName === "TABLE") {
    const line = document.createElement("p");
    line.innerHTML = EMPTY;
    editor.appendChild(line);
  }
}
