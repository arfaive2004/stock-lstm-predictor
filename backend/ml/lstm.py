"""
A from-scratch LSTM (Long Short-Term Memory) network implemented in pure NumPy.

Why not TensorFlow / PyTorch / Keras?
--------------------------------------
Vercel's Python serverless functions have a bundle size ceiling and cold-start
budget that a full deep-learning framework blows through (TensorFlow alone is
several hundred MB with its transitive dependencies, and the import time on a
cold start can exceed the request timeout on its own). NumPy is a few MB and
imports instantly, which means this model trains *fresh, on-demand, on live
data* inside a single request/response cycle instead of relying on a
pre-baked model artifact shipped with the app.

This module implements:
  - Forward propagation through time for a single-layer LSTM
  - Full backpropagation-through-time (BPTT) for every gate
  - A small Adam optimizer
  - A thin `Dense` output head

The math follows the standard LSTM formulation (Hochreiter & Schmidhuber,
1997; gate conventions per Graves 2013):

    f_t = sigmoid(W_f . [h_{t-1}, x_t] + b_f)      forget gate
    i_t = sigmoid(W_i . [h_{t-1}, x_t] + b_i)      input gate
    g_t = tanh   (W_g . [h_{t-1}, x_t] + b_g)      candidate cell state
    o_t = sigmoid(W_o . [h_{t-1}, x_t] + b_o)      output gate
    c_t = f_t * c_{t-1} + i_t * g_t                cell state
    h_t = o_t * tanh(c_t)                          hidden state
"""

from __future__ import annotations

import numpy as np


def sigmoid(x: np.ndarray) -> np.ndarray:
    # clip to avoid overflow warnings on extreme logits
    x = np.clip(x, -60, 60)
    return 1.0 / (1.0 + np.exp(-x))


class AdamState:
    """Adam optimizer moments for a single parameter tensor."""

    __slots__ = ("m", "v", "t")

    def __init__(self, shape):
        self.m = np.zeros(shape)
        self.v = np.zeros(shape)
        self.t = 0


class Adam:
    def __init__(self, params: dict, lr: float = 0.01, beta1: float = 0.9,
                 beta2: float = 0.999, eps: float = 1e-8):
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.eps = eps
        self.states = {name: AdamState(p.shape) for name, p in params.items()}

    def step(self, params: dict, grads: dict):
        for name, p in params.items():
            g = grads[name]
            s = self.states[name]
            s.t += 1
            s.m = self.beta1 * s.m + (1 - self.beta1) * g
            s.v = self.beta2 * s.v + (1 - self.beta2) * (g * g)
            m_hat = s.m / (1 - self.beta1 ** s.t)
            v_hat = s.v / (1 - self.beta2 ** s.t)
            p -= self.lr * m_hat / (np.sqrt(v_hat) + self.eps)


