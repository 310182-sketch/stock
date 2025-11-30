/**
 * 共用技術指標計算模組
 * 避免在多個檔案中重複定義相同函數
 */

/**
 * 計算簡單移動平均線 (SMA)
 * @param {Array} data - 價格數據陣列 (需有 close 欄位)
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - SMA 值
 */
function calculateSMA(data, period, endIndex) {
  if (endIndex < period - 1 || !data || data.length < period) return null;
  let sum = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    sum += data[i].close;
  }
  return sum / period;
}

/**
 * 計算指數移動平均線 (EMA)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - EMA 值
 */
function calculateEMA(data, period, endIndex) {
  if (endIndex < period - 1) return null;
  
  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(data, period, period - 1);
  
  for (let i = period; i <= endIndex; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * 計算相對強弱指標 (RSI)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期 (預設 14)
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - RSI 值 (0-100)
 */
function calculateRSI(data, period = 14, endIndex) {
  if (endIndex < period) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * 計算 MACD
 * @param {Array} data - 價格數據陣列
 * @param {number} endIndex - 結束索引
 * @param {Object} params - 參數 { fastPeriod, slowPeriod, signalPeriod }
 * @returns {Object|null} - { macd, signal, histogram }
 */
function calculateMACD(data, endIndex, params = {}) {
  const fastPeriod = params.fastPeriod || 12;
  const slowPeriod = params.slowPeriod || 26;
  const signalPeriod = params.signalPeriod || 9;
  
  if (endIndex < slowPeriod + signalPeriod - 2) return null;
  
  const fastEMA = calculateEMA(data, fastPeriod, endIndex);
  const slowEMA = calculateEMA(data, slowPeriod, endIndex);
  
  if (fastEMA === null || slowEMA === null) return null;
  
  const macd = fastEMA - slowEMA;
  
  // 計算 Signal Line (MACD 的 EMA)
  let macdValues = [];
  for (let i = slowPeriod - 1; i <= endIndex; i++) {
    const fast = calculateEMA(data, fastPeriod, i);
    const slow = calculateEMA(data, slowPeriod, i);
    if (fast !== null && slow !== null) {
      macdValues.push(fast - slow);
    }
  }
  
  if (macdValues.length < signalPeriod) return null;
  
  // 計算 signal 的 EMA
  const multiplier = 2 / (signalPeriod + 1);
  let signal = macdValues.slice(0, signalPeriod).reduce((a, b) => a + b, 0) / signalPeriod;
  
  for (let i = signalPeriod; i < macdValues.length; i++) {
    signal = (macdValues[i] - signal) * multiplier + signal;
  }
  
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

/**
 * 計算布林通道 (Bollinger Bands)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @param {number} stdDev - 標準差倍數
 * @returns {Object|null} - { upper, middle, lower, bandwidth, percentB }
 */
function calculateBollingerBands(data, period, endIndex, stdDev = 2) {
  if (endIndex < period - 1) return null;
  
  const middle = calculateSMA(data, period, endIndex);
  if (middle === null) return null;
  
  let sumSquaredDiff = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    sumSquaredDiff += Math.pow(data[i].close - middle, 2);
  }
  const std = Math.sqrt(sumSquaredDiff / period);
  
  const upper = middle + (std * stdDev);
  const lower = middle - (std * stdDev);
  const bandwidth = (upper - lower) / middle * 100;
  const percentB = (data[endIndex].close - lower) / (upper - lower) * 100;
  
  return { upper, middle, lower, bandwidth, percentB };
}

/**
 * 計算 ATR (Average True Range)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - ATR 值
 */
function calculateATR(data, period, endIndex) {
  if (endIndex < period) return null;
  
  let trSum = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trSum += tr;
  }
  
  return trSum / period;
}

module.exports = {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR
};
