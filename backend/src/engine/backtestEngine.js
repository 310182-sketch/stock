/**
 * 核心引擎層 (Engine Layer / Backtest Core) - 擴展版
 * 系統的「心臟」，負責模擬時間流動與帳戶管理
 * 事件驅動：遍歷每一天，呼叫策略層取得訊號並執行交易
 * 
 * 擴展功能：
 * - 多策略支援
 * - 風險管理
 * - 部位控管
 * - 滑價與手續費模擬
 * - 停損停利
 * - 多股票同時回測
 */

const { Strategies, SIGNALS, executeStrategy, generateAnalysisReport } = require('../strategies');

// ============================================
// 常數定義
// ============================================

const ORDER_TYPES = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  STOP: 'STOP',
  STOP_LIMIT: 'STOP_LIMIT'
};

const POSITION_SIZING = {
  FIXED: 'FIXED',           // 固定金額
  PERCENT: 'PERCENT',       // 資金百分比
  KELLY: 'KELLY',           // Kelly 公式
  ATR_BASED: 'ATR_BASED',   // ATR 基礎
  EQUAL_RISK: 'EQUAL_RISK'  // 等風險
};

// ============================================
// 回測引擎類別
// ============================================

class BacktestEngine {
  /**
   * 建立回測引擎
   * @param {Object} config - 引擎設定
   */
  constructor(config = {}) {
    this.config = {
      initialCapital: config.initialCapital || 1000000,
      positionSize: config.positionSize || 1,
      positionSizing: config.positionSizing || POSITION_SIZING.PERCENT,
      maxPositions: config.maxPositions || 5,
      commission: config.commission || 0.001425,  // 台股手續費 0.1425%
      tax: config.tax || 0.003,                   // 台股交易稅 0.3%
      slippage: config.slippage || 0.001,         // 滑價 0.1%
      stopLoss: config.stopLoss || null,          // 停損百分比
      takeProfit: config.takeProfit || null,      // 停利百分比
      trailingStop: config.trailingStop || null,  // 追蹤停損百分比
      riskPerTrade: config.riskPerTrade || 0.02,  // 每筆交易風險 2%
      ...config
    };
    
    this.reset();
  }

  /**
   * 重置引擎狀態
   */
  reset() {
    this.cash = this.config.initialCapital;
    this.positions = new Map();  // stockId -> position
    this.trades = [];
    this.equityCurve = [];
    this.orders = [];
    this.logs = [];
    this.stats = {
      totalBuys: 0,
      totalSells: 0,
      totalCommission: 0,
      totalTax: 0,
      totalSlippage: 0
    };
  }

  /**
   * 執行單股回測
   * @param {Object} options - 回測參數
   * @returns {Object} 回測結果
   */
  runBacktest(options) {
    const {
      data,
      strategy = 'maCross',
      strategyParams = {},
      stockId = 'DEFAULT'
    } = options;

    this.reset();

    const strategyConfig = Strategies[strategy];
    if (!strategyConfig) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }

    const mergedParams = { ...strategyConfig.defaultParams, ...strategyParams };

    // 遍歷每一天的數據
    for (let i = 0; i < data.length; i++) {
      const currentDay = data[i];
      
      // 更新持倉
      this.updatePositions(stockId, currentDay);
      
      // 檢查停損停利
      this.checkStopLossAndTakeProfit(stockId, currentDay, i);
      
      // 取得策略訊號
      const signal = strategyConfig.fn(data, i, mergedParams);
      
      // 執行交易
      this.executeSignal(stockId, signal, currentDay, i);
      
      // 記錄權益曲線
      this.recordEquity(currentDay, data);
    }

    // 回測結束時強制平倉
    this.closeAllPositions(data[data.length - 1]);

