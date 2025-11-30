/**
 * 分析層 (Analytics Layer) - 擴展版
 * 系統的「計分板」，負責將交易紀錄轉換為可評估的績效指標
 * 包含完整的風險指標、績效評估、統計分析功能
 */

// ============================================
// 基礎績效計算
// ============================================

/**
 * 計算完整績效指標
 * @param {Object} backtestResult - 回測結果
 * @returns {Object} 績效指標
 */
function calculateMetrics(backtestResult) {
  const { initialCapital, finalEquity, trades, equityCurve } = backtestResult;

  // 基礎報酬指標
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
  
  // 交易統計
  const tradeStats = calculateTradeStatistics(trades);
  
  // 回檔分析
  const drawdownAnalysis = calculateDrawdownAnalysis(equityCurve);
  
  // 年化指標
  const tradingDays = equityCurve.length;
  const annualizedReturn = (Math.pow(finalEquity / initialCapital, 252 / tradingDays) - 1) * 100;
  
  // 風險調整報酬
  const riskMetrics = calculateRiskMetrics(equityCurve, tradeStats);
  
  // 進階統計
  const advancedStats = calculateAdvancedStatistics(equityCurve, trades);

  return {
    // 報酬指標
    totalReturn: round(totalReturn),
    annualizedReturn: round(annualizedReturn),
    finalEquity: round(finalEquity),
    netProfit: round(finalEquity - initialCapital),
    
    // 交易統計
    totalTrades: tradeStats.totalTrades,
    winTrades: tradeStats.winTrades,
    lossTrades: tradeStats.lossTrades,
    winRate: round(tradeStats.winRate),
    avgWin: round(tradeStats.avgWin),
    avgLoss: round(tradeStats.avgLoss),
    avgWinAmount: round(tradeStats.avgWinAmount),
    avgLossAmount: round(tradeStats.avgLossAmount),
    largestWin: round(tradeStats.largestWin),
    largestLoss: round(tradeStats.largestLoss),
    avgHoldingPeriod: round(tradeStats.avgHoldingPeriod),
    profitFactor: round(tradeStats.profitFactor),
    expectancy: round(tradeStats.expectancy),
    
    // 回檔分析
    maxDrawdown: round(drawdownAnalysis.maxDrawdown),
    maxDrawdownPercent: round(drawdownAnalysis.maxDrawdownPercent),
    maxDrawdownDuration: drawdownAnalysis.maxDrawdownDuration,
    avgDrawdown: round(drawdownAnalysis.avgDrawdown),
    recoveryFactor: round(drawdownAnalysis.recoveryFactor),
    
    // 風險調整報酬
    sharpeRatio: round(riskMetrics.sharpeRatio),
    sortinoRatio: round(riskMetrics.sortinoRatio),
    calmarRatio: round(riskMetrics.calmarRatio),
    informationRatio: round(riskMetrics.informationRatio),
    treynorRatio: round(riskMetrics.treynorRatio),
    
    // 進階統計
    ...advancedStats
  };
}

// ============================================
// 交易統計
// ============================================

/**
 * 計算交易統計
 * @param {Array} trades - 交易記錄
 * @returns {Object} 交易統計
 */
