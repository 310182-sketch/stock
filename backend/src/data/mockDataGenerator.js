/**
 * 資料層 (Data Layer)
 * 負責產生標準化 OHLCV 金融數據
 * 使用隨機漫步 (Random Walk) 加上波動率參數生成擬真 K 線
 */

/**
 * 產生模擬股價數據
 * @param {Object} options - 設定參數
 * @param {number} options.days - 天數 (預設 365)
 * @param {number} options.startPrice - 起始股價 (預設 100)
 * @param {number} options.volatility - 波動率 (預設 0.02)
 * @returns {Array} OHLCV 數據陣列
 */
function generateMockData(options = {}) {
  const {
    days = 365,
    startPrice = 100,
    volatility = 0.02
  } = options;

  const data = [];
  let currentPrice = startPrice;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // 隨機漫步產生日內波動
    const dailyReturn = (Math.random() - 0.5) * 2 * volatility;
    const open = currentPrice;
    const close = open * (1 + dailyReturn);
    
    // 產生日內高低點
    const highLowSpread = Math.abs(dailyReturn) + Math.random() * volatility;
    const high = Math.max(open, close) * (1 + highLowSpread / 2);
    const low = Math.min(open, close) * (1 - highLowSpread / 2);
    
    // 隨機成交量
    const volume = Math.floor(1000000 + Math.random() * 5000000);

    data.push({
      date: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume
    });

    currentPrice = close;
  }

  return data;
}

module.exports = { generateMockData };
