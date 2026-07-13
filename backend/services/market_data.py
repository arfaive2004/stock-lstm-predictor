"""
Fetches real, live daily price history for a ticker at request time.

No prices are ever hardcoded or bundled with the app — every call hits a
public market-data source fresh. Two independent free, keyless sources are
used so a hiccup in one doesn't take the whole app down:

  1. Yahoo Finance's public chart endpoint (primary)
  2. Stooq's CSV endpoint (fallback)
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass

import numpy as np
import requests

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT = 8  # seconds


class TickerNotFoundError(Exception):
    pass


class MarketDataUnavailableError(Exception):
    pass


@dataclass
class PriceHistory:
    symbol: str
    dates: list[str]
    closes: np.ndarray
    volumes: list[float]
    currency: str | None
    exchange: str | None
    source: str


def _fetch_from_yahoo(symbol: str, price_range: str) -> PriceHistory:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    params = {"range": price_range, "interval": "1d", "includePrePost": "false"}
    resp = requests.get(
        url, params=params, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT
    )

    if resp.status_code == 404:
        raise TickerNotFoundError(f"'{symbol}' was not found.")
    resp.raise_for_status()

    payload = resp.json()
    chart = payload.get("chart", {})
    if chart.get("error"):
        raise TickerNotFoundError(f"'{symbol}' was not found.")

    results = chart.get("result") or []
    if not results:
        raise TickerNotFoundError(f"'{symbol}' returned no chart data.")

    result = results[0]
    timestamps = result.get("timestamp") or []
    quote = (result.get("indicators", {}).get("quote") or [{}])[0]
    closes_raw = quote.get("close") or []
    volumes_raw = quote.get("volume") or []
    meta = result.get("meta", {})

    if not timestamps or not closes_raw:
        raise MarketDataUnavailableError(f"No usable price series returned for '{symbol}'.")

    dates, closes, volumes = [], [], []
    for ts, close, vol in zip(timestamps, closes_raw, volumes_raw or [None] * len(timestamps)):
        if close is None:
            continue
        import datetime
        dates.append(datetime.datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d"))
        closes.append(float(close))
        volumes.append(float(vol) if vol is not None else 0.0)

    if len(closes) < 10:
        raise MarketDataUnavailableError(f"Not enough valid price points for '{symbol}'.")

    return PriceHistory(
        symbol=symbol.upper(),
        dates=dates,
        closes=np.array(closes, dtype=np.float64),
        volumes=volumes,
        currency=meta.get("currency"),
        exchange=meta.get("exchangeName"),
        source="yahoo",
    )


def _fetch_from_stooq(symbol: str) -> PriceHistory:
    candidates = [symbol.lower(), f"{symbol.lower()}.us"]
    last_err: Exception | None = None

    for candidate in candidates:
        try:
            url = "https://stooq.com/q/d/l/"
            resp = requests.get(
                url,
                params={"s": candidate, "i": "d"},
                headers={"User-Agent": USER_AGENT},
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            text = resp.text.strip()

            if not text or text.lower().startswith("no data") or "<html" in text.lower():
                continue

            reader = csv.DictReader(io.StringIO(text))
            dates, closes, volumes = [], [], []
            for row in reader:
                close = row.get("Close")
                if not close:
                    continue
                dates.append(row.get("Date", ""))
                closes.append(float(close))
                volumes.append(float(row.get("Volume") or 0.0))

            if len(closes) >= 10:
                return PriceHistory(
                    symbol=symbol.upper(),
                    dates=dates,
                    closes=np.array(closes, dtype=np.float64),
                    volumes=volumes,
                    currency=None,
                    exchange=None,
                    source="stooq",
                )
        except Exception as e:  # noqa: BLE001 — best-effort fallback loop
            last_err = e
            continue

    raise MarketDataUnavailableError(
        f"Stooq had no usable data for '{symbol}'."
        + (f" ({last_err})" if last_err else "")
    )


def fetch_price_history(symbol: str, price_range: str = "2y") -> PriceHistory:
    """
    Fetch live daily closes for `symbol`. Tries Yahoo Finance first, falls
    back to Stooq if Yahoo is unreachable or returns nothing usable.
    Raises TickerNotFoundError if neither source recognizes the symbol.
    """
    symbol = symbol.strip().upper()
    if not symbol or len(symbol) > 12 or not all(
        ch.isalnum() or ch in ".-^=" for ch in symbol
    ):
        raise TickerNotFoundError(f"'{symbol}' is not a valid ticker symbol.")

    try:
        return _fetch_from_yahoo(symbol, price_range)
    except TickerNotFoundError:
        raise
    except Exception:
        pass  # fall through to Stooq

    try:
        return _fetch_from_stooq(symbol)
    except MarketDataUnavailableError:
        raise TickerNotFoundError(
            f"Couldn't find live price history for '{symbol}' on any data source."
        )
