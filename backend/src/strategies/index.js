/**
 * 策略模組 - 擴展版
 * 包含多種技術分析策略與進階指標計算
 */

// 交易訊號常數
const SIGNALS = {
  BUY: 'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD',
  STRONG_BUY: 'STRONG_BUY',
  STRONG_SELL: 'STRONG_SELL'
};

// ============================================
// 基礎工具函數
// ============================================

/**
 * 計算簡單移動平均線 (SMA)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - SMA 值
 */
function calculateSMA(data, period, endIndex) {
  if (endIndex < period - 1) return null;
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
  
  // 先計算初始 SMA
  let ema = calculateSMA(data, period, period - 1);
  
  // 從第 period 個數據開始計算 EMA
  for (let i = period; i <= endIndex; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * 計算加權移動平均線 (WMA)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - WMA 值
 */
function calculateWMA(data, period, endIndex) {
  if (endIndex < period - 1) return null;
  
  let weightedSum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < period; i++) {
    const weight = period - i;
    weightedSum += data[endIndex - i].close * weight;
    weightSum += weight;
  }
  
  return weightedSum / weightSum;
}

/**
 * 計算相對強弱指標 (RSI)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - RSI 值 (0-100)
 */
function calculateRSI(data, period, endIndex) {
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
 * 計算 MACD 指標
 * @param {Array} data - 價格數據陣列
 * @param {number} endIndex - 結束索引
 * @param {Object} params - 參數 { fastPeriod, slowPeriod, signalPeriod }
 * @returns {Object|null} - { macd, signal, histogram }
 */
function calculateMACD(data, endIndex, params = {}) {
  const fastPeriod = params.fastPeriod || 12;
  const slowPeriod = params.slowPeriod || 26;
  const signalPeriod = params.signalPeriod || 9;
  
  if (endIndex < slowPeriod + signalPeriod - 1) return null;
  
  const fastEMA = calculateEMA(data, fastPeriod, endIndex);
  const slowEMA = calculateEMA(data, slowPeriod, endIndex);
  
  if (fastEMA === null || slowEMA === null) return null;
  
  const macd = fastEMA - slowEMA;
  
  // 計算信號線 (MACD 的 EMA)
  // 簡化處理：使用近期 MACD 值的 SMA
  let macdValues = [];
  for (let i = endIndex - signalPeriod + 1; i <= endIndex; i++) {
    const fast = calculateEMA(data, fastPeriod, i);
    const slow = calculateEMA(data, slowPeriod, i);
    if (fast !== null && slow !== null) {
      macdValues.push(fast - slow);
    }
  }
  
  const signal = macdValues.length >= signalPeriod 
    ? macdValues.reduce((a, b) => a + b, 0) / macdValues.length 
    : null;
  
  const histogram = signal !== null ? macd - signal : null;
  
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
  
  // 計算標準差
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
 * 計算 KD 隨機指標 (Stochastic Oscillator)
 * @param {Array} data - 價格數據陣列
 * @param {number} endIndex - 結束索引
 * @param {Object} params - 參數 { kPeriod, dPeriod, slowing }
 * @returns {Object|null} - { k, d, j }
 */
function calculateKD(data, endIndex, params = {}) {
  const kPeriod = params.kPeriod || 9;
  const dPeriod = params.dPeriod || 3;
  const slowing = params.slowing || 3;
  
  if (endIndex < kPeriod + slowing - 2) return null;
  
  // 計算 RSV (Raw Stochastic Value)
  let rsvValues = [];
  for (let i = endIndex - slowing + 1; i <= endIndex; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (j >= 0) {
        highestHigh = Math.max(highestHigh, data[j].high);
        lowestLow = Math.min(lowestLow, data[j].low);
      }
    }
    
    const rsv = highestHigh !== lowestLow 
      ? (data[i].close - lowestLow) / (highestHigh - lowestLow) * 100 
      : 50;
    rsvValues.push(rsv);
  }
  
  // K 值 = RSV 的 slowing 週期 SMA
  const k = rsvValues.reduce((a, b) => a + b, 0) / rsvValues.length;
  
  // 計算 D 值 (K 的 dPeriod 週期 SMA)
  let kValues = [];
  for (let i = endIndex - dPeriod + 1; i <= endIndex; i++) {
    const tempK = calculateKD(data, i, { ...params, skipD: true });
    if (tempK !== null) {
      kValues.push(typeof tempK === 'object' ? tempK.k : tempK);
    }
  }
  
  const d = kValues.length > 0 ? kValues.reduce((a, b) => a + b, 0) / kValues.length : k;
  
  // J 值 = 3K - 2D
  const j = 3 * k - 2 * d;
  
  return { k, d, j };
}

/**
 * 計算平均真實範圍 (ATR)
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

/**
 * 計算能量潮指標 (OBV)
 * @param {Array} data - 價格數據陣列
 * @param {number} endIndex - 結束索引
 * @returns {number} - OBV 值
 */
function calculateOBV(data, endIndex) {
  let obv = 0;
  for (let i = 1; i <= endIndex; i++) {
    const volume = data[i].volume || 0;
    if (data[i].close > data[i - 1].close) {
      obv += volume;
    } else if (data[i].close < data[i - 1].close) {
      obv -= volume;
    }
  }
  return obv;
}

/**
 * 計算成交量加權平均價 (VWAP)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - VWAP 值
 */
function calculateVWAP(data, period, endIndex) {
  if (endIndex < period - 1) return null;
  
  let sumPV = 0;
  let sumVolume = 0;
  
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    const volume = data[i].volume || 1;
    sumPV += typicalPrice * volume;
    sumVolume += volume;
  }
  
  return sumVolume > 0 ? sumPV / sumVolume : null;
}

/**
 * 計算威廉指標 (Williams %R)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - Williams %R 值 (-100 to 0)
 */
function calculateWilliamsR(data, period, endIndex) {
  if (endIndex < period - 1) return null;
  
  let highestHigh = -Infinity;
  let lowestLow = Infinity;
  
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    highestHigh = Math.max(highestHigh, data[i].high);
    lowestLow = Math.min(lowestLow, data[i].low);
  }
  
  if (highestHigh === lowestLow) return -50;
  
  return ((highestHigh - data[endIndex].close) / (highestHigh - lowestLow)) * -100;
}

