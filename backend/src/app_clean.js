/**
 * backend/src/app_clean.js
 * A clean Express app used temporarily for smoke tests while original app.js is restored.
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;
const GCN_SERVICE_URL = process.env.GCN_SERVICE_URL || 'http://localhost:8000';

let BacktestEngine = null;
let metrics = null;
let riskManager = null;
try { BacktestEngine = require('./engine/backtestEngine'); } catch (e) { /* optional */ }
try { metrics = require('./analytics/metrics'); } catch (e) { /* optional */ }
try { riskManager = require('./risk/riskManager'); } catch (e) { /* optional */ }

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => { console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`); next(); });

function generateMockData({ days = 365, startPrice = 100, volatility = 0.02 } = {}) {
  const d = [];
  let price = startPrice;
  const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate); date.setDate(date.getDate() + i);
    const change = (Math.random() - 0.5) * 2 * volatility;
    price = price * (1 + change);
    d.push({ date: date.toISOString().split('T')[0], open: price, high: price * 1.01, low: price * 0.99, close: parseFloat(price.toFixed(2)), volume: 1000000 });
  }
  return d;
}

function runSimpleBacktest({ data = [], initialCapital = 100000, positionSize = 1 } = {}) {
  const trades = [];
  let cash = initialCapital;
  let shares = 0;
  const equityCurve = [];
  for (let i = 0; i < data.length; i++) {
    const today = data[i];
    const prev = i > 0 ? data[i - 1].close : today.close;
    if (today.close > prev && shares === 0) {
      const buy = Math.floor((cash * positionSize) / today.close);
      if (buy > 0) { shares = buy; cash -= buy * today.close; trades.push({ date: today.date, action: 'BUY', price: today.close, shares: buy }); }
    } else if (today.close < prev && shares > 0) {
      cash += shares * today.close; trades.push({ date: today.date, action: 'SELL', price: today.close, shares }); shares = 0;
    }
    equityCurve.push({ date: today.date, equity: cash + shares * today.close });
  }
  return { trades, equityCurve, finalEquity: equityCurve.length ? equityCurve[equityCurve.length - 1].equity : initialCapital };
}

function basicMetrics(result = {}) {
  if (!result || !Array.isArray(result.equityCurve) || result.equityCurve.length === 0) return {};
  const eq = result.equityCurve;
  const start = eq[0].equity;
  const end = eq[eq.length - 1].equity;
  const totalReturn = ((end - start) / start) * 100;
  return { totalReturn: parseFloat(totalReturn.toFixed(2)), finalEquity: end };
}

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/api/features', (req, res) => res.json({ backtestEngine: !!BacktestEngine, analytics: !!metrics, riskManager: !!riskManager, gcnService: GCN_SERVICE_URL }));

app.post('/api/backtest', async (req, res) => {
  try {
    const opts = req.body || {};
    const data = opts.data || generateMockData(opts);
    if (BacktestEngine && typeof BacktestEngine.runBacktest === 'function') {
      const out = await BacktestEngine.runBacktest({ ...opts, data });
      const stats = (metrics && typeof metrics.calculateMetrics === 'function') ? metrics.calculateMetrics(out) : basicMetrics(out);
      return res.json({ success: true, result: { ...out, metrics: stats } });
    }
    const out = runSimpleBacktest({ ...opts, data });
    const stats = basicMetrics(out);
    res.json({ success: true, result: { ...out, metrics: stats } });
  } catch (err) {
    console.error('backtest error', err.stack || err.message || err);
    res.status(500).json({ success: false, error: err.message || 'backtest failed' });
  }
});

app.post('/api/gcn/predict', async (req, res) => {
  try {
    const resp = await axios.post(`${GCN_SERVICE_URL}/gcn/predict`, req.body, { timeout: 30000 });
    res.json({ success: true, data: resp.data });
  } catch (err) {
    console.error('gcn proxy error', err.message || err);
    res.status(502).json({ success: false, error: 'GCN service unreachable' });
  }
});

app.use((err, req, res, next) => { console.error('Server error:', err.stack || err); res.status(500).json({ success: false, error: 'Internal Server Error' }); });

app.use((req, res) => res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.path}` }));

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`App clean listening on http://0.0.0.0:${PORT}`));
}

module.exports = app;
