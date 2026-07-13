"use client";

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { ForecastResponse } from "@/lib/types";
import { formatCompactDate, formatCurrency } from "@/lib/format";

interface ChartRow {
  date: string;
  actual: number | null;
  forecast: number | null;
  lower: number | null;
  upper: number | null;
}

function buildChartData(data: ForecastResponse): ChartRow[] {
  // Keep the chart readable: recent history only, not the full multi-year series.
  const recentHistory = data.history.slice(-140);

  const rows: ChartRow[] = recentHistory.map((h) => ({
    date: h.date,
    actual: h.close,
    forecast: null,
    lower: null,
    upper: null,
  }));

  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    // stitch the forecast line onto the end of the actual line so there's no visual gap
    last.forecast = last.actual;
    last.lower = last.actual;
    last.upper = last.actual;
  }

  data.forecast.forEach((f) => {
    rows.push({ date: f.date, actual: null, forecast: f.price, lower: f.lower, upper: f.upper });
  });

  return rows;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const row: ChartRow = payload[0].payload;
  const isForecast = row.forecast !== null && row.actual === null;

  return (
    <div className="rounded-md border border-hairline bg-panel-raised px-3 py-2 shadow-lg">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-mist">
        {formatCompactDate(label)}
      </div>
      {isForecast ? (
        <>
          <div className="mt-1 font-mono text-sm text-amber">
            {formatCurrency(row.forecast as number)}
            <span className="ml-1.5 text-[10px] text-mist">forecast</span>
          </div>
          <div className="font-mono text-[10px] text-mist">
            range {formatCurrency(row.lower as number)} – {formatCurrency(row.upper as number)}
          </div>
        </>
      ) : (
        <div className="mt-1 font-mono text-sm text-paper">
          {formatCurrency(row.actual as number)}
          <span className="ml-1.5 text-[10px] text-mist">close</span>
        </div>
      )}
    </div>
  );
}

export default function ForecastChart({ data }: { data: ForecastResponse }) {
  const chartData = buildChartData(data);
  const boundaryDate = data.history[data.history.length - 1]?.date;

  const allValues = chartData.flatMap((r) =>
    [r.actual, r.forecast, r.lower, r.upper].filter((v): v is number => v !== null)
  );
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const pad = (max - min) * 0.08 || 1;

  const tickInterval = Math.max(Math.floor(chartData.length / 7), 1);

  return (
    <div className="rounded-lg border border-hairline bg-panel p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg italic text-paper">
            {data.symbol} · price &amp; forecast
          </h2>
          <p className="font-mono text-[11px] text-mist">
            {data.history.length} trading days fetched · last {chartData.length - data.forecast.length} shown
          </p>
        </div>
        <Legend />
      </div>

      <div className="h-[340px] w-full sm:h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="forecastStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E3A857" stopOpacity={1} />
                <stop offset="100%" stopColor="#E3A857" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="bandFill" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E3A857" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#E3A857" stopOpacity={0.06} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(237,239,243,0.06)" vertical={false} />

            <XAxis
              dataKey="date"
              tickFormatter={formatCompactDate}
              interval={tickInterval}
              tick={{ fill: "#8B93A3", fontSize: 11, fontFamily: "var(--font-plex-mono)" }}
              axisLine={{ stroke: "rgba(237,239,243,0.09)" }}
              tickLine={false}
            />
            <YAxis
              domain={[min - pad, max + pad]}
              tick={{ fill: "#8B93A3", fontSize: 11, fontFamily: "var(--font-plex-mono)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${Math.round(v)}`}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />

            {boundaryDate && (
              <ReferenceLine
                x={boundaryDate}
                stroke="rgba(237,239,243,0.22)"
                strokeDasharray="3 4"
                label={{
                  value: "today",
                  position: "insideTopLeft",
                  fill: "#8B93A3",
                  fontSize: 10,
                  fontFamily: "var(--font-plex-mono)",
                }}
              />
            )}

            {/* uncertainty band: upper area, then lower area painted in bg color to mask below it */}
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="url(#bandFill)"
              isAnimationActive={false}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="none"
              fill="#121826"
              fillOpacity={1}
              isAnimationActive={false}
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="actual"
              stroke="#EDEFF3"
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={true}
              animationDuration={900}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="url(#forecastStroke)"
              strokeWidth={2.25}
              strokeDasharray="0"
              dot={false}
              isAnimationActive={true}
              animationDuration={900}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 font-mono text-[11px] text-mist">
      <span className="flex items-center gap-1.5">
        <span className="h-[2px] w-4 bg-paper" /> history
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-[2px] w-4 bg-amber" /> LSTM forecast
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-amber-soft" /> uncertainty
      </span>
    </div>
  );
}
