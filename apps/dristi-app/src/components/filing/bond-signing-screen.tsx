"use client";

import * as React from "react";

import { StatusLine } from "@/components/feedback";
import { PenLineIcon } from "lucide-react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { BrandLockup } from "@/components/brand-lockup";
import { BondDocument, BondSignerList } from "@/components/filing/bond-document";
import { buildBondSigners } from "@/components/filing/bail-bond-status-dialog";
import { LOCALES, pick, ui, type Locale } from "@/lib/onboarding/content";
import { joinDialog } from "@/lib/join/content";
import { ACCESS_CASES } from "@/lib/access/content";
import {
  BOND_LITIGANT,
  BOND_SURETIES,
  BOND_THIRD_SURETY,
  bailDialog,
  bondCopy,
  fillCopy,
} from "@/lib/filing/content";
import { ADVOCATE_PROFILE_NAME } from "@/lib/advocate/content";

/**
 * `/bond` — where the SMS/email signing link lands. No sign-in: the person
 * enters the mobile number the court holds for them, the backend resolves
 * which party they are (litigant or which surety), and they see the bond,
 * everyone's signing status, and their own e-sign action.
 *
 */

const DEMO_CASE = ACCESS_CASES[0];
const ALL_SURETIES = [...BOND_SURETIES, BOND_THIRD_SURETY];
/** Index 0 = litigant, then sureties — mirrors the signer list order. */
const PARTY_PHONES = [BOND_LITIGANT.phone, ...ALL_SURETIES.map((entry) => entry.phone)];

export function BondSigningScreen() {
  const [locale, setLocale] = React.useState<Locale>("en");
  const [stage, setStage] = React.useState<"phone" | "status">("phone");
  const [phone, setPhone] = React.useState("");
  const [phoneTouched, setPhoneTouched] = React.useState(false);
  const [phoneUnknown, setPhoneUnknown] = React.useState(false);
  const [matchedPhone, setMatchedPhone] = React.useState<string | null>(null);
  const [signedSelf, setSignedSelf] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function submitPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhoneTouched(true);
    if (phone.length !== 10) return;
    if (!PARTY_PHONES.includes(phone)) {
      setPhoneUnknown(true);
      return;
    }
    setMatchedPhone(phone);
    setStage("status");
  }

  const suretyNames = ALL_SURETIES.map((entry) => entry.name);
  const signers = buildBondSigners({
    advocateName: ADVOCATE_PROFILE_NAME,
    litigantName: BOND_LITIGANT.name,
    suretyNames,
    locale,
    advocateSigned: true,
    allSigned: false,
    youPhone: matchedPhone ?? undefined,
    phones: PARTY_PHONES,
  }).map((signer) => (signer.you && signedSelf ? { ...signer, signed: true } : signer));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-4 md:px-6">
        <BrandLockup className="h-9" />
        <SegmentedControl
          size="compact"
          type="single"
          value={locale}
          onValueChange={(value) => value && setLocale(value as Locale)}
          aria-label={pick(ui.language, locale)}
        >
          {LOCALES.map((l) => (
            <SegmentedControlItem key={l.value} value={l.value}>
              {l.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </header>

      <main
        lang={locale}
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 md:py-12"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-title text-balance font-semibold">
            {pick(bondCopy.partyTitle, locale)}
          </h1>
          <p className="text-body text-pretty text-muted-foreground">
            {fillCopy(bondCopy.partyIntro, locale, {
              caseNumber: DEMO_CASE.caseNumber,
              title: DEMO_CASE.title,
            })}
          </p>
        </div>

        {stage === "phone" ? (
          <Card size="sm">
            <CardContent>
              <form noValidate className="flex flex-col gap-4" onSubmit={submitPhone}>
                <Field data-invalid={phoneTouched && (phone.length !== 10 || phoneUnknown)}>
                  <FieldLabel htmlFor="bond-party-phone">
                    {pick(bailDialog.phoneLabel, locale)}
                  </FieldLabel>
                  <Input
                    id="bond-party-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    autoFocus
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                      setPhoneTouched(false);
                      setPhoneUnknown(false);
                    }}
                  />
                  <FieldDescription>{pick(bondCopy.partyPhoneHelp, locale)}</FieldDescription>
                  <FieldError>
                    {phoneTouched && phone.length !== 10
                      ? pick(bailDialog.phoneError, locale)
                      : phoneUnknown
                        ? pick(bondCopy.partyPhoneUnknown, locale)
                        : null}
                  </FieldError>
                </Field>
                <p className="text-caption text-muted-foreground">
                  {pick(bondCopy.partyPhoneDemo, locale)}
                </p>
                <Button type="submit" className="self-start">
                  {pick(joinDialog.continue, locale)}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            {signedSelf ? (
              <StatusLine tone="success" title={pick(bondCopy.partySignedTitle, locale)}>
                {pick(bondCopy.partySignedBody, locale)}
              </StatusLine>
            ) : (
              <Banner variant="info">{pick(bailDialog.esignNote, locale)}</Banner>
            )}

            <Card size="sm">
              <CardContent className="flex flex-col gap-1">
                <p className="text-caption font-semibold text-muted-foreground">
                  {pick(bondCopy.esignStatusHeading, locale)}
                </p>
                <BondSignerList signers={signers} locale={locale} />
              </CardContent>
            </Card>

            <BondDocument accessCase={DEMO_CASE} suretyNames={suretyNames} locale={locale} />

            {!signedSelf ? (
              <Button
                type="button"
                className="self-start"
                data-icon="inline-start"
                onClick={() => setSignedSelf(true)}
              >
                <PenLineIcon aria-hidden />
                {pick(bondCopy.proceedEsign, locale)}
              </Button>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