function calculateTradeStatistics(trades) {
  if (trades.length === 0) {
    return {
      winRate: 0,
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      avgWin: 0,
      avgLoss: 0,
      avgWinAmount: 0,
      avgLossAmount: 0,
      largestWin: 0,
      largestLoss: 0,
      avgHoldingPeriod: 0,
      profitFactor: 0,
      expectancy: 0
    };
  }

  // 配對買賣交易
  const pairs = pairTrades(trades);
  
  const totalTrades = pairs.length;
  if (totalTrades === 0) {
    return {
      winRate: 0,
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      avgWin: 0,
      avgLoss: 0,
      avgWinAmount: 0,
      avgLossAmount: 0,
      largestWin: 0,
      largestLoss: 0,
      avgHoldingPeriod: 0,
      profitFactor: 0,
      expectancy: 0
    };
  }

  const winTrades = pairs.filter(p => p.profit > 0);
  const lossTrades = pairs.filter(p => p.profit <= 0);
  
  const winRate = (winTrades.length / totalTrades) * 100;

  // 計算平均獲利與虧損（百分比）
  const avgWin = winTrades.length > 0 
    ? winTrades.reduce((sum, p) => sum + p.profitPercent, 0) / winTrades.length 
    : 0;
  const avgLoss = lossTrades.length > 0 
    ? lossTrades.reduce((sum, p) => sum + p.profitPercent, 0) / lossTrades.length 
    : 0;

  // 計算平均獲利與虧損（金額）
  const avgWinAmount = winTrades.length > 0 
    ? winTrades.reduce((sum, p) => sum + p.profit, 0) / winTrades.length 
    : 0;
  const avgLossAmount = lossTrades.length > 0 
    ? lossTrades.reduce((sum, p) => sum + p.profit, 0) / lossTrades.length 
    : 0;

  // 最大單筆獲利與虧損
  const largestWin = winTrades.length > 0 
    ? Math.max(...winTrades.map(p => p.profitPercent)) 
    : 0;
  const largestLoss = lossTrades.length > 0 
    ? Math.min(...lossTrades.map(p => p.profitPercent)) 
    : 0;

  // 平均持有期間
  const avgHoldingPeriod = pairs.reduce((sum, p) => sum + p.holdingDays, 0) / totalTrades;

  // 盈虧比 (Profit Factor)
  const totalWins = winTrades.reduce((sum, p) => sum + p.profit, 0);
  const totalLosses = Math.abs(lossTrades.reduce((sum, p) => sum + p.profit, 0));
  const profitFactor = totalLosses !== 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  // 期望值 (Expectancy)
  const expectancy = (winRate / 100 * avgWin) + ((1 - winRate / 100) * avgLoss);

  return {
    winRate,
    totalTrades,
    winTrades: winTrades.length,
    lossTrades: lossTrades.length,
    avgWin,
    avgLoss,
    avgWinAmount,
    avgLossAmount,
    largestWin,
    largestLoss,
    avgHoldingPeriod,
    profitFactor,
    expectancy
  };
}

/**
 * 配對買賣交易
 * @param {Array} trades - 交易記錄
 * @returns {Array} 配對後的交易
 */
function pairTrades(trades) {
  const pairs = [];
  let buyTrade = null;

  for (const trade of trades) {
    if (trade.type === 'BUY' || trade.type === 'STRONG_BUY') {
      buyTrade = trade;
    } else if ((trade.type === 'SELL' || trade.type === 'STRONG_SELL') && buyTrade) {
      const profit = (trade.price - buyTrade.price) * trade.shares;
      const buyDate = new Date(buyTrade.date);
      const sellDate = new Date(trade.date);
      const holdingDays = Math.ceil((sellDate - buyDate) / (1000 * 60 * 60 * 24));
      
      pairs.push({
        buyDate: buyTrade.date,
        sellDate: trade.date,
        buyPrice: buyTrade.price,
        sellPrice: trade.price,
        shares: trade.shares,
        profit,
        profitPercent: ((trade.price - buyTrade.price) / buyTrade.price) * 100,
        holdingDays
      });
      buyTrade = null;
    }
  }

  return pairs;
}

// ============================================
// 回檔分析
// ============================================

/**
 * 計算回檔分析
 * @param {Array} equityCurve - 權益曲線
 * @returns {Object} 回檔分析結果
 */