    return this.generateResult(strategy, strategyParams);
  }

  /**
   * 執行多股回測
   * @param {Object} options - 回測參數
   * @returns {Object} 回測結果
   */
  runMultiStockBacktest(options) {
    const {
      stocksData,  // Map<stockId, data[]>
      strategy = 'maCross',
      strategyParams = {},
      rebalancePeriod = 'daily'  // daily, weekly, monthly
    } = options;

    this.reset();

    const strategyConfig = Strategies[strategy];
    if (!strategyConfig) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }

    const mergedParams = { ...strategyConfig.defaultParams, ...strategyParams };

    // 建立日期索引
    const allDates = new Set();
    for (const [stockId, data] of stocksData) {
      data.forEach(d => allDates.add(d.date));
    }
    const sortedDates = [...allDates].sort();

    // 遍歷每一天
    for (const date of sortedDates) {
      const dailySignals = [];

      // 計算每支股票的訊號
      for (const [stockId, data] of stocksData) {
        const index = data.findIndex(d => d.date === date);
        if (index === -1) continue;

        const currentDay = data[index];
        
        // 更新持倉
        this.updatePositions(stockId, currentDay);
        
        // 檢查停損停利
        this.checkStopLossAndTakeProfit(stockId, currentDay, index);
        
        // 取得訊號
        const signal = strategyConfig.fn(data, index, mergedParams);
        
        if (signal !== SIGNALS.HOLD) {
          dailySignals.push({
            stockId,
            signal,
            currentDay,
            index,
            data
          });
        }
      }

      // 根據資金分配執行交易
      this.executeMultipleSignals(dailySignals);

      // 記錄權益曲線（使用第一支股票的日期）
      const firstStock = stocksData.values().next().value;
      if (firstStock) {
        const dayData = firstStock.find(d => d.date === date);
        if (dayData) {
          this.recordEquity(dayData, firstStock);
        }
      }
    }

    // 平倉所有持股
    for (const [stockId, data] of stocksData) {
      this.closeAllPositions(data[data.length - 1], stockId);
    }

    return this.generateResult(strategy, strategyParams);
  }

  /**
   * 更新持倉資訊
   */
  updatePositions(stockId, currentDay) {
    const position = this.positions.get(stockId);
    if (position) {
      position.currentPrice = currentDay.close;
      position.currentValue = position.shares * currentDay.close;
      position.unrealizedPnL = position.currentValue - position.costBasis;
      position.unrealizedPnLPercent = (position.unrealizedPnL / position.costBasis) * 100;
      
      // 更新追蹤停損的最高價
      if (this.config.trailingStop) {
        position.highestPrice = Math.max(position.highestPrice || position.entryPrice, currentDay.high);
      }
    }
  }

  /**
   * 檢查停損停利
   */
  checkStopLossAndTakeProfit(stockId, currentDay, index) {
    const position = this.positions.get(stockId);
    if (!position) return;

    const { stopLoss, takeProfit, trailingStop } = this.config;
    
    // 停損
    if (stopLoss && position.unrealizedPnLPercent <= -stopLoss * 100) {
      this.log(`[停損] ${stockId} 虧損達 ${position.unrealizedPnLPercent.toFixed(2)}%`, currentDay.date);
      this.executeSignal(stockId, SIGNALS.SELL, currentDay, index);
      return;
    }
    
    // 停利
    if (takeProfit && position.unrealizedPnLPercent >= takeProfit * 100) {
      this.log(`[停利] ${stockId} 獲利達 ${position.unrealizedPnLPercent.toFixed(2)}%`, currentDay.date);
      this.executeSignal(stockId, SIGNALS.SELL, currentDay, index);
      return;
    }
    
    // 追蹤停損
    if (trailingStop && position.highestPrice) {
      const trailStopPrice = position.highestPrice * (1 - trailingStop);
      if (currentDay.close <= trailStopPrice) {
        this.log(`[追蹤停損] ${stockId} 從高點回落超過 ${trailingStop * 100}%`, currentDay.date);
        this.executeSignal(stockId, SIGNALS.SELL, currentDay, index);
        return;
      }
    }
  }

  /**
   * 執行交易訊號
   */
  executeSignal(stockId, signal, currentDay, index) {
    const price = currentDay.close;
    
    if (signal === SIGNALS.BUY || signal === SIGNALS.STRONG_BUY) {
      // 檢查是否已有持倉
      if (this.positions.has(stockId)) {
        // 強買訊號可以加碼
        if (signal === SIGNALS.STRONG_BUY) {
          this.addToPosition(stockId, currentDay);
        }
        return;
      }
      
      // 檢查持倉數量限制
      if (this.positions.size >= this.config.maxPositions) {
        this.log(`[限制] 持倉數已達上限 ${this.config.maxPositions}`, currentDay.date);
        return;
      }
      
      // 計算買入金額
      const investAmount = this.calculatePositionSize(stockId, currentDay);
      if (investAmount <= 0) return;
      
      this.openPosition(stockId, currentDay, investAmount);
      
    } else if (signal === SIGNALS.SELL || signal === SIGNALS.STRONG_SELL) {
      if (!this.positions.has(stockId)) return;
      
      if (signal === SIGNALS.STRONG_SELL) {
        // 強賣訊號：全部出清
        this.closePosition(stockId, currentDay);
      } else {
        // 普通賣出訊號：可以部分出清
        this.closePosition(stockId, currentDay, 1); // 全部出清
      }
    }
  }

  /**
   * 計算部位大小
   */
  calculatePositionSize(stockId, currentDay) {
    const { positionSizing, positionSize, riskPerTrade, initialCapital } = this.config;
    const currentEquity = this.calculateCurrentEquity(currentDay);
    
    switch (positionSizing) {
      case POSITION_SIZING.FIXED:
        return Math.min(positionSize, this.cash);
        
      case POSITION_SIZING.PERCENT:
        return Math.min(currentEquity * positionSize, this.cash);
        
      case POSITION_SIZING.KELLY:
        // 簡化的 Kelly 公式：f = (bp - q) / b
        // 假設 b = 1, p = 0.55, q = 0.45
        const kellyFraction = 0.1; // 使用 1/10 Kelly
        return Math.min(currentEquity * kellyFraction, this.cash);
        
      case POSITION_SIZING.EQUAL_RISK:
        // 等風險：每筆交易風險相同
        const riskAmount = currentEquity * riskPerTrade;
        const stopLossPercent = this.config.stopLoss || 0.05;
        return Math.min(riskAmount / stopLossPercent, this.cash);
        
      default:
        return Math.min(currentEquity * positionSize, this.cash);
    }
  }

  /**
   * 開倉
   */
  openPosition(stockId, currentDay, investAmount) {
    const price = currentDay.close;
    
    // 計算滑價
    const slippageAmount = price * this.config.slippage;
    const executionPrice = price + slippageAmount;
    
    // 計算可買股數（台股一張 = 1000 股）
    const sharesToBuy = Math.floor(investAmount / executionPrice);
    if (sharesToBuy <= 0) return;
    
    // 計算成本
    const cost = sharesToBuy * executionPrice;
    const commission = cost * this.config.commission;
    const totalCost = cost + commission;
    
    if (totalCost > this.cash) return;
    
    // 扣除現金
    this.cash -= totalCost;
    
    // 建立持倉
    this.positions.set(stockId, {
      stockId,
      shares: sharesToBuy,
      entryPrice: executionPrice,
      entryDate: currentDay.date,
      costBasis: totalCost,
      currentPrice: executionPrice,
      currentValue: cost,
      highestPrice: currentDay.high,
      unrealizedPnL: -commission,
      unrealizedPnLPercent: (-commission / totalCost) * 100
    });
    
    // 記錄交易
    this.trades.push({
      date: currentDay.date,
      stockId,
      type: 'BUY',
      price: executionPrice,
      shares: sharesToBuy,
      cost: totalCost,
      commission,
      slippage: slippageAmount * sharesToBuy,
      cash: this.cash,
      totalShares: sharesToBuy
    });
    
    // 更新統計
    this.stats.totalBuys++;
    this.stats.totalCommission += commission;
    this.stats.totalSlippage += slippageAmount * sharesToBuy;
    
    this.log(`[買入] ${stockId}: ${sharesToBuy} 股 @ $${executionPrice.toFixed(2)}`, currentDay.date);
  }

  /**
   * 加碼
   */
  addToPosition(stockId, currentDay) {
    const position = this.positions.get(stockId);
    if (!position) return;
    
    const additionalAmount = this.calculatePositionSize(stockId, currentDay) * 0.5; // 加碼一半
    if (additionalAmount <= 0) return;
    
    const price = currentDay.close;
    const slippageAmount = price * this.config.slippage;
    const executionPrice = price + slippageAmount;
    
    const sharesToBuy = Math.floor(additionalAmount / executionPrice);
    if (sharesToBuy <= 0) return;
    
    const cost = sharesToBuy * executionPrice;
    const commission = cost * this.config.commission;
    const totalCost = cost + commission;
    
    if (totalCost > this.cash) return;
    
    // 更新持倉
    const newTotalCost = position.costBasis + totalCost;
    const newTotalShares = position.shares + sharesToBuy;
    
    this.cash -= totalCost;
    position.shares = newTotalShares;
    position.costBasis = newTotalCost;
    position.entryPrice = newTotalCost / newTotalShares; // 平均成本
    
    // 記錄交易
    this.trades.push({
      date: currentDay.date,
      stockId,
      type: 'BUY',
      price: executionPrice,
      shares: sharesToBuy,
      cost: totalCost,
      commission,
      slippage: slippageAmount * sharesToBuy,
      cash: this.cash,
      totalShares: newTotalShares,
      isAddition: true
    });
    
    this.stats.totalBuys++;
    this.stats.totalCommission += commission;
    this.stats.totalSlippage += slippageAmount * sharesToBuy;
    
    this.log(`[加碼] ${stockId}: ${sharesToBuy} 股 @ $${executionPrice.toFixed(2)}`, currentDay.date);
  }

  /**
   * 平倉
   */
  closePosition(stockId, currentDay, portion = 1) {
    const position = this.positions.get(stockId);
    if (!position) return;
    
    const sharesToSell = Math.floor(position.shares * portion);
    if (sharesToSell <= 0) return;
    
    const price = currentDay.close;
    
    // 計算滑價
    const slippageAmount = price * this.config.slippage;
    const executionPrice = price - slippageAmount;
    
    // 計算收入
    const revenue = sharesToSell * executionPrice;
    const commission = revenue * this.config.commission;
    const tax = revenue * this.config.tax;
    const netRevenue = revenue - commission - tax;
    
    // 計算盈虧
    const costPerShare = position.costBasis / position.shares;
    const tradeCost = costPerShare * sharesToSell;
    const tradePnL = netRevenue - tradeCost;
    
    // 更新現金
    this.cash += netRevenue;
    
    // 記錄交易
    this.trades.push({
      date: currentDay.date,
      stockId,
      type: 'SELL',
      price: executionPrice,
      shares: sharesToSell,
      revenue: netRevenue,
      commission,
      tax,
      slippage: slippageAmount * sharesToSell,
      cash: this.cash,
      totalShares: position.shares - sharesToSell,
      pnl: tradePnL,
      pnlPercent: (tradePnL / tradeCost) * 100
    });
    
    // 更新統計
    this.stats.totalSells++;
    this.stats.totalCommission += commission;
    this.stats.totalTax += tax;
    this.stats.totalSlippage += slippageAmount * sharesToSell;
    
    // 更新或刪除持倉
    if (portion >= 1 || position.shares - sharesToSell <= 0) {
      this.positions.delete(stockId);
    } else {
      position.shares -= sharesToSell;
      position.costBasis -= tradeCost;
    }
    
    this.log(`[賣出] ${stockId}: ${sharesToSell} 股 @ $${executionPrice.toFixed(2)}, 盈虧: ${tradePnL.toFixed(2)}`, currentDay.date);
  }

  /**
   * 執行多個訊號
   */
  executeMultipleSignals(signals) {
    // 分類訊號
    const buySignals = signals.filter(s => s.signal === SIGNALS.BUY || s.signal === SIGNALS.STRONG_BUY);
    const sellSignals = signals.filter(s => s.signal === SIGNALS.SELL || s.signal === SIGNALS.STRONG_SELL);
    
    // 先執行賣出
    for (const { stockId, signal, currentDay, index } of sellSignals) {
      this.executeSignal(stockId, signal, currentDay, index);
    }
    
    // 再執行買入（按訊號強度排序）
    buySignals.sort((a, b) => {
      if (a.signal === SIGNALS.STRONG_BUY && b.signal !== SIGNALS.STRONG_BUY) return -1;
      if (b.signal === SIGNALS.STRONG_BUY && a.signal !== SIGNALS.STRONG_BUY) return 1;
      return 0;
    });
    
    for (const { stockId, signal, currentDay, index } of buySignals) {
      this.executeSignal(stockId, signal, currentDay, index);
    }
  }

  /**
   * 平倉所有持股
   */
  closeAllPositions(lastDay, specificStockId = null) {
    for (const [stockId, position] of this.positions) {
      if (specificStockId && stockId !== specificStockId) continue;
      this.closePosition(stockId, lastDay);
    }
  }

  /**
   * 計算當前權益
   */
  calculateCurrentEquity(currentDay) {
    let stockValue = 0;
    for (const [stockId, position] of this.positions) {
      stockValue += position.shares * (position.currentPrice || currentDay.close);
    }
    return this.cash + stockValue;
  }

  /**
   * 記錄權益曲線
   */
  recordEquity(currentDay, data) {
    let stockValue = 0;
    const positionsSnapshot = {};
    
    for (const [stockId, position] of this.positions) {
      stockValue += position.shares * position.currentPrice;
      positionsSnapshot[stockId] = {
        shares: position.shares,
        value: position.shares * position.currentPrice,
        pnlPercent: position.unrealizedPnLPercent
      };
    }
    
    const equity = this.cash + stockValue;
    
    this.equityCurve.push({
      date: currentDay.date,
      price: currentDay.close,
      equity,
      cash: this.cash,
      stockValue,
      positions: positionsSnapshot,
      positionCount: this.positions.size
    });
  }

  /**
   * 記錄日誌
   */
  log(message, date = null) {
    this.logs.push({
      timestamp: date || new Date().toISOString(),
      message
    });
  }

  /**
   * 生成結果
   */
  generateResult(strategy, strategyParams) {
    const finalEquity = this.equityCurve.length > 0 
      ? this.equityCurve[this.equityCurve.length - 1].equity 
      : this.config.initialCapital;

    return {
      initialCapital: this.config.initialCapital,
      finalEquity,
      trades: this.trades,
      equityCurve: this.equityCurve,
      strategy,
      strategyParams,
      config: this.config,
      stats: this.stats,
      logs: this.logs
    };
  }
}

