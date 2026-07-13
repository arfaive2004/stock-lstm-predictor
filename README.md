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

## Deploying to Vercel

This repo deploys as **two separate Vercel projects from the same repo** —
one for the FastAPI backend, one for the Next.js frontend. This is the most
reliable path: it avoids Python cold-start/bundle-size edge cases entirely
(the backend only needs `numpy` + `requests` + `fastapi`, all lightweight),
and each half can be redeployed or scaled independently.

### 1. Push this project to GitHub

```bash
cd stock-lstm-predictor
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Deploy the backend

1. In the [Vercel dashboard](https://vercel.com/new), import the repo.
2. When asked for the **Root Directory**, choose `backend/`.
3. Vercel auto-detects the Python runtime from `requirements.txt` and
   `main.py` (which exposes a top-level `app = FastAPI()`) — no framework
   preset needed.
4. Deploy. Note the resulting URL, e.g. `https://your-backend.vercel.app`.
5. Confirm it works: visit `https://your-backend.vercel.app/api/health`.

**If you hit a timeout (504) on `/api/predict`:** go to the backend
project's **Settings → Functions** and confirm the max duration matches
`backend/vercel.json` (60s). Vercel Hobby projects historically defaulted to
a 10s cap; if your account still enforces that, either upgrade to Pro or
reduce load in `backend/ml/pipeline.py` (lower `hidden_size`, lower
`epochs`, or shorten `lookback`) — the defaults are already tuned to train
in a few seconds on a normal CPU, but Vercel's serverless CPUs vary.

### 3. Deploy the frontend

1. In the Vercel dashboard, import the **same repo again** as a second
   project.
2. Set **Root Directory** to `frontend/`. Vercel auto-detects Next.js.
3. Add an environment variable:
   - `NEXT_PUBLIC_API_URL` = the backend URL from step 2
     (e.g. `https://your-backend.vercel.app`, **no trailing slash**)
4. Deploy.

### 4. Lock down CORS (recommended)

By default the backend allows any origin (`*`) so it's easy to develop
against. Once your frontend URL is live, go to the **backend** project's
**Settings → Environment Variables** and add:

- `FRONTEND_ORIGIN` = `https://your-frontend.vercel.app`

Redeploy the backend. `backend/main.py` reads this variable and restricts
CORS to exactly that origin instead of `*`.

### 5. Done

Open your frontend URL, type a ticker, and the whole pipeline — live fetch,
fresh training, forecast — runs on Vercel.

## Configuration knobs

| Where | What | Default |
|---|---|---|
| `backend/main.py` query params | forecast horizon | 1–30 days, default 14 |
| `backend/main.py` query params | lookback window | 20–90 days, default 45 |
| `backend/main.py` query params | history fetched | `6mo` / `1y` / `2y` / `5y`, default `2y` |
| `backend/ml/pipeline.py` | LSTM hidden units | 24 |
| `backend/ml/pipeline.py` | max epochs (early-stopped) | 100 |
| `backend/vercel.json` | function max duration | 60s |

None of these are baked into the frontend or the response shape — change a
default and both ends keep working.

## A note on dependencies

`npm audit` will likely flag a **moderate** advisory in a `postcss` copy
bundled *inside* `next`'s own dependency tree (not the top-level `postcss`
this project pins, which is already patched). It's a build-time-only issue
in CSS stringification and not something an app author can force-fix without
downgrading Next.js itself — it's tracked upstream. Everything this project
directly controls (`next`, `react`, `postcss`, `fastapi`, `starlette`,
`uvicorn`) is pinned to a current, patched version as of July 2026.

## Disclaimer

This is an educational demonstration of sequence modeling and full-stack
deployment — **not financial advice**. A small LSTM trained only on past
price history has genuinely wide uncertainty over any real horizon. Don't
trade on it.
