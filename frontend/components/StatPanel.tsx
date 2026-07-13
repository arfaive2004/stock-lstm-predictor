import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ForecastResponse } from "@/lib/types";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "rally" | "drop" | "amber" | "none";
}) {
  const accentClass =
    accent === "rally"
      ? "text-rally"
      : accent === "drop"
      ? "text-drop"
      : accent === "amber"
      ? "text-amber"
      : "text-paper";

  return (
    <div className="rounded-lg border border-hairline bg-panel p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist">{label}</div>
      <div className={`mt-1.5 font-mono text-xl tabular ${accentClass}`}>{value}</div>
      {sub && <div className="mt-0.5 font-mono text-[11px] text-mist">{sub}</div>}
    </div>
  );
}

export default function StatPanel({ data }: { data: ForecastResponse }) {
  const currency = data.currency ?? "USD";
  const change = data.predicted_change_pct;
  const isUp = change > 0.05;
  const isDown = change < -0.05;
  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Last close" value={formatCurrency(data.last_price, currency)} />
      <StatCard
        label={`Predicted (${data.forecast.length}d)`}
        value={formatCurrency(data.predicted_price, currency)}
        accent="amber"
      />
      <div className="rounded-lg border border-hairline bg-panel p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist">
          Projected move
        </div>
        <div
          className={`mt-1.5 flex items-center gap-1.5 font-mono text-xl tabular ${
            isUp ? "text-rally" : isDown ? "text-drop" : "text-paper"
          }`}
        >
          <TrendIcon className="h-4 w-4" strokeWidth={2.5} />
          {formatPercent(change)}
        </div>
      </div>
      <StatCard
        label="Model RMSE"
        value={formatCurrency(data.validation.rmse, currency)}
        sub={`${formatNumber(data.validation.mape_pct)}% MAPE on holdout`}
      />
      <StatCard
        label="RSI (14)"
        value={data.indicators.rsi_14 !== null ? formatNumber(data.indicators.rsi_14, 1) : "—"}
        sub={
          data.indicators.rsi_14 !== null
            ? data.indicators.rsi_14 > 70
              ? "overbought zone"
              : data.indicators.rsi_14 < 30
              ? "oversold zone"
              : "neutral zone"
            : undefined
        }
      />
      <StatCard
        label="Volatility (ann.)"
        value={
          data.indicators.annualized_volatility_pct !== null
            ? `${formatNumber(data.indicators.annualized_volatility_pct, 1)}%`
            : "—"
        }
      />
    </div>
  );
}
