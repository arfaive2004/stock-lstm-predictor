# Signal Room — LSTM Stock Price Forecasting

A full-stack stock price forecasting app. Type any ticker; the backend fetches
its **live** daily closing prices, trains a **from-scratch NumPy LSTM** on
that series in real time, and forecasts forward with an honest, widening
uncertainty band. Nothing is precomputed or hardcoded — every run is a fresh
fetch and a fresh training pass.

```
stock-lstm-predictor/
├── backend/         FastAPI app — live data fetch + from-scratch LSTM
│   ├── main.py                  API entrypoint (/api/predict, /api/health)
│   ├── ml/
│   │   ├── lstm.py              LSTM forward/backward pass (BPTT) + Adam, in pure NumPy
│   │   ├── scaler.py            Min-max scaler
│   │   ├── pipeline.py          Orchestrates train → validate → forecast
│   │   └── indicators.py        SMA / RSI / volatility helpers
│   ├── services/
│   │   └── market_data.py       Live fetch: Yahoo Finance (primary) + Stooq (fallback)
│   ├── requirements.txt
│   └── vercel.json               Sets function maxDuration
│
├── frontend/         Next.js 16 + TypeScript + Tailwind + Recharts
│   ├── app/                      Pages, layout, global styles
│   ├── components/               Search bar, chart, stat panel, model readout, states
│   ├── lib/                      API client, types, formatters
│   └── package.json
│
└── README.md          (you are here)
```

## Why a from-scratch NumPy LSTM instead of TensorFlow/PyTorch?

Vercel's Python serverless functions have a bundle-size ceiling and a
cold-start budget that a full deep-learning framework eats into immediately —
TensorFlow alone is several hundred MB with its dependency tree, before your
own code runs. NumPy is a few MB and imports instantly.

That constraint turned into a better design anyway: instead of shipping one
pre-trained model file and serving predictions from it (which *would* be a
form of hardcoding), the backend trains a small, real LSTM — forward pass,
full backpropagation-through-time, Adam optimizer, early stopping — **on the
live data it just fetched, for whichever ticker you ask about**, in about
2–6 seconds. You can read the entire model in `backend/ml/lstm.py`; there's
no black box.

## How a request flows

1. **Frontend** sends `GET /api/predict?ticker=AAPL&horizon=14&range=2y`
2. **Backend** fetches live daily closes for `AAPL` from Yahoo Finance
   (falling back to Stooq if Yahoo doesn't answer)
3. The closes are min-max scaled and split into `(45-day window → next day)`
   training examples
4. A fresh `LSTMRegressor` (1 layer, 24 hidden units by default) trains with
   mini-batch Adam and early stopping
5. The model is walk-forward validated on the most recent held-out windows,
   giving an honest RMSE/MAPE
6. The model forecasts forward recursively for `horizon` trading days; the
   uncertainty band widens with `√step`, scaled by that validation RMSE
7. Everything — history, forecast, validation stats, model hyperparameters,
   technical indicators — comes back as one JSON payload the frontend renders

## Running it locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Visit `http://localhost:8000/api/health` to confirm it's up, and
`http://localhost:8000/docs` for the interactive Swagger UI (FastAPI gives you
this for free).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# .env.local should point at your local backend:
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Visit `http://localhost:3000`, type a ticker (e.g. `AAPL`), and run a
forecast.

## Disclaimer

This is an educational demonstration of sequence modeling and full-stack
deployment — **not financial advice**. A small LSTM trained only on past
price history has genuinely wide uncertainty over any real horizon. Don't
trade on it.
