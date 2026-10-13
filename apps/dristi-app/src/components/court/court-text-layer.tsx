"use client";

import * as React from "react";

import { useCourt } from "@/components/court/court-provider";
import { localizeCourtText } from "@/lib/court/localize";
import { SCRIPT_LANG } from "@/lib/court/places";

/**
 * Every word the app shows, in the selected state's terms — the switch's safety net.
 *
 * The fixtures are written in Kerala's terms and are read by a few hundred screens, rows,
 * cells and dialogs. Re-voicing them one render site at a time (`useCourtText`,
 * `Identifier`, the document facsimiles) covered the court's own name and numbers but
 * left the long tail — a party's address, a police station, a Bar number in a table — in
 * Kerala, which is what the owner's review found (2026-10-08). So for any state but
 * Kerala, this layer passes the rendered page itself through `localizeCourtText`: text,
 * and the labels a screen reader or a tooltip reads (`aria-label`, `title`, `placeholder`,
 * `alt`), now and on every later render.
 *
 * What it does not touch, on purpose:
 * - what a person types or edits — inputs, text areas, and `contenteditable` editors such
 *   as the order composer, whose generated text is re-voiced at its source instead;
 * - anything marked `data-court-raw`, such as Settings' own court cards, which must show
 *   each state in its own terms whichever one is selected.
 *
 * It only changes nodes React has already hydrated (`owned`), so React's server and
 * client output still agree; parts of a page that hydrate later are picked up by the
 * next sweep. Until nothing is left waiting, the root carries `data-court-pending` and
 * the page stays hidden (`chrome.css`), with a time-boxed reveal so a failed script can
 * never leave it blank. It only ever
 * rewrites towards the selected state and Kerala needs nothing, so switching courts
 * reloads the page (`CourtProvider`) rather than trying to undo it.
 *
 * ENGINEERING SEAM — this is the design prototype's way of showing a state from Kerala
 * fixtures. A live deployment gets the state's own data and configuration from its
 * backend (MDMS) and needs no layer at all.
 */
const ATTRS = ["aria-label", "title", "placeholder", "alt"];
const SKIP = [
  "script",
  "style",
  "noscript",
  "textarea",
  "input",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[data-court-raw]",
].join(",");
const ATTR_SKIP = ["[contenteditable='']", "[contenteditable='true']", "[data-court-raw]"].join(",");

/**
 * Whether React has taken this node over yet. Hydration stamps every node it adopts with
 * a fiber key; a part of the page still waiting to hydrate (a Suspense boundary that
 * resolves later) has none, and changing its text before React compares it with the
 * server's would be a hydration mismatch. Such nodes are left for a later pass.
 */
function owned(node: Node): boolean {
  // React's stamp is an own property; `for…in` would also walk every inherited DOM one.
  return Object.keys(node).some((key) => key.startsWith("__reactFiber$"));
}

/**
 * Later passes, for the parts of a page that hydrate after the first one: every
 * `SWEEP_MS` until nothing is left waiting on React, for at most `SWEEP_FOR_MS`. A busy
 * page can take seconds to hydrate, and a fixed schedule ran out before it did.
 */
const SWEEP_MS = 150;
const SWEEP_FOR_MS = 10000;

export function CourtTextLayer() {
  const { court } = useCourt();

  React.useEffect(() => {
    const root = document.documentElement;
    if (court === "kerala") {
      root.removeAttribute("data-court-pending");
      return;
    }
    const voice = (text: string) => localizeCourtText(text, court);
    const skipped = (el: Element | null) => !el || el.closest(SKIP) !== null;
    // Labels on a field are fair game even though its value is not.
    const attrSkipped = (el: Element) => el.closest(ATTR_SKIP) !== null;
    /** Nodes that still need a change but are not React's yet. */
    let waiting = 0;

    const text = (node: Text) => {
      if (skipped(node.parentElement)) return;
      const before = node.nodeValue;
      if (!before || !before.trim()) return;
      const after = voice(before);
      if (after === before) return;
      // React stamps the element that holds a text node, not the text node itself.
      if (!node.parentElement || !owned(node.parentElement)) {
        waiting++;
        return;
      }
      node.nodeValue = after;
    };
    const scriptLang = SCRIPT_LANG[court];
    const attrs = (el: Element) => {
      if (attrSkipped(el)) return;
      const lang = scriptLang && el.getAttribute("lang") === "ml";
      const changes: [string, string][] = [];
      for (const name of ATTRS) {
        const before = el.getAttribute(name);
        if (!before) continue;
        const after = voice(before);
        if (after !== before) changes.push([name, after]);
      }
      if (!lang && changes.length === 0) return;
      if (!owned(el)) {
        waiting++;
        return;
      }
      // A name the data marks as Malayalam is shown in the state's script, so it is
      // announced in that language too.
      if (lang) el.setAttribute("lang", scriptLang);
      for (const [name, after] of changes) el.setAttribute(name, after);
    };
    const walk = (start: Node) => {
      if (start.nodeType === Node.TEXT_NODE) return text(start as Text);
      if (start.nodeType !== Node.ELEMENT_NODE) return;
      attrs(start as Element);
      const walker = document.createTreeWalker(
        start,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      );
      let node = walker.nextNode();
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) text(node as Text);
        else attrs(node as Element);
        node = walker.nextNode();
      }
    };
    const title = () => {
      const after = voice(document.title);
      if (after !== document.title) document.title = after;
    };
    /** A whole-page pass; the page is shown once nothing is left waiting on React. */
    const sweep = (last: boolean) => {
      waiting = 0;
      walk(document.body);
      title();
      if (waiting === 0 || last) root.removeAttribute("data-court-pending");
    };

    sweep(false);
    const started = Date.now();
    const timer = window.setInterval(() => {
      const last = Date.now() - started >= SWEEP_FOR_MS;
      sweep(last);
      if (waiting === 0 || last) window.clearInterval(timer);
    }, SWEEP_MS);

    const page = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") text(record.target as Text);
        else if (record.type === "attributes") attrs(record.target as Element);
        else record.addedNodes.forEach(walk);
      }
    });
    page.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS, "lang"],
    });
    const head = new MutationObserver(title);
    head.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      window.clearInterval(timer);
      page.disconnect();
      head.disconnect();
    };
  }, [court]);

  return null;
}