class LSTMRegressor:
    """
    Single-layer LSTM followed by a linear (Dense) output unit, trained with
    full BPTT + Adam. Designed for many-to-one sequence regression (predict
    the next value given a window of past values).
    """

    def __init__(self, input_size: int, hidden_size: int, seed: int = 42):
        self.input_size = input_size
        self.hidden_size = hidden_size
        rng = np.random.default_rng(seed)

        z = input_size + hidden_size
        glorot = np.sqrt(1.0 / z)

        def w():
            return rng.uniform(-glorot, glorot, size=(z, hidden_size))

        self.params = {
            "Wf": w(), "Wi": w(), "Wg": w(), "Wo": w(),
            # forget-gate bias initialised to 1.0 — standard trick that keeps
            # gradients alive early in training by defaulting to "remember"
            "bf": np.ones(hidden_size),
            "bi": np.zeros(hidden_size),
            "bg": np.zeros(hidden_size),
            "bo": np.zeros(hidden_size),
            "Wy": rng.uniform(-glorot, glorot, size=(hidden_size, 1)),
            "by": np.zeros(1),
        }
        self.optimizer = Adam(self.params, lr=0.01)

    # ------------------------------------------------------------------ #
    # Forward pass
    # ------------------------------------------------------------------ #
    def _forward(self, X: np.ndarray):
        """
        X: (batch, seq_len, input_size)
        Returns predictions (batch, 1) and a cache used for backprop.
        """
        batch, seq_len, _ = X.shape
        H = self.hidden_size
        p = self.params

        h = np.zeros((batch, H))
        c = np.zeros((batch, H))

        cache = {
            "concat": [], "f": [], "i": [], "g": [], "o": [],
            "c": [], "c_prev": [], "h": [],
        }

        for t in range(seq_len):
            x_t = X[:, t, :]
            concat = np.concatenate([h, x_t], axis=1)  # (batch, H+input)

            f = sigmoid(concat @ p["Wf"] + p["bf"])
            i = sigmoid(concat @ p["Wi"] + p["bi"])
            g = np.tanh(concat @ p["Wg"] + p["bg"])
            o = sigmoid(concat @ p["Wo"] + p["bo"])

            c_prev = c
            c = f * c_prev + i * g
            h = o * np.tanh(c)

            cache["concat"].append(concat)
            cache["f"].append(f)
            cache["i"].append(i)
            cache["g"].append(g)
            cache["o"].append(o)
            cache["c"].append(c)
            cache["c_prev"].append(c_prev)
            cache["h"].append(h)

        y_pred = h @ p["Wy"] + p["by"]
        cache["h_final"] = h
        return y_pred, cache

    # ------------------------------------------------------------------ #
    # Backward pass (BPTT)
    # ------------------------------------------------------------------ #
    def _backward(self, X: np.ndarray, y_true: np.ndarray, y_pred: np.ndarray, cache: dict):
        batch, seq_len, input_size = X.shape
        H = self.hidden_size
        p = self.params

        grads = {k: np.zeros_like(v) for k, v in p.items()}

        # MSE loss gradient
        dy = (2.0 / batch) * (y_pred - y_true)  # (batch, 1)
        grads["Wy"] = cache["h_final"].T @ dy
        grads["by"] = dy.sum(axis=0)

        dh_next = dy @ p["Wy"].T  # (batch, H)
        dc_next = np.zeros((batch, H))

        for t in reversed(range(seq_len)):
            f, i, g, o = cache["f"][t], cache["i"][t], cache["g"][t], cache["o"][t]
            c, c_prev = cache["c"][t], cache["c_prev"][t]
            concat = cache["concat"][t]

            tanh_c = np.tanh(c)
            do = dh_next * tanh_c
            dc = dh_next * o * (1 - tanh_c ** 2) + dc_next

            df = dc * c_prev
            di = dc * g
            dg = dc * i
            dc_prev = dc * f

            # gate pre-activation gradients
            d_f_pre = df * f * (1 - f)
            d_i_pre = di * i * (1 - i)
            d_g_pre = dg * (1 - g ** 2)
            d_o_pre = do * o * (1 - o)

            grads["Wf"] += concat.T @ d_f_pre
            grads["Wi"] += concat.T @ d_i_pre
            grads["Wg"] += concat.T @ d_g_pre
            grads["Wo"] += concat.T @ d_o_pre
            grads["bf"] += d_f_pre.sum(axis=0)
            grads["bi"] += d_i_pre.sum(axis=0)
            grads["bg"] += d_g_pre.sum(axis=0)
            grads["bo"] += d_o_pre.sum(axis=0)

            d_concat = (
                d_f_pre @ p["Wf"].T + d_i_pre @ p["Wi"].T +
                d_g_pre @ p["Wg"].T + d_o_pre @ p["Wo"].T
            )
            dh_next = d_concat[:, :H]
            dc_next = dc_prev

        # gradient clipping (norm) — keeps BPTT stable on volatile price series
        for k in grads:
            np.clip(grads[k], -5.0, 5.0, out=grads[k])

        return grads

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def predict(self, X: np.ndarray) -> np.ndarray:
        y_pred, _ = self._forward(X)
        return y_pred

    def train(self, X: np.ndarray, y: np.ndarray, epochs: int = 100,
               batch_size: int = 256, seed: int = 7, verbose_every: int = 0,
               patience: int = 12, min_delta: float = 1e-5):
        """
        X: (n_samples, seq_len, input_size)
        y: (n_samples, 1)

        Trains with mini-batch Adam + early stopping: once the loss stops
        improving by at least `min_delta` for `patience` consecutive epochs,
        training stops early instead of grinding through the full epoch
        budget. This keeps runtime bounded for both quiet, easy-to-fit
        series and noisy ones, without hand-tuning an epoch count per stock.

        Returns the per-epoch MSE loss history.
        """
        n = X.shape[0]
        rng = np.random.default_rng(seed)
        history = []
        best_loss = np.inf
        stale_epochs = 0

        for epoch in range(epochs):
            order = rng.permutation(n)
            X_shuf, y_shuf = X[order], y[order]
            epoch_loss = 0.0
            n_batches = 0

            for start in range(0, n, batch_size):
                xb = X_shuf[start:start + batch_size]
                yb = y_shuf[start:start + batch_size]
                if xb.shape[0] == 0:
                    continue

                y_pred, cache = self._forward(xb)
                loss = float(np.mean((y_pred - yb) ** 2))
                grads = self._backward(xb, yb, y_pred, cache)
                self.optimizer.step(self.params, grads)

                epoch_loss += loss
                n_batches += 1

            avg_loss = epoch_loss / max(n_batches, 1)
            history.append(avg_loss)
            if verbose_every and epoch % verbose_every == 0:
                print(f"epoch {epoch:3d}  mse={avg_loss:.6f}")

            if best_loss - avg_loss > min_delta:
                best_loss = avg_loss
                stale_epochs = 0
            else:
                stale_epochs += 1
                if stale_epochs >= patience:
                    break

        return history