/**
 * 計算商品通道指數 (CCI)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - CCI 值
 */
function calculateCCI(data, period, endIndex) {
  if (endIndex < period - 1) return null;
  
  // 計算典型價格
  const typicalPrices = [];
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    typicalPrices.push((data[i].high + data[i].low + data[i].close) / 3);
  }
  
  // 計算平均典型價格
  const smaTP = typicalPrices.reduce((a, b) => a + b, 0) / period;
  
  // 計算平均絕對偏差
  const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
  
  if (meanDeviation === 0) return 0;
  
  return (typicalPrices[typicalPrices.length - 1] - smaTP) / (0.015 * meanDeviation);
}

/**
 * 計算動量指標 (Momentum)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - 動量值
 */
function calculateMomentum(data, period, endIndex) {
  if (endIndex < period) return null;
  return data[endIndex].close - data[endIndex - period].close;
}

/**
 * 計算變動率 (ROC)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {number|null} - ROC 值 (百分比)
 */
function calculateROC(data, period, endIndex) {
  if (endIndex < period) return null;
  const prevClose = data[endIndex - period].close;
  if (prevClose === 0) return null;
  return ((data[endIndex].close - prevClose) / prevClose) * 100;
}

/**
 * 計算順勢指標 (DI+, DI-, ADX)
 * @param {Array} data - 價格數據陣列
 * @param {number} period - 計算週期
 * @param {number} endIndex - 結束索引
 * @returns {Object|null} - { diPlus, diMinus, adx }
 */
function calculateADX(data, period, endIndex) {
  if (endIndex < period * 2) return null;
  
  let trSum = 0;
  let dmPlusSum = 0;
  let dmMinusSum = 0;
  
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevHigh = data[i - 1].high;
    const prevLow = data[i - 1].low;
    const prevClose = data[i - 1].close;
    
    // True Range
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trSum += tr;
    
    // +DM and -DM
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    if (upMove > downMove && upMove > 0) {
      dmPlusSum += upMove;
    }
    if (downMove > upMove && downMove > 0) {
      dmMinusSum += downMove;
    }
  }
  
  const diPlus = trSum > 0 ? (dmPlusSum / trSum) * 100 : 0;
  const diMinus = trSum > 0 ? (dmMinusSum / trSum) * 100 : 0;
  
  const diSum = diPlus + diMinus;
  const dx = diSum > 0 ? Math.abs(diPlus - diMinus) / diSum * 100 : 0;
  
  // 簡化的 ADX 計算 (實際應該用平滑平均)
  const adx = dx;
  
  return { diPlus, diMinus, adx };
}

// ============================================
// 交易策略
// ============================================

