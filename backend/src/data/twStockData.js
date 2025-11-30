/**
 * 台灣股市資料層 (Taiwan Stock Data Layer)
 * 串接台灣證券交易所 (TWSE) 與櫃買中心 (TPEx) 公開 API
 */

const axios = require('axios');
const { getAllTWSEStocksFromHTML, getAllTPExStocksFromHTML, getTWSEStockDataFromHTML } = require('./twStockScraper');

// API 端點
const TWSE_API = 'https://www.twse.com.tw/exchangeReport';
const TPEX_API = 'https://www.tpex.org.tw/web/stock';

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
      const isoDate = `${parseInt(rocYear) + 1911}-${m}-${d}`;
      
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
  const allData = [];
  const now = new Date();
  
  const fetchFn = market === 'tpex' ? getTPExStockData : getTWSEStockData;

  for (let i = 0; i < months; i++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;

    console.log(`正在取得 ${stockId} ${year}/${month} 資料...`);
    
    const monthData = await fetchFn(stockId, year, month);
    allData.push(...monthData);

    // 避免請求過快被擋
    await sleep(300);
  }

  // 依日期排序
  return allData.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * 取得即時股價 (盤中)
 * @param {string} stockId - 股票代號
 * @returns {Promise<Object>} 即時股價資訊
 */
async function getRealtimePrice(stockId) {
  try {
    // TWSE 盤中即時資訊 API
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${stockId}.tw`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      },
      timeout: 5000
    });

    if (!response.data.msgArray || response.data.msgArray.length === 0) {
      return null;
    }

    const stock = response.data.msgArray[0];
    
    return {
      stockId: stock.c,
      name: stock.n,
      price: parseFloat(stock.z) || parseFloat(stock.y), // 成交價或昨收
      open: parseFloat(stock.o),
      high: parseFloat(stock.h),
      low: parseFloat(stock.l),
      yesterday: parseFloat(stock.y),
      volume: parseInt(stock.v) * 1000, // 成交張數轉股數
      time: stock.t,
      change: parseFloat(stock.z) - parseFloat(stock.y),
      changePercent: ((parseFloat(stock.z) - parseFloat(stock.y)) / parseFloat(stock.y) * 100).toFixed(2)
    };
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
  
  return stocks.map(s => ({
    ...s,
    close: Math.random() * 500 + 20,
    change: (Math.random() - 0.5) * 20,
    open: 0,
    high: 0,
    low: 0,
    volume: Math.floor(Math.random() * 50000000),
    transactions: Math.floor(Math.random() * 10000),
    market
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
 */
function inferIndustry(stockId, name) {
  // ETF 判斷
  if (stockId.startsWith('00') || name.includes('ETF') || name.includes('50') || name.includes('高股息')) {
    return 'ETF';
  }
  
  // 根據名稱關鍵字
  if (name.includes('金') || name.includes('銀') || name.includes('證') || name.includes('壽') || name.includes('產險')) {
    return '金融保險';
  }
  if (name.includes('電子') || name.includes('科技') || name.includes('電')) {
    return '電子';
  }
  if (name.includes('半導體') || name.includes('晶') || name.includes('電')) {
    return '半導體';
  }
  if (name.includes('鋼') || name.includes('鐵')) {
    return '鋼鐵';
  }
  if (name.includes('航') || name.includes('運')) {
    return '航運';
  }
  if (name.includes('藥') || name.includes('醫') || name.includes('生技')) {
    return '生技醫療';
  }
  if (name.includes('光') || name.includes('顯示')) {
    return '光電';
  }
  if (name.includes('塑') || name.includes('化')) {
    return '塑膠';
  }
  if (name.includes('建') || name.includes('營造')) {
    return '建材營造';
  }
  if (name.includes('食') || name.includes('飲')) {
    return '食品';
  }
  if (name.includes('通') || name.includes('電信')) {
    return '通信網路';
  }
  
  // 預設
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
