"use client";

/**
 * The stepper band the Add-people dialogs share. The DS stepper joins each circle
 * to the next edge to edge (owner, Sept 1: no visible gap at either end), so this
 * only names the band for assistive tech.
 */

import { Stepper, StepperItem } from "@/components/ui/stepper";

export function FlowStepper({
  steps,
  current,
  label,
}: {
  steps: ReadonlyArray<{ step: number; title: string }>;
  current: number;
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <Stepper>
        {steps.map((item) => (
          <StepperItem
            key={item.step}
            step={item.step}
            title={item.title}
            status={
              item.step < current
                ? "complete"
                : item.step === current
                  ? "current"
                  : "upcoming"
            }
            aria-current={item.step === current ? "step" : undefined}
          />
        ))}
      </Stepper>
    </nav>
  );
}
