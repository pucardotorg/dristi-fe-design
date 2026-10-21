"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FlaskConicalIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { useStageFade } from "@/components/chrome/stage-fade";

import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentSlot } from "@/components/ui/document-slot";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  CaseDetails,
  CaseIdentity,
  JOIN_PANEL,
} from "@/components/join/case-details";
import { DownloadCaseFileButton } from "@/components/join/download-case-file-button";
import {
  DocumentPreviewDialog,
  DocumentThumbnailButton,
  useObjectUrl,
} from "@/components/document-preview";
import { pick, type Locale } from "@/lib/onboarding/content";
import {
  fill,
  joinDialog,
  type CaseParty,
  type JoinCase,
} from "@/lib/join/content";
import {
  advDialog,
  VAKALATNAMA_CO_ADVOCATES,
  VAKALATNAMA_INVITER,
  COMPLAINANT_PARTIES,
  VAKALATNAMA_FEE_PAISE,
  ADVOCATE_JOIN_CASE,
} from "@/lib/advocate/content";
import { newPaymentRef } from "@/lib/filing/data";
import { rupees } from "@/lib/tasks/format";
import { Identifier } from "@/components/chrome/identifier";
import { JoinedCaseBail } from "@/components/join/joined-case-bail";
import { GATEWAY_MS, PaymentProcessing, PaymentReceipt } from "@/components/payment/payment-steps";
import {
  directoryOptions,
  inviteLabel,
  PeopleInviteField,
  type InvitePerson,
} from "@/components/access/people-invite-field";
import { useAccess } from "@/components/access/access-state";
import {
  joinOfficeCopy,
  registerAccessCase,
  shareCopy,
} from "@/lib/access/content";
import { JOIN_DEMO_CASE_ID } from "@/lib/cases/party-cases";
import { useCourt } from "@/components/court/court-provider";
import { cn } from "@/lib/utils";

/**
 * Advocate join-a-case dialog.
 *
 * Same two entry modes as the litigant dialog — `summons` (unique URL scanned from a
 * client's summons; the account's number identifies an advocate, so this flavour
 * opens) and `manual` (the Join-a-case page). The legacy flow's "are you an advocate
 * or a litigant?" question is gone: sign-in answered it.
 *
 * Stages (manual): lookup → access code → details → account → representation → litigant
 * contact → vakalatnama → payment → outcome. The access code gates the case details:
 * an advocate must prove they hold the litigant's six-digit code before any case data
 * is shown. (Summons mode arrives pre-verified from the unique link, so it opens on
 * details and skips the code.)
 *
 * Join a Case handover V1 (dristi-be/PRDs/join-a-case-handover.md):
 * · No approvals and no replacement (JOIN-41) — the advocate always joins alongside
 *   anyone already on record, on either side.
 * · "Which litigant(s)" is multi-select, auto-picked when the side has one (JOIN-40).
 * · The vakalatnama is always uploaded (JOIN-50/51); generated ones come later.
 * · An advocate another advocate already named and paid for is recognised at lookup and
 *   sent to the case; they are never asked to upload or pay (owner, 2026-10-13).
 * · Payment happens inside the flow and is the only gate (JOIN-54/55). Leaving before
 *   paying turns it into a pending task, with no access until it is paid. An advocate
 *   joining a vakalatnama another advocate already paid for does not pay.
 * · Choosing Litigant or PoA holder switches profile and carries on with this case in
 *   the litigant flow (JOIN-18/20).
 */

type Stage =
  | "lookup"
  | "invited"
  | "details"
  | "account"
  | "code"
  | "role"
  | "verify"
  | "vakalatnama"
  | "pay"
  | "processing"
  | "paid"
  | "done";

/** The flow's order: each step's drift follows it (forward from the right, back from the left). */
/** The steps where something has been entered that leaving would lose. */
const LEAVE_ASKS: readonly Stage[] = ["code", "details", "account", "role", "verify", "vakalatnama"];

const STAGE_ORDER: readonly Stage[] = ["lookup", "invited", "code", "details", "account", "role", "verify", "vakalatnama", "pay", "done"];


/** Every question on the vakalatnama step wears the same label. */
const VK_QUESTION = "text-body font-semibold leading-snug";

type Side = "complainant" | "accused" | "";
type YesNo = "yes" | "no" | "";

type AccountRole = "advocate" | "litigant" | "poa";

export type AdvocateJoinResult = {
  joinCase: JoinCase;
  side: "complainant" | "accused";
  parties: CaseParty[];
  /** True once access is granted: the fee is paid, or another advocate already paid
   *  for this vakalatnama. False leaves a pending payment task and no access. */
  joined: boolean;
};

const CODE_LENGTH = 6;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Upload slot with the app's standard uploaded-document affordances: thumbnail that
 * opens the large preview (the Add-ID pattern), plus change and remove actions.
 * Wraps its own hidden input so callers only hold the File.
 */
function UploadedDocField({
  label,
  required = false,
  file,
  onFileChange,
  locale,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
  locale: Locale;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const url = useObjectUrl(file);
  const previewCopy = {
    title: pick(advDialog.docPreviewTitle, locale),
    description: pick(advDialog.docPreviewBody, locale),
    alt: pick(advDialog.docPreviewAlt, locale),
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next && next.size <= MAX_FILE_SIZE) onFileChange(next);
          // The same file can be picked again after a remove.
          event.target.value = "";
        }}
      />
      <DocumentSlot
        status={file ? "filled" : "empty"}
        media={file ? "thumbnail" : "icon"}
        label={label}
        required={required}
        filename={file?.name}
        meta={file ? fileSize(file.size) : undefined}
        thumbnail={
          file ? (
            <DocumentThumbnailButton
              file={file}
              url={url}
              locale={locale}
              onOpen={() => setPreviewOpen(true)}
              className="size-full rounded-md"
            />
          ) : undefined
        }
        onChooseFile={() => inputRef.current?.click()}
        copy={{
          optional: locale === "ml" ? "നിർബന്ധമല്ല" : "Optional",
          noFile: locale === "ml" ? "ഫയൽ തിരഞ്ഞെടുത്തിട്ടില്ല" : "No file chosen yet",
          chooseFile: locale === "ml" ? "ഫയൽ തിരഞ്ഞെടുക്കുക" : "Choose file",
        }}
      />
      {file ? (
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() => inputRef.current?.click()}
          >
            {pick(advDialog.changeFile, locale)}
          </Button>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-destructive-ink"
            onClick={() => onFileChange(null)}
          >
            {pick(advDialog.removeFile, locale)}
          </Button>
        </div>
      ) : null}
      <DocumentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={file}
        url={url}
        locale={locale}
        copy={previewCopy}
      />
    </>
  );
}

