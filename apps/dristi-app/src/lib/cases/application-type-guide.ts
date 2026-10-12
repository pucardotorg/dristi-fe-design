/**
 * What each application type asks the court for, and the search that finds it
 * from a sentence.
 *
 * The descriptions are the only place the chooser explains a type, so each one
 * states the ask in the words of the filer and stays inside what that type's
 * form actually collects (`application-type-fields.tsx`) and what the national
 * process supports (`docs/product/domain/journey.md`). No type promises a
 * field or an outcome the flow does not have.
 *
 * The substance of the law, never its citation. "Sufficient cause" and
 * "compounded" are the real statutory standards and are the words a filer
 * meets in court, so they stay; the section numbers behind them do not appear
 * anywhere in the UI. A number on a card face is something to look up, not
 * something to decide by.
 *
 * Each line also has to survive two other places: the chosen-type card on the
 * second step, where there is no grid to refer to, and the card's aria-label,
 * read aloud as "<label>: <description>". So none of them points at the screen
 * around it, and each stays short enough for a three-up card to hold without
 * clamping.
 *
 * The search is a local keyword match, not a language model: a filer types the
 * request the way they would say it, the words every request shares ("I want
 * to file…") are dropped, and what is left is scored against each type's own
 * vocabulary. Nothing leaves the browser, and a miss costs nothing — every
 * type stays on the screen, ranked rather than hidden.
 */
import type { LucideIcon } from "lucide-react";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  SignatureIcon,
  UserPenIcon,
  UserPlusIcon,
  FileSearchIcon,
  FolderOpenIcon,
  HourglassIcon,
  LandmarkIcon,
  LockOpenIcon,
  PenLineIcon,
  SendIcon,
  Undo2Icon,
  UserXIcon,
  UsersIcon,
} from "lucide-react";

import { APPLICATION_TYPES, type ApplicationTypeId } from "./applications";
import type { ActiveStage } from "./types";

export type ApplicationTypeGuide = {
  id: ApplicationTypeId;
  label: string;
  /** One line: what this asks the court to do. */
  description: string;
  /**
   * The card's picture of the ask — one per type, all eight distinct, all from
   * the DS icon allowlist. Decorative to assistive tech: the title beside it
   * already names the type.
   */
  icon: LucideIcon;
  /** How a filer might say it. Phrases match only against the whole sentence. */
  keywords: string[];
};

