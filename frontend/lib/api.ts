import type { ForecastResponse, PredictParams, ApiErrorBody } from "./types";

/**
 * The backend URL is read from an environment variable — never hardcoded.
 * Set NEXT_PUBLIC_API_URL to your deployed FastAPI backend's base URL
 * (see .env.example / README for local + Vercel setup).
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export async function fetchForecast(params: PredictParams): Promise<ForecastResponse> {
  const search = new URLSearchParams({
    ticker: params.ticker.trim().toUpperCase(),
    horizon: String(params.horizon),
    lookback: String(params.lookback),
    range: params.range,
  });

  const res = await fetch(`${API_BASE}/api/predict?${search.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = (await res.json()) as ApiErrorBody;
      if (body?.detail) message = body.detail;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<ForecastResponse>;
}