// ============================================
// 簡化的回測函數（向後相容）
// ============================================

/**
 * 執行回測（簡化版本，向後相容）
 * @param {Object} options - 回測參數
 * @returns {Object} 回測結果
 */
function runBacktest(options) {
  const {
    data,
    strategy = 'maCross',
    strategyParams = {},
    initialCapital = 1000000,
    positionSize = 1,
    stopLoss = null,
    takeProfit = null,
    commission = 0.001425,
    tax = 0.003,
    slippage = 0.001
  } = options;

  const engine = new BacktestEngine({
    initialCapital,
    positionSize,
    stopLoss,
    takeProfit,
    commission,
    tax,
    slippage
  });

  return engine.runBacktest({
    data,
    strategy,
    strategyParams
  });
}

/**
 * 執行多策略回測
 * @param {Object} options - 回測參數
 * @returns {Array} 各策略回測結果
 */
function runMultiStrategyBacktest(options) {
  const {
    data,
    strategies = ['maCross', 'rsi', 'macd'],
    strategyParams = {},
    initialCapital = 1000000,
    positionSize = 1
  } = options;

  const results = [];

  for (const strategyId of strategies) {
    const engine = new BacktestEngine({
      initialCapital,
      positionSize
    });

    const result = engine.runBacktest({
      data,
      strategy: strategyId,
      strategyParams: strategyParams[strategyId] || {}
    });

    results.push(result);
  }

  return results;
}