const GUIDES: ApplicationTypeGuide[] = [
  {
    id: "absent-application",
    label: "Absent application",
    description:
      "Ask to be excused from attending a hearing, with the reason you cannot appear.",
    icon: UserXIcon,
    keywords: [
      "absent",
      "absence",
      "exemption",
      "exempt",
      "excused",
      "cannot attend",
      "unable to attend",
      "not present",
      "personal appearance",
      "leave of absence", "sick", "ill", "unwell", "hospital", "medical", "travel", "travelling", "abroad", "out of station", "attend", "cant", "cannot come", "not come", "unavailable",
    ],
  },
  /* The PRD splits what was one Advancement/reschedule card into two asks.
     Nothing in its fields tells them apart but the direction, so the two
     cards share one form (PRD "Advance (Prepone) / Postpone"). */
  {
    id: "advancement-reschedule",
    label: "Advance (prepone)",
    description: "Ask for a listed hearing to be moved to an earlier date.",
    icon: CalendarDaysIcon,
    keywords: [
      "advance",
      "advancement",
      "prepone",
      "reschedule",
      "hearing",
      "earlier date",
      "sooner",
      "change the date", "earlier", "urgent", "bring forward",
    ],
  },
  {
    id: "postpone",
    label: "Postpone",
    description: "Ask for a listed hearing to be moved to a later date.",
    icon: CalendarClockIcon,
    keywords: [
      "postpone",
      "postponement",
      "adjourn",
      "adjournment",
      "defer",
      "reschedule",
      "hearing",
      "later date",
      "another date",
      "next date", "later", "push", "delay the hearing", "not ready",
    ],
  },
  {
    id: "addition-of-witness",
    label: "Addition of witness",
    description: "Ask for a witness to be added to the case.",
    icon: UserPlusIcon,
    keywords: ["witness", "add witness", "new witness", "examine", "summon"],
  },
  {
    id: "edit-litigant-details",
    label: "Edit litigant details",
    description: "Ask for a correction to a litigant's details on the case.",
    icon: UserPenIcon,
    keywords: [
      "correct",
      "correction",
      "edit",
      "change name",
      "address",
      "details",
      "litigant", "wrong", "mistake", "spelling", "phone number",
    ],
  },
  {
    id: "poa-change",
    label: "PoA change",
    description: "Ask to change who holds a litigant's power of attorney.",
    icon: SignatureIcon,
    keywords: ["power of attorney", "poa", "attorney", "holder", "authorise"],
  },
  {
    id: "bail",
    label: "Bail",
    // The petitioner here is the accused, not the complainant — the one place
    // in the chooser where naming the wrong party would send someone into the
    // wrong form entirely.
    description:
      "Ask for the accused to be released on bail, with grounds and any surety.",
    icon: LockOpenIcon,
    keywords: [
      "bail",
      "surety",
      "sureties",
      "bond",
      "release",
      "custody",
      "arrest",
      "warrant",
      "bail bond", "jail", "prison", "remand", "get out",
    ],
  },
  {
    id: "condonation-of-delay",
    label: "Delay condonation",
    // "Sufficient cause" is the standard the court actually applies to a delay
    // beyond the limitation period, and the form asks for exactly that reason.
    description:
      "Ask the court to accept a filing made late, showing sufficient cause.",
    icon: HourglassIcon,
    keywords: [
      "condone",
      "condonation",
      "delay",
      "delayed",
      "late",
      "limitation",
      "deadline",
      "time barred",
      "beyond time",
      "out of time",
      "missed the date",
    ],
  },
  {
    id: "production-of-documents",
    label: "Production of documents",
    // The form takes a reason and an optional list of documents — it has no
    // field for who holds a record, so the line cannot promise one.
    description:
      "Ask for documents to be brought on record, with the reason you need them.",
    icon: FileSearchIcon,
    keywords: [
      "produce",
      "production",
      "summon",
      "records",
      "statement",
      "call for",
      "bank records",
      "account records",
      "documents from",
      "bring the documents", "bank", "statements", "bring",
    ],
  },
  {
    id: "reopen-evidence",
    label: "Reopen evidence",
    description:
      "Ask the court to reopen evidence already closed, with your grounds.",
    icon: FolderOpenIcon,
    keywords: [
      "reopen",
      "re-open",
      "reopen evidence",
      "recall witness",
      "further evidence",
      "additional evidence",
      "closed evidence",
      "lead evidence",
    ],
  },
  {
    id: "settlement",
    label: "Case settlement",
    // The offence is compoundable at any stage, so the parties may settle and
    // close the case. The form places the settlement on record; the compounding
    // is the court's, which is why the line says "can be". It is the offence
    // that is compounded, never the case — a filer who reads it the other way
    // is being taught the wrong word for the thing they are asking for.
    description:
      "Place a settlement on record so the offence can be compounded and the case closed.",
    icon: UsersIcon,
    keywords: [
      "settle",
      "settlement",
      "settled",
      "compound",
      "compounding",
      "compromise",
      "mediation",
      "mutual",
      "close the case",
      "paid the amount",
    ],
  },
  {
    id: "transfer",
    label: "Case transfer",
    description:
      "Ask for the case to be moved to a different court, with your grounds.",
    icon: LandmarkIcon,
    keywords: [
      "transfer",
      "shift",
      "another court",
      "different court",
      "move the case",
      "jurisdiction", "move", "different judge",
    ],
  },
  {
    id: "warrant-by-hand",
    label: "Warrant by hand",
    description:
      "Take a warrant by hand to serve it yourself, instead of the usual court process.",
    icon: SendIcon,
    keywords: [
      "warrant by hand",
      "dasti",
      "dasti warrant",
      "serve warrant",
      "execute warrant",
      "hand warrant",
      "personal service",
      "process by hand",
    ],
  },
  {
    id: "withdrawal",
    label: "Case withdrawal",
    /* The PRD's "Case withdrawal": the complaint itself, which is what the
       generated document and the order template already said. */
    description: "Ask to withdraw the complaint, with your reason.",
    icon: Undo2Icon,
    keywords: [
      "withdraw",
      "withdrawal",
      "take back",
      "drop",
      "do not pursue",
      "cancel the filing", "drop the case", "stop the case", "end the case",
    ],
  },
  {
    id: "application-others",
    label: "Generic",
    // Never "the types above": this same line is read on the second step, where
    // there is no grid, and aloud from the card's aria-label.
    description:
      "A request the other types do not cover. Say what you need in your own words.",
    icon: PenLineIcon,
    keywords: ["other", "others", "something else", "not listed", "general"],
  },
];

