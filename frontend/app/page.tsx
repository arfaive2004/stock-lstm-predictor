"use client";

import { useState, useCallback } from "react";
import Header from "@/components/Header";
import TickerSearch from "@/components/TickerSearch";
import ForecastChart from "@/components/ForecastChart";
import StatPanel from "@/components/StatPanel";
import ModelReadout from "@/components/ModelReadout";
import EmptyState from "@/components/EmptyState";
import ErrorPanel from "@/components/ErrorPanel";
import LoadingState from "@/components/LoadingState";
import MethodologyNote from "@/components/MethodologyNote";
import { fetchForecast, ApiError } from "@/lib/api";
import type { ForecastResponse, PredictParams } from "@/lib/types";

export default function Home() {
  const [ticker, setTicker] = useState("");
  const [horizon, setHorizon] = useState(14);
  const [range, setRange] = useState<PredictParams["range"]>("2y");

  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);

  const runForecast = useCallback(
    async (tickerOverride?: string) => {
      const symbol = (tickerOverride ?? ticker).trim();
      if (!symbol) return;

      setLoading(true);
      setError(null);

      try {
        const result = await fetchForecast({ ticker: symbol, horizon, lookback: 45, range });
        setData(result);
      } catch (e) {
        if (e instanceof ApiError) {
          setError({ message: e.message, status: e.status });
        } else {
          setError({ message: "Something went wrong reaching the backend." });
        }
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [ticker, horizon, range]
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl">
      <Header />

      <div className="px-6 py-8 sm:px-10">
        <TickerSearch
          ticker={ticker}
          onTickerChange={setTicker}
          horizon={horizon}
          onHorizonChange={setHorizon}
          range={range}
          onRangeChange={setRange}
          onSubmit={runForecast}
          loading={loading}
        />

        <div className="mt-6">
          {loading && <LoadingState />}

          {!loading && error && <ErrorPanel message={error.message} status={error.status} />}

          {!loading && !error && !data && <EmptyState />}

          {!loading && !error && data && (
            <div className="animate-rise flex flex-col gap-6">
              <StatPanel data={data} />
              <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                <ForecastChart data={data} />
                <ModelReadout data={data} />
              </div>
            </div>
          )}
        </div>
      </div>

      <MethodologyNote />
    </main>
  );
}