/**
 * 執行參數優化
 * @param {Object} options - 優化參數
 * @returns {Object} 最佳參數與結果
 */
function optimizeStrategy(options) {
  const {
    data,
    strategy,
    paramRanges,  // { param1: [min, max, step], param2: [min, max, step] }
    optimizeFor = 'sharpeRatio',
    initialCapital = 1000000
  } = options;

  const { calculateMetrics } = require('../analytics/metrics');
  
  let bestResult = null;
  let bestParams = null;
  let bestMetric = -Infinity;
  const allResults = [];

  // 生成參數組合
  const paramNames = Object.keys(paramRanges);
  const paramValues = paramNames.map(name => {
    const [min, max, step] = paramRanges[name];
    const values = [];
    for (let v = min; v <= max; v += step) {
      values.push(v);
    }
    return values;
  });

  // 遞歸生成所有組合
  function* generateCombinations(index = 0, current = {}) {
    if (index >= paramNames.length) {
      yield { ...current };
      return;
    }
    
    for (const value of paramValues[index]) {
      current[paramNames[index]] = value;
      yield* generateCombinations(index + 1, current);
    }
  }

  // 測試每個組合
  for (const params of generateCombinations()) {
    const engine = new BacktestEngine({ initialCapital });
    const result = engine.runBacktest({
      data,
      strategy,
      strategyParams: params
    });

    const metrics = calculateMetrics(result);
    const metricValue = metrics[optimizeFor] || 0;

    allResults.push({
      params,
      metrics,
      metricValue
    });

    if (metricValue > bestMetric) {
      bestMetric = metricValue;
      bestParams = { ...params };
      bestResult = result;
    }
  }

  return {
    bestParams,
    bestResult,
    bestMetric,
    optimizeFor,
    allResults: allResults.sort((a, b) => b.metricValue - a.metricValue).slice(0, 10)
  };
}

