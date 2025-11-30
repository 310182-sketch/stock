/**
 * Clean app module: minimal, robust, integrates optional components if present.
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
try { BacktestEngine = require('./engine/backtestEngine'); } catch (e) {}
try { metrics = require('./analytics/metrics'); } catch (e) {}
try { riskManager = require('./risk/riskManager'); } catch (e) {}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => { console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`); next(); });

function simpleGenerateMockData({ days = 365, startPrice = 100, volatility = 0.02 }) {
  const data = [];
  let price = startPrice;
  const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate); date.setDate(date.getDate() + i);
    const change = (Math.random() - 0.5) * 2 * volatility; price = price * (1 + change);
    data.push({ date: date.toISOString().split('T')[0], open: price, high: price * 1.01, low: price * 0.99, close: parseFloat(price.toFixed(2)), volume: 1000000 });
  }
  return data;
}

function simpleRunBacktest({ data, initialCapital = 100000, positionSize = 1 }) {
  const trades = []; let cash = initialCapital; let shares = 0; const equityCurve = [];
  for (let i = 0; i < data.length; i++) {
    const today = data[i]; const prev = data[i - 1]?.close ?? today.close;
    if (today.close > prev && shares === 0) { const buy = Math.floor((cash * positionSize) / today.close); if (buy > 0) { shares = buy; cash -= buy * today.close; trades.push({ date: today.date, action: 'BUY', price: today.close, shares: buy }); } }
    else if (today.close < prev && shares > 0) { cash += shares * today.close; trades.push({ date: today.date, action: 'SELL', price: today.close, shares }); shares = 0; }
    equityCurve.push({ date: today.date, equity: cash + shares * today.close });
  }
  return { trades, equityCurve, finalEquity: equityCurve[equityCurve.length - 1]?.equity ?? initialCapital };
}

function calculateBasicMetrics(result) {
  if (!result || !Array.isArray(result.equityCurve) || result.equityCurve.length === 0) return {};
  const eq = result.equityCurve; const start = eq[0].equity; const end = eq[eq.length - 1].equity; const totalReturn = ((end - start) / start) * 100;
  return { totalReturn: parseFloat(totalReturn.toFixed(2)), finalEquity: end };
}

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/api/features', (req, res) => res.json({ backtestEngine: !!BacktestEngine, analytics: !!metrics, riskManager: !!riskManager, gcnService: GCN_SERVICE_URL }));

app.post('/api/backtest', async (req, res) => {
  try {
    const opts = req.body || {}; const data = opts.data || simpleGenerateMockData(opts);
    if (BacktestEngine && typeof BacktestEngine.runBacktest === 'function') { const out = await BacktestEngine.runBacktest({ ...opts, data }); const stats = (metrics && metrics.calculateMetrics) ? metrics.calculateMetrics(out) : calculateBasicMetrics(out); return res.json({ success: true, result: { ...out, metrics: stats } }); }
    const out = simpleRunBacktest({ ...opts, data }); const stats = calculateBasicMetrics(out); res.json({ success: true, result: { ...out, metrics: stats } });
  } catch (err) { console.error('backtest error', err.stack || err.message || err); res.status(500).json({ success: false, error: err.message || 'backtest failed' }); }
});

app.post('/api/optimize', async (req, res) => {
  try { if (BacktestEngine && typeof BacktestEngine.optimizeStrategy === 'function') { const report = await BacktestEngine.optimizeStrategy(req.body); return res.json({ success: true, report }); } return res.status(501).json({ success: false, error: 'optimize not available' }); } catch (err) { console.error('optimize error', err.stack || err.message || err); res.status(500).json({ success: false, error: err.message || 'optimize failed' }); }
});

app.post('/api/multi-backtest', async (req, res) => {
  try { if (BacktestEngine && typeof BacktestEngine.runMultiStrategyBacktest === 'function') { const report = await BacktestEngine.runMultiStrategyBacktest(req.body); if (metrics && metrics.compareBacktests) report.comparison = metrics.compareBacktests(report.results); return res.json({ success: true, report }); } return res.status(501).json({ success: false, error: 'multi-backtest not available' }); } catch (err) { console.error('multi-backtest error', err.stack || err.message || err); res.status(500).json({ success: false, error: err.message || 'multi-backtest failed' }); }
});

app.post('/api/risk/portfolio', (req, res) => { try { if (!riskManager) return res.status(501).json({ success: false, error: 'riskManager not available' }); const report = riskManager.calculatePortfolioRisk(req.body); res.json({ success: true, report }); } catch (err) { console.error('risk error', err.stack || err.message || err); res.status(500).json({ success: false, error: err.message || 'risk failed' }); } });

app.post('/api/risk/kelly', (req, res) => { try { if (!riskManager || typeof riskManager.calculateKelly !== 'function') return res.status(501).json({ success: false, error: 'kelly not available' }); const { winProb, winLossRatio } = req.body; const k = riskManager.calculateKelly(winProb, winLossRatio); res.json({ success: true, kelly: k }); } catch (err) { console.error('kelly error', err.stack || err.message || err); res.status(500).json({ success: false, error: err.message || 'kelly failed' }); } });

app.post('/api/gcn/predict', async (req, res) => { try { const resp = await axios.post(`${GCN_SERVICE_URL}/gcn/predict`, req.body, { timeout: 30000 }); res.json({ success: true, data: resp.data }); } catch (err) { console.error('gcn proxy error', err.message || err); res.status(502).json({ success: false, error: 'GCN service unreachable' }); } });

app.post('/api/metrics/calculate', (req, res) => { try { if (!metrics || !metrics.generateFullReport) return res.status(501).json({ success: false, error: 'metrics not available' }); const report = metrics.generateFullReport(req.body.result); res.json({ success: true, report }); } catch (err) { console.error('metrics error', err.stack || err.message || err); res.status(500).json({ success: false, error: err.message || 'metrics failed' }); } });

app.use((err, req, res, next) => { console.error('Server error:', err.stack || err); res.status(500).json({ success: false, error: 'Internal Server Error' }); });

app.use((req, res) => res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.path}` }));

if (require.main === module) { app.listen(PORT, '0.0.0.0', () => console.log(`API server listening on http://0.0.0.0:${PORT}`)); }

module.exports = app;
  const pros = [], cons = [], suggestions = [];

  if (ma5 && ma20 && ma5 > ma20) pros.push('短期均線在長期均線之上，多頭排列');
  else if (ma5 && ma20 && ma5 < ma20) cons.push('短期均線在長期均線之下，空頭排列');

  if (ma60 && price > ma60) pros.push('股價站穩季線，中期趨勢向上');
  else if (ma60 && price < ma60) cons.push('股價跌破季線，中期趨勢偏弱');

  if (rsi14 !== null) {
    if (rsi14 < 30) {
      pros.push(`RSI=${rsi14.toFixed(1)} 超賣區，可能反彈`);
      suggestions.push('可考慮分批布局');
    } else if (rsi14 > 70) {
      cons.push(`RSI=${rsi14.toFixed(1)} 超買區，可能回檔`);
      suggestions.push('獲利者可分批了結');
    }
  }

  if (momentum20 > 10) {
    pros.push(`近20日漲 ${momentum20}%，動能強`);
  } else if (momentum20 < -10) {
    cons.push(`近20日跌 ${Math.abs(momentum20)}%，賣壓重`);
  }

  const score = Math.min(100, Math.max(0, 
    50 + (pros.length * 10) - (cons.length * 10) + (momentum20 > 0 ? 5 : -5)
  ));

  const summary = score >= 70 ? '技術面偏多' : score >= 50 ? '技術面中性' : '技術面偏空';

  return { score, pros: pros.slice(0, 4), cons: cons.slice(0, 4), suggestions: suggestions.slice(0, 3), summary };
}

// ============ API 路由 ============

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/strategies', (req, res) => {
  const strategies = Object.values(STRATEGIES).map(s => ({
    id: s.id, name: s.name, description: s.description, params: s.params
  }));
  res.json({ success: true, strategies });
});

app.get('/api/recommendations', (req, res) => {
  res.json({
    success: true,
    recommendations: [
      { id: '2330', name: '台積電', theme: '半導體龍頭', reason: '策略測試基準' },
      { id: '2317', name: '鴻海', theme: '電子製造', reason: '波動適中' },
      { id: '2454', name: '聯發科', theme: 'IC 設計', reason: '成長型個股' },
      { id: '0050', name: '元大台灣50', theme: 'ETF', reason: '分散風險' },
      { id: '0056', name: '元大高股息', theme: '高股息', reason: '穩定配息' },
      { id: '00878', name: '國泰永續高股息', theme: 'ESG', reason: '熱門 ETF' }
    ]
  });
});

app.post('/api/backtest', (req, res) => {
  try {
    const { strategy = 'maCross', strategyParams = {}, initialCapital = 100000, 
            positionSize = 1, days = 365, startPrice = 100, volatility = 0.02, data } = req.body;

    const marketData = data || generateMockData({ days, startPrice, volatility });
    const result = runBacktest({ data: marketData, strategy, strategyParams, initialCapital, positionSize });
    const metrics = calculateMetrics(result);

    res.json({ success: true, result: { ...result, metrics } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tw/stock/:stockId', async (req, res) => {
  try {
    const { stockId } = req.params;
    const { months = 6 } = req.query;
    
    const data = await getStockHistory(stockId, parseInt(months));
    if (data.length === 0) {
      return res.status(404).json({ success: false, error: `找不到 ${stockId} 的資料` });
    }
    
    res.json({ success: true, stockId, dataCount: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tw/backtest', async (req, res) => {
  try {
    const { stockId, months = 6, strategy = 'maCross', strategyParams = {}, 
            initialCapital = 100000, positionSize = 1 } = req.body;

    if (!stockId) return res.status(400).json({ success: false, error: '請提供股票代號' });

    const data = await getStockHistory(stockId, parseInt(months));
    if (data.length === 0) {
      return res.status(404).json({ success: false, error: `找不到 ${stockId} 的資料` });
    }

    const result = runBacktest({ data, strategy, strategyParams, initialCapital, positionSize });
    const metrics = calculateMetrics(result);

    res.json({ success: true, stockId, dataCount: data.length, result: { ...result, metrics } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tw/scan', async (req, res) => {
  try {
    const { stockIds = ['2330', '2317', '2454', '0050', '0056'], months = 3 } = req.body;
    const uniqueIds = [...new Set(stockIds)].slice(0, 20);
    const results = [];

    for (const stockId of uniqueIds) {
      try {
        console.log(`掃描 ${stockId}...`);
        const data = await getStockHistory(stockId, parseInt(months));
        
        if (!data || data.length < 30) continue;

        const closes = data.map(d => d.close);
        const latestClose = closes[closes.length - 1];
        const latestData = data[data.length - 1];

        const ma5 = calculateMA(closes, 5);
        const ma10 = calculateMA(closes, 10);
        const ma20 = calculateMA(closes, 20);
        const ma60 = closes.length >= 60 ? calculateMA(closes, 60) : null;
        const rsi14 = calculateRSI(closes, 14);

        const momentum20 = closes.length >= 20 
          ? ((latestClose - closes[closes.length - 20]) / closes[closes.length - 20] * 100).toFixed(2) : null;
        const change1d = closes.length >= 2 
          ? ((latestClose - closes[closes.length - 2]) / closes[closes.length - 2] * 100).toFixed(2) : null;
        const change5d = closes.length >= 5
          ? ((latestClose - closes[closes.length - 5]) / closes[closes.length - 5] * 100).toFixed(2) : null;

        const signals = [];
        if (rsi14 !== null && rsi14 < 30) signals.push({ type: 'RSI_OVERSOLD', name: 'RSI 超賣' });
        if (rsi14 !== null && rsi14 > 70) signals.push({ type: 'RSI_OVERBOUGHT', name: 'RSI 超買' });
        
        if (ma5 && ma20) {
          const prevMa5 = calculateMA(closes.slice(0, -1), 5);
          const prevMa20 = calculateMA(closes.slice(0, -1), 20);
          if (prevMa5 && prevMa20 && prevMa5 < prevMa20 && ma5 > ma20) {
            signals.push({ type: 'MA_GOLDEN_CROSS', name: '黃金交叉' });
          }
          if (prevMa5 && prevMa20 && prevMa5 > prevMa20 && ma5 < ma20) {
            signals.push({ type: 'MA_DEATH_CROSS', name: '死亡交叉' });
          }
        }

        const analysis = generateAIAnalysis({
          price: latestClose, change1d: parseFloat(change1d) || 0, change5d: parseFloat(change5d) || 0,
          momentum20: parseFloat(momentum20) || 0, ma5, ma10, ma20, ma60, rsi14, signals
        });

        results.push({
          stockId, latestDate: latestData.date, price: latestClose,
          change1d: parseFloat(change1d) || 0, change5d: parseFloat(change5d) || 0,
          momentum20: parseFloat(momentum20) || 0,
          indicators: { ma5, ma10, ma20, ma60, rsi14 },
          signals, signalCount: signals.length, analysis
        });
      } catch (err) {
        console.error(`掃描 ${stockId} 失敗:`, err.message);
      }
    }

    results.sort((a, b) => b.signalCount - a.signalCount);
    res.json({ success: true, scannedCount: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tw/compare', async (req, res) => {
  try {
    const { stockIds = [], months = 6 } = req.body;
    if (!Array.isArray(stockIds) || stockIds.length === 0) {
      return res.status(400).json({ success: false, error: '請提供 stockIds 陣列' });
    }

    const uniqueIds = [...new Set(stockIds)].slice(0, 6);
    const series = [];

    for (const id of uniqueIds) {
      const data = await getStockHistory(id, parseInt(months));
      if (!data || data.length === 0) continue;

      const firstClose = data[0].close || 1;
      const points = data.map(d => ({
        date: d.date, close: d.close, retIndex: (d.close / firstClose) * 100
      }));
      series.push({ stockId: id, points });
    }

    if (series.length === 0) {
      return res.status(404).json({ success: false, error: '無法取得資料' });
    }

    res.json({ success: true, series });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tw/gcn', async (req, res) => {
  try {
    const { stockIds = [], months = 6, trainEpochs = 0 } = req.body;
    if (!Array.isArray(stockIds) || stockIds.length === 0) {
      return res.status(400).json({ success: false, error: '請提供 stockIds 陣列' });
    }

    const uniqueIds = [...new Set(stockIds)].slice(0, 30);
    const allHistory = {};

    for (const id of uniqueIds) {
      const data = await getStockHistory(id, parseInt(months));
      if (data && data.length > 0) allHistory[id] = data;
    }

    const ids = Object.keys(allHistory);
    if (ids.length === 0) {
      return res.status(404).json({ success: false, error: '無法取得資料' });
    }

    const features = [];
    const closesMap = {};
    
    for (const id of ids) {
      const data = allHistory[id];
      const closes = data.map(d => d.close);
      closesMap[id] = { dates: data.map(d => d.date), closes };

      const latestClose = closes[closes.length - 1] || 1;
      const ma5 = calculateMA(closes, 5) || 0;
      const ma10 = calculateMA(closes, 10) || 0;
      const ma20 = calculateMA(closes, 20) || 0;
      const ma60 = closes.length >= 60 ? calculateMA(closes, 60) : 0;
      const rsi14 = calculateRSI(closes, 14) || 50;
      const momentum20 = closes.length >= 20 ? ((latestClose - closes[closes.length - 20]) / closes[closes.length - 20]) * 100 : 0;
      const change1d = closes.length >= 2 ? ((latestClose - closes[closes.length - 2]) / closes[closes.length - 2]) * 100 : 0;
      const change5d = closes.length >= 5 ? ((latestClose - closes[closes.length - 5]) / closes[closes.length - 5]) * 100 : 0;
      const volume = data[data.length - 1].volume || 0;

      features.push([
        ma5 / latestClose, ma10 / latestClose, ma20 / latestClose, ma60 / latestClose,
        rsi14 / 100, momentum20 / 100, change1d / 100, change5d / 100, Math.log1p(volume)
      ]);
    }

    const edges = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        edges.push([i, j]);
      }
    }

    try {
      const resp = await axios.post(`${GCN_SERVICE_URL}/gcn/predict`, {
        nodes: ids, features, adjacency: edges, train_epochs: trainEpochs
      }, { timeout: 30000 });

      if (resp.data && resp.data.scores) {
        return res.json({ success: true, ids, scores: resp.data.scores, info: resp.data.info });
      }
      return res.status(500).json({ success: false, error: 'GCN 服務回傳異常' });
    } catch (err) {
      console.error('GCN 服務錯誤:', err.message);
      return res.status(500).json({ success: false, error: `無法連線到 GCN 服務` });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error('伺服器錯誤:', err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: `找不到: ${req.method} ${req.path}` });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║     🚀 股票回測 API v2.0                               ║
╠════════════════════════════════════════════════════════╣
║  📍 http://localhost:${PORT}                              ║
║  🔗 GCN: ${GCN_SERVICE_URL}                            ║
╠════════════════════════════════════════════════════════╣
║  GET  /api/strategies      POST /api/backtest          ║
║  GET  /api/recommendations POST /api/tw/backtest       ║
║  GET  /api/tw/stock/:id    POST /api/tw/scan           ║
║  POST /api/tw/compare      POST /api/tw/gcn            ║
╚════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
