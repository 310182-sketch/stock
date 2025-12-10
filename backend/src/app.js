/**
 * backend/src/app.js - 台股歷史資料 API (精簡版)
 */
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// === 模組載入 ===
const modules = {};
['./data/twStockData', './engine/backtestEngine', './analytics/metrics', 
 './analytics/pricePredictor', './data/newsScraper', './analytics/sentimentAnalyzer']
.forEach(path => {
  const name = path.split('/').pop();
  try { modules[name] = require(path); } catch (e) { /* optional */ }
});
const { twStockData, backtestEngine: BacktestEngine, metrics, pricePredictor: PricePredictor, newsScraper: NewsScraper, sentimentAnalyzer: SentimentAnalyzer } = modules;

const DB = require('./db');
const logger = require('./utils/logger');
const TwseOpenApi = require('./integrations/twseOpenApi');
const TwseSyncJob = require('./jobs/twseSyncJob');
const LineNotify = require('./integrations/lineNotify');
const C = require('./config/constants');
const { calculateRSI } = require('./utils/indicators');
let dbInstance = null;

// === 工具函數 ===
const SYMBOL_REGEX = /^[0-9A-Za-z]{4,6}$/;
const validateSymbol = (s) => s && SYMBOL_REGEX.test(s);
const validateInt = (v, def = 1, max = 100) => Math.min(max, Math.max(1, parseInt(v, 10) || def));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// === 中介軟體 ===
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => { logger.info(`${req.method} ${req.path}`); next(); });

// === API 路由 ===

// 健康檢查
app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({ 
    status: 'ok', 
    uptime: `${Math.floor(process.uptime())}s`,
    memory: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
    db: dbInstance ? 'ok' : 'disconnected',
    stocks: dbInstance?.data?.stocks?.length || 0
  });
});

app.get('/', (req, res) => res.json({ message: '台股 API v1.0', endpoints: ['/health', '/api/tw/stocks', '/api/tw/history/:symbol', '/api/tw/backtest'] }));

