/**
 * 台灣股市資料層 (Taiwan Stock Data Layer)
 * 串接台灣證券交易所 (TWSE) 與櫃買中心 (TPEx) 公開 API
 */

const axios = require('axios');
const { getAllTWSEStocksFromHTML, getAllTPExStocksFromHTML, getTWSEStockDataFromHTML } = require('./twStockScraper');
const finmind = require('../integrations/finmind');
const yahoo = require('../integrations/yahoo');
const fbs = require('../integrations/fbs');

// API 端點
const TWSE_API = 'https://www.twse.com.tw/exchangeReport';
const TPEX_API = 'https://www.tpex.org.tw/web/stock';

// ============================================
// 快取機制
// ============================================
const cache = new Map();
const CACHE_TTL = {
  REALTIME: 30 * 1000,        // 即時價: 30 秒
  HISTORY: 5 * 60 * 1000,     // 歷史資料: 5 分鐘
  STOCK_LIST: 10 * 60 * 1000  // 股票清單: 10 分鐘
};

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > item.ttl) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttl) {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

function clearCache() {
  cache.clear();
}

// ============================================
// 中文股票名稱對照表
// ============================================
const STOCK_NAME_MAP = {
  // 上市股票
  '2330': { name: '台積電', industry: '半導體', market: 'twse' },
  '2317': { name: '鴻海', industry: '電子零組件', market: 'twse' },
  '2454': { name: '聯發科', industry: '半導體', market: 'twse' },
  '2308': { name: '台達電', industry: '電子零組件', market: 'twse' },
  '2382': { name: '廣達', industry: '電腦及週邊', market: 'twse' },
  '2881': { name: '富邦金', industry: '金融保險', market: 'twse' },
  '2882': { name: '國泰金', industry: '金融保險', market: 'twse' },
  '2891': { name: '中信金', industry: '金融保險', market: 'twse' },
  '2303': { name: '聯電', industry: '半導體', market: 'twse' },
  '2412': { name: '中華電', industry: '通信網路', market: 'twse' },
  '2886': { name: '兆豐金', industry: '金融保險', market: 'twse' },
  '2884': { name: '玉山金', industry: '金融保險', market: 'twse' },
  '3008': { name: '大立光', industry: '光電', market: 'twse' },
  '2357': { name: '華碩', industry: '電腦及週邊', market: 'twse' },
  '2379': { name: '瑞昱', industry: '半導體', market: 'twse' },
  '3711': { name: '日月光投控', industry: '半導體', market: 'twse' },
  '2892': { name: '第一金', industry: '金融保險', market: 'twse' },
  '2301': { name: '光寶科', industry: '電子零組件', market: 'twse' },
  '2002': { name: '中鋼', industry: '鋼鐵', market: 'twse' },
  '1301': { name: '台塑', industry: '塑膠', market: 'twse' },
  '1303': { name: '南亞', industry: '塑膠', market: 'twse' },
  '1326': { name: '台化', industry: '塑膠', market: 'twse' },
  '6505': { name: '台塑化', industry: '油電燃氣', market: 'twse' },
  '0050': { name: '元大台灣50', industry: 'ETF', market: 'twse' },
  '0056': { name: '元大高股息', industry: 'ETF', market: 'twse' },
  '00878': { name: '國泰永續高股息', industry: 'ETF', market: 'twse' },
  '00919': { name: '群益台灣精選高息', industry: 'ETF', market: 'twse' },
  '2603': { name: '長榮', industry: '航運', market: 'twse' },
  '2609': { name: '陽明', industry: '航運', market: 'twse' },
  '2615': { name: '萬海', industry: '航運', market: 'twse' },
  '3034': { name: '聯詠', industry: '半導體', market: 'twse' },
  '2327': { name: '國巨', industry: '電子零組件', market: 'twse' },
  '2345': { name: '智邦', industry: '通信網路', market: 'twse' },
  '2353': { name: '宏碁', industry: '電腦及週邊', market: 'twse' },
  '2376': { name: '技嘉', industry: '電腦及週邊', market: 'twse' },
  '2377': { name: '微星', industry: '電腦及週邊', market: 'twse' },
  '2395': { name: '研華', industry: '電腦及週邊', market: 'twse' },
  '2408': { name: '南亞科', industry: '半導體', market: 'twse' },
  '2474': { name: '可成', industry: '電子零組件', market: 'twse' },
  '2633': { name: '台灣高鐵', industry: '觀光', market: 'twse' },
  '2801': { name: '彰銀', industry: '金融保險', market: 'twse' },
  '2880': { name: '華南金', industry: '金融保險', market: 'twse' },
  '2883': { name: '開發金', industry: '金融保險', market: 'twse' },
  '2885': { name: '元大金', industry: '金融保險', market: 'twse' },
  '2887': { name: '台新金', industry: '金融保險', market: 'twse' },
  '2888': { name: '新光金', industry: '金融保險', market: 'twse' },
  '2890': { name: '永豐金', industry: '金融保險', market: 'twse' },
  '2912': { name: '統一超', industry: '貿易百貨', market: 'twse' },
  '3037': { name: '欣興', industry: '電子零組件', market: 'twse' },
  '3045': { name: '台灣大', industry: '通信網路', market: 'twse' },
  '3231': { name: '緯創', industry: '電腦及週邊', market: 'twse' },
  '3443': { name: '創意', industry: '半導體', market: 'twse' },
  '3481': { name: '群創', industry: '光電', market: 'twse' },
  '3529': { name: '力旺', industry: '半導體', market: 'twse' },
  '3661': { name: '世芯-KY', industry: '半導體', market: 'twse' },
  '3702': { name: '大聯大', industry: '電子通路', market: 'twse' },
  '4904': { name: '遠傳', industry: '通信網路', market: 'twse' },
  '4938': { name: '和碩', industry: '電腦及週邊', market: 'twse' },
  '5871': { name: '中租-KY', industry: '金融保險', market: 'twse' },
  '5880': { name: '合庫金', industry: '金融保險', market: 'twse' },
  '6415': { name: '矽力-KY', industry: '半導體', market: 'twse' },
  '6446': { name: '藥華藥', industry: '生技醫療', market: 'twse' },
  '6669': { name: '緯穎', industry: '電腦及週邊', market: 'twse' },
  '6770': { name: '力積電', industry: '半導體', market: 'twse' },
  // 上櫃股票
  '6488': { name: '環球晶', industry: '半導體', market: 'tpex' },
  '5483': { name: '中美晶', industry: '半導體', market: 'tpex' },
  '3105': { name: '穩懋', industry: '半導體', market: 'tpex' },
  '8069': { name: '元太', industry: '光電', market: 'tpex' },
  '6409': { name: '旭隼', industry: '電子零組件', market: 'tpex' },
  '3293': { name: '鑫創', industry: '半導體', market: 'tpex' },
  '5269': { name: '祥碩', industry: '半導體', market: 'tpex' },
  '6547': { name: '高端疫苗', industry: '生技醫療', market: 'tpex' },
  '8046': { name: '南電', industry: '電子零組件', market: 'tpex' },
  '3530': { name: '晶相光', industry: '半導體', market: 'tpex' },
  '4966': { name: '譜瑞-KY', industry: '半導體', market: 'tpex' },
  '5289': { name: '宜鼎', industry: '半導體', market: 'tpex' },
  '6533': { name: '晶心科', industry: '半導體', market: 'tpex' },
  '6803': { name: '崧騰', industry: '電子零組件', market: 'tpex' },
  '3707': { name: '漢磊', industry: '半導體', market: 'tpex' },
};

/**
 * 查詢股票中文資訊
 * @param {string} stockId - 股票代號
 * @returns {Object|null} { name, industry, market }
 */
function getStockInfo(stockId) {
  return STOCK_NAME_MAP[stockId] || null;
}

/**
 * 取得台灣上市股票歷史資料 (TWSE 證交所)
 * @param {string} stockId - 股票代號 (如 '2330' 台積電)
 * @param {number} year - 年份 (民國年)
 * @param {number} month - 月份
 * @returns {Promise<Array>} OHLCV 數據陣列
 */
async function getTWSEStockData(stockId, year, month) {
  try {
    // 轉換為西元年
    const westernYear = year > 1911 ? year : year + 1911;
    const dateStr = `${westernYear}${String(month).padStart(2, '0')}01`;
    
    const url = `${TWSE_API}/STOCK_DAY?response=json&date=${dateStr}&stockNo=${stockId}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (response.data.stat !== 'OK' || !response.data.data) {
      return [];
    }

    // 解析資料：日期, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 成交筆數
    return response.data.data.map(row => {
      const [date, volume, turnover, open, high, low, close, change, transactions] = row;
      
      // 轉換民國年日期為西元年 (114/01/02 -> 2025-01-02)
      const [rocYear, m, d] = date.split('/');
      const isoDate = `${parseInt(rocYear) + 1911}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      
      return {
        date: isoDate,
        open: parseFloat(open.replace(/,/g, '')) || 0,
        high: parseFloat(high.replace(/,/g, '')) || 0,
        low: parseFloat(low.replace(/,/g, '')) || 0,
        close: parseFloat(close.replace(/,/g, '')) || 0,
        volume: parseInt(volume.replace(/,/g, '')) || 0,
        change: parseFloat(change.replace(/,/g, '')) || 0
      };
    }).filter(d => d.open > 0); // 過濾無效資料
  } catch (error) {
    console.error(`取得 TWSE 資料失敗: ${error.message}`);
    return [];
  }
}

