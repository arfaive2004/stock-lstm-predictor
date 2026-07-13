export interface HistoryPoint {
  date: string;
  close: number;
}

export interface ForecastPoint {
  step: number;
  date: string;
  price: number;
  lower: number;
  upper: number;
}

export interface ValidationStats {
  rmse: number;
  mape_pct: number;
  val_windows: number;
}

export interface ModelInfo {
  architecture: string;
  hidden_units: number;
  lookback_days: number;
  train_windows: number;
  epochs_run: number;
  final_train_mse: number;
  train_seconds: number;
}

export interface Indicators {
  sma_20: number | null;
  sma_50: number | null;
  rsi_14: number | null;
  annualized_volatility_pct: number | null;
}

export interface ForecastResponse {
  symbol: string;
  exchange: string | null;
  currency: string | null;
  source: string;
  history: HistoryPoint[];
  forecast: ForecastPoint[];
  last_price: number;
  predicted_price: number;
  predicted_change_abs: number;
  predicted_change_pct: number;
  validation: ValidationStats;
  model: ModelInfo;
  indicators: Indicators;
  generated_at: string;
}

export interface ApiErrorBody {
  detail: string;
}

export interface PredictParams {
  ticker: string;
  horizon: number;
  lookback: number;
  range: "6mo" | "1y" | "2y" | "5y";
}
