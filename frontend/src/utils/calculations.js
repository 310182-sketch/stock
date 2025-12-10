/**
 * 技術指標計算工具函數
 */

/**
 * 計算移動平均線 (Moving Average)
 * @param {Array} data - 價格數據數組
 * @param {number} period - 週期
 * @returns {Array} MA 值數組
 */
export function calculateMA(data, period) {
  if (!data || data.length < period) return []
  
  const result = []
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const sum = slice.reduce((acc, val) => acc + (val.close || val), 0)
    result.push({
      time: data[i].date || data[i].time,
      value: sum / period
    })
  }
  return result
}

/**
 * 計算 RSI (Relative Strength Index)
 * @param {Array} prices - 收盤價數組或包含 close 的物件數組
 * @param {number} period - 週期,預設 14
 * @returns {Array} RSI 值數組
 */
export function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return []
  
  const priceData = prices.map(p => p.close !== undefined ? p.close : p)
  const changes = []
  
  for (let i = 1; i < priceData.length; i++) {
    changes.push(priceData[i] - priceData[i - 1])
  }
  
  const result = []
  let avgGain = 0
  let avgLoss = 0
  
  // 計算初始平均
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period
  avgLoss /= period
  
  let rs = avgGain / (avgLoss || 1)
  let rsi = 100 - (100 / (1 + rs))
  
  result.push({
    time: prices[period].date || prices[period].time,
    value: rsi
  })
  
  // 計算後續 RSI
  for (let i = period; i < changes.length; i++) {
    const change = changes[i]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    
    rs = avgGain / (avgLoss || 1)
    rsi = 100 - (100 / (1 + rs))
    
    result.push({
      time: prices[i + 1].date || prices[i + 1].time,
      value: rsi
    })
  }
  
  return result
}

/**
 * 計算指數移動平均 (Exponential Moving Average)
 * @param {Array} data - 價格數據數組
 * @param {number} period - 週期
 * @returns {Array} EMA 值數組
 */
export function calculateEMA(data, period) {
  if (!data || data.length < period) return []
  
  const k = 2 / (period + 1)
  const result = []
  
  // 初始 SMA
  let ema = 0
  for (let i = 0; i < period; i++) {
    ema += data[i].close || data[i]
  }
  ema /= period
  
  result.push({
    time: data[period - 1].date || data[period - 1].time,
    value: ema
  })
  
  // 計算 EMA
  for (let i = period; i < data.length; i++) {
    const price = data[i].close || data[i]
    ema = price * k + ema * (1 - k)
    result.push({
      time: data[i].date || data[i].time,
      value: ema
    })
  }
  
  return result
}

/**
 * 計算布林通道 (Bollinger Bands)
 * @param {Array} prices - 價格數據數組
 * @param {number} period - 週期,預設 20
 * @param {number} stdDev - 標準差倍數,預設 2
 * @returns {Object} 包含 upper, middle, lower 的物件
 */
export function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  if (!prices || prices.length < period) {
    return { upper: [], middle: [], lower: [] }
  }
  
  const priceData = prices.map(p => p.close !== undefined ? p.close : p)
  const upper = []
  const middle = []
  const lower = []
  
  for (let i = period - 1; i < priceData.length; i++) {
    const slice = priceData.slice(i - period + 1, i + 1)
    
    // 計算 SMA (中軌)
    const sma = slice.reduce((sum, val) => sum + val, 0) / period
    
    // 計算標準差
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period
    const std = Math.sqrt(variance)
    
    const time = prices[i].date || prices[i].time
    
    upper.push({ time, value: sma + stdDev * std })
    middle.push({ time, value: sma })
    lower.push({ time, value: sma - stdDev * std })
  }
  
  return { upper, middle, lower }
}

/**
 * 判斷趨勢方向
 * @param {Array} prices - 價格數據數組
 * @returns {string} 'up' | 'down' | 'neutral'
 */
export function getTrend(prices) {
  if (!prices || prices.length < 10) return 'neutral'
  
  const priceData = prices.map(p => p.close !== undefined ? p.close : p)
  const recentPrices = priceData.slice(-10)
  
  let upCount = 0
  
  for (let i = 1; i < recentPrices.length; i++) {
    if (recentPrices[i] > recentPrices[i - 1]) upCount++
  }
  
  const upRatio = upCount / (recentPrices.length - 1)
  
  if (upRatio > 0.6) return 'up'
  if (upRatio < 0.4) return 'down'
  return 'neutral'
}

/**
 * 格式化數字
 * @param {number} num - 要格式化的數字
 * @param {number} decimals - 小數位數,預設 2
 * @returns {string} 格式化後的字串
 */
export function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return 'N/A'
  
  if (Math.abs(num) >= 1e9) {
    return (num / 1e9).toFixed(decimals) + 'B'
  }
  if (Math.abs(num) >= 1e6) {
    return (num / 1e6).toFixed(decimals) + 'M'
  }
  if (Math.abs(num) >= 1e3) {
    return (num / 1e3).toFixed(decimals) + 'K'
  }
  
  return num.toFixed(decimals)
}
