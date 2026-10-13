"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCount } from "@/lib/employee/register-rows";

export type CountBar = {
  /** The axis label: "Oct", "8–14". */
  short: string;
  /** The full name, for the tooltip and the table: "Oct 2025", "8–14 days". */
  label: string;
  value: number;
};

/**
 * One series of counts as bars, on the DS chart primitive and its first series colour.
 *
 * Values are printed on the bars rather than left to the tooltip — the tooltip is a
 * pointer and keyboard extra (the DS `accessibilityLayer`), never the only way to read a
 * number. Every bar carries its value: labelling only some read as an arbitrary pick
 * (owner, 2026-10-11). A visually hidden table carries the same numbers for a screen
 * reader.
 */
export function CountBarChart({
  title,
  unit,
  data,
}: {
  /** What the chart shows; names its table and the chart region. */
  title: string;
  /** The counted thing, for the tooltip: "judgements", "cases". */
  unit: string;
  data: CountBar[];
}) {
  const config = {
    value: { label: unit.charAt(0).toUpperCase() + unit.slice(1), color: "var(--color-chart-1)" },
  } satisfies ChartConfig;
  const points = data.map((bar) => ({ ...bar, shown: formatCount(bar.value) }));

  return (
    <figure className="flex min-w-0 flex-col">
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <BarChart
          accessibilityLayer
          title={title}
          data={points}
          margin={{ top: 24, right: 4, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey="short" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickFormatter={(value: number) => formatCount(value)}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  (payload?.[0]?.payload as CountBar | undefined)?.label ?? ""
                }
              />
            }
          />
          <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="shown" position="top" offset={6} className="fill-foreground tabular-nums" />
          </Bar>
        </BarChart>
      </ChartContainer>
      {/* Hidden on a wrapper, not the table: a table cannot shrink below its content,
          so `sr-only` on the table itself still widened the page at a phone's width. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">{config.value.label}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((bar) => (
              <tr key={bar.label}>
                <th scope="row">{bar.label}</th>
                <td>{formatCount(bar.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
