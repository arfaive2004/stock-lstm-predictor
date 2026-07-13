"""
FastAPI backend for the LSTM stock forecasting app.

Every prediction is generated fresh, per request:
  1. Live daily closes are fetched for the requested ticker
  2. A brand-new LSTM is trained on that series (see ml/lstm.py — a
     from-scratch NumPy implementation, no TensorFlow/PyTorch)
  3. The trained model forecasts forward and the result is returned

Nothing about a specific ticker or its prices is hardcoded anywhere in this
codebase — change the `ticker` query param and you get a fresh fetch, a
fresh training run, and a fresh forecast.
"""

from __future__ import annotations

import datetime
import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ml.pipeline import run_forecast, InsufficientDataError
from services.market_data import (
    fetch_price_history,
    TickerNotFoundError,
    MarketDataUnavailableError,
)

app = FastAPI(
    title="LSTM Stock Forecast API",
    description="Trains a fresh from-scratch NumPy LSTM on live price data and forecasts forward.",
    version="1.0.0",
)

# Restrict to the deployed frontend origin in production via FRONTEND_ORIGIN;
# falls back to "*" for local development / preview convenience.
_frontend_origin = os.environ.get("FRONTEND_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend_origin] if _frontend_origin != "*" else ["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

VALID_RANGES = {"6mo", "1y", "2y", "5y"}


def _next_business_days(start: datetime.date, n: int) -> list[str]:
    """Approximate future trading dates by skipping weekends. Doesn't
    account for market holidays — documented as an approximation."""
    out = []
    d = start
    while len(out) < n:
        d = d + datetime.timedelta(days=1)
        if d.weekday() < 5:  # Mon-Fri
            out.append(d.isoformat())
    return out


@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.datetime.utcnow().isoformat()}


class ForecastResponse(BaseModel):
    symbol: str
    exchange: str | None
    currency: str | None
    source: str
    history: list[dict]
    forecast: list[dict]
    last_price: float
    predicted_price: float
    predicted_change_abs: float
    predicted_change_pct: float
    validation: dict
    model: dict
    indicators: dict
    generated_at: str


@app.get("/api/predict", response_model=ForecastResponse)
def predict(
    ticker: str = Query(..., min_length=1, max_length=12, description="Ticker symbol, e.g. AAPL"),
    horizon: int = Query(14, ge=1, le=30, description="Trading days to forecast forward"),
    lookback: int = Query(45, ge=20, le=90, description="Days of history the model looks at per training window"),
    range: str = Query("2y", description="Amount of history to fetch: 6mo, 1y, 2y, 5y"),
):
    if range not in VALID_RANGES:
        raise HTTPException(status_code=400, detail=f"range must be one of {sorted(VALID_RANGES)}")

    try:
        history = fetch_price_history(ticker, price_range=range)
    except TickerNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except MarketDataUnavailableError as e:
        raise HTTPException(status_code=502, detail=str(e))

    try:
        result = run_forecast(history.closes, horizon=horizon, lookback=lookback)
    except InsufficientDataError as e:
        raise HTTPException(status_code=422, detail=str(e))

    last_date = datetime.date.fromisoformat(history.dates[-1])
    future_dates = _next_business_days(last_date, horizon)
    for point, date in zip(result["forecast"], future_dates):
        point["date"] = date

    history_points = [
        {"date": d, "close": round(c, 4)}
        for d, c in zip(history.dates, history.closes.tolist())
    ]

    return {
        "symbol": history.symbol,
        "exchange": history.exchange,
        "currency": history.currency or "USD",
        "source": history.source,
        "history": history_points,
        "forecast": result["forecast"],
        "last_price": result["last_price"],
        "predicted_price": result["predicted_price"],
        "predicted_change_abs": result["predicted_change_abs"],
        "predicted_change_pct": result["predicted_change_pct"],
        "validation": result["validation"],
        "model": result["model"],
        "indicators": result["indicators"],
        "generated_at": datetime.datetime.utcnow().isoformat(),
    }