// 策略列表
app.get('/api/strategies', (req, res) => {
  try {
    const { Strategies } = require('./strategies');
    res.json({ success: true, strategies: Object.entries(Strategies).map(([id, s]) => ({ id, name: s.name, description: s.description })) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 熱門股票
const POPULAR_STOCKS = [
  { symbol: '2330', name: '台積電', industry: '半導體' },
  { symbol: '2317', name: '鴻海', industry: '電子代工' },
  { symbol: '2454', name: '聯發科', industry: '半導體' },
  { symbol: '2412', name: '中華電', industry: '電信' },
  { symbol: '2882', name: '國泰金', industry: '金融保險' },
  { symbol: '2881', name: '富邦金', industry: '金融保險' },
  { symbol: '0050', name: '元大台灣50', industry: 'ETF' },
  { symbol: '0056', name: '元大高股息', industry: 'ETF' },
];
app.get('/api/tw/stocks', (req, res) => res.json({ success: true, stocks: POPULAR_STOCKS }));

// 即時股價
app.get('/api/tw/realtime/:symbol', async (req, res) => {
  try {
    if (!twStockData) return res.status(503).json({ success: false, error: '模組未載入' });
    const data = await twStockData.getRealtimePrice(req.params.symbol);
    data ? res.json({ success: true, data }) : res.status(404).json({ success: false, error: '找不到股票' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 歷史資料
app.get('/api/tw/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!validateSymbol(symbol)) return res.status(400).json({ success: false, error: '無效股票代號' });
    if (!twStockData) return res.status(503).json({ success: false, error: '模組未載入' });
    
    const months = validateInt(req.query.months, 3, 36);
    const data = await twStockData.getStockHistory(symbol, months, req.query.market || 'twse');
    if (!data?.length) return res.status(404).json({ success: false, error: '無歷史資料' });
    
    res.json({ success: true, symbol, dataPoints: data.length, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 掃描股票 (支援篩選條件)
app.post('/api/tw/scan', async (req, res) => {
  try {
    if (!twStockData) return res.status(503).json({ success: false, error: '模組未載入' });
    
    const { stockIds, minPrice, maxPrice, minChange, maxChange, minVolume } = req.body || {};
    
    // 若有指定 stockIds，只掃描這些股票；否則取得所有股票
    let stocksToScan;
    if (stockIds?.length) {
      stocksToScan = [];
      for (const symbol of stockIds) {
        const data = await twStockData.getRealtimePrice(symbol);
        if (data) stocksToScan.push(data);
        await sleep(50);
      }
    } else {
      stocksToScan = await twStockData.getAllStocks() || [];
    }
    
    // 應用篩選條件
    const results = stocksToScan.filter(s => {
      if (!s || !s.close) return false;
      const price = s.close || s.price || 0;
      const change = parseFloat(s.changePercent || 0);
      const volume = s.volume || 0;
      
      if (minPrice && price < minPrice) return false;
      if (maxPrice && price > maxPrice) return false;
      if (minChange && change < minChange) return false;
      if (maxChange && change > maxChange) return false;
      if (minVolume && volume < minVolume) return false;
      return true;
    }).map(s => ({
      symbol: s.stockId,
      stockId: s.stockId,
      name: s.name,
      price: s.close || s.price,
      changePercent: parseFloat(s.changePercent || 0),
      volume: s.volume || 0,
      industry: s.industry || '其他',
      signals: parseFloat(s.changePercent || 0) > 3 ? ['強勢'] : parseFloat(s.changePercent || 0) < -3 ? ['弱勢'] : ['觀望']
    }));
    
    res.json({ success: true, total: results.length, stocks: results });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 回測
app.post('/api/tw/backtest', async (req, res) => {
  try {
    const { stockId, symbol, months = 6, market = 'twse', initialCapital = 1000000, positionSize = 1, strategy = 'maCross', strategyParams = {} } = req.body || {};
    const stockSymbol = stockId || symbol || '2330'; // 同時支援 stockId 和 symbol
    if (!validateSymbol(stockSymbol)) return res.status(400).json({ success: false, error: '無效股票代號' });
    if (!twStockData) return res.status(503).json({ success: false, error: '模組未載入' });

    const data = await twStockData.getStockHistory(stockSymbol, validateInt(months, 6, 36), market);
    if (!data?.length) return res.status(404).json({ success: false, error: '無歷史資料' });

    let result;
    if (BacktestEngine?.runBacktest) {
      result = BacktestEngine.runBacktest({ data, initialCapital, positionSize, strategy, strategyParams, stockId: stockSymbol });
      if (metrics?.calculateMetrics) result.metrics = metrics.calculateMetrics(result);
    } else {
      result = simpleBacktest(data, initialCapital, positionSize);
    }
    
    res.json({ success: true, symbol: stockSymbol, dataPoints: data.length, result, historicalData: data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 簡單回測
function simpleBacktest(data, capital = 1000000, size = 1) {
  let cash = capital, shares = 0;
  const trades = [], curve = [];
  
  for (let i = 20; i < data.length; i++) {
    const ma5 = data.slice(i-5, i).reduce((s, d) => s + d.close, 0) / 5;
    const ma20 = data.slice(i-20, i).reduce((s, d) => s + d.close, 0) / 20;
    const prevMa5 = data.slice(i-6, i-1).reduce((s, d) => s + d.close, 0) / 5;
    const prevMa20 = data.slice(i-21, i-1).reduce((s, d) => s + d.close, 0) / 20;
    const price = data[i].close;
    
    if (prevMa5 <= prevMa20 && ma5 > ma20 && shares === 0) {
      shares = Math.floor(cash * size * 0.995 / price);
      cash -= shares * price;
      trades.push({ date: data[i].date, action: 'BUY', price, shares });
    } else if (prevMa5 >= prevMa20 && ma5 < ma20 && shares > 0) {
      cash += shares * price;
      trades.push({ date: data[i].date, action: 'SELL', price, shares });
      shares = 0;
    }
    curve.push({ date: data[i].date, equity: cash + shares * price });
  }
  
  const finalEquity = curve.length ? curve[curve.length - 1].equity : capital;
  return { trades, equityCurve: curve, finalEquity, metrics: { totalReturn: ((finalEquity - capital) / capital * 100).toFixed(2), totalTrades: trades.length } };
}

// 比較股票 (同時支援 stocks 和 symbols 參數)
app.post('/api/tw/compare', async (req, res) => {
  try {
    const { stocks, symbols, months = 12, market = 'twse' } = req.body || {};
    const stockList = symbols || stocks || ['2330', '0050'];
    if (!twStockData) return res.status(503).json({ success: false, error: '模組未載入' });
    
    const series = [];
    const stocksData = [];
    
    for (const symbol of stockList) {
      const data = await twStockData.getStockHistory(symbol, months, market);
      const realtime = await twStockData.getRealtimePrice(symbol);
      
      if (data?.length) {
        const start = data[0].close;
        const latest = data[data.length - 1];
        series.push({ 
          symbol, 
          data: data.map(d => ({ date: d.date, value: ((d.close - start) / start * 100).toFixed(2) })) 
        });
        
        // 同時提供前端期望的 stocks 格式
        stocksData.push({
          symbol,
          name: realtime?.name || symbol,
          price: latest?.close || realtime?.close || 0,
          changePercent: realtime?.changePercent || ((latest?.close - start) / start * 100),
          volume: realtime?.volume || latest?.volume || 0,
          marketCap: null,
          pe: null,
          rsi: null
        });
      }
    }
    res.json({ success: true, series, stocks: stocksData });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DB 查詢
app.get('/api/tw/stocks-db', async (req, res) => {
  try {
    if (!dbInstance) return res.status(503).json({ success: false, error: 'DB 未初始化' });
    res.json({ success: true, ...DB.queryStocks(dbInstance, req.query) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 同步 DB
app.post('/api/tw/sync-db', async (req, res) => {
  try {
    if (!dbInstance || !twStockData?.getAllStocks) return res.status(503).json({ success: false, error: '服務未就緒' });
    const all = await twStockData.getAllStocks();
    await DB.bulkUpsert(dbInstance, all);
    res.json({ success: true, total: all.length });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// TWSE OpenAPI 代理
app.get('/api/external/twse', async (req, res) => {
  try {
    const { path, ...params } = req.query;
    if (!path) return res.status(400).json({ success: false, error: '缺少 path' });
    res.json({ success: true, data: await TwseOpenApi.fetchOpenApi(path, params) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 價格預測
app.post('/api/tw/predict', async (req, res) => {
  try {
    const { symbol = '2330', months = 6, daysAhead = 5, market = 'twse' } = req.body || {};
    if (!twStockData || !PricePredictor) return res.status(503).json({ success: false, error: '模組未載入' });
    
    const data = await twStockData.getStockHistory(symbol, months, market);
    if (data?.length < 30) return res.status(400).json({ success: false, error: '資料不足' });
    
    res.json({ success: true, symbol, currentPrice: data[data.length - 1].close, prediction: PricePredictor.predictPriceTrend(data, daysAhead) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 新聞
app.get('/api/news', async (req, res) => {
  try {
    if (!NewsScraper || !SentimentAnalyzer) return res.status(503).json({ success: false, error: '模組未載入' });
    const news = (await NewsScraper.fetchMarketNews()).map(n => ({ ...n, ...SentimentAnalyzer.analyzeSentiment(n.title) }));
    const score = news.reduce((s, n) => s + n.score, 0);
    res.json({ success: true, marketSentiment: score > 2 ? 'bullish' : score < -2 ? 'bearish' : 'neutral', news });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Line 通知
app.post('/api/notify/test', async (req, res) => {
  const { token, message } = req.body;
  if (!token) return res.status(400).json({ success: false, error: '缺少 Token' });
  const ok = await new LineNotify(token).send(message || '🔔 測試訊息！系統運作正常。');
  res.json({ success: ok, message: ok ? '已發送' : '發送失敗' });
});

app.post('/api/notify/daily-summary', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, error: '缺少 Token' });
  try {
    const stocks = await twStockData?.getAllStocks() || [];
    const up = stocks.filter(s => s.change > 0).length;
    const down = stocks.filter(s => s.change < 0).length;
    const msg = `📊 台股日報 ${new Date().toLocaleDateString()}\n📈 上漲: ${up}\n📉 下跌: ${down}`;
    const ok = await new LineNotify(token).send(msg);
    res.json({ success: ok });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 潛力股
app.get('/api/tw/potential-stocks', async (req, res) => {
  try {
    if (!twStockData) return res.status(503).json({ success: false, error: '模組未載入' });
    const allStocks = await twStockData.getAllStocks();
    if (!allStocks?.length) return res.json({ success: true, total: 0, stocks: [] });

    // Compute metrics for potential stocks. Calculate RSI using historical data if possible.
    const stocks = await Promise.all(allStocks.filter(s => s.close > 0 && s.name).map(async (s) => {
      const change = s.close - s.change > 0 ? (s.change / (s.close - s.change) * 100) : 0;
      const range = s.high - s.low;
      const pos = range > 0 ? ((s.close - s.low) / range * 100) : 50;

      // Try to fetch ~1 month of history to compute RSI properly
      let rsi = null;
      try {
        const history = await twStockData.getStockHistory(s.stockId, 1, 'twse');
        if (history && history.length >= C.INDICATORS.RSI_PERIOD + 1) {
          // extract closing prices array for RSI calculation
          const closes = history.map(h => h.close).filter(v => typeof v === 'number' && !Number.isNaN(v));
          if (closes.length >= C.INDICATORS.RSI_PERIOD + 1) {
            rsi = calculateRSI(closes, C.INDICATORS.RSI_PERIOD);
          }
        }
      } catch (e) { /* ignore history failures, fallback to heuristic */ }

      // Fallback heuristic if RSI could not be calculated
      if (rsi === null || isNaN(rsi)) rsi = Math.min(100, Math.max(0, pos + change * 1.5));

      const score = Math.round(50 + (rsi > C.SCORING.RSI_OVERBOUGHT ? -10 : rsi < C.SCORING.RSI_OVERSOLD ? 10 : 0) + (change > 3 ? 15 : change < -3 ? -10 : change * 3));

      return {
        symbol: s.stockId, id: s.stockId, name: s.name, price: s.close, change: s.change,
        changePercent: parseFloat(change.toFixed(2)), volume: s.volume,
        industry: s.industry || twStockData.inferIndustry?.(s.stockId, s.name) || '其他',
        rsi: Math.round(rsi), aiScore: Math.min(100, Math.max(0, score)),
        signals: rsi < C.SCORING.RSI_OVERSOLD ? ['RSI超賣'] : rsi > C.SCORING.RSI_OVERBOUGHT ? ['RSI超買'] : change > 5 ? ['強勢'] : ['觀望']
      };
    }));

    res.json({ success: true, total: stocks.length, stocks });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 404
app.use((req, res) => res.status(404).json({ success: false, error: `找不到: ${req.method} ${req.path}` }));

// === 啟動伺服器 ===
if (require.main === module) {
  (async () => {
    try {
      dbInstance = await DB.init();
      logger.info('DB 初始化完成');

      if (twStockData?.getAllStocks) {
        try {
          const all = await twStockData.getAllStocks();
          await DB.bulkUpsert(dbInstance, all);
          logger.info(`已同步 ${all.length} 檔股票`);
        } catch (e) { console.error('同步失敗:', e.message); }
      }

      // 定時同步 (5分鐘)
      setInterval(async () => {
        if (!twStockData?.getAllStocks || !dbInstance) return;
        try {
          const all = await twStockData.getAllStocks();
          if (all?.length) await DB.bulkUpsert(dbInstance, all);
        } catch (e) { logger.error('同步失敗:', e.message); }
      }, 5 * 60 * 1000);

      // TWSE 排程
      if (process.env.TWSE_SYNC_ENABLED === '1') {
        TwseSyncJob.startSync(dbInstance, { pathTemplate: process.env.TWSE_OPENAPI_QUOTE_PATH || '/v1/quote/{symbol}' });
      }
    } catch (e) { logger.error('初始化失敗:', e.message); }

    app.listen(PORT, '0.0.0.0', () => logger.info(`API 啟動於 http://0.0.0.0:${PORT}`));
  })();
}

module.exports = app;