/**
 * 執行蒙地卡羅模擬
 * @param {Object} backtestResult - 回測結果
 * @param {number} simulations - 模擬次數
 * @returns {Object} 模擬結果
 */
function runMonteCarloSimulation(backtestResult, simulations = 1000) {
  const { trades, initialCapital } = backtestResult;
  
  // 計算每筆交易的報酬率
  const returns = [];
  let buyTrade = null;
  
  for (const trade of trades) {
    if (trade.type === 'BUY') {
      buyTrade = trade;
    } else if (trade.type === 'SELL' && buyTrade) {
      const returnPct = (trade.price - buyTrade.price) / buyTrade.price;
      returns.push(returnPct);
      buyTrade = null;
    }
  }
  
  if (returns.length === 0) {
    return {
      simulations: 0,
      results: [],
      percentiles: {},
      statistics: {}
    };
  }

  // 執行模擬
  const simulationResults = [];
  
  for (let sim = 0; sim < simulations; sim++) {
    let equity = initialCapital;
    
    // 隨機重排交易順序
    const shuffledReturns = [...returns].sort(() => Math.random() - 0.5);
    
    // 模擬交易
    for (const returnPct of shuffledReturns) {
      equity *= (1 + returnPct);
    }
    
    simulationResults.push({
      finalEquity: equity,
      totalReturn: ((equity - initialCapital) / initialCapital) * 100
    });
  }

  // 計算統計
  const sortedReturns = simulationResults.map(r => r.totalReturn).sort((a, b) => a - b);
  
  return {
    simulations,
    results: simulationResults,
    percentiles: {
      p5: sortedReturns[Math.floor(simulations * 0.05)],
      p10: sortedReturns[Math.floor(simulations * 0.10)],
      p25: sortedReturns[Math.floor(simulations * 0.25)],
      p50: sortedReturns[Math.floor(simulations * 0.50)],
      p75: sortedReturns[Math.floor(simulations * 0.75)],
      p90: sortedReturns[Math.floor(simulations * 0.90)],
      p95: sortedReturns[Math.floor(simulations * 0.95)]
    },
    statistics: {
      mean: sortedReturns.reduce((a, b) => a + b, 0) / simulations,
      min: sortedReturns[0],
      max: sortedReturns[simulations - 1],
      stdDev: Math.sqrt(
        sortedReturns.reduce((sum, r) => sum + Math.pow(r - sortedReturns.reduce((a, b) => a + b, 0) / simulations, 2), 0) / simulations
      )
    }
  };
}

/**
 * 執行滾動窗口回測
 * @param {Object} options - 回測參數
 * @returns {Array} 各窗口回測結果
 */
function runRollingWindowBacktest(options) {
  const {
    data,
    strategy,
    strategyParams = {},
    windowSize = 252,  // 一年約 252 交易日
    stepSize = 21,     // 每月前進
    initialCapital = 1000000
  } = options;

  const results = [];

  for (let start = 0; start + windowSize <= data.length; start += stepSize) {
    const windowData = data.slice(start, start + windowSize);
    
    const engine = new BacktestEngine({ initialCapital });
    const result = engine.runBacktest({
      data: windowData,
      strategy,
      strategyParams
    });

    results.push({
      startDate: windowData[0].date,
      endDate: windowData[windowData.length - 1].date,
      result
    });
  }

  return results;
}

// ============================================
// 模組匯出
// ============================================

module.exports = {
  // 類別
  BacktestEngine,
  
  // 常數
  ORDER_TYPES,
  POSITION_SIZING,
  
  // 函數
  runBacktest,
  runMultiStrategyBacktest,
  optimizeStrategy,
  runMonteCarloSimulation,
  runRollingWindowBacktest
};
