"""
Orchestrates a full predict-on-demand run:

  1. windows the fetched closing-price series into (lookback -> next value)
     training examples
  2. trains a fresh LSTMRegressor on those windows (no pre-baked weights —
     every request trains its own model on the live data it just fetched)
  3. walk-forward validates on a held-out tail to get an honest error estimate
  4. recursively forecasts `horizon` future trading days
  5. builds a widening uncertainty band around the forecast, since a model's
     confidence in its own guess should shrink the further out it reaches
"""

from __future__ import annotations

import time
import numpy as np

from .lstm import LSTMRegressor
from .scaler import MinMaxScaler
from . import indicators


class InsufficientDataError(Exception):
    pass


def _build_windows(scaled: np.ndarray, lookback: int):
    X, y = [], []
    for i in range(len(scaled) - lookback):
        X.append(scaled[i:i + lookback])
        y.append(scaled[i + lookback])
    return np.array(X), np.array(y)


def run_forecast(
    closes: np.ndarray,
    horizon: int = 14,
    lookback: int = 45,
    hidden_size: int = 24,
    epochs: int = 100,
    batch_size: int = 256,
    seed: int = 42,
) -> dict:
    closes = np.asarray(closes, dtype=np.float64)

    min_required = lookback + 30  # need enough windows to train + validate meaningfully
    if len(closes) < min_required:
        raise InsufficientDataError(
            f"Need at least {min_required} trading days of history, got {len(closes)}."
        )

    scaler = MinMaxScaler((0.0, 1.0))
    scaled = scaler.fit_transform(closes).reshape(-1, 1)

    X, y = _build_windows(scaled, lookback)

    # last ~10% (min 15 windows) held out for walk-forward validation
    val_size = max(15, int(len(X) * 0.1))
    val_size = min(val_size, len(X) - 20)  # always leave >=20 windows to train on
    split = len(X) - val_size

    X_train, y_train = X[:split], y[:split]
    X_val, y_val = X[split:], y[split:]

    model = LSTMRegressor(input_size=1, hidden_size=hidden_size, seed=seed)

    t0 = time.time()
    loss_history = model.train(
        X_train, y_train,
        epochs=epochs,
        batch_size=min(batch_size, len(X_train)),
        seed=seed,
    )
    train_seconds = time.time() - t0

    # --- validation: how far off was the model on unseen recent windows? ---
    val_pred_scaled = model.predict(X_val)
    val_pred_prices = scaler.inverse_transform(val_pred_scaled.flatten())
    val_true_prices = scaler.inverse_transform(y_val.flatten())

    val_rmse = float(np.sqrt(np.mean((val_pred_prices - val_true_prices) ** 2)))
    val_mape = float(np.mean(np.abs((val_true_prices - val_pred_prices) / val_true_prices)) * 100)

    # --- recursive multi-step forecast into the future ---
    window = scaled[-lookback:].copy()
    future_scaled = []
    for _ in range(horizon):
        x_in = window.reshape(1, lookback, 1)
        next_scaled = model.predict(x_in)[0, 0]
        # clip so a runaway extrapolation can't leave the learned [0, 1] range by much
        next_scaled = float(np.clip(next_scaled, -0.15, 1.15))
        future_scaled.append(next_scaled)
        window = np.vstack([window[1:], [[next_scaled]]])

    future_prices = scaler.inverse_transform(np.array(future_scaled))

    last_price = float(closes[-1])

    # Uncertainty band: grows with sqrt(step-ahead), a standard random-walk-style
    # heuristic, anchored to the model's own validation RMSE. This is a
    # transparent approximation, not a calibrated statistical interval —
    # documented as such in the API response and the UI.
    band = [val_rmse * np.sqrt(step + 1) for step in range(horizon)]

    forecast_points = []
    for i, price in enumerate(future_prices):
        forecast_points.append({
            "step": i + 1,
            "price": round(float(price), 4),
            "lower": round(float(price - band[i]), 4),
            "upper": round(float(price + band[i]), 4),
        })

    predicted_price = float(future_prices[-1])
    change_abs = predicted_price - last_price
    change_pct = (change_abs / last_price) * 100 if last_price else 0.0

    return {
        "forecast": forecast_points,
        "last_price": round(last_price, 4),
        "predicted_price": round(predicted_price, 4),
        "predicted_change_abs": round(change_abs, 4),
        "predicted_change_pct": round(change_pct, 4),
        "validation": {
            "rmse": round(val_rmse, 4),
            "mape_pct": round(val_mape, 4),
            "val_windows": int(len(X_val)),
        },
        "model": {
            "architecture": "1-layer LSTM (from-scratch NumPy) + linear head",
            "hidden_units": hidden_size,
            "lookback_days": lookback,
            "train_windows": int(len(X_train)),
            "epochs_run": len(loss_history),
            "final_train_mse": round(float(loss_history[-1]), 6),
            "train_seconds": round(train_seconds, 2),
        },
        "indicators": {
            "sma_20": indicators.simple_moving_average(closes, 20),
            "sma_50": indicators.simple_moving_average(closes, 50),
            "rsi_14": indicators.rsi(closes, 14),
            "annualized_volatility_pct": indicators.annualized_volatility(closes),
        },
    }