/**
 * MA 交叉策略 (經典黃金交叉/死亡交叉)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function maCrossStrategy(data, index, params = {}) {
  const shortPeriod = params.shortPeriod || 5;
  const longPeriod = params.longPeriod || 20;
  
  if (index < longPeriod) return SIGNALS.HOLD;
  
  const shortMA = calculateSMA(data, shortPeriod, index);
  const longMA = calculateSMA(data, longPeriod, index);
  const prevShortMA = calculateSMA(data, shortPeriod, index - 1);
  const prevLongMA = calculateSMA(data, longPeriod, index - 1);
  
  if (shortMA === null || longMA === null || prevShortMA === null || prevLongMA === null) {
    return SIGNALS.HOLD;
  }
  
  // 黃金交叉：短期均線由下往上穿越長期均線
  if (prevShortMA <= prevLongMA && shortMA > longMA) {
    return SIGNALS.BUY;
  }
  
  // 死亡交叉：短期均線由上往下穿越長期均線
  if (prevShortMA >= prevLongMA && shortMA < longMA) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 三重均線策略
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function tripleMAStrategy(data, index, params = {}) {
  const shortPeriod = params.shortPeriod || 5;
  const mediumPeriod = params.mediumPeriod || 10;
  const longPeriod = params.longPeriod || 20;
  
  if (index < longPeriod) return SIGNALS.HOLD;
  
  const shortMA = calculateSMA(data, shortPeriod, index);
  const mediumMA = calculateSMA(data, mediumPeriod, index);
  const longMA = calculateSMA(data, longPeriod, index);
  
  if (shortMA === null || mediumMA === null || longMA === null) {
    return SIGNALS.HOLD;
  }
  
  // 多頭排列：短期 > 中期 > 長期
  if (shortMA > mediumMA && mediumMA > longMA) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 空頭排列：短期 < 中期 < 長期
  if (shortMA < mediumMA && mediumMA < longMA) {
    return SIGNALS.STRONG_SELL;
  }
  
  // 短期均線在中期均線之上
  if (shortMA > mediumMA) {
    return SIGNALS.BUY;
  }
  
  // 短期均線在中期均線之下
  if (shortMA < mediumMA) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 動量策略
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function momentumStrategy(data, index, params = {}) {
  const period = params.period || 10;
  const threshold = params.threshold || 0.02;
  
  if (index < period) return SIGNALS.HOLD;
  
  const currentPrice = data[index].close;
  const pastPrice = data[index - period].close;
  const momentum = (currentPrice - pastPrice) / pastPrice;
  
  if (momentum > threshold * 1.5) return SIGNALS.STRONG_BUY;
  if (momentum > threshold) return SIGNALS.BUY;
  if (momentum < -threshold * 1.5) return SIGNALS.STRONG_SELL;
  if (momentum < -threshold) return SIGNALS.SELL;
  
  return SIGNALS.HOLD;
}

/**
 * RSI 策略
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function rsiStrategy(data, index, params = {}) {
  const period = params.period || 14;
  const overbought = params.overbought || 70;
  const oversold = params.oversold || 30;
  const extremeOverbought = params.extremeOverbought || 80;
  const extremeOversold = params.extremeOversold || 20;
  
  const rsi = calculateRSI(data, period, index);
  
  if (rsi === null) return SIGNALS.HOLD;
  
  if (rsi < extremeOversold) return SIGNALS.STRONG_BUY;
  if (rsi < oversold) return SIGNALS.BUY;
  if (rsi > extremeOverbought) return SIGNALS.STRONG_SELL;
  if (rsi > overbought) return SIGNALS.SELL;
  
  return SIGNALS.HOLD;
}

/**
 * MACD 策略
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function macdStrategy(data, index, params = {}) {
  const macd = calculateMACD(data, index, params);
  const prevMacd = calculateMACD(data, index - 1, params);
  
  if (macd === null || prevMacd === null) return SIGNALS.HOLD;
  
  // MACD 線上穿信號線
  if (prevMacd.macd <= prevMacd.signal && macd.macd > macd.signal) {
    if (macd.macd < 0) return SIGNALS.STRONG_BUY; // 在零軸下方的金叉更強
    return SIGNALS.BUY;
  }
  
  // MACD 線下穿信號線
  if (prevMacd.macd >= prevMacd.signal && macd.macd < macd.signal) {
    if (macd.macd > 0) return SIGNALS.STRONG_SELL; // 在零軸上方的死叉更強
    return SIGNALS.SELL;
  }
  
  // 零軸交叉
  if (prevMacd.macd <= 0 && macd.macd > 0) return SIGNALS.BUY;
  if (prevMacd.macd >= 0 && macd.macd < 0) return SIGNALS.SELL;
  
  return SIGNALS.HOLD;
}

/**
 * 布林通道策略
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function bollingerStrategy(data, index, params = {}) {
  const period = params.period || 20;
  const stdDev = params.stdDev || 2;
  
  const bb = calculateBollingerBands(data, period, index, stdDev);
  
  if (bb === null) return SIGNALS.HOLD;
  
  const price = data[index].close;
  
  // 價格觸及下軌：買入訊號
  if (price <= bb.lower) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 價格接近下軌 (在 %B 25% 以下)
  if (bb.percentB < 25) {
    return SIGNALS.BUY;
  }
  
  // 價格觸及上軌：賣出訊號
  if (price >= bb.upper) {
    return SIGNALS.STRONG_SELL;
  }
  
  // 價格接近上軌 (在 %B 75% 以上)
  if (bb.percentB > 75) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * KD 隨機指標策略
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function kdStrategy(data, index, params = {}) {
  const kd = calculateKD(data, index, params);
  const prevKd = calculateKD(data, index - 1, params);
  
  if (kd === null || prevKd === null) return SIGNALS.HOLD;
  
  const overbought = params.overbought || 80;
  const oversold = params.oversold || 20;
  
  // K 線從下往上穿越 D 線 (黃金交叉)
  if (prevKd.k <= prevKd.d && kd.k > kd.d) {
    if (kd.k < oversold) return SIGNALS.STRONG_BUY;
    return SIGNALS.BUY;
  }
  
  // K 線從上往下穿越 D 線 (死亡交叉)
  if (prevKd.k >= prevKd.d && kd.k < kd.d) {
    if (kd.k > overbought) return SIGNALS.STRONG_SELL;
    return SIGNALS.SELL;
  }
  
  // 極度超賣
  if (kd.k < oversold && kd.d < oversold) {
    return SIGNALS.BUY;
  }
  
  // 極度超買
  if (kd.k > overbought && kd.d > overbought) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 突破策略 (Breakout Strategy)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function breakoutStrategy(data, index, params = {}) {
  const period = params.period || 20;
  const volumeMultiplier = params.volumeMultiplier || 1.5;
  
  if (index < period) return SIGNALS.HOLD;
  
  // 計算區間高低點
  let highestHigh = -Infinity;
  let lowestLow = Infinity;
  let avgVolume = 0;
  
  for (let i = index - period; i < index; i++) {
    highestHigh = Math.max(highestHigh, data[i].high);
    lowestLow = Math.min(lowestLow, data[i].low);
    avgVolume += data[i].volume || 0;
  }
  avgVolume /= period;
  
  const currentPrice = data[index].close;
  const currentVolume = data[index].volume || 0;
  const isHighVolume = currentVolume > avgVolume * volumeMultiplier;
  
  // 向上突破且成交量放大
  if (currentPrice > highestHigh && isHighVolume) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 向上突破
  if (currentPrice > highestHigh) {
    return SIGNALS.BUY;
  }
  
  // 向下突破且成交量放大
  if (currentPrice < lowestLow && isHighVolume) {
    return SIGNALS.STRONG_SELL;
  }
  
  // 向下突破
  if (currentPrice < lowestLow) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 均值回歸策略 (Mean Reversion Strategy)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function meanReversionStrategy(data, index, params = {}) {
  const period = params.period || 20;
  const threshold = params.threshold || 2;
  
  if (index < period) return SIGNALS.HOLD;
  
  const ma = calculateSMA(data, period, index);
  if (ma === null) return SIGNALS.HOLD;
  
  // 計算標準差
  let sumSquaredDiff = 0;
  for (let i = index - period + 1; i <= index; i++) {
    sumSquaredDiff += Math.pow(data[i].close - ma, 2);
  }
  const std = Math.sqrt(sumSquaredDiff / period);
  
  const currentPrice = data[index].close;
  const zScore = (currentPrice - ma) / std;
  
  // 價格低於均值超過 threshold 個標準差，買入
  if (zScore < -threshold * 1.5) return SIGNALS.STRONG_BUY;
  if (zScore < -threshold) return SIGNALS.BUY;
  
  // 價格高於均值超過 threshold 個標準差，賣出
  if (zScore > threshold * 1.5) return SIGNALS.STRONG_SELL;
  if (zScore > threshold) return SIGNALS.SELL;
  
  return SIGNALS.HOLD;
}

/**
 * 威廉指標策略
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function williamsRStrategy(data, index, params = {}) {
  const period = params.period || 14;
  const overbought = params.overbought || -20;
  const oversold = params.oversold || -80;
  
  const wr = calculateWilliamsR(data, period, index);
  const prevWr = calculateWilliamsR(data, period, index - 1);
  
  if (wr === null || prevWr === null) return SIGNALS.HOLD;
  
  // 從超賣區向上穿越
  if (prevWr <= oversold && wr > oversold) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 在超賣區
  if (wr < oversold) {
    return SIGNALS.BUY;
  }
  
  // 從超買區向下穿越
  if (prevWr >= overbought && wr < overbought) {
    return SIGNALS.STRONG_SELL;
  }
  
  // 在超買區
  if (wr > overbought) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * CCI 商品通道指數策略
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function cciStrategy(data, index, params = {}) {
  const period = params.period || 20;
  const overbought = params.overbought || 100;
  const oversold = params.oversold || -100;
  
  const cci = calculateCCI(data, period, index);
  const prevCci = calculateCCI(data, period, index - 1);
  
  if (cci === null || prevCci === null) return SIGNALS.HOLD;
  
  // 從超賣區向上突破
  if (prevCci <= oversold && cci > oversold) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 在超賣區
  if (cci < oversold) {
    return SIGNALS.BUY;
  }
  
  // 從超買區向下突破
  if (prevCci >= overbought && cci < overbought) {
    return SIGNALS.STRONG_SELL;
  }
  
  // 在超買區
  if (cci > overbought) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * ADX 趨勢強度策略
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function adxStrategy(data, index, params = {}) {
  const period = params.period || 14;
  const adxThreshold = params.adxThreshold || 25;
  
  const adx = calculateADX(data, period, index);
  const prevAdx = calculateADX(data, period, index - 1);
  
  if (adx === null || prevAdx === null) return SIGNALS.HOLD;
  
  // 強趨勢中，跟隨 DI 方向
  if (adx.adx > adxThreshold) {
    if (adx.diPlus > adx.diMinus) {
      // DI+ 交叉向上
      if (prevAdx.diPlus <= prevAdx.diMinus && adx.diPlus > adx.diMinus) {
        return SIGNALS.STRONG_BUY;
      }
      return SIGNALS.BUY;
    } else {
      // DI- 交叉向上
      if (prevAdx.diMinus <= prevAdx.diPlus && adx.diMinus > adx.diPlus) {
        return SIGNALS.STRONG_SELL;
      }
      return SIGNALS.SELL;
    }
  }
  
  return SIGNALS.HOLD;
}

/**
 * VWAP 策略
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function vwapStrategy(data, index, params = {}) {
  const period = params.period || 20;
  const threshold = params.threshold || 0.02;
  
  const vwap = calculateVWAP(data, period, index);
  
  if (vwap === null) return SIGNALS.HOLD;
  
  const currentPrice = data[index].close;
  const deviation = (currentPrice - vwap) / vwap;
  
  // 價格大幅低於 VWAP
  if (deviation < -threshold * 1.5) return SIGNALS.STRONG_BUY;
  if (deviation < -threshold) return SIGNALS.BUY;
  
  // 價格大幅高於 VWAP
  if (deviation > threshold * 1.5) return SIGNALS.STRONG_SELL;
  if (deviation > threshold) return SIGNALS.SELL;
  
  return SIGNALS.HOLD;
}

/**
 * OBV 能量潮策略
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function obvStrategy(data, index, params = {}) {
  const period = params.period || 20;
  
  if (index < period) return SIGNALS.HOLD;
  
  // 計算 OBV 的變化趨勢
  const currentOBV = calculateOBV(data, index);
  const prevOBV = calculateOBV(data, index - 1);
  
  // 計算 OBV 的移動平均
  let obvSum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    obvSum += calculateOBV(data, i);
  }
  const obvMA = obvSum / period;
  
  const currentPrice = data[index].close;
  const prevPrice = data[index - 1].close;
  
  // 價格上漲且 OBV 增加 (量價配合)
  if (currentPrice > prevPrice && currentOBV > prevOBV) {
    if (currentOBV > obvMA) return SIGNALS.STRONG_BUY;
    return SIGNALS.BUY;
  }
  
  // 價格下跌且 OBV 減少 (量價配合)
  if (currentPrice < prevPrice && currentOBV < prevOBV) {
    if (currentOBV < obvMA) return SIGNALS.STRONG_SELL;
    return SIGNALS.SELL;
  }
  
  // 背離情況
  if (currentPrice > prevPrice && currentOBV < prevOBV) {
    return SIGNALS.SELL; // 價漲量縮，頂背離
  }
  
  if (currentPrice < prevPrice && currentOBV > prevOBV) {
    return SIGNALS.BUY; // 價跌量增，底背離
  }
  
  return SIGNALS.HOLD;
}

/**
 * 雙重確認策略 (結合 RSI 和 MACD)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function dualConfirmationStrategy(data, index, params = {}) {
  const rsiSignal = rsiStrategy(data, index, params);
  const macdSignal = macdStrategy(data, index, params);
  
  // 雙重確認買入
  if ((rsiSignal === SIGNALS.BUY || rsiSignal === SIGNALS.STRONG_BUY) &&
      (macdSignal === SIGNALS.BUY || macdSignal === SIGNALS.STRONG_BUY)) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 雙重確認賣出
  if ((rsiSignal === SIGNALS.SELL || rsiSignal === SIGNALS.STRONG_SELL) &&
      (macdSignal === SIGNALS.SELL || macdSignal === SIGNALS.STRONG_SELL)) {
    return SIGNALS.STRONG_SELL;
  }
  
  // 單一指標訊號
  if (rsiSignal === SIGNALS.STRONG_BUY || macdSignal === SIGNALS.STRONG_BUY) {
    return SIGNALS.BUY;
  }
  
  if (rsiSignal === SIGNALS.STRONG_SELL || macdSignal === SIGNALS.STRONG_SELL) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 趨勢跟隨策略 (結合 ADX 和 MA)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function trendFollowingStrategy(data, index, params = {}) {
  const maPeriod = params.maPeriod || 50;
  const adxPeriod = params.adxPeriod || 14;
  const adxThreshold = params.adxThreshold || 25;
  
  if (index < maPeriod) return SIGNALS.HOLD;
  
  const adx = calculateADX(data, adxPeriod, index);
  const ma = calculateSMA(data, maPeriod, index);
  
  if (adx === null || ma === null) return SIGNALS.HOLD;
  
  const currentPrice = data[index].close;
  
  // 強趨勢中，價格在均線上方
  if (adx.adx > adxThreshold && currentPrice > ma && adx.diPlus > adx.diMinus) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 強趨勢中，價格在均線下方
  if (adx.adx > adxThreshold && currentPrice < ma && adx.diMinus > adx.diPlus) {
    return SIGNALS.STRONG_SELL;
  }
  
  // 弱趨勢中，回歸均值
  if (adx.adx < adxThreshold) {
    if (currentPrice < ma * 0.95) return SIGNALS.BUY;
    if (currentPrice > ma * 1.05) return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 波動率突破策略 (ATR-based)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function volatilityBreakoutStrategy(data, index, params = {}) {
  const atrPeriod = params.atrPeriod || 14;
  const multiplier = params.multiplier || 2;
  
  if (index < atrPeriod + 1) return SIGNALS.HOLD;
  
  const atr = calculateATR(data, atrPeriod, index);
  const prevClose = data[index - 1].close;
  const currentPrice = data[index].close;
  
  if (atr === null) return SIGNALS.HOLD;
  
  // 價格突破上軌
  if (currentPrice > prevClose + atr * multiplier) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 價格突破下軌
  if (currentPrice < prevClose - atr * multiplier) {
    return SIGNALS.STRONG_SELL;
  }
  
  // 較小的波動
  if (currentPrice > prevClose + atr) {
    return SIGNALS.BUY;
  }
  
  if (currentPrice < prevClose - atr) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 海龜交易策略 (Turtle Trading)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function turtleTradingStrategy(data, index, params = {}) {
  const entryPeriod = params.entryPeriod || 20;
  const exitPeriod = params.exitPeriod || 10;
  
  if (index < entryPeriod) return SIGNALS.HOLD;
  
  // 計算突破點
  let highestHigh = -Infinity;
  let lowestLow = Infinity;
  let exitHigh = -Infinity;
  let exitLow = Infinity;
  
  for (let i = index - entryPeriod; i < index; i++) {
    highestHigh = Math.max(highestHigh, data[i].high);
    lowestLow = Math.min(lowestLow, data[i].low);
  }
  
  for (let i = index - exitPeriod; i < index; i++) {
    exitHigh = Math.max(exitHigh, data[i].high);
    exitLow = Math.min(exitLow, data[i].low);
  }
  
  const currentPrice = data[index].close;
  
  // 突破 20 日高點，買入
  if (currentPrice > highestHigh) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 跌破 20 日低點，賣出
  if (currentPrice < lowestLow) {
    return SIGNALS.STRONG_SELL;
  }
  
  // 跌破 10 日低點，止損
  if (currentPrice < exitLow) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 唐奇安通道策略 (Donchian Channel)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function donchianChannelStrategy(data, index, params = {}) {
  const period = params.period || 20;
  
  if (index < period) return SIGNALS.HOLD;
  
  let upperBand = -Infinity;
  let lowerBand = Infinity;
  
  for (let i = index - period; i < index; i++) {
    upperBand = Math.max(upperBand, data[i].high);
    lowerBand = Math.min(lowerBand, data[i].low);
  }
  
  const currentPrice = data[index].close;
  const middleBand = (upperBand + lowerBand) / 2;
  
  // 突破上軌
  if (currentPrice >= upperBand) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 突破下軌
  if (currentPrice <= lowerBand) {
    return SIGNALS.STRONG_SELL;
  }
  
  // 接近上軌
  if (currentPrice > middleBand && currentPrice > upperBand * 0.98) {
    return SIGNALS.BUY;
  }
  
  // 接近下軌
  if (currentPrice < middleBand && currentPrice < lowerBand * 1.02) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 金字塔加碼策略 (Pyramiding)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function pyramidingStrategy(data, index, params = {}) {
  const maPeriod = params.maPeriod || 50;
  const atrPeriod = params.atrPeriod || 14;
  const addThreshold = params.addThreshold || 1.5;
  
  if (index < Math.max(maPeriod, atrPeriod)) return SIGNALS.HOLD;
  
  const ma = calculateSMA(data, maPeriod, index);
  const atr = calculateATR(data, atrPeriod, index);
  const currentPrice = data[index].close;
  
  if (ma === null || atr === null) return SIGNALS.HOLD;
  
  // 價格在均線上方，且上漲超過 ATR 倍數
  if (currentPrice > ma) {
    const priceChange = currentPrice - data[index - 1].close;
    if (priceChange > atr * addThreshold) {
      return SIGNALS.STRONG_BUY;
    }
    if (priceChange > atr * 0.5) {
      return SIGNALS.BUY;
    }
  }
  
  // 價格跌破均線
  if (currentPrice < ma) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 配對交易策略 (Pairs Trading) - 簡化版
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function pairsTradingStrategy(data, index, params = {}) {
  const period = params.period || 20;
  const threshold = params.threshold || 2;
  
  if (index < period) return SIGNALS.HOLD;
  
  // 計算價格與移動平均的 Z-score
  const ma = calculateSMA(data, period, index);
  if (ma === null) return SIGNALS.HOLD;
  
  let sumSquaredDiff = 0;
  for (let i = index - period + 1; i <= index; i++) {
    sumSquaredDiff += Math.pow(data[i].close - ma, 2);
  }
  const std = Math.sqrt(sumSquaredDiff / period);
  
  if (std === 0) return SIGNALS.HOLD;
  
  const zScore = (data[index].close - ma) / std;
  
  // 價格過低，買入
  if (zScore < -threshold) {
    return SIGNALS.STRONG_BUY;
  }
  if (zScore < -1) {
    return SIGNALS.BUY;
  }
  
  // 價格過高，賣出
  if (zScore > threshold) {
    return SIGNALS.STRONG_SELL;
  }
  if (zScore > 1) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 價量背離策略 (Volume Divergence)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function volumeDivergenceStrategy(data, index, params = {}) {
  const period = params.period || 10;
  
  if (index < period + 1) return SIGNALS.HOLD;
  
  // 計算平均成交量
  let avgVolume = 0;
  for (let i = index - period; i < index; i++) {
    avgVolume += data[i].volume;
  }
  avgVolume /= period;
  
  const currentPrice = data[index].close;
  const prevPrice = data[index - 1].close;
  const currentVolume = data[index].volume;
  
  // 價格上漲但成交量下降（頂背離）
  if (currentPrice > prevPrice && currentVolume < avgVolume * 0.7) {
    return SIGNALS.SELL;
  }
  
  // 價格下跌但成交量放大（底背離）
  if (currentPrice < prevPrice && currentVolume > avgVolume * 1.5) {
    return SIGNALS.BUY;
  }
  
  // 價格上漲且成交量放大（確認上漲）
  if (currentPrice > prevPrice && currentVolume > avgVolume * 1.5) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 價格下跌且成交量放大（確認下跌）
  if (currentPrice < prevPrice * 0.98 && currentVolume > avgVolume * 1.5) {
    return SIGNALS.STRONG_SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 趨勢反轉策略 (Trend Reversal)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function trendReversalStrategy(data, index, params = {}) {
  const rsiPeriod = params.rsiPeriod || 14;
  const maPeriod = params.maPeriod || 20;
  
  if (index < Math.max(rsiPeriod, maPeriod)) return SIGNALS.HOLD;
  
  const rsi = calculateRSI(data, rsiPeriod, index);
  const ma = calculateSMA(data, maPeriod, index);
  const currentPrice = data[index].close;
  
  if (rsi === null || ma === null) return SIGNALS.HOLD;
  
  // 找出近期高低點
  let recentHigh = -Infinity;
  let recentLow = Infinity;
  for (let i = index - 5; i <= index; i++) {
    recentHigh = Math.max(recentHigh, data[i].high);
    recentLow = Math.min(recentLow, data[i].low);
  }
  
  // 價格創新低但 RSI 未創新低（底背離）
  if (currentPrice === recentLow && rsi > 30) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 價格創新高但 RSI 未創新高（頂背離）
  if (currentPrice === recentHigh && rsi < 70) {
    return SIGNALS.STRONG_SELL;
  }
  
  // RSI 超賣且價格在均線下
  if (rsi < 30 && currentPrice < ma) {
    return SIGNALS.BUY;
  }
  
  // RSI 超買且價格在均線上
  if (rsi > 70 && currentPrice > ma) {
    return SIGNALS.SELL;
  }
  
  return SIGNALS.HOLD;
}

/**
 * 跳空缺口策略 (Gap Trading)
 * @param {Array} data - 價格數據陣列
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function gapTradingStrategy(data, index, params = {}) {
  const gapThreshold = params.gapThreshold || 0.02; // 2% 缺口
  
  if (index < 2) return SIGNALS.HOLD;
  
  const prevClose = data[index - 1].close;
  const currentOpen = data[index].open || data[index].close;
  const currentClose = data[index].close;
  
  const gapPercent = (currentOpen - prevClose) / prevClose;
  
  // 向上跳空且未回補
  if (gapPercent > gapThreshold && currentClose > currentOpen) {
    return SIGNALS.STRONG_BUY;
  }
  
  // 向下跳空且未回補
  if (gapPercent < -gapThreshold && currentClose < currentOpen) {
    return SIGNALS.STRONG_SELL;
  }
  
  // 向上跳空但回補（反轉訊號）
  if (gapPercent > gapThreshold && currentClose < prevClose) {
    return SIGNALS.SELL;
  }
  
  // 向下跳空但回補（反轉訊號）
  if (gapPercent < -gapThreshold && currentClose > prevClose) {
    return SIGNALS.BUY;
  }
  
  return SIGNALS.HOLD;
}

// ============================================
// 策略集合與工具函數
// ============================================

/**
 * 所有可用策略
 */
