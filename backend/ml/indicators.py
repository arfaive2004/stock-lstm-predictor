"""Small technical-indicator helpers, computed straight from fetched closes.

Nothing here is hardcoded per-ticker — every value is derived from whatever
price series was just fetched for the requested symbol.
"""

from __future__ import annotations
import numpy as np


def simple_moving_average(closes: np.ndarray, window: int) -> float | None:
    if len(closes) < window:
        return None
    return float(np.mean(closes[-window:]))


def annualized_volatility(closes: np.ndarray) -> float | None:
    if len(closes) < 2:
        return None
    log_returns = np.diff(np.log(closes))
    if len(log_returns) == 0:
        return None
    return float(np.std(log_returns) * np.sqrt(252) * 100)


def rsi(closes: np.ndarray, period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    deltas = np.diff(closes[-(period + 1):])
    gains = np.clip(deltas, 0, None)
    losses = np.clip(-deltas, 0, None)
    avg_gain = np.mean(gains)
    avg_loss = np.mean(losses)
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return float(100 - (100 / (1 + rs)))
