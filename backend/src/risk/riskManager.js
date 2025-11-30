/**
 * 風險管理模組
 * 提供完整的風險控管功能
 */

// ============================================
// 常數定義
// ============================================

const RISK_LEVELS = {
  VERY_LOW: { name: '極低風險', color: 'green', maxDrawdown: 5, maxVolatility: 10 },
  LOW: { name: '低風險', color: 'lightgreen', maxDrawdown: 10, maxVolatility: 15 },
  MEDIUM: { name: '中等風險', color: 'yellow', maxDrawdown: 20, maxVolatility: 25 },
  HIGH: { name: '高風險', color: 'orange', maxDrawdown: 30, maxVolatility: 35 },
  VERY_HIGH: { name: '極高風險', color: 'red', maxDrawdown: 50, maxVolatility: 50 }
};

const POSITION_SIZING_METHODS = {
  FIXED: '固定金額',
  PERCENT: '資金百分比',
  KELLY: 'Kelly 公式',
  OPTIMAL_F: 'Optimal F',
  ATR_BASED: 'ATR 基礎',
  EQUAL_RISK: '等風險分配'
};

// ============================================
// 投資組合風險計算
// ============================================

/**
 * 計算投資組合風險指標
 * @param {Array} positions - 持倉陣列
 * @param {Array} priceHistory - 價格歷史
 * @returns {Object} 風險指標
 */
function calculatePortfolioRisk(positions, priceHistory) {
  if (!positions || positions.length === 0) {
    return {
      totalValue: 0,
      totalRisk: 0,
      diversificationRatio: 0,
      concentrationRisk: 0,
      betaExposure: 1,
      sectorExposure: {}
    };
  }

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  
  // 計算集中度風險
  const weights = positions.map(p => p.value / totalValue);
  const herfindahlIndex = weights.reduce((sum, w) => sum + Math.pow(w, 2), 0);
  const concentrationRisk = herfindahlIndex * 100;
  
  // 計算分散化比率
  const effectivePositions = 1 / herfindahlIndex;
  const diversificationRatio = Math.min(effectivePositions / positions.length, 1);
  
  // 計算波動率
  const volatilities = positions.map(p => p.volatility || 20);
  const weightedVolatility = weights.reduce((sum, w, i) => sum + w * volatilities[i], 0);
  
  // 計算相關性調整後的風險
  // 假設平均相關係數為 0.3
  const avgCorrelation = 0.3;
  const portfolioVolatility = Math.sqrt(
    weights.reduce((sum, wi, i) => 
      sum + weights.reduce((innerSum, wj, j) => {
        const corr = i === j ? 1 : avgCorrelation;
        return innerSum + wi * wj * volatilities[i] * volatilities[j] * corr;
      }, 0)
    , 0)
  );
  
  return {
    totalValue,
    totalRisk: portfolioVolatility,
    diversificationRatio: Math.round(diversificationRatio * 100),
    concentrationRisk: Math.round(concentrationRisk),
    effectivePositions: Math.round(effectivePositions * 10) / 10,
    weightedVolatility: Math.round(weightedVolatility * 100) / 100,
    riskLevel: getRiskLevel(portfolioVolatility)
  };
}

/**
 * 取得風險等級
 */
function getRiskLevel(volatility) {
  if (volatility <= 10) return RISK_LEVELS.VERY_LOW;
  if (volatility <= 15) return RISK_LEVELS.LOW;
  if (volatility <= 25) return RISK_LEVELS.MEDIUM;
  if (volatility <= 35) return RISK_LEVELS.HIGH;
  return RISK_LEVELS.VERY_HIGH;
}

// ============================================
// 部位大小計算
// ============================================

/**
 * Kelly 公式計算最佳部位大小
 * @param {number} winRate - 勝率 (0-1)
 * @param {number} avgWin - 平均獲利比例
 * @param {number} avgLoss - 平均虧損比例 (正值)
 * @returns {number} 最佳部位比例 (0-1)
 */
function calculateKelly(winRate, avgWin, avgLoss) {
  if (avgLoss === 0) return 0;
  
  const b = avgWin / avgLoss;
  const p = winRate;
  const q = 1 - p;
  
  const kelly = (b * p - q) / b;
  
  // 限制在 0-0.5 之間，使用半 Kelly
  return Math.max(0, Math.min(0.25, kelly / 2));
}

/**
 * Optimal F 計算
 * @param {Array} tradeReturns - 交易報酬率陣列
 * @returns {number} 最佳 F 值
 */
