"use client";

import * as React from "react";

/**
 * Does the viewer hold this case only through office access (`lib/cases/viewer`)?
 * Office access works on the case like the advocate, but never e-signs (OFC-06):
 * the signing flows under the case page read this to drop their e-sign route.
 * Absent means the vakalatnama, so screens outside a case page are unchanged.
 */
const CaseOfficeAccessContext = React.createContext(false);

export function CaseOfficeAccessProvider({
  office,
  children,
}: {
  office: boolean;
  children: React.ReactNode;
}) {
  return (
    <CaseOfficeAccessContext.Provider value={office}>{children}</CaseOfficeAccessContext.Provider>
  );
}

export function useCaseOfficeAccess(): boolean {
  return React.useContext(CaseOfficeAccessContext);
}

/** Said wherever e-signing is withheld for office access. */
export const OFFICE_NO_ESIGN =
  "You hold office access on this case, so you cannot e-sign. Upload a copy signed by an advocate on the vakalatnama.";