function calculateDrawdownAnalysis(equityCurve) {
  if (equityCurve.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      maxDrawdownDuration: 0,
      avgDrawdown: 0,
      recoveryFactor: 0,
      drawdownPeriods: []
    };
  }

  let peak = equityCurve[0].equity;
  let peakIndex = 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let maxDrawdownDuration = 0;
  let currentDrawdownStart = null;
  
  const drawdowns = [];
  const drawdownPeriods = [];

  for (let i = 0; i < equityCurve.length; i++) {
    const point = equityCurve[i];
    
    if (point.equity > peak) {
      // 創新高
      if (currentDrawdownStart !== null) {
        // 記錄回檔期間
        drawdownPeriods.push({
          startDate: equityCurve[currentDrawdownStart].date,
          endDate: point.date,
          duration: i - currentDrawdownStart,
          maxDrawdown: Math.max(...drawdowns.slice(currentDrawdownStart, i))
        });
        currentDrawdownStart = null;
      }
      peak = point.equity;
      peakIndex = i;
    }
    
    const drawdown = peak - point.equity;
    const drawdownPercent = (drawdown / peak) * 100;
    drawdowns.push(drawdownPercent);
    
    if (drawdownPercent > 0 && currentDrawdownStart === null) {
      currentDrawdownStart = i;
    }
    
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPercent;
      maxDrawdownDuration = i - peakIndex;
    }
  }

  // 平均回檔
  const nonZeroDrawdowns = drawdowns.filter(d => d > 0);
  const avgDrawdown = nonZeroDrawdowns.length > 0 
    ? nonZeroDrawdowns.reduce((a, b) => a + b, 0) / nonZeroDrawdowns.length 
    : 0;

  // 恢復係數 (Recovery Factor)
  const totalReturn = equityCurve.length > 0 
    ? (equityCurve[equityCurve.length - 1].equity - equityCurve[0].equity) / equityCurve[0].equity * 100 
    : 0;
  const recoveryFactor = maxDrawdownPercent > 0 ? totalReturn / maxDrawdownPercent : 0;

  return {
    maxDrawdown,
    maxDrawdownPercent,
    maxDrawdownDuration,
    avgDrawdown,
    recoveryFactor,
    drawdownPeriods
  };
}

// ============================================
// 風險指標
// ============================================

/**
 * 計算風險調整報酬指標
 * @param {Array} equityCurve - 權益曲線
 * @param {Object} tradeStats - 交易統計
 * @returns {Object} 風險指標
 */
function calculateRiskMetrics(equityCurve, tradeStats) {
  if (equityCurve.length < 2) {
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      informationRatio: 0,
      treynorRatio: 0
    };
  }

  // 計算每日報酬率
  const dailyReturns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const dailyReturn = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
    dailyReturns.push(dailyReturn);
  }

  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  
  // 標準差
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);

  // 下行標準差（只計算負報酬）
  const negativeReturns = dailyReturns.filter(r => r < 0);
  const downsidevariables = negativeReturns.length > 0 
    ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length 
    : 0;
  const downsideDeviation = Math.sqrt(downsidevariables);

  // 無風險利率（假設年化 2%）
  const riskFreeRate = 0.02 / 252;

  // Sharpe Ratio
  const excessReturn = avgReturn - riskFreeRate;
  const sharpeRatio = stdDev !== 0 ? (excessReturn * Math.sqrt(252)) / (stdDev * Math.sqrt(252)) : 0;

  // Sortino Ratio（使用下行標準差）
  const sortinoRatio = downsideDeviation !== 0 
    ? (excessReturn * Math.sqrt(252)) / (downsideDeviation * Math.sqrt(252)) 
    : 0;

  // Calmar Ratio（年化報酬 / 最大回檔）
  const { maxDrawdownPercent } = calculateDrawdownAnalysis(equityCurve);
  const annualizedReturn = avgReturn * 252;
  const calmarRatio = maxDrawdownPercent !== 0 ? (annualizedReturn * 100) / maxDrawdownPercent : 0;

  // Information Ratio（假設基準報酬為 0）
  const trackingError = stdDev * Math.sqrt(252);
  const informationRatio = trackingError !== 0 ? (annualizedReturn * 100) / (trackingError * 100) : 0;

  // Treynor Ratio（假設 Beta = 1）
  const beta = 1;
  const treynorRatio = (annualizedReturn - 0.02) / beta;

  return {
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    informationRatio,
    treynorRatio
  };
}

// ============================================
// 進階統計
// ============================================

/**
 * 計算進階統計
 * @param {Array} equityCurve - 權益曲線
 * @param {Array} trades - 交易記錄
 * @returns {Object} 進階統計
 */