function calculateOptimalF(tradeReturns) {
  if (tradeReturns.length === 0) return 0.1;
  
  const worstLoss = Math.min(...tradeReturns);
  if (worstLoss >= 0) return 0.25; // 沒有虧損
  
  // 二分搜尋最佳 F
  let bestF = 0.1;
  let bestTWR = 0;
  
  for (let f = 0.01; f <= 0.5; f += 0.01) {
    let twr = 1;
    for (const r of tradeReturns) {
      const hpr = 1 + (f * r / Math.abs(worstLoss));
      if (hpr <= 0) {
        twr = 0;
        break;
      }
      twr *= hpr;
    }
    
    if (twr > bestTWR) {
      bestTWR = twr;
      bestF = f;
    }
  }
  
  return bestF;
}

/**
 * ATR 基礎部位大小計算
 * @param {number} capital - 資金
 * @param {number} atr - ATR 值
 * @param {number} price - 當前價格
 * @param {number} riskPercent - 風險百分比 (預設 2%)
 * @returns {Object} 部位大小資訊
 */
function calculateATRPosition(capital, atr, price, riskPercent = 0.02) {
  const riskAmount = capital * riskPercent;
  const stopDistance = atr * 2; // 使用 2 倍 ATR 作為停損距離
  
  const shares = Math.floor(riskAmount / stopDistance);
  const positionValue = shares * price;
  const positionPercent = positionValue / capital;
  
  return {
    shares,
    positionValue,
    positionPercent: Math.round(positionPercent * 10000) / 100,
    stopLossPrice: price - stopDistance,
    stopLossPercent: Math.round((stopDistance / price) * 10000) / 100,
    riskAmount: Math.round(riskAmount)
  };
}

// ============================================
// 停損停利策略
// ============================================

/**
 * 計算動態停損價格
 * @param {Object} position - 持倉資訊
 * @param {Object} config - 停損設定
 * @returns {Object} 停損資訊
 */
function calculateDynamicStopLoss(position, config = {}) {
  const {
    entryPrice,
    currentPrice,
    highestPrice = currentPrice,
    atr = currentPrice * 0.02
  } = position;
  
  const {
    fixedStopLoss = 0.08,        // 固定停損 8%
    trailingStop = 0.05,         // 追蹤停損 5%
    atrMultiplier = 2,           // ATR 倍數
    breakEvenTrigger = 0.05,    // 獲利 5% 後移動停損到成本價
    profitLockPercent = 0.5     // 鎖定 50% 獲利
  } = config;
  
  const currentReturn = (currentPrice - entryPrice) / entryPrice;
  const results = [];
  
  // 1. 固定停損
  const fixedStopPrice = entryPrice * (1 - fixedStopLoss);
  results.push({
    type: 'FIXED',
    name: '固定停損',
    price: Math.round(fixedStopPrice * 100) / 100,
    distance: Math.round(((currentPrice - fixedStopPrice) / currentPrice) * 10000) / 100
  });
  
  // 2. 追蹤停損
  const trailingStopPrice = highestPrice * (1 - trailingStop);
  results.push({
    type: 'TRAILING',
    name: '追蹤停損',
    price: Math.round(trailingStopPrice * 100) / 100,
    distance: Math.round(((currentPrice - trailingStopPrice) / currentPrice) * 10000) / 100
  });
  
  // 3. ATR 停損
  const atrStopPrice = currentPrice - (atr * atrMultiplier);
  results.push({
    type: 'ATR',
    name: 'ATR 停損',
    price: Math.round(atrStopPrice * 100) / 100,
    distance: Math.round(((currentPrice - atrStopPrice) / currentPrice) * 10000) / 100
  });
  
  // 4. 移動到成本價 (如果已獲利超過觸發點)
  if (currentReturn > breakEvenTrigger) {
    results.push({
      type: 'BREAKEVEN',
      name: '保本停損',
      price: Math.round(entryPrice * 100) / 100,
      distance: Math.round(((currentPrice - entryPrice) / currentPrice) * 10000) / 100
    });
  }
  
  // 5. 鎖定獲利 (如果已獲利)
  if (currentReturn > 0) {
    const lockedProfit = currentReturn * profitLockPercent;
    const profitLockPrice = entryPrice * (1 + lockedProfit);
    results.push({
      type: 'PROFIT_LOCK',
      name: '獲利鎖定',
      price: Math.round(profitLockPrice * 100) / 100,
      distance: Math.round(((currentPrice - profitLockPrice) / currentPrice) * 10000) / 100
    });
  }
  
  // 選擇最高的停損價格
  const recommendedStop = results.reduce((best, current) => 
    current.price > best.price ? current : best
  , results[0]);
  
  return {
    currentPrice,
    entryPrice,
    currentReturn: Math.round(currentReturn * 10000) / 100,
    stopLossOptions: results,
    recommended: recommendedStop
  };
}

/**
 * 計算停利目標
 * @param {Object} position - 持倉資訊
 * @param {Object} config - 停利設定
 * @returns {Object} 停利目標
 */
