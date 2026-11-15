"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from "recharts";

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
  /** A period not over yet (this month so far): drawn lighter. */
  partial?: boolean;
};

/**
 * One series of counts as bars, on the DS chart primitive and its first series colour.
 *
 * Values are printed on the bars rather than left to the tooltip — the tooltip is a
 * pointer and keyboard extra (the DS `accessibilityLayer`), never the only way to read a
 * number. Every bar carries its value: labelling only some read as an arbitrary pick
 * (owner, 2026-10-11). A visually hidden table carries the same numbers for a screen
 * reader.
 *
 * Optional: a `target` drawn as a dashed line across the bars (the magistrate's monthly
 * judgment target), and a `partial` last bar drawn in the brand's muted fill with a solid
 * edge, so a month not over yet is not read as a low month. No key under the chart
 * (owner, 2026-11-15): the target is named in the panel's header, and the hidden table
 * names both for a screen reader.
 */
export function CountBarChart({
  title,
  unit,
  data,
  target = null,
  targetName = "Target",
  surface = "var(--color-card)",
}: {
  /** What the chart shows; names its table and the chart region. */
  title: string;
  /** The counted thing, for the tooltip: "judgements", "cases". */
  unit: string;
  data: CountBar[];
  /** A level to draw across the bars; `null` for none. */
  target?: number | null;
  /** What the line is called in the hidden table: "Your target". */
  targetName?: string;
  /** The fill the chart sits on: each bar's number is ringed in it, so a target line
      passing behind a number never runs through it. */
  surface?: string;
}) {
  const config = {
    value: { label: unit.charAt(0).toUpperCase() + unit.slice(1), color: "var(--color-chart-1)" },
  } satisfies ChartConfig;
  const points = data.map((bar) => ({ ...bar, shown: formatCount(bar.value) }));

  return (
    <figure className="flex min-w-0 flex-col gap-2">
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
          {target !== null ? (
            <ReferenceLine y={target} stroke="var(--color-foreground)" strokeWidth={1.5} strokeDasharray="6 4" ifOverflow="extendDomain" />
          ) : null}
          <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {points.map((bar) => (
              <Cell
                key={bar.label}
                fill={bar.partial ? "var(--color-brand-muted)" : "var(--color-value)"}
                stroke={bar.partial ? "var(--color-value)" : "none"}
                strokeWidth={bar.partial ? 1.5 : 0}
              />
            ))}
            <LabelList
              dataKey="shown"
              position="top"
              offset={6}
              className="fill-foreground tabular-nums"
              stroke={surface}
              strokeWidth={4}
              paintOrder="stroke"
            />
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
              {target !== null ? <th scope="col">{targetName}</th> : null}
            </tr>
          </thead>
          <tbody>
            {data.map((bar) => (
              <tr key={bar.label}>
                <th scope="row">
                  {bar.label}
                  {bar.partial ? ", not over yet" : ""}
                </th>
                <td>{formatCount(bar.value)}</td>
                {target !== null ? <td>{formatCount(target)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
