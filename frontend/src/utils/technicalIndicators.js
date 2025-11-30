/**
 * 技術指標計算工具
 */

// 計算簡單移動平均 (SMA)
export function calculateSMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      // result.push({ time: data[i].time, value: NaN }); // TradingView doesn't like NaN usually, better to skip
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

// 計算指數移動平均 (EMA)
export function calculateEMA(data, period) {
  const result = [];
  const k = 2 / (period + 1);
  let ema = data[0].close;
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push({ time: data[i].time, value: ema });
      continue;
    }
    ema = data[i].close * k + ema * (1 - k);
    if (i >= period - 1) {
      result.push({ time: data[i].time, value: ema });
    }
  }
  return result;
}

// 計算布林通道 (Bollinger Bands)
export function calculateBollingerBands(data, period = 20, stdDevMultiplier = 2) {
  const upper = [];
  const lower = [];
  const middle = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;

    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const sma = sum / period;
    middle.push({ time: data[i].time, value: sma });

    let sumSqDiff = 0;
    for (let j = 0; j < period; j++) {
      sumSqDiff += Math.pow(data[i - j].close - sma, 2);
    }
    const stdDev = Math.sqrt(sumSqDiff / period);

    upper.push({ time: data[i].time, value: sma + stdDev * stdDevMultiplier });
    lower.push({ time: data[i].time, value: sma - stdDev * stdDevMultiplier });
  }

  return { upper, middle, lower };
}

// 計算 MACD
export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const macdLine = [];
  const signalLine = [];
  const histogram = [];

  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  // Align data
  // We need to match times. Assuming data is sorted and continuous for simplicity, 
  // but robust implementation should match by time.
  // Since calculateEMA returns {time, value}, we can map by time.
  
  const fastMap = new Map(fastEMA.map(i => [i.time, i.value]));
  const slowMap = new Map(slowEMA.map(i => [i.time, i.value]));

  const times = data.map(d => d.time);
  const macdValues = [];

  for (const time of times) {
    const fast = fastMap.get(time);
    const slow = slowMap.get(time);
    if (fast !== undefined && slow !== undefined) {
      const macd = fast - slow;
      macdValues.push({ time, value: macd });
      macdLine.push({ time, value: macd });
    }
  }

  // Calculate Signal Line (EMA of MACD)
  // We need to pass the MACD values as "close" to calculateEMA
  const macdForEma = macdValues.map(m => ({ time: m.time, close: m.value }));
  const signal = calculateEMA(macdForEma, signalPeriod);
  const signalMap = new Map(signal.map(s => [s.time, s.value]));

  for (const m of macdValues) {
    const s = signalMap.get(m.time);
    if (s !== undefined) {
      signalLine.push({ time: m.time, value: s });
      histogram.push({ time: m.time, value: m.value - s });
    }
  }

  return { macdLine, signalLine, histogram };
}
