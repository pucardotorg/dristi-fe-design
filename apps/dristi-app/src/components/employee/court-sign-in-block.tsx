"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, LandmarkIcon } from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { CHARCOAL_PLATE } from "@/components/chrome/rail-plate";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setCourtSession } from "@/lib/employee/session";
import {
  accountFor,
  COURT_ACCOUNTS,
  COURT_SIGN_IN_ROLES,
  courtroomsFor,
} from "@/lib/employee/sign-in";

/**
 * `/employee/login` — the court's own door.
 *
 * **One form, no role step.** An earlier version asked which seat you were signing in
 * as before it showed the fields. The owner cut it on 2026-09-14 for the reason it could
 * only have been cut by somebody who has watched a court work: staff sign in for each
 * other constantly — a bench clerk opens the magistrate's account to get a thing done —
 * and a screen that makes you declare a role first taxes every one of those sign-ins for
 * a fact the back end already holds. The username says which seat it is. The screen asks
 * for the username.
 *
 * So the shape is username, password, the court room, one button. No registration line,
 * because court users are registered by the establishment; no OTP, so no method toggle;
 * no "forgot password", because a court password is reset by the establishment and a link
 * here would go nowhere.
 *
 * **The court room is chosen at the door, from the account's own list — not after.** An
 * employee is mapped to one or more court rooms (REG-35), and the PRD's model is that
 * they pick which to work in. That pick belongs *in* the sign-in, not on a step the other
 * side of it: a second screen to choose a room before the day can start is the mess the
 * owner asked to avoid (owner, 2026-09-16). So there is no free district-then-court
 * picker; the room field reads straight off the account the username names. A magistrate,
 * clerk or typist mapped to one room sees it confirmed, with nothing to pick (REG-36); a
 * scrutiny officer across a whole establishment picks from their list. The district is a
 * fact of the room, so it is not asked separately — it rides along with the room chosen
 * (`session.ts`). The list is read, never edited: rooms are added by the back end (REG-38).
 *
 * **It does not look like the citizen sign-in, on purpose.** That screen's plate is the
 * deep-teal marketing canvas — it is selling access to people who may never have seen the
 * product. This one is charcoal: `CHARCOAL_PLATE`, the exact ground the bench's own rail
 * is painted on, so the door is made of the same material as the room behind it. It is
 * narrower than the citizen plate too (a third of the page against four-ninths), because
 * it identifies rather than persuades.
 *
 * Signing in lands on Today's hearings, which is where the court's day actually starts.
 *
 * Nothing here authenticates. Every court URL was reachable before it existed and is
 * still reachable now.
 */

/** Where the court's day starts — and so where signing in lands. */
const AFTER_SIGN_IN = "/employee/hearings";

