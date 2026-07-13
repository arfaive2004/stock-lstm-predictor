"""Minimal Min-Max scaler (avoids pulling in scikit-learn just for this)."""

from __future__ import annotations
import numpy as np


class MinMaxScaler:
    def __init__(self, feature_range: tuple[float, float] = (0.0, 1.0)):
        self.lo, self.hi = feature_range
        self.data_min_ = None
        self.data_max_ = None

    def fit(self, x: np.ndarray) -> "MinMaxScaler":
        self.data_min_ = float(np.min(x))
        self.data_max_ = float(np.max(x))
        if self.data_max_ - self.data_min_ < 1e-8:
            # flat series guard — avoid divide-by-zero
            self.data_max_ = self.data_min_ + 1e-8
        return self

    def transform(self, x: np.ndarray) -> np.ndarray:
        scaled = (x - self.data_min_) / (self.data_max_ - self.data_min_)
        return scaled * (self.hi - self.lo) + self.lo

    def fit_transform(self, x: np.ndarray) -> np.ndarray:
        return self.fit(x).transform(x)

    def inverse_transform(self, x: np.ndarray) -> np.ndarray:
        unscaled = (x - self.lo) / (self.hi - self.lo)
        return unscaled * (self.data_max_ - self.data_min_) + self.data_min_