const Strategies = {
  // 基礎策略
  maCross: {
    name: 'MA 交叉策略',
    description: '使用短期與長期移動平均線的交叉點產生買賣訊號',
    fn: maCrossStrategy,
    defaultParams: { shortPeriod: 5, longPeriod: 20 }
  },
  tripleMA: {
    name: '三重均線策略',
    description: '使用三條移動平均線判斷趨勢強度',
    fn: tripleMAStrategy,
    defaultParams: { shortPeriod: 5, mediumPeriod: 10, longPeriod: 20 }
  },
  momentum: {
    name: '動量策略',
    description: '根據價格動量判斷趨勢方向',
    fn: momentumStrategy,
    defaultParams: { period: 10, threshold: 0.02 }
  },
  
  // 震盪指標策略
  rsi: {
    name: 'RSI 策略',
    description: '使用相對強弱指標判斷超買超賣',
    fn: rsiStrategy,
    defaultParams: { period: 14, overbought: 70, oversold: 30 }
  },
  kd: {
    name: 'KD 隨機指標策略',
    description: '使用 KD 指標的交叉與超買超賣區判斷',
    fn: kdStrategy,
    defaultParams: { kPeriod: 9, dPeriod: 3, overbought: 80, oversold: 20 }
  },
  williamsR: {
    name: '威廉指標策略',
    description: '使用威廉 %R 判斷超買超賣',
    fn: williamsRStrategy,
    defaultParams: { period: 14, overbought: -20, oversold: -80 }
  },
  cci: {
    name: 'CCI 商品通道策略',
    description: '使用商品通道指數判斷價格偏離程度',
    fn: cciStrategy,
    defaultParams: { period: 20, overbought: 100, oversold: -100 }
  },
  
  // 趨勢指標策略
  macd: {
    name: 'MACD 策略',
    description: '使用 MACD 線與信號線的交叉產生訊號',
    fn: macdStrategy,
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }
  },
  adx: {
    name: 'ADX 趨勢策略',
    description: '使用平均趨向指標判斷趨勢強度與方向',
    fn: adxStrategy,
    defaultParams: { period: 14, adxThreshold: 25 }
  },
  
  // 波動率策略
  bollinger: {
    name: '布林通道策略',
    description: '使用布林通道判斷價格相對位置',
    fn: bollingerStrategy,
    defaultParams: { period: 20, stdDev: 2 }
  },
  volatilityBreakout: {
    name: '波動率突破策略',
    description: '使用 ATR 判斷價格突破',
    fn: volatilityBreakoutStrategy,
    defaultParams: { atrPeriod: 14, multiplier: 2 }
  },
  
  // 量價策略
  vwap: {
    name: 'VWAP 策略',
    description: '使用成交量加權平均價判斷買賣時機',
    fn: vwapStrategy,
    defaultParams: { period: 20, threshold: 0.02 }
  },
  obv: {
    name: 'OBV 能量潮策略',
    description: '使用能量潮指標判斷量價關係',
    fn: obvStrategy,
    defaultParams: { period: 20 }
  },
  
  // 其他策略
  breakout: {
    name: '突破策略',
    description: '追蹤價格突破區間高低點',
    fn: breakoutStrategy,
    defaultParams: { period: 20, volumeMultiplier: 1.5 }
  },
  meanReversion: {
    name: '均值回歸策略',
    description: '當價格偏離均值時進行反向操作',
    fn: meanReversionStrategy,
    defaultParams: { period: 20, threshold: 2 }
  },
  
  // 複合策略
  dualConfirmation: {
    name: '雙重確認策略',
    description: '結合 RSI 和 MACD 進行雙重確認',
    fn: dualConfirmationStrategy,
    defaultParams: { period: 14 }
  },
  trendFollowing: {
    name: '趨勢跟隨策略',
    description: '結合 ADX 和 MA 跟隨趨勢',
    fn: trendFollowingStrategy,
    defaultParams: { maPeriod: 50, adxPeriod: 14, adxThreshold: 25 }
  },
  
  // 新增進階策略
  turtleTrading: {
    name: '海龜交易策略',
    description: '突破 20 日高低點的趨勢跟隨系統',
    fn: turtleTradingStrategy,
    defaultParams: { entryPeriod: 20, exitPeriod: 10 }
  },
  donchianChannel: {
    name: '唐奇安通道策略',
    description: '使用唐奇安通道判斷突破點',
    fn: donchianChannelStrategy,
    defaultParams: { period: 20 }
  },
  pyramiding: {
    name: '金字塔加碼策略',
    description: '趨勢確認後逐步加碼',
    fn: pyramidingStrategy,
    defaultParams: { maPeriod: 50, atrPeriod: 14, addThreshold: 1.5 }
  },
  pairsTrading: {
    name: '配對交易策略',
    description: '基於價格偏離均值的均值回歸策略',
    fn: pairsTradingStrategy,
    defaultParams: { period: 20, threshold: 2 }
  },
  volumeDivergence: {
    name: '價量背離策略',
    description: '利用價格與成交量的背離發現反轉機會',
    fn: volumeDivergenceStrategy,
    defaultParams: { period: 10 }
  },
  trendReversal: {
    name: '趨勢反轉策略',
    description: '捕捉趨勢反轉點的背離信號',
    fn: trendReversalStrategy,
    defaultParams: { rsiPeriod: 14, maPeriod: 20 }
  },
  gapTrading: {
    name: '跳空缺口策略',
    description: '利用開盤跳空缺口進行交易',
    fn: gapTradingStrategy,
    defaultParams: { gapThreshold: 0.02 }
  }
};