/**
 * The catalogue in the order the picker lists it: alphabetical by label,
 * Others last. Sorted here rather than kept sorted by hand, so a type added
 * to the list above lands in its place.
 */
export const APPLICATION_TYPE_GUIDES: ApplicationTypeGuide[] = [...GUIDES].sort(
  (a, b) => {
    if (a.id === "application-others") return 1;
    if (b.id === "application-others") return -1;
    return a.label.localeCompare(b.label);
  }
);

const GUIDES_BY_ID = new Map(
  APPLICATION_TYPE_GUIDES.map((guide) => [guide.id, guide])
);

export function applicationTypeGuide(
  id: ApplicationTypeId
): ApplicationTypeGuide {
  const guide = GUIDES_BY_ID.get(id);
  if (guide) return guide;
  // The catalogue is the source of the ids, so a label always exists.
  const label =
    APPLICATION_TYPES.find((type) => type.id === id)?.label ?? id;
  return { id, label, description: "", icon: PenLineIcon, keywords: [] };
}

/**
 * What a filer most often asks for at each stage. WORKING GUESS (Sept 21, open
 * for the PM): read off the national journey, not off a rule the court
 * publishes. Bail and the warrant asks follow the accused being called;
 * reopening evidence only means something once evidence has closed.
 *
 * Three at most, so the suggestions hold one row on a desktop and stay a
 * suggestion rather than a second catalogue.
 *
 * It orders the chooser and nothing else. Every type stays fileable at every
 * stage, because the court can hear any of them at any time and a guess here
 * must never be able to take an application away from someone.
 */
const SUGGESTED_BY_STAGE: Record<ActiveStage, ApplicationTypeId[]> = {
  scrutiny: ["condonation-of-delay", "withdrawal"],
  cognizance: ["condonation-of-delay", "advancement-reschedule", "withdrawal"],
  summons: ["warrant-by-hand", "advancement-reschedule", "settlement"],
  appearance: ["bail", "absent-application", "warrant-by-hand"],
  evidence: ["absent-application", "production-of-documents", "postpone"],
  arguments: ["reopen-evidence", "postpone", "absent-application"],
  judgment: ["reopen-evidence", "settlement"],
};

/** Empty for a disposed case: nothing about a closed case predicts the ask. */
export function suggestedApplicationTypes(
  stage: ActiveStage,
  disposed: boolean
): ApplicationTypeId[] {
  return disposed ? [] : SUGGESTED_BY_STAGE[stage];
}

/**
 * Words that appear in every request and so separate no two types. Dropping
 * them is what stops "I want to file an application in this case" from
 * scoring against all eight at once.
 */