export function CourtSignInBlock() {
  const router = useRouter();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [revealed, setRevealed] = React.useState(false);
  /* Which fields failed, not what the failure reads as — the same rule the citizen
     sign-in keeps, so a message is never frozen into the state that produced it. */
  const [touched, setTouched] = React.useState(false);

  const typed = username.trim();
  const badUsername = touched && !typed;
  /* The account the typed username names, resolved live — it is what the court-room
     field reads from, so it cannot wait for a submit. */
  const account = accountFor(username);
  /* Said as a fact under the field, the way the citizen screen says it of an unknown
     number. There is no offer to register: nobody registers themselves here. */
  const unknownUsername = touched && Boolean(typed) && !account;
  const badPassword = touched && !password;

  const courtrooms = courtroomsFor(account);
  /* Which of the account's rooms the visit runs as — held by name, not index, and only
     as an override. The room in force is derived every render: the picked name if it is
     one of *this* account's rooms, else the top of the list (Court 1, where the fixtures
     live). So changing the username self-corrects — a name left over from another account
     simply falls back — and a single-room account needs no pick, it lands on its one room.
     No effect syncs this; the fallback is the whole of it. */
  const [courtroomName, setCourtroomName] = React.useState<string | null>(null);
  const courtroom =
    courtrooms.find((room) => room.name === courtroomName) ?? courtrooms[0] ?? null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!password) return;
    if (!account || !courtroom) return;

    /* The username is what decides the seat. Nothing on this screen asked for it and
       nothing on this screen can override it. The court room is the account's own; its
       district rides along with it. */
    setCourtSession({
      username: account.username,
      name: account.name,
      role: account.role,
      district: courtroom.district,
      court: courtroom.name,
    });
    router.push(AFTER_SIGN_IN);
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[1fr_auto] lg:h-dvh lg:min-h-0 lg:grid-cols-[4fr_5fr] lg:overflow-hidden">
      {/* The bench's own charcoal (`rail-plate.ts`), so the door is the same material as
          the room behind it — but warmed by the court's own teal rising from the foot of
          the plate, because court staff meet this screen every day and it should be worth
          meeting. Charcoal at the top where the mark and the promise sit; the green blooms
          up through the lower half. Still charcoal-rooted, not the citizen side's flat
          teal. Desktop only, like the citizen plate. */}
      <aside
        style={
          {
            ...CHARCOAL_PLATE.vars,
            /* A darker charcoal than the rail's own — local to this plate, so the rail
               elsewhere keeps its token. The teal still blooms from the foot over it. */
            "--court-plate": "color-mix(in srgb, var(--sidebar) 58%, #000)",
            background:
              "radial-gradient(85% 65% at 18% 106%, color-mix(in srgb, var(--rail-avatar) 58%, transparent) 0%, transparent 58%), linear-gradient(165deg, var(--court-plate) 0%, var(--court-plate) 44%, color-mix(in srgb, var(--brand-canvas) 78%, var(--court-plate)) 100%)",
          } as React.CSSProperties
        }
        className="relative hidden overflow-hidden px-12 py-12 text-(--sidebar-foreground) lg:row-span-2 lg:flex lg:flex-col"
      >
        <BrandLockup onDark className="relative h-12" />

        {/* Mark, then the promise, then who runs it — a different composition as well as a
            different colour from the citizen plate. The hero steps up to display scale
            because this plate is now the front of house, not a side note. */}
        <div className="relative flex flex-1 flex-col justify-center gap-4">
          <h2 className="text-title-l font-semibold tracking-tight text-balance sm:text-display-s">
            Every stage of a case, on one bench.
          </h2>
          <p className="max-w-md text-body text-(--rail-muted)">
            Secure access for the magistrates, bench clerks, scrutiny officers and
            typists of the district courts.
          </p>
        </div>

      </aside>

      {/* Form column. */}
      <div className="relative flex flex-col lg:col-start-2 lg:min-h-0">
        <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-4 border-b border-hairline bg-background px-6 py-4 lg:hidden">
          <BrandLockup className="h-8" />
        </header>

        <main className="flex flex-1 items-start justify-center overflow-y-auto px-6 pt-8 pb-12 lg:min-h-0 lg:items-center lg:px-12 lg:py-12">
          <div className="mx-auto flex w-full max-w-100 flex-col gap-6">
            {/* One token down the scale on phones, as the citizen screen steps. Controls
                do not step: 40px is the touch-target floor. */}
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-title-s text-balance font-semibold sm:text-title">
                Sign in to your court account
              </h1>
              <p className="text-body-compact text-muted-foreground sm:text-body">
                Use the username the court issued you.
              </p>
            </div>

            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
              <Field data-invalid={badUsername || unknownUsername}>
                <FieldLabel htmlFor="court-username">Username</FieldLabel>
                <Input
                  id="court-username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  placeholder="Enter your username"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setTouched(false);
                  }}
                />
                <FieldError>
                  {badUsername
                    ? "Enter your username."
                    : unknownUsername
                      ? "No court account has that username."
                      : null}
                </FieldError>
              </Field>

              <Field data-invalid={badPassword}>
                <FieldLabel htmlFor="court-password">Password</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="court-password"
                    name="password"
                    type={revealed ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setTouched(false);
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-sm"
                      aria-label={revealed ? "Hide password" : "Show password"}
                      aria-pressed={revealed}
                      onClick={() => setRevealed((value) => !value)}
                    >
                      {revealed ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError>
                  {badPassword ? "Enter your password." : null}
                </FieldError>
              </Field>

              {/* The court room, read from the account. It appears once the username
                  names a real account, because before that there is no list to show — a
                  free picker here would be inviting a choice the account has already made
                  (owner, 2026-09-16). One room is confirmed, not asked; several are
                  offered as a select. */}
              {account ? (
                courtrooms.length > 1 ? (
                  <Field>
                    <FieldLabel htmlFor="court-room">Court room</FieldLabel>
                    <Select
                      value={courtroom?.name ?? undefined}
                      onValueChange={setCourtroomName}
                    >
                      <SelectTrigger id="court-room" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {courtrooms.map((room) => (
                          <SelectItem key={room.name} value={room.name}>
                            {room.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      You cover {courtrooms.length} court rooms. Pick the one you are
                      working in today.
                    </FieldDescription>
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel>Court room</FieldLabel>
                    {/* A settled fact, not a control: a room the account holds alone has
                        nothing to choose (REG-36). Shown so the person knows which bench
                        they are about to enter, styled as a value at rest. */}
                    <div className="flex items-center gap-2.5 rounded-md border border-input bg-surface-sunken px-3 py-2.5">
                      <LandmarkIcon
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 truncate text-body-compact font-medium">
                        {courtroom?.name}
                      </span>
                    </div>
                    <FieldDescription>
                      You are mapped to this court room.
                    </FieldDescription>
                  </Field>
                )
              ) : null}

              <Button type="submit" size="lg" className="w-full">
                Sign in
              </Button>
            </form>

            <PrototypeAccounts onPick={setUsername} />
          </div>
        </main>
      </div>

      {/* The citizen sign-in's footer, to the character — three policies, dot-separated,
          under the form column only. Separator and link stay in one flex item so a wrap
          never strands a dot at the end of a line, which is exactly what happens at
          375px. The separators are decorative, so they stay out of the tree. */}
      <footer
        aria-label="About this site"
        className="flex flex-wrap items-center justify-center gap-x-2 border-t border-border px-6 py-2 text-caption text-muted-foreground lg:col-start-2 lg:px-12"
      >
        {[
          { label: "Terms of use", href: "/terms" },
          { label: "Privacy", href: "/privacy" },
          { label: "Support", href: "/support" },
        ].map((item, index) => (
          <span key={item.href} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden>·</span> : null}
            <Button
              variant="link"
              asChild
              className="h-10 px-0 text-caption text-muted-foreground"
            >
              <a href={item.href}>{item.label}</a>
            </Button>
          </span>
        ))}
      </footer>
    </div>
  );
}

/**
 * Scaffolding, and labelled as such — delete it with `sign-in.ts`.
 *
 * It is here because a demo account nobody can guess is a demo account nobody can use:
 * there is no directory behind this screen to look a username up in, and `sreelathaTypist`
 * is not a thing anyone types from memory. Each button fills the field and nothing else,
 * so the form above it stays the whole of the sign-in — this is a shortcut past typing,
 * not a step on the way in.
 *
 * It names usernames rather than roles on purpose. A row of roles would rebuild the role
 * chooser that was just taken out, one screen lower down.
 */
function PrototypeAccounts({ onPick }: { onPick: (username: string) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-4">
      <p className="text-caption text-muted-foreground">
        Prototype — any password works. Demo accounts:
      </p>
      <div className="flex flex-wrap gap-2">
        {COURT_SIGN_IN_ROLES.map((role) => (
          <Button
            key={role}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPick(COURT_ACCOUNTS[role].username)}
          >
            {COURT_ACCOUNTS[role].username}
          </Button>
        ))}
      </div>
    </div>
  );
}
