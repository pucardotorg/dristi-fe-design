import {
  CreditCardIcon,
  FileTextIcon,
  MailIcon,
  MapPinIcon,
  PenToolIcon,
  ScaleIcon,
  UserIcon,
  UserSearchIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import type { GroupIcon } from "@/lib/employee/scrutiny/types";

/** Group-card glyphs. Named per group so the fixture data never carries JSX. */
export const GROUP_ICONS: Record<GroupIcon, LucideIcon> = {
  user: UserIcon,
  userSearch: UserSearchIcon,
  scale: ScaleIcon,
  cheque: CreditCardIcon,
  memo: FileTextIcon,
  mail: MailIcon,
  pin: MapPinIcon,
  doc: FileTextIcon,
  pen: PenToolIcon,
  wallet: WalletIcon,
};
