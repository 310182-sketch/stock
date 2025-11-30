/**
 * backend/src/app.js
 * 台股歷史資料 API - 使用 TWSE/TPEx 真實資料
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// 載入台股資料模組
let twStockData = null;
let BacktestEngine = null;
let metrics = null;
let PricePredictor = null;
try { twStockData = require('./data/twStockData'); } catch (e) { console.error('twStockData 載入失敗:', e.message); }
try { BacktestEngine = require('./engine/backtestEngine'); } catch (e) { /* optional */ }
try { metrics = require('./analytics/metrics'); } catch (e) { /* optional */ }
try { PricePredictor = require('./analytics/pricePredictor'); } catch (e) { console.error('PricePredictor 載入失敗:', e.message); }

// DB (lowdb)
const DB = require('./db');
let dbInstance = null;
const TwseOpenApi = require('./integrations/twseOpenApi');
const TwseSyncJob = require('./jobs/twseSyncJob');

// CORS 設定
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
app.use((req, res, next) => { console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`); next(); });

// 計算簡單移動平均
function calculateSMA(data, period, index) {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[index - i].close;
  }
  return sum / period;
}

// 平滑權益曲線
function smoothEquityCurve(equityCurve, smoothPeriod = 5) {
  if (equityCurve.length < smoothPeriod) return equityCurve;
  
  const smoothed = [];
  for (let i = 0; i < equityCurve.length; i++) {
    if (i < smoothPeriod - 1) {
      smoothed.push({ ...equityCurve[i], smoothedEquity: equityCurve[i].equity });
    } else {
      let sum = 0;
      for (let j = 0; j < smoothPeriod; j++) {
        sum += equityCurve[i - j].equity;
      }
      smoothed.push({ 
        ...equityCurve[i], 
        smoothedEquity: sum / smoothPeriod,
        rawEquity: equityCurve[i].equity 
      });
    }
  }
  return smoothed;
}

// 簡單回測邏輯 - 使用移動平均交叉策略
function runSimpleBacktest({ data = [], initialCapital = 1000000, positionSize = 1 } = {}) {
  const trades = [];
  let cash = initialCapital;
  let shares = 0;
  const equityCurve = [];
  const fastPeriod = 5;
  const slowPeriod = 20;
  
  for (let i = 0; i < data.length; i++) {
    const today = data[i];
    const fastMA = calculateSMA(data, fastPeriod, i);
    const slowMA = calculateSMA(data, slowPeriod, i);
    const prevFastMA = i > 0 ? calculateSMA(data, fastPeriod, i - 1) : null;
    const prevSlowMA = i > 0 ? calculateSMA(data, slowPeriod, i - 1) : null;
    
    // 黃金交叉：快線上穿慢線，買入
    if (fastMA && slowMA && prevFastMA && prevSlowMA) {
      if (prevFastMA <= prevSlowMA && fastMA > slowMA && shares === 0) {
        const buy = Math.floor((cash * positionSize) / today.close);
        if (buy > 0) { 
          shares = buy; 
          cash -= buy * today.close; 
          trades.push({ date: today.date, action: 'BUY', price: today.close, shares: buy, signal: 'GOLDEN_CROSS' }); 
        }
      }
      // 死亡交叉：快線下穿慢線，賣出
      else if (prevFastMA >= prevSlowMA && fastMA < slowMA && shares > 0) {
        const sellValue = shares * today.close;
        cash += sellValue; 
        trades.push({ date: today.date, action: 'SELL', price: today.close, shares, profit: sellValue - (shares * trades[trades.length - 1].price), signal: 'DEATH_CROSS' }); 
        shares = 0;
      }
    }
    
    const equity = cash + shares * today.close;
    equityCurve.push({ 
      date: today.date, 
      equity,
      cash,
      stockValue: shares * today.close,
      shares,
      price: today.close,
      fastMA,
      slowMA
    });
  }
  
  // 平滑權益曲線
  const smoothedCurve = smoothEquityCurve(equityCurve, 5);
  
  return { 
    trades, 
    equityCurve: smoothedCurve, 
    finalEquity: smoothedCurve.length ? smoothedCurve[smoothedCurve.length - 1].equity : initialCapital 
  };
}

function basicMetrics(result = {}, initialCapital = 1000000) {
  if (!result || !Array.isArray(result.equityCurve) || result.equityCurve.length === 0) return {};
  const eq = result.equityCurve;
  const end = eq[eq.length - 1].equity;
  const totalReturn = ((end - initialCapital) / initialCapital) * 100;
  return { totalReturn: parseFloat(totalReturn.toFixed(2)), finalEquity: end, netProfit: parseFloat((end - initialCapital).toFixed(2)), totalTrades: result.trades?.length || 0 };
}

// === API 端點 ===

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), modules: { twStockData: !!twStockData, backtestEngine: !!BacktestEngine } }));

app.get('/', (req, res) => res.json({ 
  message: '台股歷史資料 API', version: '1.0.0', 
  endpoints: ['GET /health', 'GET /api/strategies', 'GET /api/tw/stocks', 'GET /api/tw/realtime/:symbol', 'GET /api/tw/history/:symbol', 'POST /api/tw/scan', 'POST /api/tw/backtest']
}));

app.get('/api/strategies', (req, res) => {
  try {
    const { Strategies } = require('./strategies');
    const strategies = Object.entries(Strategies).map(([id, strategy]) => ({
      id,
      name: strategy.name,
      description: strategy.description,
      params: Object.entries(strategy.defaultParams || {}).map(([name, value]) => ({
        name,
        default: value,
        label: name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
      }))
    }));
    res.json({ success: true, strategies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/tw/stocks', (req, res) => res.json({
  success: true,
  stocks: [
    { 
      symbol: '2330', 
      name: '台積電', 
      fullName: '台灣積體電路製造股份有限公司',
      market: 'twse',
      industry: '半導體',
      description: '全球最大晶圓代工廠，專注於半導體製造服務，為蘋果、NVIDIA、AMD 等全球科技巨頭提供先進製程晶片代工服務。'
    },
    { 
      symbol: '2317', 
      name: '鴻海', 
      fullName: '鴻海精密工業股份有限公司',
      market: 'twse',
      industry: '電子代工',
      description: '全球最大電子代工廠，為蘋果 iPhone、Sony PlayStation 等全球知名品牌提供組裝代工服務，積極布局電動車與半導體領域。'
    },
    { 
      symbol: '2454', 
      name: '聯發科', 
      fullName: '聯發科技股份有限公司',
      market: 'twse',
      industry: '半導體',
      description: '全球領先的無晶圓廠半導體公司，專注於手機晶片、WiFi 晶片及智慧家居晶片設計，在中低階手機市場佔有率領先。'
    },
    { 
      symbol: '2412', 
      name: '中華電', 
      fullName: '中華電信股份有限公司',
      market: 'twse',
      industry: '電信',
      description: '台灣最大電信業者，提供固網、行動通訊、寬頻網路及數據服務，擁有穩定現金流及高股息配發率。'
    },
    { 
      symbol: '2882', 
      name: '國泰金', 
      fullName: '國泰金融控股股份有限公司',
      market: 'twse',
      industry: '金融保險',
      description: '台灣最大金融控股公司，旗下擁有國泰人壽、國泰世華銀行、國泰證券等子公司，業務涵蓋壽險、銀行、證券。'
    },
    { 
      symbol: '2881', 
      name: '富邦金', 
      fullName: '富邦金融控股股份有限公司',
      market: 'twse',
      industry: '金融保險',
      description: '台灣第二大金融控股公司，旗下有富邦人壽、台北富邦銀行、富邦證券等，積極拓展海外市場。'
    },
    { 
      symbol: '2891', 
      name: '中信金', 
      fullName: '中國信託金融控股股份有限公司',
      market: 'twse',
      industry: '金融保險',
      description: '台灣領先的金融服務集團，以銀行業務為主，信用卡市佔率第一，積極發展數位金融服務。'
    },
    { 
      symbol: '2303', 
      name: '聯電', 
      fullName: '聯華電子股份有限公司',
      market: 'twse',
      industry: '半導體',
      description: '台灣第二大晶圓代工廠，專注於成熟製程及特殊製程，為全球客戶提供晶圓代工服務。'
    },
    { 
      symbol: '0050', 
      name: '元大台灣50', 
      fullName: '元大台灣卓越50證券投資信託基金',
      market: 'twse',
      industry: 'ETF',
      description: '台灣首檔 ETF，追蹤台灣 50 指數，成分股為台股市值前 50 大公司，適合長期投資台灣股市。'
    },
    { 
      symbol: '0056', 
      name: '元大高股息', 
      fullName: '元大台灣高股息證券投資信託基金',
      market: 'twse',
      industry: 'ETF',
      description: '台灣最受歡迎的高股息 ETF，選取預測未來一年現金股利殖利率最高的 30 檔股票，適合追求穩定現金流的投資人。'
    },
  ]
}));

app.get('/api/tw/realtime/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!twStockData) return res.status(503).json({ success: false, error: 'twStockData 模組未載入' });
    const data = await twStockData.getRealtimePrice(symbol);
    if (!data) return res.status(404).json({ success: false, error: `找不到股票 ${symbol}` });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/tw/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { months = 3, market = 'twse' } = req.query;
    if (!twStockData) return res.status(503).json({ success: false, error: 'twStockData 模組未載入' });
    console.log(`取得 ${symbol} 過去 ${months} 個月歷史資料...`);
    const data = await twStockData.getStockHistory(symbol, parseInt(months), market);
    if (!data || data.length === 0) return res.status(404).json({ success: false, error: `無法取得 ${symbol} 的歷史資料` });
    res.json({ success: true, symbol, dataPoints: data.length, dateRange: { start: data[0]?.date, end: data[data.length - 1]?.date }, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/tw/scan', async (req, res) => {
  try {
    const { stockIds = ['2330', '2317', '2454', '2412', '2882'], symbols, months = 3 } = req.body || {};
    const ids = stockIds || symbols || ['2330', '2317', '2454', '2412', '2882'];
    if (!twStockData) return res.status(503).json({ success: false, error: 'twStockData 模組未載入' });
    const results = [];
    for (const symbol of ids) {
      const data = await twStockData.getRealtimePrice(symbol);
      if (data) {
        // 簡單產生訊號以避免前端錯誤 (真實訊號需歷史資料)
        const signals = [];
        const changeP = parseFloat(data.changePercent);
        
        if (changeP > 3) signals.push({ type: 'MOMENTUM_HIGH', message: '強勢上漲' });
        else if (changeP < -3) signals.push({ type: 'MOMENTUM_LOW', message: '弱勢下跌' });
        
        if (changeP > 0) signals.push({ type: 'ABOVE_ALL_MA', message: '趨勢向上' }); // 模擬
        else if (changeP < 0) signals.push({ type: 'BELOW_ALL_MA', message: '趨勢向下' }); // 模擬

        // 模擬技術指標 (真實指標需歷史資料計算)
        const mockRSI = 50 + (changeP * 2); // 簡單模擬 RSI
        const indicators = {
          rsi14: Math.max(0, Math.min(100, mockRSI)),
          ma5: data.price * (1 + changeP / 100 * 0.5),
          ma20: data.price * (1 + changeP / 100 * 0.3),
          ma60: data.price * (1 + changeP / 100 * 0.1)
        };

        results.push({
          stockId: data.stockId,
          symbol: data.stockId,
          name: data.name,
          price: data.price,
          change: data.change,
          change1d: changeP,
          changePercent: changeP,
          change5d: changeP * 1.2, // 模擬
          momentum20: changeP * 0.8, // 模擬
          volume: data.volume,
          time: data.time,
          indicators: indicators,
          signals: signals,
          signalCount: signals.length
        });
      }
      await new Promise(r => setTimeout(r, 100));
    }
    res.json({ success: true, results, total: results.length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DB 查詢 endpoint
app.get('/api/tw/stocks-db', async (req, res) => {
  try {
    if (!dbInstance) return res.status(503).json({ success: false, error: 'DB 尚未初始化' });
    const { market, industry, search, page = 1, pageSize = 50, minVolume, maxVolume } = req.query;
    const q = { market, industry, search, page: parseInt(page), pageSize: parseInt(pageSize) };
    if (minVolume) q.minVolume = parseInt(minVolume);
    if (maxVolume) q.maxVolume = parseInt(maxVolume);
    const result = DB.queryStocks(dbInstance, q);
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// 手動觸發 DB 同步 (可用於 UI 或自動化)
app.post('/api/tw/sync-db', async (req, res) => {
  try {
    if (!dbInstance) return res.status(503).json({ success: false, error: 'DB 尚未初始化' });
    if (!twStockData || !twStockData.getAllStocks) return res.status(500).json({ success: false, error: 'twStockData 未載入' });
    const all = await twStockData.getAllStocks();
    await DB.bulkUpsert(dbInstance, all);
    res.json({ success: true, total: all.length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/tw/backtest', async (req, res) => {
  try {
    const { symbol = '2330', months = 6, market = 'twse', initialCapital = 1000000, positionSize = 1, strategy = 'maCross', strategyParams = {} } = req.body || {};
    if (!twStockData) return res.status(503).json({ success: false, error: 'twStockData 模組未載入' });
    console.log(`回測 ${symbol}：取得過去 ${months} 個月歷史資料...`);
    const historicalData = await twStockData.getStockHistory(symbol, months, market);
    if (!historicalData || historicalData.length === 0) return res.status(404).json({ success: false, error: `無法取得 ${symbol} 的歷史資料` });
    
    let result;
    if (BacktestEngine && typeof BacktestEngine.runBacktest === 'function') {
      result = await BacktestEngine.runBacktest({ 
        data: historicalData, 
        initialCapital, 
        positionSize, 
        strategy, 
        strategyParams,
        stockId: symbol 
      });
      result.metrics = (metrics?.calculateMetrics) ? metrics.calculateMetrics(result) : basicMetrics(result, initialCapital);
    } else {
      result = runSimpleBacktest({ data: historicalData, initialCapital, positionSize });
      result.metrics = basicMetrics(result, initialCapital);
    }
    res.json({ success: true, symbol, dataPoints: historicalData.length, dateRange: { start: historicalData[0]?.date, end: historicalData[historicalData.length - 1]?.date }, result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/tw/compare', async (req, res) => {
  try {
    const { stocks = ['2330', '0050'], months = 12, market = 'twse' } = req.body || {};
    if (!twStockData) return res.status(503).json({ success: false, error: 'twStockData 模組未載入' });
    
    const series = [];
    for (const symbol of stocks) {
      const data = await twStockData.getStockHistory(symbol, months, market);
      if (data && data.length > 0) {
        const startPrice = data[0].close;
        const normalizedData = data.map(d => ({
          date: d.date,
          value: parseFloat(((d.close - startPrice) / startPrice * 100).toFixed(2)),
          price: d.close
        }));
        series.push({ symbol, data: normalizedData });
      }
    }
    res.json({ success: true, series });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Proxy 呼叫 TWSE OpenAPI（範例）
// 前端使用：GET /api/external/twse?path=/v1/xxx&param1=...&param2=...
app.get('/api/external/twse', async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) return res.status(400).json({ success: false, error: 'query param `path` required' });
    // 複製 query 並移除 path
    const params = { ...req.query };
    delete params.path;

    const data = await TwseOpenApi.fetchOpenApi(path, params);
    res.json({ success: true, data });
  } catch (err) {
    console.error('external twse error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 新端點：價格預測
app.post('/api/tw/predict', async (req, res) => {
  try {
    const { symbol = '2330', months = 6, daysAhead = 5, market = 'twse' } = req.body || {};
    
    if (!twStockData) {
      return res.status(503).json({ success: false, error: 'twStockData 模組未載入' });
    }
    
    if (!PricePredictor) {
      return res.status(503).json({ success: false, error: 'PricePredictor 模組未載入' });
    }
    
    // 獲取歷史資料
    const historicalData = await twStockData.getStockHistory(symbol, months, market);
    
    if (!historicalData || historicalData.length < 30) {
      return res.status(400).json({ 
        success: false, 
        error: `資料不足：需要至少 30 個交易日，目前只有 ${historicalData?.length || 0} 筆` 
      });
    }
    
    // 執行預測
    const prediction = PricePredictor.predictPriceTrend(historicalData, daysAhead);
    
    res.json({
      success: true,
      symbol,
      currentPrice: historicalData[historicalData.length - 1].close,
      currentDate: historicalData[historicalData.length - 1].date,
      daysAhead,
      prediction
    });
    
  } catch (err) {
    console.error('預測錯誤:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// === 潛力股專區 API ===
app.get('/api/tw/potential-stocks', async (req, res) => {
  try {
    if (!twStockData) {
      return res.status(503).json({ success: false, error: 'twStockData 模組未載入' });
    }

    console.log('正在取得潛力股資料...');
    
    // 取得所有上市上櫃股票
    const allStocks = await twStockData.getAllStocks();
    
    if (!allStocks || allStocks.length === 0) {
      return res.status(500).json({ success: false, error: '無法取得股票資料' });
    }

    console.log(`取得 ${allStocks.length} 檔股票，開始計算評分...`);
    
    // 為每檔股票計算評分與技術指標
    const potentialStocks = allStocks.map((stock, index) => {
      // 產業推斷
      const industry = stock.industry || twStockData.inferIndustry(stock.stockId, stock.name);
      
      // 計算漲跌幅
      const changePercent = stock.close > 0 ? 
        ((stock.change / (stock.close - stock.change)) * 100).toFixed(2) : 0;
      
      // 簡化版技術指標計算（因為沒有完整歷史資料）
      // 使用當日資料推算
      const priceRange = stock.high - stock.low;
      const pricePosition = priceRange > 0 ? 
        ((stock.close - stock.low) / priceRange * 100) : 50;
      
      // 模擬 RSI（基於漲跌幅）
      const rsi = Math.min(100, Math.max(0, 50 + parseFloat(changePercent) * 2));
      
      // 計算 AI 評分
      const technicalScore = calculateTechnicalScore(stock, rsi, pricePosition, changePercent);
      const potentialScore = calculatePotentialScore(stock, technicalScore, industry);
      const aiScore = Math.round((technicalScore * 0.6 + potentialScore * 0.4));
      
      // 產生技術訊號
      const signals = generateSignals(rsi, parseFloat(changePercent), pricePosition, stock);
      
      return {
        id: stock.stockId,
        name: stock.name,
        price: stock.close,
        change: stock.change,
        changePercent: parseFloat(changePercent),
        volume: stock.volume,
        industry,
        market: stock.market,
        rsi: Math.round(rsi),
        ma5: stock.close * 0.99,
        ma20: stock.close * 0.98,
        ma60: stock.close * 0.97,
        aiScore,
        potentialScore,
        technicalScore,
        signals,
        high: stock.high,
        low: stock.low,
        open: stock.open
      };
    });

    // 過濾掉無效資料
    const validStocks = potentialStocks.filter(s => 
      s.price > 0 && s.name && s.id
    );

    console.log(`成功處理 ${validStocks.length} 檔有效股票`);

    res.json({
      success: true,
      total: validStocks.length,
      lastUpdate: new Date().toISOString(),
      stocks: validStocks
    });

  } catch (err) {
    console.error('取得潛力股資料錯誤:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 計算技術評分
function calculateTechnicalScore(stock, rsi, pricePosition, changePercent) {
  let score = 50;
  
  // RSI 評分（超賣給加分）
  if (rsi < 30) score += 15;
  else if (rsi < 40) score += 10;
  else if (rsi > 70) score -= 10;
  else if (rsi > 80) score -= 15;
  
  // 價格位置評分
  if (pricePosition > 70) score += 10;
  else if (pricePosition > 50) score += 5;
  else if (pricePosition < 30) score -= 5;
  
  // 漲跌幅評分
  const change = parseFloat(changePercent);
  if (change > 3) score += 15;
  else if (change > 1) score += 10;
  else if (change > 0) score += 5;
  else if (change < -3) score -= 10;
  else if (change < -1) score -= 5;
  
  // 成交量評分
  if (stock.volume > 50000000) score += 10;
  else if (stock.volume > 10000000) score += 5;
  else if (stock.volume < 1000000) score -= 5;
  
  return Math.min(100, Math.max(0, score));
}

// 計算潛力評分
function calculatePotentialScore(stock, technicalScore, industry) {
  let score = technicalScore;
  
  // 產業加成
  const hotIndustries = ['半導體', 'AI', '電子', 'ETF', '生技醫療'];
  const stableIndustries = ['金融保險', '電信', '公用事業'];
  
  if (hotIndustries.includes(industry)) score += 10;
  else if (stableIndustries.includes(industry)) score += 5;
  
  // 價格帶加成（中價股較受青睞）
  if (stock.close >= 50 && stock.close <= 300) score += 5;
  else if (stock.close > 500) score += 3;
  else if (stock.close < 20) score -= 5;
  
  return Math.min(100, Math.max(0, score));
}

// 產生技術訊號
function generateSignals(rsi, changePercent, pricePosition, stock) {
  const signals = [];
  
  if (rsi < 30) signals.push('RSI超賣');
  if (rsi > 70) signals.push('RSI超買');
  if (changePercent > 5) signals.push('強勢上漲');
  if (changePercent < -5) signals.push('急跌');
  if (pricePosition > 80) signals.push('逼近高點');
  if (pricePosition < 20) signals.push('逼近低點');
  if (stock.volume > 50000000) signals.push('大量');
  if (changePercent > 0 && stock.volume > 20000000) signals.push('量價齊揚');
  
  if (signals.length === 0) {
    signals.push('觀望');
  }
  
  return signals;
}

app.use((req, res) => res.status(404).json({ success: false, error: `找不到: ${req.method} ${req.path}` }));

if (require.main === module) {
  (async () => {
    try {
      dbInstance = await DB.init();
      console.log('資料庫已初始化', DB.DB_PATH);

      // 初次同步一次股票資料
      const twStockDataModule = twStockData;
      if (twStockDataModule?.getAllStocks) {
        try {
          const all = await twStockDataModule.getAllStocks();
          await DB.bulkUpsert(dbInstance, all);
          console.log(`已同步 ${all.length} 檔股票到 DB`);
        } catch (err) { console.error('Sync 初次同步失敗:', err.message); }
      }

      // 啟動 TWSE OpenAPI 排程（若環境變數啟用）
      try {
        const enableSync = (process.env.TWSE_SYNC_ENABLED === '1' || !!process.env.TWSE_SYNC_SYMBOLS);
        if (enableSync) {
          console.log('啟動 TWSE OpenAPI 同步排程...');
          // pathTemplate 與 symbols 可用 env 覆寫
          const job = TwseSyncJob.startSync(dbInstance, {
            pathTemplate: process.env.TWSE_OPENAPI_QUOTE_PATH || '/v1/quote/{symbol}',
            intervalMs: process.env.TWSE_SYNC_INTERVAL_MS ? parseInt(process.env.TWSE_SYNC_INTERVAL_MS, 10) : undefined
          });
          // optional: store job reference if needed later
          global.__twse_sync_job = job;
        }
      } catch (err) { console.error('啟動 TWSE 同步排程失敗:', err.message); }

      // 定時同步 (每 5 分鐘)
      setInterval(async () => {
        try {
          const all = await twStockDataModule.getAllStocks();
          await DB.bulkUpsert(dbInstance, all);
          console.log(`定時同步成功: ${all.length} 檔股票 (${new Date().toISOString()})`);
        } catch (err) { console.error('定時同步失敗', err.message); }
      }, 1000 * 60 * 5);
    } catch (err) { console.error('初始化 DB 失敗:', err.message); }

    app.listen(PORT, '0.0.0.0', () => console.log(`台股歷史 API 啟動於 http://0.0.0.0:${PORT}`));
  })();
}

module.exports = app;