/**
 * 取得台灣上櫃股票歷史資料 (TPEx 櫃買中心)
 * @param {string} stockId - 股票代號 (如 '6488' 環球晶)
 * @param {number} year - 年份 (民國年)
 * @param {number} month - 月份
 * @returns {Promise<Array>} OHLCV 數據陣列
 */
async function getTPExStockData(stockId, year, month) {
  try {
    // 民國年格式
    const rocYear = year > 1911 ? year - 1911 : year;
    const dateStr = `${rocYear}/${String(month).padStart(2, '0')}`;
    
    const url = `${TPEX_API}/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${dateStr}&stkno=${stockId}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (!response.data.aaData) {
      return [];
    }

    // 解析資料
    return response.data.aaData.map(row => {
      const [date, volume, turnover, open, high, low, close, change, transactions] = row;
      
      // 轉換民國年日期
      const [rocY, m, d] = date.split('/');
      const isoDate = `${parseInt(rocY) + 1911}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      
      return {
        date: isoDate,
        open: parseFloat(String(open).replace(/,/g, '')) || 0,
        high: parseFloat(String(high).replace(/,/g, '')) || 0,
        low: parseFloat(String(low).replace(/,/g, '')) || 0,
        close: parseFloat(String(close).replace(/,/g, '')) || 0,
        volume: parseInt(String(volume).replace(/,/g, '')) || 0,
        change: parseFloat(String(change).replace(/,/g, '')) || 0
      };
    }).filter(d => d.open > 0);
  } catch (error) {
    console.error(`取得 TPEx 資料失敗: ${error.message}`);
    return [];
  }
}