export function AdvocateJoinCaseDialog({
  open,
  onOpenChange,
  mode,
  summonsCase,
  locale,
  onJoined,
  onJoinAsLitigant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "summons" | "manual";
  /** The case resolved from the summons token. Required in summons mode. */
  summonsCase?: JoinCase;
  locale: Locale;
  onJoined: (result: AdvocateJoinResult) => void;
  /** The person chose Litigant or PoA holder; continue this case in the litigant flow. */
  onJoinAsLitigant: (kind: "self" | "poa") => void;
}) {
  /* From the summons the case is known but the code is still asked, as on every other
     way in (owner, 2026-10-14) — the litigant's door does the same. */
  const initialStage: Stage = mode === "summons" ? "code" : "lookup";
  /* Each step fades softly into the next (`useStageFade`), its content drifting a
     hint the way the person is going; the height changes while the window is clear,
     so nothing resizes in view (owner, Oct 6). */
  const {
    stage,
    setStage,
    resetStage,
    changed: stageChanged,
    panelStyle,
    sceneClassName,
  } = useStageFade<Stage>(initialStage, STAGE_ORDER);
  const router = useRouter();
  /* Focus follows the stage. The footer's buttons change with every step, so the
     one just pressed is unmounted; left there, focus would drop to the page with
     the dialog still open. The title takes it, as on every staged overlay. */
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (!stageChanged) return;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) {
      titleRef.current?.focus();
    }
  }, [stage, stageChanged]);
  const [joinCase, setJoinCase] = React.useState<JoinCase | undefined>(summonsCase);

  const [query, setQuery] = React.useState("");
  const [queryTouched, setQueryTouched] = React.useState(false);
  const [lookupMiss, setLookupMiss] = React.useState(false);

  const [code, setCode] = React.useState("");
  /* Found by searching, after "Not my case?" — the way back is then the search. */
  const [searched, setSearched] = React.useState(false);
  const [codeTouched, setCodeTouched] = React.useState(false);
  const [accountRole, setAccountRole] = React.useState<AccountRole>("advocate");
  const [switchingProfile, setSwitchingProfile] = React.useState(false);
  const switchTimerRef = React.useRef<number | null>(null);

  // Summons reach the accused side, so an advocate arriving from the unique link
  // represents an accused by default; the choice stays editable.
  const [side, setSide] = React.useState<Side>(mode === "summons" ? "accused" : "");
  const [partyIds, setPartyIds] = React.useState<string[]>([]);
  const partyAnchor = useComboboxAnchor();
  const [roleTouched, setRoleTouched] = React.useState(false);

  // Contact capture (only for litigants not yet on the case), keyed by party id.
  const [contacts, setContacts] = React.useState<Record<string, string>>({});
  const [verifyTouched, setVerifyTouched] = React.useState(false);

  const [vkOthers, setVkOthers] = React.useState<YesNo>("");
  const [vkAdvocates, setVkAdvocates] = React.useState<InvitePerson[]>([]);
  /* How many advocates the vakalatnama names, counting this one. Typed or stepped. */
  const [vkCount, setVkCount] = React.useState("1");
  const [vkFile, setVkFile] = React.useState<File | null>(null);
  const [vkTouched, setVkTouched] = React.useState(false);

  /* Sandbox: whether another advocate already named this advocate on a paid
     vakalatnama for the case looked up. The real check is the system's. */
  const [alreadyAdded, setAlreadyAdded] = React.useState(false);

  const [payOutcome, setPayOutcome] = React.useState<"success" | "failed">("success");
  const [payFailed, setPayFailed] = React.useState(false);
  const payFailedRef = React.useRef<HTMLDivElement>(null);
  const payTimerRef = React.useRef<number | null>(null);
  const [paymentRef, setPaymentRef] = React.useState("");
  const [outcome, setOutcome] = React.useState<"joined" | "unpaid">("joined");

  const [team, setTeam] = React.useState<InvitePerson[]>([]);
  const { invite, office, caseAdded } = useAccess();
  /* Office members on All cases got this case the moment the advocate joined
     (OFC-25, OFC-41); the step lists them rather than asking again. */
  const allCasesOffice = office.filter((person) => person.allCases);
  const [teamInvited, setTeamInvited] = React.useState<string[]>([]);

  /* File bail application opens the application form at Bail, in place of
     this window (the join is done; this window closes when the form does). */
  const [bailOpen, setBailOpen] = React.useState(false);
  /* A beat of loading before the bail form takes over, so the hand-off reads as
     the next step loading rather than a jump cut (owner, 2026-10-12). */
  const [bailOpening, setBailOpening] = React.useState(false);
  const bailTimerRef = React.useRef<number | null>(null);
  const [downloadNotice, setDownloadNotice] = React.useState(false);

  const sideParties: CaseParty[] =
    side === "complainant"
      ? COMPLAINANT_PARTIES
      : side === "accused"
        ? (joinCase?.accused ?? [])
        : [];
  const selectedParties = sideParties.filter((party) => partyIds.includes(party.id));
  // Only litigants not already on the case need a contact number entered — the system
  // already holds one for anyone who has joined.
  const contactParties = selectedParties.filter((party) => !party.hasJoined);

  /*
   * Who pays for the vakalatnama (team decision, owner 2026-10-13): the first advocate
   * to join answers one question — is anyone else named on it? — adds the others, and
   * pays for everyone. The others get an SMS to join and are recognised at lookup, so
   * nobody is asked whether it was already paid. They say how many more advocates it
   * names — the others, not counting themselves (owner, 2026-10-14) — and must add
   * exactly that many before continuing. Only advocates on the platform can be added. A partner the
   * first advocate missed joins on their own and pays for themselves.
   */
  const needsCoAdvocates = vkOthers === "yes";
  const vkCountNumber = Number.parseInt(vkCount, 10) || 0;
  const vkCountValid = vkCountNumber >= 1;
  const coAdvocatesNeeded = vkCountValid ? vkCountNumber : 0;
  /* Kerala bills per advocate named; Gujarat and Punjab & Haryana charge one flat fee
     for the vakalatnama (owner, 2026-10-13). */
  const { court: joinCourt, profile: joinProfile } = useCourt();
  const flatJoinFee = joinProfile.fees.joinBilling === "flat";
  const advocatesPaidFor =
    !flatJoinFee && needsCoAdvocates && vkCountValid ? vkCountNumber + 1 : 1;
  /* Gujarat's is its own schedule's: ₹20 welfare fund + ₹2 court fee stamp, once
     (owner, 2026-10-14). */
  const gujaratFee = joinCourt === "gujarat";
  const coAdvocatesComplete =
    !needsCoAdvocates || (vkCountValid && vkAdvocates.length === coAdvocatesNeeded);

  const vkAttached = Boolean(vkFile);
  const unpaidOutcome = stage === "done" && outcome === "unpaid";
  const fee = gujaratFee
    ? rupees((joinProfile.fees.join.welfareFund + joinProfile.fees.join.courtFee) * 100)
    : rupees(VAKALATNAMA_FEE_PAISE * advocatesPaidFor);
  const isSummonsIntro = mode === "summons" && stage === "details";

  React.useEffect(() => () => {
    if (switchTimerRef.current !== null) window.clearTimeout(switchTimerRef.current);
    if (payTimerRef.current !== null) window.clearTimeout(payTimerRef.current);
    if (bailTimerRef.current !== null) window.clearTimeout(bailTimerRef.current);
  }, []);

  // A failed payment announces itself and takes focus; the person stays on the step.
  React.useEffect(() => {
    if (!payFailed) return;
    const id = window.requestAnimationFrame(() => payFailedRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [payFailed]);

  function reset() {
    resetStage(initialStage);
    setSearched(false);
    setJoinCase(summonsCase);
    setQuery("");
    setQueryTouched(false);
    setLookupMiss(false);
    setCode("");
    setCodeTouched(false);
    setAccountRole("advocate");
    setSwitchingProfile(false);
    if (switchTimerRef.current !== null) window.clearTimeout(switchTimerRef.current);
    switchTimerRef.current = null;
    setSide(mode === "summons" ? "accused" : "");
    setPartyIds([]);
    setRoleTouched(false);
    setContacts({});
    setVerifyTouched(false);
    setVkOthers("");
    setVkAdvocates([]);
    setVkCount("2");
    setVkFile(null);
    setVkTouched(false);
    setAlreadyAdded(false);
    setPayOutcome("success");
    setPayFailed(false);
    if (payTimerRef.current !== null) window.clearTimeout(payTimerRef.current);
    payTimerRef.current = null;
    setPaymentRef("");
    setOutcome("joined");
    setTeam([]);
    setTeamInvited([]);
    setDownloadNotice(false);
    if (bailTimerRef.current !== null) window.clearTimeout(bailTimerRef.current);
    bailTimerRef.current = null;
    setBailOpening(false);
  }

  /* View case opens the joined case's own page (owner, 2026-10-12). */
  function viewCase() {
    handleOpenChange(false);
    router.push(`/cases/${JOIN_DEMO_CASE_ID}`);
  }

  function openBail() {
    setBailOpening(true);
    bailTimerRef.current = window.setTimeout(() => {
      bailTimerRef.current = null;
      setBailOpening(false);
      setBailOpen(true);
    }, 900);
  }

  /* Partway through, the close asks first (owner, 2026-10-13): what was entered would be
     lost. The question takes this window's header and footer — never a second modal. */
  const [leaving, setLeaving] = React.useState(false);
  // Arriving from the summons, the code step is the first: nothing typed, nothing to lose.
  const entered =
    LEAVE_ASKS.includes(stage) &&
    !(stage === "code" && mode === "summons" && !searched && code.length === 0);

  function handleOpenChange(next: boolean) {
    // The gateway is confirming; the window holds until it answers.
    if (!next && stage === "processing") return;
    if (!next && entered && !leaving) {
      setLeaving(true);
      titleRef.current?.focus();
      return;
    }
    if (!next) setLeaving(false);
    // Leaving at the payment step still records the join as unpaid: the fee becomes a
    // pending task and access waits for it (JOIN-54).
    if (!next && stage === "pay") reportJoined(false);
    if (!next) reset();
    onOpenChange(next);
  }

  function reportJoined(joined: boolean) {
    if (!joinCase || !side) return;
    onJoined({ joinCase, side, parties: selectedParties, joined });
  }

  function submitLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQueryTouched(true);
    const trimmed = query.trim();
    if (trimmed.length < 4) {
      setLookupMiss(false);
      return;
    }
    // Prototype lookup, same contract as the litigant dialog: any plausible number
    // resolves to the demo case; a number with no digits exercises the miss path.
    if (!/\d/.test(trimmed)) {
      setLookupMiss(true);
      return;
    }
    setLookupMiss(false);
    setSearched(true);
    setJoinCase(ADVOCATE_JOIN_CASE);
    // Already named and paid for by another advocate: nothing to join, only the case
    // to open.
    if (alreadyAdded) {
      setStage("invited");
      return;
    }
    // The access code gates the case details. The code stage shows only the public
    // identity — title, number, court, no amount (JOIN-11) — so the advocate can
    // confirm the case before spending the litigant's code.
    setStage("code");
  }

  function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeTouched(true);
    if (code.length !== CODE_LENGTH) return;
    setStage("details");
  }

  function continueFromAccount() {
    if (accountRole === "advocate") {
      setStage("role");
      return;
    }
    setSwitchingProfile(true);
    const kind = accountRole === "poa" ? "poa" : "self";
    switchTimerRef.current = window.setTimeout(() => onJoinAsLitigant(kind), 2000);
  }

  function submitRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRoleTouched(true);
    if (!side || partyIds.length === 0) return;
    // Litigants already on the case need no contact entry — go straight to the
    // vakalatnama when nobody is missing a number.
    const missing = selectedParties.filter((party) => !party.hasJoined);
    if (missing.length === 0) {
      setStage("vakalatnama");
      return;
    }
    setContacts((current) => {
      const next = { ...current };
      for (const party of missing) next[party.id] ??= "";
      return next;
    });
    setStage("verify");
  }

  function submitVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyTouched(true);
    // Every litigant without a number on record needs a valid one before continuing.
    const allValid = contactParties.every(
      (party) => (contacts[party.id] ?? "").length === 10,
    );
    if (!allValid) return;
    setVerifyTouched(false);
    setStage("vakalatnama");
  }

  function submitVakalatnama(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVkTouched(true);
    if (!joinCase || !side) return;
    if (!vkOthers) return;
    if (!coAdvocatesComplete) return;
    if (!vkAttached) return;
    setStage("pay");
  }

  function pay() {
    if (payOutcome === "failed") {
      setPayFailed(true);
      return;
    }
    setPayFailed(false);
    // The gateway round trip, then its receipt, as e-filing does (owner, 2026-10-12);
    // the join is recorded once the payment confirms.
    setStage("processing");
    payTimerRef.current = window.setTimeout(() => {
      payTimerRef.current = null;
      setPaymentRef(newPaymentRef());
      setOutcome("joined");
      setStage("paid");
      reportJoined(true);
      // The co-advocates named on the vakalatnama get their SMS once it is paid for.
      if (needsCoAdvocates && vkAdvocates.length) {
        toast.success(
          fill(advDialog.vkInviteToast, locale, { names: vkAdvocates.map(inviteLabel).join(", ") }),
        );
      }
    }, GATEWAY_MS);
  }

  function payLater() {
    setOutcome("unpaid");
    setStage("done");
    reportJoined(false);
  }

  function updateContact(partyId: string, value: string) {
    setContacts((current) => ({ ...current, [partyId]: value }));
    setVerifyTouched(false);
  }

  /* The joined case enters the access world once the advocate is on it, and
     everyone on All cases gets it then (OFC-25). Keyed by CNR so it runs once. */
  const joinedCnr = stage === "done" && joinCase && !unpaidOutcome ? joinCase.cnr : null;
  React.useEffect(() => {
    if (!joinedCnr || !joinCase) return;
    const caseId = `join-${joinedCnr}`;
    registerAccessCase({
      id: caseId,
      title: joinCase.title,
      caseNumber: joinCase.caseNumber,
      court: joinCase.court,
      nextHearing: joinCase.hearingDate,
    });
    caseAdded(caseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per joined case
  }, [joinedCnr]);

  function sendInvites() {
    if (!team.length || !joinCase) return;
    // Office access to the joined case as a specific case (OFC-42).
    const caseId = `join-${joinCase.cnr}`;
    invite(team.map((person) => person.phone ?? ""), [caseId]);
    // The confirmation shows the batch just sent and replaces any earlier one — a
    // later send swaps the old notification out rather than growing it.
    setTeamInvited(team.map(inviteLabel));
    toast.success(fill(shareCopy.inviteToast, locale, { names: team.map(inviteLabel).join(", ") }));
    setTeam([]);
  }

  const joinedParties = selectedParties.filter((party) => party.hasJoined);

  const headerCopy: { title: string; body: string } =
    stage === "lookup"
      ? { title: pick(advDialog.title, locale), body: pick(advDialog.lookupBody, locale) }
      : stage === "invited"
        ? {
            title: pick(advDialog.invitedTitle, locale),
            body: fill(advDialog.invitedBody, locale, { name: VAKALATNAMA_INVITER }),
          }
      : stage === "details"
        ? isSummonsIntro
          ? { title: pick(advDialog.summonsHeading, locale), body: pick(advDialog.summonsBody, locale) }
          : { title: pick(advDialog.title, locale), body: pick(advDialog.detailsBody, locale) }
        : stage === "code"
          ? {
              title: pick(advDialog.title, locale),
              body: pick(
                mode === "summons" ? joinDialog.codeSummonsBodyAdvocate : joinDialog.codeBody,
                locale,
              ),
            }
          : stage === "account"
            ? switchingProfile
              ? { title: pick(advDialog.accountSwitchTitle, locale), body: pick(advDialog.accountSwitchBody, locale) }
              : { title: pick(advDialog.accountTitle, locale), body: pick(advDialog.accountBody, locale) }
          : stage === "role"
            ? { title: pick(advDialog.title, locale), body: pick(advDialog.roleBody, locale) }
            : stage === "verify"
              ? { title: pick(advDialog.verifyTitle, locale), body: pick(advDialog.verifyBody, locale) }
              : stage === "pay"
                ? { title: pick(advDialog.payTitle, locale), body: pick(advDialog.payBody, locale) }
                : stage === "processing"
                  ? { title: pick(advDialog.payProcessingTitle, locale), body: pick(advDialog.payProcessingBody, locale) }
                  : stage === "paid"
                    ? { title: pick(advDialog.paidTitle, locale), body: pick(advDialog.paidBody, locale) }
                    : { title: pick(advDialog.vkTitle, locale), body: pick(advDialog.vkBody, locale) };

  return (
    <>
    <Dialog open={open && !bailOpen} onOpenChange={handleOpenChange}>
      <FlowDialogContent
        lang={locale}
        rise
        sheet
        style={panelStyle}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl",
          // No way out while the gateway confirms, as e-filing's processing window.
          stage === "processing" && "[&_[data-slot=dialog-close]]:hidden",
        )}
        // The litigant combobox portals its list outside this dialog's DOM. Without
        // this guard the modal dialog reads a click on that list as an outside
        // interaction and swallows it before the option can be selected.
        // A click outside never closes the flow: a misclick lost every step entered
        // (owner, 2026-10-13). Close and Escape remain, and ask first partway through.
        // This also keeps the litigant combobox's portalled list clickable.
        onInteractOutside={(event) => event.preventDefault()}
        // Escape must close the innermost layer only: with the combobox list open
        // (its popup is in the DOM), the dialog stands down and lets the list
        // close; a second Escape then closes the dialog.
        onEscapeKeyDown={(event) => {
          if (document.querySelector('[data-slot="combobox-content"]')) event.preventDefault();
        }}
      >
        {/* The chrome, on every stage including the outcome: the same header the
            product's staged overlays carry, so the outcome reads as this window
            settling rather than a different one (owner, Oct 6). Only the words
            change; the frame holds still while the stage below it moves. */}
        <DialogHeader className="shrink-0 gap-2 border-b border-hairline p-6 pr-16 text-left">
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="text-title-s font-semibold text-balance outline-none"
          >
            {leaving
              ? pick(advDialog.leaveTitle, locale)
              : stage === "done"
                ? pick(unpaidOutcome ? advDialog.unpaidTitle : advDialog.joinedTitle, locale)
                : headerCopy.title}
          </DialogTitle>
          <DialogDescription className="text-body-compact text-pretty text-muted-foreground">
            {leaving
              ? pick(advDialog.leaveBody, locale)
              : stage === "done"
                ? pick(unpaidOutcome ? advDialog.unpaidBody : advDialog.joinedBody, locale)
                : headerCopy.body}
          </DialogDescription>
        </DialogHeader>

        {/* The stage: the warm canvas the case and the questions are laid on as
            white panels, the product's staged-overlay surface. It hugs each
            step's height, which changes while the window is faded out
            (`useStageFade`). Keyed on the step so each one opens scrolled to its
            top and plays its drift in. */}
        <div
          className={cn(
            "relative flex min-h-0 flex-col overflow-hidden bg-muted dark:bg-background",
            "shrink",
            unpaidOutcome && "hidden",
          )}
        >
        <div
          key={stage}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto",
            sceneClassName,
          )}
        >
        {bailOpening ? (
          <div
            role="status"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/90 text-center motion-safe:animate-in motion-safe:fade-in-0 dark:bg-background/90"
          >
            <Spinner className="size-8 text-primary" />
            <p className="text-body-compact font-medium">{pick(advDialog.bailOpening, locale)}</p>
          </div>
        ) : null}
        <div className="flex flex-col p-4 sm:p-6">
          {/* ------------------------------------------------------- lookup */}
          {stage === "lookup" ? (
            <form id="adv-lookup" noValidate className={JOIN_PANEL} onSubmit={submitLookup}>
              <Field data-invalid={queryTouched && query.trim().length < 4}>
                <FieldLabel>{pick(joinDialog.lookupLabel, locale)}</FieldLabel>
                <Input
                  autoFocus
                  value={query}
                  placeholder={pick(joinDialog.lookupPlaceholder, locale)}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setQueryTouched(false);
                    setLookupMiss(false);
                  }}
                />
                <FieldError>
                  {queryTouched && query.trim().length < 4
                    ? pick(joinDialog.lookupError, locale)
                    : null}
                </FieldError>
              </Field>
              {lookupMiss ? (
                <Banner variant="warning" className="items-start">{pick(joinDialog.lookupMiss, locale)}</Banner>
              ) : null}
            </form>
          ) : null}

          {/* ---------------------------------------------- already added */}
          {stage === "invited" && joinCase ? (
            <CaseDetails joinCase={joinCase} locale={locale} compact />
          ) : null}

          {/* ------------------------------------------------------ details */}
          {/* Advocates get the full registry list (CNR, filing number, court, both
              sides' advocates) — the limited litigant set was an intimidation
              trade-off that does not apply to professionals. */}
          {stage === "details" && joinCase ? (
            <div className="flex flex-col gap-4">
              <CaseDetails joinCase={joinCase} locale={locale} extended />
              {downloadNotice ? (
                <Banner variant="info" className="items-start">
                  {pick(joinDialog.downloadCaseFilePrototype, locale)}
                </Banner>
              ) : null}
            </div>
          ) : null}

          {/* --------------------------------------------- account for this case */}
          {stage === "account" && joinCase ? (
            switchingProfile ? (
              <div className="flex min-h-32 flex-col items-center justify-center gap-3 text-center">
                <Spinner className="size-6 text-primary" />
                <p className="text-body-compact font-medium">{pick(advDialog.accountSwitchStatus, locale)}</p>
              </div>
            ) : (
              <div className={JOIN_PANEL}>
                <Field>
                  <FieldLabel>{pick(advDialog.accountLabel, locale)}</FieldLabel>
                  <Select
                    value={accountRole}
                    onValueChange={(value) => setAccountRole(value as AccountRole)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="advocate">{pick(advDialog.accountAdvocate, locale)}</SelectItem>
                      <SelectItem value="litigant">{pick(advDialog.accountLitigant, locale)}</SelectItem>
                      <SelectItem value="poa">{pick(advDialog.accountPoa, locale)}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Banner variant="info" className="items-start">{pick(advDialog.accountNote, locale)}</Banner>
              </div>
            )
          ) : null}

          {/* --------------------------------------------------- access code */}
          {stage === "code" && joinCase ? (
            <form id="adv-code" noValidate className="flex flex-col gap-4" onSubmit={submitCode}>
              {/* Public identity only — title (with "1 other" explorable), case
                  number and court. The amount stays behind the code (JOIN-11). */}
              <CaseIdentity
                joinCase={joinCase}
                locale={locale}
                lead={pick(joinDialog.codeCaseLead, locale)}
              />
              <Banner variant="info" className="items-start">
                {pick(
                  mode === "summons" ? joinDialog.codeSummonsNoteAdvocate : joinDialog.codeNote,
                  locale,
                )}
              </Banner>
              <div className={JOIN_PANEL}>
              <Field data-invalid={codeTouched && code.length !== CODE_LENGTH}>
                <FieldLabel>{pick(joinDialog.codeLabel, locale)}</FieldLabel>
                <InputOTP
                  maxLength={CODE_LENGTH}
                  pattern={REGEXP_ONLY_DIGITS}
                  inputMode="numeric"
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    setCodeTouched(false);
                  }}
                >
                  <InputOTPGroup className="w-full">
                    {Array.from({ length: CODE_LENGTH }, (_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="h-12 w-auto flex-1 text-body font-semibold"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <FieldError>
                  {codeTouched && code.length !== CODE_LENGTH
                    ? pick(joinDialog.codeError, locale)
                    : null}
                </FieldError>
              </Field>
              </div>
            </form>
          ) : null}

          {/* ------------------------------------------------ representation */}
          {stage === "role" && joinCase ? (
            <form id="adv-role" noValidate className={cn(JOIN_PANEL, "gap-6")} onSubmit={submitRole}>
              <Field data-invalid={roleTouched && !side}>
                <FieldLabel className="block w-full text-body font-semibold leading-snug">
                  {pick(advDialog.sideLegend, locale)}
                </FieldLabel>
                <RadioGroup
                  value={side}
                  onValueChange={(value) => {
                    const next = value as Side;
                    setSide(next);
                    // JOIN-40: a side with one party has it chosen for the advocate.
                    const parties =
                      next === "complainant" ? COMPLAINANT_PARTIES : (joinCase?.accused ?? []);
                    setPartyIds(parties.length === 1 ? [parties[0].id] : []);
                    setRoleTouched(false);
                  }}
                  className="flex flex-col gap-1"
                >
                  <div className="flex min-h-10 items-center gap-2">
                    <RadioGroupItem value="complainant" id="adv-side-complainant" />
                    <Label htmlFor="adv-side-complainant">
                      {pick(advDialog.sideComplainant, locale)}
                    </Label>
                  </div>
                  <div className="flex min-h-10 items-center gap-2">
                    <RadioGroupItem value="accused" id="adv-side-accused" />
                    <Label htmlFor="adv-side-accused">
                      {pick(advDialog.sideAccused, locale)}
                    </Label>
                  </div>
                </RadioGroup>
                <FieldError>
                  {roleTouched && !side ? pick(advDialog.sideError, locale) : null}
                </FieldError>
              </Field>

              {side === "accused" ? (
                <Banner variant="info" className="items-start">{pick(advDialog.accusedAckNote, locale)}</Banner>
              ) : null}

              {side ? (
                <Field data-invalid={roleTouched && partyIds.length === 0}>
                  <FieldLabel className="block w-full text-body font-semibold leading-snug">
                    {pick(advDialog.whichLegend, locale)}
                  </FieldLabel>
                  {/* Multi-select dropdown, not a checkbox list — a real case can carry
                      many litigants on one side, and one vakalatnama often covers
                      several of them. Selected litigants sit as removable chips. */}
                  <Combobox
                    multiple
                    items={sideParties.map((party) => party.name)}
                    value={selectedParties.map((party) => party.name)}
                    onValueChange={(names: string[]) => {
                      setPartyIds(
                        sideParties
                          .filter((party) => names.includes(party.name))
                          .map((party) => party.id),
                      );
                      setRoleTouched(false);
                    }}
                  >
                    <ComboboxChips ref={partyAnchor}>
                      <ComboboxValue>
                        {(value: string[]) => (
                          <>
                            {value.map((name) => (
                              <ComboboxChip key={name}>{name}</ComboboxChip>
                            ))}
                            <ComboboxChipsInput
                              placeholder={
                                value.length
                                  ? undefined
                                  : pick(advDialog.whichPlaceholder, locale)
                              }
                            />
                          </>
                        )}
                      </ComboboxValue>
                    </ComboboxChips>
                    {/* The popup portals to <body>, which the modal dialog freezes with
                        pointer-events:none — so the list must re-enable its own, or every
                        option is unclickable (a Radix-dialog + portaled-popup interaction,
                        not a combobox bug). */}
                    <ComboboxContent anchor={partyAnchor} className="pointer-events-auto">
                      <ComboboxEmpty>{pick(advDialog.whichEmpty, locale)}</ComboboxEmpty>
                      <ComboboxList>
                        {(item: string) => (
                          <ComboboxItem key={item} value={item}>
                            {item}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <FieldError>
                    {roleTouched && partyIds.length === 0
                      ? pick(advDialog.whichError, locale)
                      : null}
                  </FieldError>
                </Field>
              ) : null}

            </form>
          ) : null}

          {/* ---------------------------- litigant contact capture */}
          {/* Only litigants not yet on the case are asked — the court has no number for
              them. One labelled field each on a single screen; litigants already on the
              case are named in a note instead of asked. */}
          {stage === "verify" ? (
            <form id="adv-verify" noValidate className={cn(JOIN_PANEL, "gap-5")} onSubmit={submitVerify}>
              {/* JOIN-64: no OTP here; each number's owner confirms at sign-in. */}
              <Banner variant="info" className="items-start">{pick(advDialog.contactConfirmNote, locale)}</Banner>
              {joinedParties.length ? (
                <Banner variant="info" className="items-start">
                  {fill(advDialog.contactAlreadyNote, locale, {
                    names: joinedParties.map((party) => party.name).join(", "),
                  })}
                </Banner>
              ) : null}

              {contactParties.map((party) => {
                const value = contacts[party.id] ?? "";
                const invalid = verifyTouched && value.length !== 10;
                return (
                  <Field key={party.id} data-invalid={invalid}>
                    {/* Whose number, on the field itself: the name alone did not read
                        as "enter their mobile" (owner, 2026-10-12). The +91 group is
                        the product's mobile entry, as in registration. */}
                    <FieldLabel htmlFor={`adv-mobile-${party.id}`} className="font-semibold">
                      {fill(advDialog.contactMobileLabel, locale, { name: party.name })}
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupAddon variant="field">
                        <InputGroupText>+91</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id={`adv-mobile-${party.id}`}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={10}
                        aria-invalid={invalid || undefined}
                        value={value}
                        onChange={(event) =>
                          updateContact(party.id, event.target.value.replace(/\D/g, "").slice(0, 10))
                        }
                      />
                    </InputGroup>
                    <FieldError>
                      {invalid ? pick(advDialog.contactMobileError, locale) : null}
                    </FieldError>
                  </Field>
                );
              })}
            </form>
          ) : null}

          {/* --------------------------------------------------- vakalatnama */}
          {stage === "vakalatnama" ? (
            <form
              id="adv-vakalatnama"
              noValidate
              className={cn(JOIN_PANEL, "gap-8")}
              onSubmit={submitVakalatnama}
            >
              {/* One rhythm (owner, Oct 6): every question is the same semibold
                  label over its control, 12px apart, and questions sit 32px apart.
                  A note belongs to the question it explains, so the fee note rides
                  with the answer that brings it on. Not one big Field: a missed
                  upload must redden only the upload area. */}
              <div className="flex flex-col gap-3">
                <p className={VK_QUESTION}>{pick(advDialog.vkDocLabel, locale)}</p>
                <Field data-invalid={vkTouched && !vkAttached}>
                  <div className="flex flex-col gap-2">
                    <UploadedDocField
                      label={pick(advDialog.vkDocLabel, locale)}
                      required
                      file={vkFile}
                      onFileChange={(file) => {
                        setVkFile(file);
                        setVkTouched(false);
                      }}
                      locale={locale}
                    />
                    <FieldDescription>{pick(advDialog.vkDocHelp, locale)}</FieldDescription>
                    {/* The blank form to fill and sign, for an advocate who has not drawn
                        one up (owner, 2026-10-14). A sandbox file for now. */}
                    <div>
                      <Button asChild variant="outline" size="sm">
                        <a href="/case-file/04-vakalats.pdf" download="vakalatnama-template.pdf">
                          <DownloadIcon data-icon="inline-start" aria-hidden />
                          {pick(advDialog.vkTemplate, locale)}
                        </a>
                      </Button>
                    </div>
                  </div>
                  <FieldError>
                    {vkTouched && !vkAttached ? pick(advDialog.vkAttachError, locale) : null}
                  </FieldError>
                </Field>
              </div>

              {/* Is anyone else named on it? One question; the fee follows the answer. */}
              <Field data-invalid={vkTouched && !vkOthers}>
                <FieldLabel className={cn(VK_QUESTION, "block w-full")}>
                  {pick(advDialog.vkOthersLegend, locale)}
                </FieldLabel>
                <RadioGroup
                  value={vkOthers}
                  onValueChange={(value) => {
                    setVkOthers(value as YesNo);
                    setVkTouched(false);
                  }}
                  className="flex flex-col gap-1"
                >
                  <div className="flex min-h-10 items-center gap-2">
                    <RadioGroupItem value="no" id="adv-vk-no" />
                    <Label htmlFor="adv-vk-no">{pick(advDialog.vkOthersNo, locale)}</Label>
                  </div>
                  <div className="flex min-h-10 items-center gap-2">
                    <RadioGroupItem value="yes" id="adv-vk-yes" />
                    <Label htmlFor="adv-vk-yes">{pick(advDialog.vkOthersYes, locale)}</Label>
                  </div>
                </RadioGroup>
                <FieldError>
                  {vkTouched && !vkOthers ? pick(advDialog.vkOthersError, locale) : null}
                </FieldError>
                {vkOthers === "no" ? (
                  <Banner variant="info" className="items-start">
                    {fill(
                      gujaratFee ? advDialog.vkGujaratSoloFeeNote : advDialog.vkFeeNote,
                      locale,
                      { amount: fee },
                    )}
                  </Banner>
                ) : null}
              </Field>

              {/* Say how many are named, then add exactly that many others; the fee
                  follows the number. */}
              {needsCoAdvocates ? (
                <>
                  <Field data-invalid={vkTouched && !vkCountValid}>
                    <FieldLabel htmlFor="adv-vk-count" className={cn(VK_QUESTION, "block w-full")}>
                      {pick(advDialog.vkCountLabel, locale)}
                    </FieldLabel>
                    {/* Wrapped: Field stretches its direct children to full width. */}
                    <div>
                      <InputGroup className="w-36">
                        <InputGroupAddon>
                          <InputGroupButton
                            size="icon-sm"
                            aria-label={pick(advDialog.vkCountDecrease, locale)}
                            aria-controls="adv-vk-count"
                            aria-disabled={vkCountNumber <= 1}
                            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                            onClick={() => {
                              setVkCount(String(Math.max(1, vkCountNumber - 1)));
                              setVkTouched(false);
                            }}
                          >
                            <MinusIcon aria-hidden />
                          </InputGroupButton>
                        </InputGroupAddon>
                        <InputGroupInput
                          id="adv-vk-count"
                          inputMode="numeric"
                          autoComplete="off"
                          className="text-center tabular-nums"
                          value={vkCount}
                          aria-invalid={vkTouched && !vkCountValid}
                          onChange={(event) => {
                            setVkCount(event.target.value.replace(/\D/g, "").slice(0, 2));
                            setVkTouched(false);
                          }}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            size="icon-sm"
                            aria-label={pick(advDialog.vkCountIncrease, locale)}
                            aria-controls="adv-vk-count"
                            aria-disabled={vkCountNumber >= 99}
                            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                            onClick={() => {
                              setVkCount(String(Math.min(99, Math.max(1, vkCountNumber + 1))));
                              setVkTouched(false);
                            }}
                          >
                            <PlusIcon aria-hidden />
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                    </div>
                    <FieldError>
                      {vkTouched && !vkCountValid ? pick(advDialog.vkCountError, locale) : null}
                    </FieldError>
                  </Field>

                  <Field data-invalid={vkTouched && vkCountValid && !coAdvocatesComplete}>
                    <FieldLabel className={cn(VK_QUESTION, "block w-full")}>
                      {pick(advDialog.vkAddLegend, locale)}
                    </FieldLabel>
                    {/* As Share (owner, 2026-10-13): only advocates this office has added
                        before are suggested; anyone else is their full number, never
                        resolved to a name. */}
                    <PeopleInviteField
                      id="adv-vk-advocates"
                      label={pick(advDialog.vkAddFieldLabel, locale)}
                      known={VAKALATNAMA_CO_ADVOCATES}
                      value={vkAdvocates}
                      onValueChange={(next) => {
                        setVkAdvocates(next);
                        setVkTouched(false);
                      }}
                      locale={locale}
                      copy={{
                        suggested: advDialog.vkAddSuggested,
                        newNumber: advDialog.vkAddNewNumber,
                        keepTyping: advDialog.vkAddKeepTyping,
                      }}
                    />
                    <FieldDescription>
                      {vkCountValid ? (
                        <span className="tabular-nums" aria-live="polite">
                          {fill(advDialog.vkAddProgress, locale, {
                            added: String(vkAdvocates.length),
                            needed: String(coAdvocatesNeeded),
                          })}
                          {" · "}
                        </span>
                      ) : null}
                      {pick(advDialog.vkAddHelp, locale)}
                    </FieldDescription>
                    <FieldError>
                      {vkTouched && vkCountValid && !coAdvocatesComplete
                        ? coAdvocatesNeeded === 1
                          ? pick(advDialog.vkAddErrorOne, locale)
                          : fill(advDialog.vkAddErrorMany, locale, { n: String(coAdvocatesNeeded) })
                        : null}
                    </FieldError>
                    {vkCountValid ? (
                      <Banner variant="info" className="items-start">
                        {gujaratFee
                          ? fill(advDialog.vkGujaratFeeNote, locale, { amount: fee })
                          : flatJoinFee
                          ? fill(advDialog.vkFlatFeeNote, locale, { amount: fee })
                          : fill(advDialog.vkGroupFeeNote, locale, {
                              n: String(advocatesPaidFor),
                              amount: fee,
                            })}
                      </Banner>
                    ) : null}
                  </Field>
                </>
              ) : null}
            </form>
          ) : null}

          {/* ------------------------------------------------------- payment */}
          {/* JOIN-54: payment happens here, and access waits for it. A sandbox, like
              the pending-tasks pay card: no money moves; pick the gateway's answer. */}
          {stage === "pay" && joinCase ? (
            <form
              id="adv-pay"
              noValidate
              className={cn(JOIN_PANEL, "gap-5")}
              onSubmit={(event) => {
                event.preventDefault();
                pay();
              }}
            >
              {payFailed ? (
                <div
                  ref={payFailedRef}
                  tabIndex={-1}
                  className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Banner variant="error" className="items-start">{pick(advDialog.payFailed, locale)}</Banner>
                </div>
              ) : null}
              <DescriptionList className="rounded-xl bg-surface-sunken px-4 py-1">
                <DescriptionRow className="border-hairline">
                  <DescriptionTerm>{pick(advDialog.payFeeHead, locale)}</DescriptionTerm>
                  <DescriptionDetails>{pick(advDialog.payFeeName, locale)}</DescriptionDetails>
                </DescriptionRow>
                <DescriptionRow className="border-hairline">
                  <DescriptionTerm>{pick(advDialog.payCase, locale)}</DescriptionTerm>
                  <DescriptionDetails>
                    <Identifier value={joinCase.caseNumber} label="case number" />
                  </DescriptionDetails>
                </DescriptionRow>
                {gujaratFee ? (
                  <>
                    <DescriptionRow className="border-hairline">
                      <DescriptionTerm>{pick(advDialog.payWelfare, locale)}</DescriptionTerm>
                      <DescriptionDetails className="tabular-nums">
                        {rupees(joinProfile.fees.join.welfareFund * 100)}
                      </DescriptionDetails>
                    </DescriptionRow>
                    <DescriptionRow className="border-hairline">
                      <DescriptionTerm>{pick(advDialog.payStamp, locale)}</DescriptionTerm>
                      <DescriptionDetails className="tabular-nums">
                        {rupees(joinProfile.fees.join.courtFee * 100)}
                      </DescriptionDetails>
                    </DescriptionRow>
                  </>
                ) : null}
                <DescriptionRow className="border-hairline">
                  <DescriptionTerm>{pick(advDialog.payAmount, locale)}</DescriptionTerm>
                  <DescriptionDetails className="font-semibold tabular-nums">{fee}</DescriptionDetails>
                </DescriptionRow>
              </DescriptionList>
            </form>
          ) : null}

          {/* ------------------------------------------- the gateway round trip */}
          {stage === "processing" ? <PaymentProcessing /> : null}

          {/* ------------------------------------------------------ receipt */}
          {stage === "paid" && joinCase ? (
            <div className={JOIN_PANEL}>
              <PaymentReceipt
                amount={fee}
                rows={[
                  { label: pick(advDialog.payFeeHead, locale), value: pick(advDialog.payFeeName, locale) },
                  {
                    label: pick(advDialog.payCase, locale),
                    value: <Identifier value={joinCase.caseNumber} label="case number" />,
                  },
                  {
                    label: pick(advDialog.paidRef, locale),
                    value: <Identifier value={paymentRef} label="payment reference" />,
                  },
                ]}
              />
            </div>
          ) : null}

          {/* --------------------------------------------------------- done */}
          {stage === "done" && joinCase && !unpaidOutcome ? (
            <div className="flex flex-col gap-4">
              <CaseDetails
                joinCase={joinCase}
                locale={locale}
                compact
                outcome={fill(advDialog.joinedBand, locale, {
                  names: selectedParties.map((party) => party.name).join(", "),
                })}
              />

              {/* Optional: bring the office's subordinates onto the case. Numbers are
                  typed one at a time and added to the stack above with the + button
                  (or Enter); Send invite then notifies everyone in the stack. */}
              <div className={cn(JOIN_PANEL, "gap-3")}>
                <div className="flex flex-col gap-1">
                  {/* "Optional" is the DS's optional marker, not part of the heading. */}
                  <div className="flex items-center gap-2">
                    <p className="text-body font-semibold">
                      {pick(advDialog.teamTitle, locale)}
                    </p>
                    <Badge variant="secondary">{pick(advDialog.teamOptional, locale)}</Badge>
                  </div>
                  <p className="text-body-compact text-pretty text-muted-foreground">
                    {pick(advDialog.teamBody, locale)}
                  </p>
                </div>

                {allCasesOffice.length ? (
                  <p className="text-body-compact text-pretty text-muted-foreground">
                    {pick(joinOfficeCopy.alreadyAdded, locale)}{" "}
                    <span className="font-medium text-foreground">
                      {allCasesOffice.map((person) => person.name).join(", ")}
                    </span>
                  </p>
                ) : null}

                {/* The office is suggested; any registered advocate or clerk can be
                    searched by name, number or Bar ID (owner, 2026-10-21, OFC-42). */}
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <PeopleInviteField
                      id="adv-team"
                      label={pick(advDialog.teamTitle, locale)}
                      known={directoryOptions(office.map((person) => person.phone)).filter(
                        (option) => !allCasesOffice.some((person) => person.phone === option.phone),
                      )}
                      value={team}
                      onValueChange={setTeam}
                      locale={locale}
                      registeredOnly
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!team.length}
                    onClick={sendInvites}
                  >
                    {pick(advDialog.teamSendInvite, locale)}
                  </Button>
                </div>

                {team.length ? (
                  <p className="text-body-compact text-muted-foreground">
                    {pick(advDialog.teamAddedNote, locale)}
                  </p>
                ) : null}

                {/* One-line confirmation: a single tick, then the numbers just invited,
                    inline and comma-separated. Replaced (not grown) on the next send. */}
                {teamInvited.length ? (
                  <p className="flex items-start gap-1.5 rounded-lg border border-success bg-success-muted px-3 py-2 text-body-compact font-medium text-success-muted-foreground">
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      {pick(advDialog.teamInviteSentNote, locale)}{" "}
                      <span className="tabular-nums">{teamInvited.join(", ")}</span>
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        </div>
        </div>

        {/* ------------------------------------------------------------ footer */}
        <footer
          className={`flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 pt-4 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))] sm:flex-row sm:items-center ${unpaidOutcome ? "sm:justify-end" : "sm:justify-between"} ${stage === "processing" ? "hidden" : ""}`}
        >
          {leaving ? (
            <>
              <Button type="button" variant="outline" onClick={() => setLeaving(false)}>
                {pick(advDialog.leaveStay, locale)}
              </Button>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {pick(advDialog.leaveGo, locale)}
              </Button>
            </>
          ) : (
            <>
            {stage === "lookup" ? (
              <>
                {mode === "summons" ? (
                  /* "Not my case?" is not a dead end: back to the summons's own case and its
                     code (owner, 2026-10-14). */
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setJoinCase(summonsCase);
                      setSearched(false);
                      setStage("code");
                    }}
                    data-icon="inline-start"
                  >
                    <ArrowLeftIcon aria-hidden />
                    {pick(joinDialog.backToSummonsCase, locale)}
                  </Button>
                ) : (
                  <span aria-hidden className="hidden sm:block" />
                )}
                <div className="flex items-center gap-2">
                  {/* Sandbox, under the flask as on Pay: whether another advocate already
                      named this one on a paid vakalatnama. Not modal — a modal menu inside
                      the dialog leaves the page pointer-locked once an item is chosen. */}
                  <DropdownMenu modal={false}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={pick(advDialog.lookupSandboxTip, locale)}
                            className="text-muted-foreground"
                          >
                            <FlaskConicalIcon aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>{pick(advDialog.lookupSandboxTip, locale)}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuLabel>{pick(advDialog.lookupSandboxLabel, locale)}</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={alreadyAdded ? "added" : "new"}
                        onValueChange={(value) => setAlreadyAdded(value === "added")}
                      >
                        <DropdownMenuRadioItem value="new">
                          {pick(advDialog.lookupSandboxNew, locale)}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="added">
                          {pick(advDialog.lookupSandboxAdded, locale)}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="submit"
                    form="adv-lookup"
                    data-icon="inline-start"
                    className="flex-1 sm:flex-none"
                  >
                    <SearchIcon aria-hidden />
                    {pick(advDialog.findAndJoin, locale)}
                  </Button>
                </div>
              </>
            ) : null}

            {stage === "invited" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStage("lookup")}
                  data-icon="inline-start"
                >
                  <ArrowLeftIcon aria-hidden />
                  {pick(joinDialog.back, locale)}
                </Button>
                <Button type="button" onClick={viewCase}>
                  {pick(joinDialog.viewCase, locale)}
                </Button>
              </>
            ) : null}

            {stage === "details" ? (
              <>
                {mode === "manual" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStage("code")}
                    data-icon="inline-start"
                  >
                    <ArrowLeftIcon aria-hidden />
                    {pick(joinDialog.back, locale)}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                    {locale === "ml" ? "ഇപ്പോൾ വേണ്ട" : "Not now"}
                  </Button>
                )}
                {/* Download sits next to the primary action as a compact icon; the label
                    rides in its hover tooltip. */}
                <div className="flex items-center gap-2">
                  <DownloadCaseFileButton
                    label={pick(joinDialog.downloadCaseFile, locale)}
                    onClick={() => setDownloadNotice(true)}
                  />
                  {/* Stacked footer on a phone: the primary fills the row beside
                      the icon, as wide as the Back button under it. */}
                  <Button
                    type="button"
                    className="flex-1 sm:flex-none"
                    onClick={() => setStage("account")}
                    data-icon="inline-end"
                  >
                    {pick(joinDialog.continue, locale)}
                    <ArrowRightIcon aria-hidden />
                  </Button>
                </div>
              </>
            ) : null}

            {stage === "account" ? (
              <>
                <Button type="button" variant="outline" disabled={switchingProfile} onClick={() => setStage("details")} data-icon="inline-start">
                  <ArrowLeftIcon aria-hidden />
                  {pick(joinDialog.back, locale)}
                </Button>
                <Button
                  type="button"
                  disabled={switchingProfile}
                  onClick={continueFromAccount}
                  data-icon="inline-end"
                >
                  {pick(joinDialog.continue, locale)}
                  <ArrowRightIcon aria-hidden />
                </Button>
              </>
            ) : null}

            {stage === "code" ? (
              <>
                {mode === "summons" && !searched ? (
                  /* The wrong summons, or a mistyped link: search for the right case. */
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCode("");
                      setCodeTouched(false);
                      setStage("lookup");
                    }}
                  >
                    {pick(joinDialog.notMyCase, locale)}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStage("lookup")}
                    data-icon="inline-start"
                  >
                    <ArrowLeftIcon aria-hidden />
                    {pick(joinDialog.back, locale)}
                  </Button>
                )}
                <Button type="submit" form="adv-code" data-icon="inline-end">
                  {pick(joinDialog.codeVerify, locale)}
                  <ArrowRightIcon aria-hidden />
                </Button>
              </>
            ) : null}

            {stage === "role" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  // Representation always follows the account step in both modes.
                  onClick={() => setStage("account")}
                  data-icon="inline-start"
                >
                  <ArrowLeftIcon aria-hidden />
                  {pick(joinDialog.back, locale)}
                </Button>
                <Button type="submit" form="adv-role" data-icon="inline-end">
                  {pick(joinDialog.continue, locale)}
                  <ArrowRightIcon aria-hidden />
                </Button>
              </>
            ) : null}

            {stage === "verify" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  data-icon="inline-start"
                  onClick={() => {
                    setVerifyTouched(false);
                    setStage("role");
                  }}
                >
                  <ArrowLeftIcon aria-hidden />
                  {pick(joinDialog.back, locale)}
                </Button>
                <Button type="submit" form="adv-verify" data-icon="inline-end">
                  {pick(joinDialog.continue, locale)}
                  <ArrowRightIcon aria-hidden />
                </Button>
              </>
            ) : null}

            {stage === "vakalatnama" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  data-icon="inline-start"
                  onClick={() => {
                    setVkTouched(false);
                    // Return to contact capture only if any litigant needed one;
                    // otherwise step straight back to the representation stage.
                    setStage(contactParties.length > 0 ? "verify" : "role");
                  }}
                >
                  <ArrowLeftIcon aria-hidden />
                  {pick(joinDialog.back, locale)}
                </Button>
                <Button type="submit" form="adv-vakalatnama" data-icon="inline-end">
                  {/* The fee is always due here, so the next step is payment. */}
                  {pick(joinDialog.continue, locale)}
                  <ArrowRightIcon aria-hidden />
                </Button>
              </>
            ) : null}

            {stage === "pay" ? (
              <>
                <Button type="button" variant="outline" onClick={payLater}>
                  {pick(advDialog.payLater, locale)}
                </Button>
                <div className="flex items-center gap-2">
                  {/* Sandbox, tucked under the flask as on Sign (owner, 2026-10-12): the
                      gateway's answer is a demo control, not part of the payment. */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={pick(advDialog.paySandboxTip, locale)}
                            className="text-muted-foreground"
                          >
                            <FlaskConicalIcon aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>{pick(advDialog.paySandboxTip, locale)}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>{pick(advDialog.payOutcomeLabel, locale)}</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={payOutcome}
                        onValueChange={(value) => setPayOutcome(value as "success" | "failed")}
                      >
                        <DropdownMenuRadioItem value="success">
                          {pick(advDialog.payOutcomeSuccess, locale)}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="failed">
                          {pick(advDialog.payOutcomeFailed, locale)}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button type="submit" form="adv-pay" className="flex-1 sm:flex-none">
                    {fill(advDialog.payNow, locale, { amount: fee })}
                  </Button>
                </div>
              </>
            ) : null}

            {stage === "paid" ? (
              <Button
                type="button"
                className="sm:ml-auto"
                onClick={() => setStage("done")}
                data-icon="inline-end"
              >
                {pick(joinDialog.continue, locale)}
                <ArrowRightIcon aria-hidden />
              </Button>
            ) : null}

            {stage === "done" ? (
              unpaidOutcome ? (
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  {pick(joinDialog.backHome, locale)}
                </Button>
              ) : side === "accused" ? (
                // Bail is an accused-side step; it leads only for the accused's advocate.
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={viewCase}
                  >
                    {pick(joinDialog.viewCase, locale)}
                  </Button>
                  <Button
                    type="button"
                    disabled={bailOpening}
                    onClick={openBail}
                    data-icon="inline-end"
                  >
                    {pick(joinDialog.fileBail, locale)}
                    <ArrowRightIcon aria-hidden />
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                    {pick(joinDialog.backHome, locale)}
                  </Button>
                  <Button
                    type="button"
                    onClick={viewCase}
                    data-icon="inline-end"
                  >
                    {pick(joinDialog.viewCase, locale)}
                    <ArrowRightIcon aria-hidden />
                  </Button>
                </>
              )
            ) : null}
            </>
          )}
        </footer>
      </FlowDialogContent>
    </Dialog>
    {bailOpen && joinCase ? (
      <JoinedCaseBail
        joinCase={joinCase}
        accused={selectedParties.map((party) => party.name)}
        as="advocate"
        onViewCase={() => router.push(`/cases/${JOIN_DEMO_CASE_ID}`)}
        onClose={() => {
          setBailOpen(false);
          handleOpenChange(false);
        }}
      />
    ) : null}
    </>
  );
}