/**
 * 取得所有策略資訊
 * @returns {Array} - 策略資訊陣列
 */
function getAllStrategiesInfo() {
  return Object.entries(Strategies).map(([key, strategy]) => ({
    id: key,
    name: strategy.name,
    description: strategy.description,
    defaultParams: strategy.defaultParams
  }));
}

/**
 * 執行策略
 * @param {string} strategyId - 策略 ID
 * @param {Array} data - 價格數據
 * @param {number} index - 當前索引
 * @param {Object} params - 策略參數
 * @returns {string} - 交易訊號
 */
function executeStrategy(strategyId, data, index, params = {}) {
  const strategy = Strategies[strategyId];
  if (!strategy) {
    throw new Error(`策略 ${strategyId} 不存在`);
  }
  return strategy.fn(data, index, { ...strategy.defaultParams, ...params });
}

/**
 * 計算所有技術指標
 * @param {Array} data - 價格數據
 * @param {number} index - 當前索引
 * @returns {Object} - 所有指標值
 */
function calculateAllIndicators(data, index) {
  return {
    // 移動平均線
    sma5: calculateSMA(data, 5, index),
    sma10: calculateSMA(data, 10, index),
    sma20: calculateSMA(data, 20, index),
    sma60: calculateSMA(data, 60, index),
    ema12: calculateEMA(data, 12, index),
    ema26: calculateEMA(data, 26, index),
    wma10: calculateWMA(data, 10, index),
    
    // 震盪指標
    rsi14: calculateRSI(data, 14, index),
    kd: calculateKD(data, index),
    williamsR: calculateWilliamsR(data, 14, index),
    cci: calculateCCI(data, 20, index),
    
    // 趨勢指標
    macd: calculateMACD(data, index),
    adx: calculateADX(data, 14, index),
    
    // 波動率指標
    bollinger: calculateBollingerBands(data, 20, index),
    atr: calculateATR(data, 14, index),
    
    // 量價指標
    obv: calculateOBV(data, index),
    vwap: calculateVWAP(data, 20, index),
    
    // 動量指標
    momentum: calculateMomentum(data, 10, index),
    roc: calculateROC(data, 10, index)
  };
}

