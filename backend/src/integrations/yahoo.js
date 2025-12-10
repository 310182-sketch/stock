const yf = require('yahoo-finance2').default;

/**
 * 取得即時報價
 * @param {string} stockId - 股票代號
 * @param {string} chineseName - 中文名稱 (可選,優先使用)
 * @param {string} market - 市場 ('twse' 上市 或 'tpex' 上櫃)
 */
async function fetchRealtime(stockId, chineseName = null, market = 'twse') {
  try {
    // Yahoo ticker: 上市用 .TW, 上櫃用 .TWO
    const suffix = market === 'tpex' ? '.TWO' : '.TW';
    const symbol = stockId.endsWith('.TW') || stockId.endsWith('.TWO') 
      ? stockId 
      : `${stockId}${suffix}`;
    
    const q = await yf.quoteSummary(symbol, { modules: ['price'] });
    if (!q || !q.price) return null;
    const p = q.price;
    
    const price = p.regularMarketPrice || p.previousClose || 0;
    const yesterday = p.previousClose || 0;
    const change = price - yesterday;
    const changePercent = yesterday > 0 ? ((change / yesterday) * 100) : 0;
    
    return {
      stockId: stockId.replace(/\.(TW|TWO)$/, ''),
      name: chineseName || p.longName || p.shortName || stockId,
      price,
      open: p.regularMarketOpen || 0,
      high: p.regularMarketDayHigh || 0,
      low: p.regularMarketDayLow || 0,
      yesterday,
      volume: p.regularMarketVolume || 0,
      time: p.regularMarketTime || null,
      change,
      changePercent: changePercent.toFixed(2)
    };
  } catch (e) {
    return null;
  }
}

/**
 * 批量取得多檔股票即時報價
 * @param {Array<{stockId: string, name: string, industry?: string, market?: string}>} stocks
 * @param {number} delayMs - 每次請求間隔 (毫秒)
 */
async function fetchMultipleRealtime(stocks, delayMs = 150) {
  const results = [];
  
  for (const stock of stocks) {
    try {
      const data = await fetchRealtime(stock.stockId, stock.name, stock.market || 'twse');
      if (data) {
        results.push({
          ...data,
          industry: stock.industry || '未分類',
          market: stock.market || 'twse'
        });
      }
    } catch (e) {
      // 忽略單一股票錯誤
    }
    // 避免請求過快被限制
    if (delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  
  return results;
}

async function fetchHistory(stockId, queryOptions = { period: '1mo' }) {
  try {
    const symbol = stockId.includes('.') ? stockId : `${stockId}.TW`;
    const options = typeof queryOptions === 'string'
      ? { period: queryOptions }
      : { interval: '1d', ...queryOptions };

    const hist = await yf.historical(symbol, options);
    if (!Array.isArray(hist)) return [];

    return hist.map(d => ({
      date: d.date instanceof Date ? d.date.toISOString().slice(0, 10) : String(d.date).slice(0, 10),
      open: Number(d.open) || 0,
      high: Number(d.high) || 0,
      low: Number(d.low) || 0,
      close: Number(d.close) || 0,
      volume: Number(d.volume) || 0
    }));
  } catch (e) {
    console.error(`Yahoo history error for ${stockId}:`, e.message);
    return [];
  }
}

module.exports = { fetchRealtime, fetchHistory, fetchMultipleRealtime };