/**
 * 取得多月份股票歷史資料
 * @param {string} stockId - 股票代號
 * @param {number} months - 取得幾個月的資料 (預設 12)
 * @param {string} market - 市場類型 ('twse' 上市 或 'tpex' 上櫃)
 * @returns {Promise<Array>} OHLCV 數據陣列
 */
async function getStockHistory(stockId, months = 12, market = 'twse') {
  const cacheKey = `history_${stockId}_${months}_${market}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  // 若提供 FinMind token，優先使用 FinMind 取得歷史（一次區間請求）
  const token = process.env.FINMIND_TOKEN || null;
  // If FBS is configured, prefer FBS for history (single range request)
  const fbsKey = process.env.FBS_API_KEY || null;
  if (fbsKey && market === 'twse') {
    try {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - months + 1);
      const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      const data = await fbs.fetchHistory(stockId, startDate, endDate);
      if (Array.isArray(data) && data.length) {
        const allData = data.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        setCache(cacheKey, allData, CACHE_TTL.HISTORY);
        return allData;
      }
    } catch (e) {
      // ignore and fallback
    }
  }

  if (token && market === 'twse') {
    try {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - months + 1);
      const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      const data = await finmind.fetchHistorical(stockId, startDate, endDate, 'TaiwanStockPrice', token);
      // finmind 回傳為每日 OHLCV
      const allData = Array.isArray(data) ? data : [];
      allData.sort((a, b) => new Date(a.date) - new Date(b.date));
      setCache(cacheKey, allData, CACHE_TTL.HISTORY);
      if (allData.length) return allData;
    } catch (e) {
      // ignore and fallback to default
    }
  }

  // Yahoo Finance fallback to bridge unreliable TWSE/TPEx endpoints
  try {
    const end = new Date();
    const start = new Date(end);
    start.setDate(1); // align to beginning of month to ensure enough candles
    start.setMonth(start.getMonth() - Math.max(1, months));

    const data = await yahoo.fetchHistory(stockId, { period1: start, period2: end, interval: '1d' });
    if (Array.isArray(data) && data.length > 0) {
      const allData = data
        .filter(d => d?.date && Number.isFinite(d.close))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      if (allData.length) {
        setCache(cacheKey, allData, CACHE_TTL.HISTORY);
        return allData;
      }
    }
  } catch (e) {
    console.error('Yahoo history fallback failed:', e.message);
  }

  // fallback: 原本按月呼叫 TWSE/TPEx API
  const now = new Date();
  const fetchFn = market === 'tpex' ? getTPExStockData : getTWSEStockData;
  let allData = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthData = await fetchFn(stockId, d.getFullYear(), d.getMonth() + 1);
    allData = allData.concat(monthData);
    await sleep(300);
  }
  allData.sort((a, b) => new Date(a.date) - new Date(b.date));
  setCache(cacheKey, allData, CACHE_TTL.HISTORY);
  return allData;
}

/**
 * 取得即時股價 (盤中)
 * @param {string} stockId - 股票代號
 * @returns {Promise<Object>} 即時股價資訊
 */
async function getRealtimePrice(stockId) {
  // 檢查快取
  const cacheKey = `realtime_${stockId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  // 取得中文股票資訊
  const stockInfo = getStockInfo(stockId);
  const chineseName = stockInfo?.name || null;
  const market = stockInfo?.market || 'twse';

  try {
    // 優先使用 yahoo integration 取得即時價（支援 TW 市場），作為最常用的回退
    // If FBS configured, try FBS first for realtime
    const fbsKey = process.env.FBS_API_KEY || null;
    if (fbsKey) {
      try {
        const f = await fbs.fetchRealtime(stockId);
        if (f) { setCache(cacheKey, f, CACHE_TTL.REALTIME); return f; }
      } catch (e) { /* ignore */ }
    }

    // 使用 Yahoo Finance 並傳入中文名稱
    const yahooRes = await yahoo.fetchRealtime(stockId, chineseName, market);
    if (yahooRes) {
      // 補充產業資訊
      if (stockInfo?.industry) {
        yahooRes.industry = stockInfo.industry;
      }
      setCache(cacheKey, yahooRes, CACHE_TTL.REALTIME);
      return yahooRes;
    }

    // 否則回退到原本的 MIS API
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${stockId}.tw|otc_${stockId}.tw`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 5000
    });
    if (!response.data.msgArray || response.data.msgArray.length === 0) return null;
    const stock = response.data.msgArray[0];
    const toFloat = v => { if (v === null || v === undefined) return null; const s = String(v).replace(/,/g, '').replace(/^-$/, ''); const n = parseFloat(s); return Number.isNaN(n) ? null : n; };
    const toInt = v => { if (v === null || v === undefined) return 0; const s = String(v).replace(/,/g, '').replace(/^-$/, ''); const n = parseInt(s, 10); return Number.isNaN(n) ? 0 : n; };
    const price = toFloat(stock.z) ?? toFloat(stock.y) ?? 0;
    const yesterday = toFloat(stock.y) ?? 0;
    const open = toFloat(stock.o) ?? 0;
    const high = toFloat(stock.h) ?? 0;
    const low = toFloat(stock.l) ?? 0;
    const volume = toInt(stock.v) ? toInt(stock.v) * 1000 : 0;
    const change = (price !== null && yesterday !== null) ? (price - yesterday) : 0;
    const changePercent = (yesterday > 0) ? ((change / yesterday) * 100).toFixed(2) : '0.00';
    const result = { stockId: stock.c, name: stock.n, price, open, high, low, yesterday, volume, time: stock.t, change, changePercent };
    setCache(cacheKey, result, CACHE_TTL.REALTIME);
    return result;
  } catch (error) {
    console.error(`取得即時股價失敗: ${error.message}`);
    return null;
  }
}

/**
 * 搜尋股票
 * @param {string} keyword - 股票代號或名稱關鍵字
 * @returns {Promise<Array>} 符合的股票列表
 */
async function searchStock(keyword) {
  // 常用台股列表 (可擴充或改為從 API 取得)
  const popularStocks = [
    { id: '2330', name: '台積電', market: 'twse' },
    { id: '2317', name: '鴻海', market: 'twse' },
    { id: '2454', name: '聯發科', market: 'twse' },
    { id: '2308', name: '台達電', market: 'twse' },
    { id: '2382', name: '廣達', market: 'twse' },
    { id: '2881', name: '富邦金', market: 'twse' },
    { id: '2882', name: '國泰金', market: 'twse' },
    { id: '2891', name: '中信金', market: 'twse' },
    { id: '2303', name: '聯電', market: 'twse' },
    { id: '2412', name: '中華電', market: 'twse' },
    { id: '2886', name: '兆豐金', market: 'twse' },
    { id: '2884', name: '玉山金', market: 'twse' },
    { id: '3008', name: '大立光', market: 'twse' },
    { id: '2357', name: '華碩', market: 'twse' },
    { id: '2379', name: '瑞昱', market: 'twse' },
    { id: '3711', name: '日月光投控', market: 'twse' },
    { id: '2892', name: '第一金', market: 'twse' },
    { id: '2301', name: '光寶科', market: 'twse' },
    { id: '2002', name: '中鋼', market: 'twse' },
    { id: '1301', name: '台塑', market: 'twse' },
    { id: '1303', name: '南亞', market: 'twse' },
    { id: '1326', name: '台化', market: 'twse' },
    { id: '6505', name: '台塑化', market: 'twse' },
    { id: '0050', name: '元大台灣50', market: 'twse' },
    { id: '0056', name: '元大高股息', market: 'twse' },
    { id: '00878', name: '國泰永續高股息', market: 'twse' },
    { id: '00919', name: '群益台灣精選高息', market: 'twse' },
    { id: '6488', name: '環球晶', market: 'tpex' },
    { id: '5483', name: '中美晶', market: 'tpex' },
    { id: '3105', name: '穩懋', market: 'tpex' },
    { id: '8069', name: '元太', market: 'tpex' },
    { id: '6409', name: '旭隼', market: 'tpex' }
  ];

  return popularStocks.filter(stock => 
    stock.id.includes(keyword) || stock.name.includes(keyword)
  );
}

/**
 * 取得所有上市股票當日行情
 * @returns {Promise<Array>} 上市股票清單含即時行情
 */
async function getAllTWSEStocks() {
  try {
    // TWSE 每日收盤行情全部股票
    const url = `${TWSE_API}/STOCK_DAY_ALL?response=json`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    if (!response.data || !response.data.data) {
      // 備用方案：從 HTML 解析或其他 API
      console.warn('TWSE API returned empty, trying HTML scraper fallback');
      const htmlFallback = await getAllTWSEStocksFromHTML();
      if (htmlFallback && htmlFallback.length > 0) return htmlFallback;
      return await getAllTWSEStocksFromMI();
    }

    return response.data.data.map(row => ({
      stockId: row[0],
      name: row[1],
      volume: parseInt(String(row[2]).replace(/,/g, '')) || 0,
      tradeValue: parseInt(String(row[3]).replace(/,/g, '')) || 0,
      open: parseFloat(String(row[4]).replace(/,/g, '')) || 0,
      high: parseFloat(String(row[5]).replace(/,/g, '')) || 0,
      low: parseFloat(String(row[6]).replace(/,/g, '')) || 0,
      close: parseFloat(String(row[7]).replace(/,/g, '')) || 0,
      change: parseFloat(String(row[8]).replace(/,/g, '')) || 0,
      transactions: parseInt(String(row[9]).replace(/,/g, '')) || 0,
      market: 'twse'
    })).filter(s => s.close > 0);
  } catch (error) {
    console.error(`取得上市股票清單失敗: ${error.message}`);
    return await getAllTWSEStocksFromMI();
  }
}

/**
 * 備用方案：從 MI 行情資訊站取得上市股票
 */
async function getAllTWSEStocksFromMI() {
  try {
    const url = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw|otc_o00.tw';
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    // 如果這個也失敗，返回預設股票清單
    return getDefaultStockList('twse');
  } catch (error) {
    return getDefaultStockList('twse');
  }
}

/**
 * 取得所有上櫃股票當日行情
 * @returns {Promise<Array>} 上櫃股票清單含即時行情
 */
async function getAllTPExStocks() {
  try {
    // TPEx 上櫃股票每日收盤行情
    const today = new Date();
    const dateStr = `${today.getFullYear() - 1911}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
    
    const url = `https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&d=${dateStr}&se=EW`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    if (!response.data || !response.data.aaData) {
      console.warn('TPEx API returned empty, trying HTML scraper fallback');
      const htmlFallback = await getAllTPExStocksFromHTML();
      if (htmlFallback && htmlFallback.length > 0) return htmlFallback;
      return getDefaultStockList('tpex');
    }

    return response.data.aaData.map(row => ({
      stockId: row[0],
      name: row[1],
      close: parseFloat(String(row[2]).replace(/,/g, '')) || 0,
      change: parseFloat(String(row[3]).replace(/,/g, '')) || 0,
      open: parseFloat(String(row[4]).replace(/,/g, '')) || 0,
      high: parseFloat(String(row[5]).replace(/,/g, '')) || 0,
      low: parseFloat(String(row[6]).replace(/,/g, '')) || 0,
      volume: parseInt(String(row[7]).replace(/,/g, '')) * 1000 || 0,
      tradeValue: parseInt(String(row[8]).replace(/,/g, '')) * 1000 || 0,
      transactions: parseInt(String(row[9]).replace(/,/g, '')) || 0,
      market: 'tpex'
    })).filter(s => s.close > 0);
  } catch (error) {
    console.error(`取得上櫃股票清單失敗: ${error.message}`);
    return getDefaultStockList('tpex');
  }
}

/**
 * 取得預設股票清單（備用）
 */
function getDefaultStockList(market) {
  const twseStocks = [
    { stockId: '2330', name: '台積電', industry: '半導體' },
    { stockId: '2317', name: '鴻海', industry: '電子零組件' },
    { stockId: '2454', name: '聯發科', industry: '半導體' },
    { stockId: '2308', name: '台達電', industry: '電子零組件' },
    { stockId: '2382', name: '廣達', industry: '電腦及週邊' },
    { stockId: '2881', name: '富邦金', industry: '金融保險' },
    { stockId: '2882', name: '國泰金', industry: '金融保險' },
    { stockId: '2891', name: '中信金', industry: '金融保險' },
    { stockId: '2303', name: '聯電', industry: '半導體' },
    { stockId: '2412', name: '中華電', industry: '通信網路' },
    { stockId: '2886', name: '兆豐金', industry: '金融保險' },
    { stockId: '2884', name: '玉山金', industry: '金融保險' },
    { stockId: '3008', name: '大立光', industry: '光電' },
    { stockId: '2357', name: '華碩', industry: '電腦及週邊' },
    { stockId: '2379', name: '瑞昱', industry: '半導體' },
    { stockId: '3711', name: '日月光投控', industry: '半導體' },
    { stockId: '2892', name: '第一金', industry: '金融保險' },
    { stockId: '2301', name: '光寶科', industry: '電子零組件' },
    { stockId: '2002', name: '中鋼', industry: '鋼鐵' },
    { stockId: '1301', name: '台塑', industry: '塑膠' },
    { stockId: '1303', name: '南亞', industry: '塑膠' },
    { stockId: '1326', name: '台化', industry: '塑膠' },
    { stockId: '6505', name: '台塑化', industry: '油電燃氣' },
    { stockId: '0050', name: '元大台灣50', industry: 'ETF' },
    { stockId: '0056', name: '元大高股息', industry: 'ETF' },
    { stockId: '00878', name: '國泰永續高股息', industry: 'ETF' },
    { stockId: '00919', name: '群益台灣精選高息', industry: 'ETF' },
    { stockId: '2603', name: '長榮', industry: '航運' },
    { stockId: '2609', name: '陽明', industry: '航運' },
    { stockId: '2615', name: '萬海', industry: '航運' },
    { stockId: '3034', name: '聯詠', industry: '半導體' },
    { stockId: '2327', name: '國巨', industry: '電子零組件' },
    { stockId: '2345', name: '智邦', industry: '通信網路' },
    { stockId: '2353', name: '宏碁', industry: '電腦及週邊' },
    { stockId: '2376', name: '技嘉', industry: '電腦及週邊' },
    { stockId: '2377', name: '微星', industry: '電腦及週邊' },
    { stockId: '2395', name: '研華', industry: '電腦及週邊' },
    { stockId: '2408', name: '南亞科', industry: '半導體' },
    { stockId: '2474', name: '可成', industry: '電子零組件' },
    { stockId: '2633', name: '台灣高鐵', industry: '觀光' },
    { stockId: '2801', name: '彰銀', industry: '金融保險' },
    { stockId: '2880', name: '華南金', industry: '金融保險' },
    { stockId: '2883', name: '開發金', industry: '金融保險' },
    { stockId: '2885', name: '元大金', industry: '金融保險' },
    { stockId: '2887', name: '台新金', industry: '金融保險' },
    { stockId: '2888', name: '新光金', industry: '金融保險' },
    { stockId: '2890', name: '永豐金', industry: '金融保險' },
    { stockId: '2912', name: '統一超', industry: '貿易百貨' },
    { stockId: '3037', name: '欣興', industry: '電子零組件' },
    { stockId: '3045', name: '台灣大', industry: '通信網路' },
    { stockId: '3231', name: '緯創', industry: '電腦及週邊' },
    { stockId: '3443', name: '創意', industry: '半導體' },
    { stockId: '3481', name: '群創', industry: '光電' },
    { stockId: '3529', name: '力旺', industry: '半導體' },
    { stockId: '3661', name: '世芯-KY', industry: '半導體' },
    { stockId: '3702', name: '大聯大', industry: '電子通路' },
    { stockId: '4904', name: '遠傳', industry: '通信網路' },
    { stockId: '4938', name: '和碩', industry: '電腦及週邊' },
    { stockId: '5871', name: '中租-KY', industry: '金融保險' },
    { stockId: '5880', name: '合庫金', industry: '金融保險' },
    { stockId: '6415', name: '矽力-KY', industry: '半導體' },
    { stockId: '6446', name: '藥華藥', industry: '生技醫療' },
    { stockId: '6669', name: '緯穎', industry: '電腦及週邊' },
    { stockId: '6770', name: '力積電', industry: '半導體' }
  ];

  const tpexStocks = [
    { stockId: '6488', name: '環球晶', industry: '半導體' },
    { stockId: '5483', name: '中美晶', industry: '半導體' },
    { stockId: '3105', name: '穩懋', industry: '半導體' },
    { stockId: '8069', name: '元太', industry: '光電' },
    { stockId: '6409', name: '旭隼', industry: '電子零組件' },
    { stockId: '3293', name: '鑫創', industry: '半導體' },
    { stockId: '5269', name: '祥碩', industry: '半導體' },
    { stockId: '6547', name: '高端疫苗', industry: '生技醫療' },
    { stockId: '8046', name: '南電', industry: '電子零組件' },
    { stockId: '3530', name: '晶相光', industry: '半導體' },
    { stockId: '4966', name: '譜瑞-KY', industry: '半導體' },
    { stockId: '5289', name: '宜鼎', industry: '半導體' },
    { stockId: '6533', name: '晶心科', industry: '半導體' },
    { stockId: '6803', name: '崧騰', industry: '電子零組件' },
    { stockId: '3707', name: '漢磊', industry: '半導體' }
  ];

  const stocks = market === 'tpex' ? tpexStocks : twseStocks;
  
  // Return stocks with zero values as placeholders (fallback mode)
  // These will be updated when real API data becomes available
  return stocks.map(s => ({
    ...s,
    stockId: s.stockId,
    close: 0,
    change: 0,
    open: 0,
    high: 0,
    low: 0,
    volume: 0,
    transactions: 0,
    market,
    isFallback: true // Flag to indicate this is fallback data
  }));
}

/**
 * 使用 Yahoo Finance 取得預設股票清單的即時報價 (中文名稱)
 * @param {string} market - 市場 ('twse' 或 'tpex')
 * @returns {Promise<Array>} 含即時報價的股票清單
 */
async function getDefaultStockListWithYahoo(market) {
  const defaultList = getDefaultStockList(market);
  
  console.log(`正在透過 Yahoo Finance 取得 ${market} ${defaultList.length} 檔股票即時報價...`);
  
  // 使用 Yahoo Finance 批量取得即時報價
  const enrichedStocks = await yahoo.fetchMultipleRealtime(
    defaultList.map(s => ({
      stockId: s.stockId,
      name: s.name,
      industry: s.industry,
      market
    })),
    100 // 100ms 間隔
  );
  
  console.log(`Yahoo Finance 成功取得 ${enrichedStocks.length} 檔 ${market} 股票資料`);
  
  // 轉換為統一格式
  return enrichedStocks.map(stock => ({
    stockId: stock.stockId,
    symbol: stock.stockId,
    name: stock.name,
    industry: stock.industry,
    close: stock.price,
    price: stock.price,
    open: stock.open,
    high: stock.high,
    low: stock.low,
    change: stock.change,
    changePercent: Number(stock.changePercent),
    volume: stock.volume,
    market,
    source: 'yahoo'
  }));
}

/**
 * 取得全部台股（上市+上櫃）
 * @returns {Promise<Array>} 全部股票清單
 */
async function getAllStocks() {
  console.log('正在取得所有上市上櫃股票...');
  
  const [twseStocks, tpexStocks] = await Promise.all([
    getAllTWSEStocks(),
    getAllTPExStocks()
  ]);

  // 檢查是否為 fallback 資料 (價格為 0)
  const twseFallback = twseStocks.every(s => s.isFallback || s.close === 0);
  const tpexFallback = tpexStocks.every(s => s.isFallback || s.close === 0);

  if (twseFallback || tpexFallback) {
    console.log('TWSE/TPEx API 返回空資料,改用 Yahoo Finance 取得即時報價...');
    
    try {
      const [yahooTwse, yahooTpex] = await Promise.all([
        getDefaultStockListWithYahoo('twse'),
        getDefaultStockListWithYahoo('tpex')
      ]);
      
      const allYahoo = [...yahooTwse, ...yahooTpex];
      console.log(`Yahoo Finance 共取得 ${allYahoo.length} 檔股票`);
      return allYahoo;
    } catch (e) {
      console.error('Yahoo Finance fallback 失敗:', e.message);
    }
  }

  console.log(`取得上市股票 ${twseStocks.length} 檔, 上櫃股票 ${tpexStocks.length} 檔`);
  
  return [...twseStocks, ...tpexStocks];
}

/**
 * 計算技術指標
 * @param {Array} prices - 價格陣列
 * @returns {Object} 技術指標
 */
function calculateIndicators(prices) {
  if (!prices || prices.length < 20) {
    return {
      rsi: 50,
      ma5: 0,
      ma20: 0,
      ma60: 0,
      macdSignal: 'neutral',
      bollingerPosition: 50
    };
  }

  const closes = prices.map(p => p.close);
  
  // RSI 計算 (14日)
  const rsi = calculateRSI(closes, 14);
  
  // 移動平均
  const ma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const ma60 = closes.length >= 60 ? closes.slice(-60).reduce((a, b) => a + b, 0) / 60 : ma20;
  
  // MACD 訊號
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12 - ema26;
  const prevMacd = calculateEMA(closes.slice(0, -1), 12) - calculateEMA(closes.slice(0, -1), 26);
  const macdSignal = macd > prevMacd ? 'bullish' : macd < prevMacd ? 'bearish' : 'neutral';
  
  // 布林通道位置
  const std = Math.sqrt(closes.slice(-20).reduce((sum, p) => sum + Math.pow(p - ma20, 2), 0) / 20);
  const upperBand = ma20 + 2 * std;
  const lowerBand = ma20 - 2 * std;
  const currentPrice = closes[closes.length - 1];
  const bollingerPosition = ((currentPrice - lowerBand) / (upperBand - lowerBand)) * 100;

  return {
    rsi: Math.round(rsi),
    ma5: Math.round(ma5 * 100) / 100,
    ma20: Math.round(ma20 * 100) / 100,
    ma60: Math.round(ma60 * 100) / 100,
    macdSignal,
    bollingerPosition: Math.round(bollingerPosition)
  };
}

/**
 * 計算 RSI
 */
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * 計算 EMA
 */
function calculateEMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * 產業分類對照表
 */
const INDUSTRY_MAP = {
  '01': '水泥', '02': '食品', '03': '塑膠', '04': '紡織纖維',
  '05': '電機機械', '06': '電器電纜', '07': '化學生技醫療', '08': '化學',
  '09': '生技醫療', '10': '玻璃陶瓷', '11': '造紙', '12': '鋼鐵',
  '13': '橡膠', '14': '汽車', '15': '電子', '16': '半導體',
  '17': '電腦及週邊', '18': '光電', '19': '通信網路', '20': '電子零組件',
  '21': '電子通路', '22': '資訊服務', '23': '其他電子', '24': '建材營造',
  '25': '航運', '26': '觀光', '27': '金融保險', '28': '貿易百貨',
  '29': '油電燃氣', '30': '其他', '31': 'ETF'
};

/**
 * 根據股票代號推斷產業
 * 使用優先級順序匹配，避免過度匹配
 */
function inferIndustry(stockId, name, industryCode) {
  if (!name) return '其他';

  // 1. 產業代碼優先（如有）
  if (industryCode && typeof industryCode === 'string') {
    const codeMap = {
      '31': 'ETF',
      '27': '金融保險',
      '19': '通信網路',
      '4': '半導體',
      '5': '生技醫療',
      '25': '航運',
      '7': '鋼鐵',
      '8': '塑膠',
      '18': '光電',
      '17': '電腦及週邊',
      '20': '電子零組件',
      '24': '建材營造',
      '13': '食品',
      '26': '觀光',
      '29': '油電燃氣',
    };
    if (codeMap[industryCode]) return codeMap[industryCode];
  }

  // 2. 關鍵字表格化（正則）
  const rules = [
    { type: 'ETF', regex: /ETF|元大台灣|國泰永續|富邦.*(50|100|高股息|科技|金融)/ },
    { type: '金融保險', regex: /金控|銀行|證券|人壽|產險|投信|[^黃]金$/ },
    { type: '通信網路', regex: /電信|遠傳|台灣大|中華電/ },
    { type: '半導體', regex: /積電|聯電|晶|半導體|IC設計|封測|矽|創意|世芯/ },
    { type: '生技醫療', regex: /藥|醫|生技|疫苗/ },
    { type: '航運', regex: /航|長榮|陽明|萬海/ },
    { type: '鋼鐵', regex: /鋼|鐵/ },
    { type: '塑膠', regex: /塑|台化|南亞|台塑/ },
    { type: '光電', regex: /光電|面板|顯示|友達|群創|大立光/ },
    { type: '電腦及週邊', regex: /電腦|華碩|宏碁|技嘉|微星|廣達|緯創/ },
    { type: '電子零組件', regex: /電子|鴻海|和碩|可成/ },
    { type: '建材營造', regex: /建|營造|水泥/ },
    { type: '食品', regex: /食|飲|統一|味/ },
    { type: '觀光', regex: /飯店|旅|觀光|高鐵/ },
    { type: '油電燃氣', regex: /油|瓦斯|燃氣|台塑化/ },
  ];

  for (const rule of rules) {
    if (rule.regex.test(name)) return rule.type;
  }

  // ETF 判斷（代號）
  if (stockId && stockId.startsWith('00')) return 'ETF';

  return '其他';
}

/**
 * 休眠函式
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  getTWSEStockData,
  getTPExStockData,
  getStockHistory,
  getRealtimePrice,
  searchStock,
  getAllTWSEStocks,
  getAllTPExStocks,
  getAllStocks,
  calculateIndicators,
  calculateRSI,
  calculateEMA,
  inferIndustry,
  getDefaultStockList
};