/**
 * 產生綜合分析報告
 * @param {Array} data - 價格數據
 * @param {number} index - 當前索引
 * @returns {Object} - 分析報告
 */
function generateAnalysisReport(data, index) {
  const indicators = calculateAllIndicators(data, index);
  const signals = {};
  
  // 計算每個策略的訊號
  for (const [id, strategy] of Object.entries(Strategies)) {
    try {
      signals[id] = strategy.fn(data, index, strategy.defaultParams);
    } catch {
      signals[id] = SIGNALS.HOLD;
    }
  }
  
  // 統計訊號
  const signalCounts = {
    [SIGNALS.STRONG_BUY]: 0,
    [SIGNALS.BUY]: 0,
    [SIGNALS.HOLD]: 0,
    [SIGNALS.SELL]: 0,
    [SIGNALS.STRONG_SELL]: 0
  };
  
  Object.values(signals).forEach(signal => {
    signalCounts[signal]++;
  });
  
  // 計算綜合分數 (-100 到 100)
  const score = (
    signalCounts[SIGNALS.STRONG_BUY] * 2 +
    signalCounts[SIGNALS.BUY] * 1 +
    signalCounts[SIGNALS.SELL] * -1 +
    signalCounts[SIGNALS.STRONG_SELL] * -2
  ) / Object.keys(signals).length * 50;
  
  // 決定綜合建議
  let recommendation;
  if (score > 50) recommendation = SIGNALS.STRONG_BUY;
  else if (score > 20) recommendation = SIGNALS.BUY;
  else if (score < -50) recommendation = SIGNALS.STRONG_SELL;
  else if (score < -20) recommendation = SIGNALS.SELL;
  else recommendation = SIGNALS.HOLD;
  
  return {
    price: data[index].close,
    date: data[index].date,
    indicators,
    signals,
    signalCounts,
    score: Math.round(score),
    recommendation
  };
}

// ============================================
// 模組匯出
// ============================================

module.exports = {
  // 常數
  SIGNALS,
  
  // 指標計算函數
  calculateSMA,
  calculateEMA,
  calculateWMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateKD,
  calculateATR,
  calculateOBV,
  calculateVWAP,
  calculateWilliamsR,
  calculateCCI,
  calculateMomentum,
  calculateROC,
  calculateADX,
  
  // 策略集合
  Strategies,
  
  // 策略執行函數
  maCrossStrategy,
  tripleMAStrategy,
  momentumStrategy,
  rsiStrategy,
  macdStrategy,
  bollingerStrategy,
  kdStrategy,
  breakoutStrategy,
  meanReversionStrategy,
  williamsRStrategy,
  cciStrategy,
  adxStrategy,
  vwapStrategy,
  obvStrategy,
  dualConfirmationStrategy,
  trendFollowingStrategy,
  volatilityBreakoutStrategy,
  
  // 工具函數
  getAllStrategiesInfo,
  executeStrategy,
  calculateAllIndicators,
  generateAnalysisReport
};
