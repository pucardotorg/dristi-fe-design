import type * as React from "react";

export type Persona = "adv" | "lit" | "mag" | "staff";

export type Flow = { name: string; who: Persona[]; file: string };

export type Lane = {
  id: string;
  name: string;
  weight: 0 | 1 | 2 | 3 | 4;
  note: string;
  specimens: { label: string; now: React.ReactNode; next: React.ReactNode; why: string }[];
  flows: Flow[];
};

export const f = (name: string, who: Persona[], file: string): Flow => ({ name, who, file });
