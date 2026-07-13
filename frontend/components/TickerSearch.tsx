"use client";

import { Search, Loader2 } from "lucide-react";
import type { PredictParams } from "@/lib/types";

const QUICK_PICKS = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN"];

const HORIZONS = [7, 14, 30] as const;
const RANGES: { value: PredictParams["range"]; label: string }[] = [
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "2y", label: "2Y" },
  { value: "5y", label: "5Y" },
];

interface Props {
  ticker: string;
  onTickerChange: (v: string) => void;
  horizon: number;
  onHorizonChange: (v: number) => void;
  range: PredictParams["range"];
  onRangeChange: (v: PredictParams["range"]) => void;
  onSubmit: (tickerOverride?: string) => void;
  loading: boolean;
}

export default function TickerSearch({
  ticker,
  onTickerChange,
  horizon,
  onHorizonChange,
  range,
  onRangeChange,
  onSubmit,
  loading,
}: Props) {
  return (
    <div className="rounded-lg border border-hairline bg-panel p-4 sm:p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label
            htmlFor="ticker-input"
            className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-mist"
          >
            Ticker
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
            <input
              id="ticker-input"
              type="text"
              value={ticker}
              onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
              placeholder="AAPL"
              maxLength={12}
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded-md border border-hairline bg-ink py-2.5 pl-9 pr-3 font-mono text-lg tracking-wide text-paper placeholder:text-mist/50 focus:border-amber-dim"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-mist">
            Horizon
          </label>
          <div className="flex rounded-md border border-hairline bg-ink p-1">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => onHorizonChange(h)}
                className={`rounded px-3 py-1.5 font-mono text-sm transition-colors ${
                  horizon === h
                    ? "bg-amber-soft text-amber"
                    : "text-mist hover:text-paper"
                }`}
              >
                {h}d
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-mist">
            History
          </label>
          <div className="flex rounded-md border border-hairline bg-ink p-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => onRangeChange(r.value)}
                className={`rounded px-3 py-1.5 font-mono text-sm transition-colors ${
                  range === r.value
                    ? "bg-amber-soft text-amber"
                    : "text-mist hover:text-paper"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || ticker.trim().length === 0}
          className="flex items-center justify-center gap-2 rounded-md bg-amber px-6 py-2.5 font-mono text-sm font-medium uppercase tracking-[0.08em] text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Training
            </>
          ) : (
            "Run forecast"
          )}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist">
          Quick pick
        </span>
        {QUICK_PICKS.map((sym) => (
          <button
            key={sym}
            type="button"
            onClick={() => {
              onTickerChange(sym);
              onSubmit(sym);
            }}
            className="rounded border border-hairline px-2.5 py-1 font-mono text-xs text-mist transition-colors hover:border-amber-dim hover:text-amber"
          >
            {sym}
          </button>
        ))}
      </div>
    </div>
  );
}