function calculateTakeProfitTargets(position, config = {}) {
  const { entryPrice, currentPrice, atr = currentPrice * 0.02 } = position;
  const {
    riskRewardRatios = [1.5, 2, 3, 5],
    stopLossDistance = entryPrice * 0.08
  } = config;
  
  const targets = riskRewardRatios.map(ratio => ({
    ratio,
    price: Math.round((entryPrice + stopLossDistance * ratio) * 100) / 100,
    potentialReturn: Math.round((stopLossDistance * ratio / entryPrice) * 10000) / 100
  }));
  
  // ATR 目標
  const atrTargets = [1, 2, 3, 5].map(mult => ({
    ratio: `${mult}x ATR`,
    price: Math.round((currentPrice + atr * mult) * 100) / 100,
    potentialReturn: Math.round((atr * mult / currentPrice) * 10000) / 100
  }));
  
  return {
    currentPrice,
    entryPrice,
    riskRewardTargets: targets,
    atrTargets
  };
}

// ============================================
// VaR 與壓力測試
// ============================================

/**
 * 計算 VaR (Value at Risk)
 * @param {Array} returns - 報酬率陣列
 * @param {number} confidence - 信心水準 (如 0.95)
 * @param {number} capital - 資金
 * @returns {Object} VaR 結果
 */
function calculateVaR(returns, confidence = 0.95, capital = 1000000) {
  if (returns.length === 0) return { var: 0, cvar: 0, capital };
  
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sortedReturns.length);
  
  const var_pct = sortedReturns[index];
  const var_amount = Math.abs(var_pct * capital);
  
  // CVaR (Expected Shortfall)
  const tailReturns = sortedReturns.slice(0, index + 1);
  const cvar_pct = tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length;
  const cvar_amount = Math.abs(cvar_pct * capital);
  
  return {
    confidence,
    varPercent: Math.round(Math.abs(var_pct) * 10000) / 100,
    varAmount: Math.round(var_amount),
    cvarPercent: Math.round(Math.abs(cvar_pct) * 10000) / 100,
    cvarAmount: Math.round(cvar_amount),
    interpretation: `在 ${confidence * 100}% 信心水準下，單日最大虧損不超過 $${var_amount.toLocaleString()}`
  };
}

/**
 * 壓力測試
 * @param {Object} portfolio - 投資組合
 * @param {Array} scenarios - 情境陣列
 * @returns {Array} 壓力測試結果
 */
function runStressTest(portfolio, scenarios = null) {
  const defaultScenarios = [
    { name: '市場小幅回檔', drop: 0.05 },
    { name: '市場中度回檔', drop: 0.10 },
    { name: '市場大幅回檔', drop: 0.20 },
    { name: '金融危機', drop: 0.35 },
    { name: '極端事件', drop: 0.50 }
  ];
  
  const testScenarios = scenarios || defaultScenarios;
  const totalValue = portfolio.totalValue || 1000000;
  const beta = portfolio.beta || 1;
  
  return testScenarios.map(scenario => {
    const portfolioDrop = scenario.drop * beta;
    const lossAmount = totalValue * portfolioDrop;
    const remainingValue = totalValue - lossAmount;
    const recoveryNeeded = (lossAmount / remainingValue) * 100;
    
    return {
      scenario: scenario.name,
      marketDrop: Math.round(scenario.drop * 100),
      portfolioDrop: Math.round(portfolioDrop * 100),
      lossAmount: Math.round(lossAmount),
      remainingValue: Math.round(remainingValue),
      recoveryNeeded: Math.round(recoveryNeeded * 10) / 10
    };
  });
}

// ============================================
// 風險警報系統
// ============================================

/**
 * 檢查風險警報
 * @param {Object} portfolio - 投資組合
 * @param {Object} config - 警報設定
 * @returns {Array} 警報陣列
 */