function calculateAdvancedStatistics(equityCurve, trades) {
  if (equityCurve.length < 2) {
    return {
      volatility: 0,
      skewness: 0,
      kurtosis: 0,
      var95: 0,
      var99: 0,
      cvar95: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      avgTradesPerMonth: 0,
      returnVolatilityRatio: 0
    };
  }

  // 計算日報酬率
  const dailyReturns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    dailyReturns.push((equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity);
  }

  // 波動率（年化）
  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  const volatility = Math.sqrt(variance * 252) * 100;

  // 偏度 (Skewness)
  const stdDev = Math.sqrt(variance);
  const skewness = stdDev !== 0 
    ? dailyReturns.reduce((sum, r) => sum + Math.pow((r - avgReturn) / stdDev, 3), 0) / dailyReturns.length 
    : 0;

  // 峰度 (Kurtosis)
  const kurtosis = stdDev !== 0 
    ? dailyReturns.reduce((sum, r) => sum + Math.pow((r - avgReturn) / stdDev, 4), 0) / dailyReturns.length - 3 
    : 0;

  // VaR (Value at Risk) - 歷史模擬法
  const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
  const var95Index = Math.floor(dailyReturns.length * 0.05);
  const var99Index = Math.floor(dailyReturns.length * 0.01);
  const var95 = sortedReturns[var95Index] ? Math.abs(sortedReturns[var95Index]) * 100 : 0;
  const var99 = sortedReturns[var99Index] ? Math.abs(sortedReturns[var99Index]) * 100 : 0;

  // CVaR (Conditional VaR)
  const cvar95Returns = sortedReturns.slice(0, var95Index + 1);
  const cvar95 = cvar95Returns.length > 0 
    ? Math.abs(cvar95Returns.reduce((a, b) => a + b, 0) / cvar95Returns.length) * 100 
    : 0;

  // 連續獲利/虧損次數
  const pairs = pairTrades(trades);
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  for (const pair of pairs) {
    if (pair.profit > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else {
      currentLossStreak++;
      currentWinStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    }
  }

  // 平均每月交易次數
  const tradingDays = equityCurve.length;
  const months = tradingDays / 21;
  const avgTradesPerMonth = months > 0 ? pairs.length / months : 0;

  // 報酬/波動率比
  const totalReturn = (equityCurve[equityCurve.length - 1].equity - equityCurve[0].equity) / equityCurve[0].equity * 100;
  const returnVolatilityRatio = volatility !== 0 ? totalReturn / volatility : 0;

  return {
    volatility: round(volatility),
    skewness: round(skewness),
    kurtosis: round(kurtosis),
    var95: round(var95),
    var99: round(var99),
    cvar95: round(cvar95),
    consecutiveWins: maxWinStreak,
    consecutiveLosses: maxLossStreak,
    avgTradesPerMonth: round(avgTradesPerMonth),
    returnVolatilityRatio: round(returnVolatilityRatio)
  };
}

// ============================================
// 比較分析
// ============================================

/**
 * 比較多個回測結果
 * @param {Array} backtestResults - 回測結果陣列
 * @returns {Object} 比較分析結果
 */
function compareBacktests(backtestResults) {
  const metrics = backtestResults.map(result => ({
    strategy: result.strategy,
    ...calculateMetrics(result)
  }));

  // 排名計算
  const rankings = {
    totalReturn: rankBy(metrics, 'totalReturn', true),
    sharpeRatio: rankBy(metrics, 'sharpeRatio', true),
    maxDrawdownPercent: rankBy(metrics, 'maxDrawdownPercent', false),
    winRate: rankBy(metrics, 'winRate', true),
    profitFactor: rankBy(metrics, 'profitFactor', true)
  };

  // 計算綜合評分
  const compositeScores = metrics.map((m, i) => {
    const score = (
      rankings.totalReturn[i] * 0.25 +
      rankings.sharpeRatio[i] * 0.25 +
      rankings.maxDrawdownPercent[i] * 0.20 +
      rankings.winRate[i] * 0.15 +
      rankings.profitFactor[i] * 0.15
    );
    return { ...m, compositeScore: round(score) };
  });

  // 按綜合評分排序
  compositeScores.sort((a, b) => b.compositeScore - a.compositeScore);

  return {
    metrics,
    rankings,
    compositeScores,
    bestStrategy: compositeScores[0]?.strategy || null,
    worstStrategy: compositeScores[compositeScores.length - 1]?.strategy || null
  };
}

/**
 * 按指標排名
 */
function rankBy(metrics, field, descending = true) {
  const sorted = [...metrics]
    .map((m, i) => ({ value: m[field], index: i }))
    .sort((a, b) => descending ? b.value - a.value : a.value - b.value);
  
  const ranks = new Array(metrics.length);
  sorted.forEach((item, rank) => {
    ranks[item.index] = (metrics.length - rank) / metrics.length * 100;
  });
  return ranks;
}

// ============================================
// 月度/年度分析
// ============================================

/**
 * 計算月度績效
 * @param {Array} equityCurve - 權益曲線
 * @returns {Array} 月度績效
 */
function calculateMonthlyReturns(equityCurve) {
  if (equityCurve.length === 0) return [];

  const monthlyReturns = {};
  let prevMonthEquity = equityCurve[0].equity;

  for (const point of equityCurve) {
    const date = new Date(point.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyReturns[monthKey]) {
      monthlyReturns[monthKey] = {
        month: monthKey,
        startEquity: prevMonthEquity,
        endEquity: point.equity,
        highEquity: point.equity,
        lowEquity: point.equity
      };
    } else {
      monthlyReturns[monthKey].endEquity = point.equity;
      monthlyReturns[monthKey].highEquity = Math.max(monthlyReturns[monthKey].highEquity, point.equity);
      monthlyReturns[monthKey].lowEquity = Math.min(monthlyReturns[monthKey].lowEquity, point.equity);
    }
    prevMonthEquity = point.equity;
  }

  return Object.values(monthlyReturns).map(m => ({
    month: m.month,
    return: round(((m.endEquity - m.startEquity) / m.startEquity) * 100),
    high: round(((m.highEquity - m.startEquity) / m.startEquity) * 100),
    low: round(((m.lowEquity - m.startEquity) / m.startEquity) * 100),
    range: round(((m.highEquity - m.lowEquity) / m.startEquity) * 100)
  }));
}

/**
 * 計算年度績效
 * @param {Array} equityCurve - 權益曲線
 * @returns {Array} 年度績效
 */
function calculateYearlyReturns(equityCurve) {
  if (equityCurve.length === 0) return [];

  const yearlyReturns = {};
  let prevYearEquity = equityCurve[0].equity;

  for (const point of equityCurve) {
    const date = new Date(point.date);
    const year = date.getFullYear().toString();
    
    if (!yearlyReturns[year]) {
      yearlyReturns[year] = {
        year,
        startEquity: prevYearEquity,
        endEquity: point.equity,
        highEquity: point.equity,
        lowEquity: point.equity
      };
    } else {
      yearlyReturns[year].endEquity = point.equity;
      yearlyReturns[year].highEquity = Math.max(yearlyReturns[year].highEquity, point.equity);
      yearlyReturns[year].lowEquity = Math.min(yearlyReturns[year].lowEquity, point.equity);
    }
    prevYearEquity = point.equity;
  }

  return Object.values(yearlyReturns).map(y => ({
    year: y.year,
    return: round(((y.endEquity - y.startEquity) / y.startEquity) * 100),
    high: round(((y.highEquity - y.startEquity) / y.startEquity) * 100),
    low: round(((y.lowEquity - y.startEquity) / y.startEquity) * 100)
  }));
}

// ============================================
// 交易分析
// ============================================

/**
 * 分析交易模式
 * @param {Array} trades - 交易記錄
 * @param {Array} equityCurve - 權益曲線
 * @returns {Object} 交易模式分析
 */
function analyzeTradePatterns(trades, equityCurve) {
  const pairs = pairTrades(trades);
  
  if (pairs.length === 0) {
    return {
      weekdayAnalysis: [],
      hourAnalysis: [],
      holdingPeriodDistribution: [],
      profitDistribution: []
    };
  }

  // 週幾分析
  const weekdayStats = {};
  for (let i = 0; i < 7; i++) {
    weekdayStats[i] = { day: i, totalProfit: 0, count: 0, wins: 0 };
  }

  for (const pair of pairs) {
    const day = new Date(pair.sellDate).getDay();
    weekdayStats[day].totalProfit += pair.profitPercent;
    weekdayStats[day].count++;
    if (pair.profit > 0) weekdayStats[day].wins++;
  }

  const weekdayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const weekdayAnalysis = Object.values(weekdayStats)
    .filter(s => s.count > 0)
    .map(s => ({
      day: weekdayNames[s.day],
      avgReturn: round(s.totalProfit / s.count),
      winRate: round((s.wins / s.count) * 100),
      count: s.count
    }));

  // 持有期間分佈
  const holdingBuckets = {
    '1-5天': { min: 1, max: 5, count: 0, profit: 0 },
    '6-10天': { min: 6, max: 10, count: 0, profit: 0 },
    '11-20天': { min: 11, max: 20, count: 0, profit: 0 },
    '21-40天': { min: 21, max: 40, count: 0, profit: 0 },
    '40天以上': { min: 41, max: Infinity, count: 0, profit: 0 }
  };

  for (const pair of pairs) {
    for (const [key, bucket] of Object.entries(holdingBuckets)) {
      if (pair.holdingDays >= bucket.min && pair.holdingDays <= bucket.max) {
        bucket.count++;
        bucket.profit += pair.profitPercent;
        break;
      }
    }
  }

  const holdingPeriodDistribution = Object.entries(holdingBuckets)
    .filter(([_, b]) => b.count > 0)
    .map(([range, b]) => ({
      range,
      count: b.count,
      avgReturn: round(b.profit / b.count)
    }));

  // 獲利分佈
  const profitBuckets = {
    '虧損>10%': { min: -Infinity, max: -10, count: 0 },
    '虧損5-10%': { min: -10, max: -5, count: 0 },
    '虧損0-5%': { min: -5, max: 0, count: 0 },
    '獲利0-5%': { min: 0, max: 5, count: 0 },
    '獲利5-10%': { min: 5, max: 10, count: 0 },
    '獲利>10%': { min: 10, max: Infinity, count: 0 }
  };

  for (const pair of pairs) {
    for (const [key, bucket] of Object.entries(profitBuckets)) {
      if (pair.profitPercent > bucket.min && pair.profitPercent <= bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  const profitDistribution = Object.entries(profitBuckets)
    .map(([range, b]) => ({
      range,
      count: b.count,
      percentage: round((b.count / pairs.length) * 100)
    }));

  return {
    weekdayAnalysis,
    holdingPeriodDistribution,
    profitDistribution
  };
}

// ============================================
// 報告生成
// ============================================

/**
 * 生成完整回測報告
 * @param {Object} backtestResult - 回測結果
 * @returns {Object} 完整報告
 */
function generateFullReport(backtestResult) {
  const metrics = calculateMetrics(backtestResult);
  const monthlyReturns = calculateMonthlyReturns(backtestResult.equityCurve);
  const yearlyReturns = calculateYearlyReturns(backtestResult.equityCurve);
  const tradePatterns = analyzeTradePatterns(backtestResult.trades, backtestResult.equityCurve);
  
  // 生成文字摘要
  const summary = generateTextSummary(metrics, backtestResult);
  
  // 風險評估
  const riskAssessment = assessRisk(metrics);
  
  // 改進建議
  const recommendations = generateRecommendations(metrics, tradePatterns);

  return {
    summary,
    metrics,
    monthlyReturns,
    yearlyReturns,
    tradePatterns,
    riskAssessment,
    recommendations,
    generatedAt: new Date().toISOString()
  };
}

/**
 * 生成文字摘要
 */
function generateTextSummary(metrics, backtestResult) {
  const { strategy, initialCapital, finalEquity } = backtestResult;
  
  return {
    title: `${strategy} 策略回測報告`,
    overview: `
      策略 ${strategy} 在回測期間的表現：
      - 初始資金：$${initialCapital.toLocaleString()}
      - 最終資產：$${finalEquity.toLocaleString()}
      - 總報酬率：${metrics.totalReturn}%
      - 年化報酬率：${metrics.annualizedReturn}%
    `,
    performance: `
      交易統計：
      - 總交易次數：${metrics.totalTrades}
      - 勝率：${metrics.winRate}%
      - 盈虧比：${metrics.profitFactor}
      - 平均獲利：${metrics.avgWin}%
      - 平均虧損：${metrics.avgLoss}%
    `,
    risk: `
      風險指標：
      - 最大回檔：${metrics.maxDrawdownPercent}%
      - Sharpe Ratio：${metrics.sharpeRatio}
      - Sortino Ratio：${metrics.sortinoRatio}
      - 波動率：${metrics.volatility}%
    `
  };
}

/**
 * 風險評估
 */
function assessRisk(metrics) {
  const riskLevel = 
    metrics.maxDrawdownPercent > 30 ? 'HIGH' :
    metrics.maxDrawdownPercent > 15 ? 'MEDIUM' :
    'LOW';

  const volatilityLevel =
    metrics.volatility > 30 ? 'HIGH' :
    metrics.volatility > 15 ? 'MEDIUM' :
    'LOW';

  return {
    overallRisk: riskLevel,
    volatilityRisk: volatilityLevel,
    drawdownRisk: metrics.maxDrawdownPercent > 20 ? 'ELEVATED' : 'NORMAL',
    consistencyRisk: metrics.winRate < 40 ? 'ELEVATED' : 'NORMAL',
    riskScore: calculateRiskScore(metrics)
  };
}

/**
 * 計算風險分數
 */
function calculateRiskScore(metrics) {
  let score = 100;
  
  // 回檔扣分
  score -= Math.min(metrics.maxDrawdownPercent, 40);
  
  // 波動率扣分
  score -= Math.min(metrics.volatility / 2, 20);
  
  // 低勝率扣分
  if (metrics.winRate < 50) {
    score -= (50 - metrics.winRate) / 2;
  }
  
  // 低 Sharpe 扣分
  if (metrics.sharpeRatio < 1) {
    score -= (1 - metrics.sharpeRatio) * 10;
  }
  
  return round(Math.max(0, Math.min(100, score)));
}

/**
 * 生成改進建議
 */
function generateRecommendations(metrics, tradePatterns) {
  const recommendations = [];
  
  if (metrics.winRate < 50) {
    recommendations.push({
      type: 'WIN_RATE',
      priority: 'HIGH',
      message: '勝率偏低，建議優化進場條件或增加確認訊號'
    });
  }
  
  if (metrics.profitFactor < 1.5) {
    recommendations.push({
      type: 'PROFIT_FACTOR',
      priority: 'HIGH',
      message: '盈虧比偏低，建議改善停損停利策略'
    });
  }
  
  if (metrics.maxDrawdownPercent > 20) {
    recommendations.push({
      type: 'DRAWDOWN',
      priority: 'MEDIUM',
      message: '最大回檔較大，建議加入風險控管機制'
    });
  }
  
  if (metrics.avgTradesPerMonth < 2) {
    recommendations.push({
      type: 'FREQUENCY',
      priority: 'LOW',
      message: '交易頻率較低，可能錯過部分機會'
    });
  }
  
  if (metrics.consecutiveLosses > 5) {
    recommendations.push({
      type: 'STREAK',
      priority: 'MEDIUM',
      message: '連續虧損次數較多，建議檢視策略在特定市況的表現'
    });
  }
  
  return recommendations;
}

// ============================================
// 工具函數
// ============================================

/**
 * 四捨五入到兩位小數
 */
function round(value) {
  return Math.round(value * 100) / 100;
}

// ============================================
// 模組匯出
// ============================================

module.exports = {
  // 主要函數
  calculateMetrics,
  compareBacktests,
  generateFullReport,
  
  // 統計函數
  calculateTradeStatistics,
  calculateDrawdownAnalysis,
  calculateRiskMetrics,
  calculateAdvancedStatistics,
  
  // 時間分析
  calculateMonthlyReturns,
  calculateYearlyReturns,
  
  // 模式分析
  analyzeTradePatterns,
  
  // 輔助函數
  pairTrades,
  assessRisk,
  generateRecommendations,
  round
};