const STOPWORDS = new Set([
  "and",
  "any",
  "application",
  "apply",
  "are",
  "ask",
  "asking",
  "can",
  "case",
  "court",
  "file",
  "filing",
  "for",
  "from",
  "have",
  "his",
  "her",
  "need",
  "our",
  "please",
  "raise",
  "request",
  "submit",
  "that",
  "the",
  "their",
  "them",
  "this",
  "want",
  "was",
  "were",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulWords(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/**
 * One word shared with a description is noise — "filed" appears in half of
 * them. A real match has vocabulary or the type's own name behind it.
 */
export const APPLICATION_TYPE_MATCH_FLOOR = 2;

export type ApplicationTypeMatch = {
  guide: ApplicationTypeGuide;
  /** 0 means the sentence said nothing about this type. */
  score: number;
};

/**
 * Every type, best first. Callers rank with this rather than filter — a
 * chooser that hides the seven types you did not describe is a chooser you
 * cannot browse.
 */
export function searchApplicationTypes(query: string): ApplicationTypeMatch[] {
  const normalized = normalize(query);
  const words = meaningfulWords(normalized);

  return APPLICATION_TYPE_GUIDES.map((guide, index) => ({
    guide,
    index,
    score: words.length === 0 ? 0 : scoreGuide(guide, normalized, words),
  }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ guide, score }) => ({ guide, score }));
}

/**
 * Vocabulary counts most, then the type's own name, then its description —
 * a word the filer shares with the keyword list is a far stronger signal than
 * one it shares with a sentence written to read well.
 */
function scoreGuide(
  guide: ApplicationTypeGuide,
  normalized: string,
  words: string[]
): number {
  let score = 0;
  /* The sentence with its filler gone, so "cancel the warrant" meets the
     phrase "cancel warrant". */
  const gist = words.join(" ");
  /* Only the last word can be half typed; an earlier "set" is a word. */
  const typing = words.at(-1) ?? "";

  for (const keyword of guide.keywords) {
    if (keyword.includes(" ")) {
      // A phrase has to appear as one, or "call for" matches every "for".
      const keywordGist = meaningfulWords(normalize(keyword)).join(" ");
      if (
        normalized.includes(keyword) ||
        (keywordGist.includes(" ") && gist.includes(keywordGist))
      ) {
        score += 4;
      }
      continue;
    }
    for (const word of words) {
      if (word === keyword) score += 3;
      else if (sameWordInflected(word, keyword)) {
        // "settling" and "settle" are the same ask typed differently.
        score += 2;
      } else if (word === typing && word.length >= 3 && keyword.startsWith(word)) {
        // Still being typed: "adjou" is on its way to "adjourn".
        score += 2;
      } else if (word.length >= 5 && withinOneEdit(word, keyword)) {
        // One slip of the finger: "certfied", "postpne".
        score += 2;
      }
    }
  }

  const label = meaningfulWords(normalize(guide.label));
  const description = meaningfulWords(normalize(guide.description));
  for (const word of words) {
    if (label.includes(word)) score += 2;
    else if (
      word.length >= 3 &&
      label.some(
        (part) =>
          (word === typing && part.startsWith(word)) || withinOneEdit(word, part)
      )
    ) {
      score += 2;
    } else if (word.length > 4 && description.includes(word)) score += 1;
  }

  return score;
}

/** The endings an ask takes when typed in a sentence: "settling", "delayed". */
const INFLECTIONS = ["s", "es", "ed", "d", "ing", "ment", "ments", "ion", "al"];

function sameWordInflected(word: string, keyword: string): boolean {
  if (keyword.length < 4) return false;
  const [longer, shorter] =
    word.length >= keyword.length ? [word, keyword] : [keyword, word];
  if (!longer.startsWith(shorter.replace(/e$/, ""))) return false;
  const rest = longer.slice(shorter.replace(/e$/, "").length);
  return rest === "" || rest === "e" || INFLECTIONS.some((end) => rest === end || rest === `e${end}`);
}

/** Whether two words are one insertion, deletion or swap of letters apart. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) {
    return false;
  }
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    // Two neighbouring letters swapped.
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return a.length > b.length
    ? a.slice(i + 1) === b.slice(i)
    : a.slice(i) === b.slice(i + 1);
}