function checkRiskAlerts(portfolio, config = {}) {
  const {
    maxDrawdownAlert = 10,
    maxConcentrationAlert = 30,
    minDiversificationAlert = 40,
    maxVolatilityAlert = 30,
    maxSinglePositionAlert = 20
  } = config;
  
  const alerts = [];
  
  // 回檔警報
  if (portfolio.currentDrawdown > maxDrawdownAlert) {
    alerts.push({
      level: portfolio.currentDrawdown > maxDrawdownAlert * 1.5 ? 'CRITICAL' : 'WARNING',
      type: 'DRAWDOWN',
      message: `當前回檔 ${portfolio.currentDrawdown.toFixed(1)}% 超過警戒線 ${maxDrawdownAlert}%`,
      action: '考慮減少持倉或執行停損'
    });
  }
  
  // 集中度警報
  if (portfolio.concentrationRisk > maxConcentrationAlert) {
    alerts.push({
      level: 'WARNING',
      type: 'CONCENTRATION',
      message: `投資組合集中度 ${portfolio.concentrationRisk}% 偏高`,
      action: '建議分散投資標的'
    });
  }
  
  // 分散化不足警報
  if (portfolio.diversificationRatio < minDiversificationAlert) {
    alerts.push({
      level: 'INFO',
      type: 'DIVERSIFICATION',
      message: `分散化比率 ${portfolio.diversificationRatio}% 偏低`,
      action: '考慮增加不相關資產'
    });
  }
  
  // 波動率警報
  if (portfolio.totalRisk > maxVolatilityAlert) {
    alerts.push({
      level: portfolio.totalRisk > maxVolatilityAlert * 1.5 ? 'CRITICAL' : 'WARNING',
      type: 'VOLATILITY',
      message: `組合波動率 ${portfolio.totalRisk.toFixed(1)}% 超過警戒線`,
      action: '考慮降低高波動標的比重'
    });
  }
  
  // 單一持倉過大警報
  const largestPosition = portfolio.positions?.reduce((max, p) => 
    (p.weight || 0) > (max?.weight || 0) ? p : max
  , null);
  
  if (largestPosition && largestPosition.weight > maxSinglePositionAlert) {
    alerts.push({
      level: 'WARNING',
      type: 'SINGLE_POSITION',
      message: `單一持倉 ${largestPosition.stockId} 佔比 ${largestPosition.weight}% 過高`,
      action: '考慮分批獲利了結'
    });
  }
  
  return alerts.sort((a, b) => {
    const levelOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });
}

// ============================================
// 風險調整績效
// ============================================

/**
 * 計算風險調整後報酬指標
 * @param {Object} performance - 績效數據
 * @returns {Object} 風險調整指標
 */
function calculateRiskAdjustedReturns(performance) {
  const {
    totalReturn = 0,
    annualizedReturn = 0,
    volatility = 20,
    maxDrawdown = 10,
    riskFreeRate = 0.02
  } = performance;
  
  // Sharpe Ratio
  const sharpeRatio = volatility > 0 
    ? (annualizedReturn / 100 - riskFreeRate) / (volatility / 100) 
    : 0;
  
  // Sortino Ratio (假設下行波動率為總波動率的 70%)
  const downsideVolatility = volatility * 0.7;
  const sortinoRatio = downsideVolatility > 0 
    ? (annualizedReturn / 100 - riskFreeRate) / (downsideVolatility / 100) 
    : 0;
  
  // Calmar Ratio
  const calmarRatio = maxDrawdown > 0 
    ? annualizedReturn / maxDrawdown 
    : 0;
  
  // Information Ratio (假設基準報酬為 8%)
  const benchmarkReturn = 8;
  const trackingError = volatility * 0.5;
  const informationRatio = trackingError > 0 
    ? (annualizedReturn - benchmarkReturn) / trackingError 
    : 0;
  
  // Omega Ratio (簡化版)
  const omegaRatio = maxDrawdown > 0 
    ? 1 + (totalReturn / maxDrawdown) 
    : 1;
  
  // 綜合評分
  const compositeScore = (
    (sharpeRatio > 0 ? Math.min(sharpeRatio / 2, 1) * 25 : 0) +
    (sortinoRatio > 0 ? Math.min(sortinoRatio / 3, 1) * 25 : 0) +
    (calmarRatio > 0 ? Math.min(calmarRatio / 2, 1) * 25 : 0) +
    (totalReturn > 0 ? Math.min(totalReturn / 50, 1) * 25 : 0)
  );
  
  return {
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    calmarRatio: Math.round(calmarRatio * 100) / 100,
    informationRatio: Math.round(informationRatio * 100) / 100,
    omegaRatio: Math.round(omegaRatio * 100) / 100,
    compositeScore: Math.round(compositeScore),
    rating: compositeScore >= 80 ? 'A' : compositeScore >= 60 ? 'B' : compositeScore >= 40 ? 'C' : 'D'
  };
}

// ============================================
// 模組匯出
// ============================================

module.exports = {
  // 常數
  RISK_LEVELS,
  POSITION_SIZING_METHODS,
  
  // 投資組合風險
  calculatePortfolioRisk,
  getRiskLevel,
  
  // 部位大小
  calculateKelly,
  calculateOptimalF,
  calculateATRPosition,
  
  // 停損停利
  calculateDynamicStopLoss,
  calculateTakeProfitTargets,
  
  // VaR 與壓力測試
  calculateVaR,
  runStressTest,
  
  // 警報系統
  checkRiskAlerts,
  
  // 風險調整績效
  calculateRiskAdjustedReturns
};
