/**
 * 價格預測模組
 * 使用多種技術分析和統計方法預測未來價格走勢
 */

/**
 * 計算簡單移動平均
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
 * 計算指數移動平均
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
 * 計算線性回歸
 */
function calculateLinearRegression(data, period, endIndex) {
  if (endIndex < period - 1) return null;
  
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  
  for (let i = 0; i < period; i++) {
    const x = i;
    const y = data[endIndex - period + 1 + i].close;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  
  const slope = (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / period;
  
  return { slope, intercept };
}

/**
 * 計算波動率（標準差）
 */
function calculateVolatility(data, period, endIndex) {
  if (endIndex < period - 1) return null;
  
  const returns = [];
  for (let i = endIndex - period + 2; i <= endIndex; i++) {
    const ret = (data[i].close - data[i - 1].close) / data[i - 1].close;
    returns.push(ret);
  }
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance);
}

/**
 * 使用線性回歸預測未來價格
 */
function predictLinearRegression(data, daysAhead = 5) {
  const period = Math.min(20, data.length);
  const endIndex = data.length - 1;
  
  const regression = calculateLinearRegression(data, period, endIndex);
  if (!regression) return null;
  
  const predictions = [];
  const lastPrice = data[endIndex].close;
  
  for (let i = 1; i <= daysAhead; i++) {
    const x = period + i - 1;
    const predictedPrice = regression.slope * x + regression.intercept;
    predictions.push({
      day: i,
      price: Math.max(0, predictedPrice),
      change: ((predictedPrice - lastPrice) / lastPrice) * 100
    });
  }
  
  return predictions;
}

/**
 * 使用移動平均趨勢預測
 */
function predictMovingAverageTrend(data, daysAhead = 5) {
  const endIndex = data.length - 1;
  
  const sma5 = calculateSMA(data, 5, endIndex);
  const sma20 = calculateSMA(data, 20, endIndex);
  const ema12 = calculateEMA(data, 12, endIndex);
  
  if (!sma5 || !sma20 || !ema12) return null;
  
  const lastPrice = data[endIndex].close;
  const trend = sma5 > sma20 ? 'bullish' : 'bearish';
  const momentum = (sma5 - sma20) / sma20;
  
  const predictions = [];
  let currentPrice = lastPrice;
  
  for (let i = 1; i <= daysAhead; i++) {
    // 基於趨勢和動量預測
    const trendEffect = momentum * 0.1 * i;
    const predictedPrice = currentPrice * (1 + trendEffect);
    
    predictions.push({
      day: i,
      price: predictedPrice,
      change: ((predictedPrice - lastPrice) / lastPrice) * 100,
      trend
    });
    
    currentPrice = predictedPrice;
  }
  
  return predictions;
}

/**
 * 使用蒙地卡羅模擬預測
 */
function predictMonteCarlo(data, daysAhead = 5, simulations = 1000) {
  const period = Math.min(60, data.length);
  const endIndex = data.length - 1;
  
  const volatility = calculateVolatility(data, period, endIndex);
  if (!volatility) return null;
  
  const lastPrice = data[endIndex].close;
  
  // 計算平均日回報率
  let avgReturn = 0;
  for (let i = endIndex - period + 2; i <= endIndex; i++) {
    avgReturn += (data[i].close - data[i - 1].close) / data[i - 1].close;
  }
  avgReturn /= (period - 1);
  
  // 執行蒙地卡羅模擬
  const allPaths = [];
  
  for (let sim = 0; sim < simulations; sim++) {
    const path = [lastPrice];
    let price = lastPrice;
    
    for (let day = 0; day < daysAhead; day++) {
      // 使用幾何布朗運動
      const randomReturn = avgReturn + volatility * (Math.random() * 2 - 1);
      price = price * (1 + randomReturn);
      path.push(price);
    }
    
    allPaths.push(path);
  }
  
  // 計算每一天的統計數據
  const predictions = [];
  
  for (let day = 1; day <= daysAhead; day++) {
    const dayPrices = allPaths.map(path => path[day]).sort((a, b) => a - b);
    
    const mean = dayPrices.reduce((a, b) => a + b, 0) / simulations;
    const p10 = dayPrices[Math.floor(simulations * 0.1)];
    const p25 = dayPrices[Math.floor(simulations * 0.25)];
    const p50 = dayPrices[Math.floor(simulations * 0.5)];
    const p75 = dayPrices[Math.floor(simulations * 0.75)];
    const p90 = dayPrices[Math.floor(simulations * 0.9)];
    
    predictions.push({
      day,
      mean,
      median: p50,
      lower: p10,
      upper: p90,
      q1: p25,
      q3: p75,
      change: ((mean - lastPrice) / lastPrice) * 100
    });
  }
  
  return predictions;
}

/**
 * 綜合預測（整合多種方法）
 */
function predictPriceTrend(data, options = {}) {
  const {
    daysAhead = 5,
    includeLinearRegression = true,
    includeMovingAverage = true,
    includeMonteCarlo = true,
    monteCarloSimulations = 1000
  } = options;
  
  if (!data || data.length < 20) {
    return {
      success: false,
      error: '數據不足，至少需要 20 個交易日'
    };
  }
  
  const lastPrice = data[data.length - 1].close;
  const lastDate = data[data.length - 1].date;
  
  const result = {
    success: true,
    stockId: data[0].stockId || 'UNKNOWN',
    lastPrice,
    lastDate,
    daysAhead,
    predictions: {}
  };
  
  // 線性回歸預測
  if (includeLinearRegression) {
    const lrPredictions = predictLinearRegression(data, daysAhead);
    if (lrPredictions) {
      result.predictions.linearRegression = lrPredictions;
    }
  }
  
  // 移動平均趨勢預測
  if (includeMovingAverage) {
    const maPredictions = predictMovingAverageTrend(data, daysAhead);
    if (maPredictions) {
      result.predictions.movingAverage = maPredictions;
    }
  }
  
  // 蒙地卡羅模擬
  if (includeMonteCarlo) {
    const mcPredictions = predictMonteCarlo(data, daysAhead, monteCarloSimulations);
    if (mcPredictions) {
      result.predictions.monteCarlo = mcPredictions;
    }
  }
  
  // 計算綜合預測（加權平均）
  const consensusPredictions = [];
  
  for (let day = 1; day <= daysAhead; day++) {
    let weightedSum = 0;
    let totalWeight = 0;
    
    if (result.predictions.linearRegression) {
      weightedSum += result.predictions.linearRegression[day - 1].price * 0.3;
      totalWeight += 0.3;
    }
    
    if (result.predictions.movingAverage) {
      weightedSum += result.predictions.movingAverage[day - 1].price * 0.3;
      totalWeight += 0.3;
    }
    
    if (result.predictions.monteCarlo) {
      weightedSum += result.predictions.monteCarlo[day - 1].mean * 0.4;
      totalWeight += 0.4;
    }
    
    if (totalWeight > 0) {
      const consensusPrice = weightedSum / totalWeight;
      consensusPredictions.push({
        day,
        price: consensusPrice,
        change: ((consensusPrice - lastPrice) / lastPrice) * 100,
        confidence: totalWeight >= 0.9 ? 'high' : totalWeight >= 0.6 ? 'medium' : 'low'
      });
    }
  }
  
  result.predictions.consensus = consensusPredictions;
  
  // 添加市場分析
  const sma20 = calculateSMA(data, 20, data.length - 1);
  const volatility = calculateVolatility(data, 20, data.length - 1);
  
  result.marketAnalysis = {
    currentTrend: lastPrice > sma20 ? 'bullish' : 'bearish',
    volatility: volatility ? (volatility * 100).toFixed(2) + '%' : 'N/A',
    support: sma20 ? sma20.toFixed(2) : null,
    pricePosition: sma20 ? ((lastPrice - sma20) / sma20 * 100).toFixed(2) + '%' : null
  };
  
  return result;
}

module.exports = {
  predictPriceTrend,
  predictLinearRegression,
  predictMovingAverageTrend,
  predictMonteCarlo,
  calculateVolatility
};
