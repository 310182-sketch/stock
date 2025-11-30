import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import './TradingViewChart.css';

/**
 * TradingView K 線圖組件
 * 支援：K線、成交量、SMA、布林通道、MACD
 */
export default function TradingViewChart({ data, title }) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const seriesRef = useRef({});

  // 指標開關
  const [indicators, setIndicators] = useState({
    sma20: false,
    bollinger: false,
    macd: false,
  });

  // ============ 工具函數 ============

  /**
   * 將 ISO 日期字串轉為 UTC 時間戳（秒）
   * Lightweight Charts 要求時間戳為 UTC 秒數
   */
  const parseDate = useCallback((dateStr) => {
    if (!dateStr) return null;
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return null;
    const [year, month, day] = parts.map(Number);
    if (!year || !month || !day) return null;
    // 使用 UTC 時間戳（秒）
    return Date.UTC(year, month - 1, day) / 1000;
  }, []);

  /**
   * 格式化原始數據為 K 線格式
   */
  const formatCandleData = useCallback((rawData) => {
    if (!rawData || !Array.isArray(rawData)) return [];
    
    const formatted = rawData
      .map((item) => {
        const time = parseDate(item.date);
        if (!time) return null;
        
        // 確保數值有效
        const open = Number(item.open);
        const high = Number(item.high);
        const low = Number(item.low);
        const close = Number(item.close);
        
        if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) return null;
        
        return { time, open, high, low, close };
      })
      .filter(Boolean);

    // 按時間排序並去重
    const seen = new Set();
    return formatted
      .sort((a, b) => a.time - b.time)
      .filter((item) => {
        if (seen.has(item.time)) return false;
        seen.add(item.time);
        return true;
      });
  }, [parseDate]);

  /**
   * 格式化成交量數據
   */
  const formatVolumeData = useCallback((rawData, candleData) => {
    if (!rawData || !Array.isArray(rawData)) return [];
    
    const candleMap = new Map(candleData.map((c) => [c.time, c]));
    
    return rawData
      .map((item) => {
        const time = parseDate(item.date);
        if (!time) return null;
        
        const volume = Number(item.volume);
        if (isNaN(volume)) return null;
        
        const candle = candleMap.get(time);
        const isUp = candle ? candle.close >= candle.open : true;
        
        return {
          time,
          value: volume,
          color: isUp ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)',
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.time - b.time);
  }, [parseDate]);

  // ============ 技術指標計算 ============

  /**
   * 計算 SMA (簡單移動平均)
   */
  const calculateSMA = useCallback((candleData, period) => {
    const result = [];
    for (let i = period - 1; i < candleData.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candleData[i - j].close;
      }
      result.push({
        time: candleData[i].time,
        value: sum / period,
      });
    }
    return result;
  }, []);

  /**
   * 計算 EMA (指數移動平均)
   */
  const calculateEMA = useCallback((values, period) => {
    if (values.length === 0) return [];
    
    const k = 2 / (period + 1);
    const result = [];
    let ema = values[0].value;
    
    for (let i = 0; i < values.length; i++) {
      if (i === 0) {
        ema = values[i].value;
      } else {
        ema = values[i].value * k + ema * (1 - k);
      }
      
      if (i >= period - 1) {
        result.push({ time: values[i].time, value: ema });
      }
    }
    return result;
  }, []);

  /**
   * 計算布林通道
   */
  const calculateBollingerBands = useCallback((candleData, period = 20, multiplier = 2) => {
    const upper = [];
    const middle = [];
    const lower = [];

    for (let i = period - 1; i < candleData.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candleData[i - j].close;
      }
      const sma = sum / period;

      let sumSqDiff = 0;
      for (let j = 0; j < period; j++) {
        sumSqDiff += Math.pow(candleData[i - j].close - sma, 2);
      }
      const stdDev = Math.sqrt(sumSqDiff / period);

      const time = candleData[i].time;
      upper.push({ time, value: sma + stdDev * multiplier });
      middle.push({ time, value: sma });
      lower.push({ time, value: sma - stdDev * multiplier });
    }

    return { upper, middle, lower };
  }, []);

  /**
   * 計算 MACD
   */
  const calculateMACD = useCallback((candleData, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    // 將 candle 數據轉為 { time, value } 格式
    const closeData = candleData.map((c) => ({ time: c.time, value: c.close }));
    
    const fastEMA = calculateEMA(closeData, fastPeriod);
    const slowEMA = calculateEMA(closeData, slowPeriod);

    // 建立查找表
    const fastMap = new Map(fastEMA.map((e) => [e.time, e.value]));
    const slowMap = new Map(slowEMA.map((e) => [e.time, e.value]));

    // 計算 MACD 線
    const macdValues = [];
    for (const { time } of candleData) {
      const fast = fastMap.get(time);
      const slow = slowMap.get(time);
      if (fast !== undefined && slow !== undefined) {
        macdValues.push({ time, value: fast - slow });
      }
    }

    // 計算信號線 (MACD 的 EMA)
    const signalLine = calculateEMA(macdValues, signalPeriod);
    const signalMap = new Map(signalLine.map((s) => [s.time, s.value]));

    // 計算柱狀圖
    const macdLine = [];
    const histogram = [];

    for (const m of macdValues) {
      const signal = signalMap.get(m.time);
      if (signal !== undefined) {
        macdLine.push({ time: m.time, value: m.value });
        histogram.push({
          time: m.time,
          value: m.value - signal,
          color: m.value - signal >= 0 ? '#ef4444' : '#22c55e',
        });
      }
    }

    return { macdLine, signalLine, histogram };
  }, [calculateEMA]);

  // ============ 圖表初始化與更新 ============

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 格式化數據
    const candleData = formatCandleData(data);
    
    if (candleData.length === 0) {
      console.warn('TradingViewChart: No valid candle data');
      return;
    }

    const volumeData = formatVolumeData(data, candleData);

    // 清除舊圖表
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
      seriesRef.current = {};
    }

    // 建立新圖表
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333333',
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      rightPriceScale: {
        borderColor: '#e0e0e0',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#e0e0e0',
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1, // Normal
        vertLine: {
          color: '#758696',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
    });

    chartInstanceRef.current = chart;

    // K 線 Series (台股：漲紅跌綠)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderUpColor: '#ef4444',
      borderDownColor: '#22c55e',
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    });
    candlestickSeries.setData(candleData);
    seriesRef.current.candle = candlestickSeries;

    // 成交量 Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeries.setData(volumeData);
    seriesRef.current.volume = volumeSeries;

    // SMA 20
    if (indicators.sma20) {
      const smaData = calculateSMA(candleData, 20);
      const smaSeries = chart.addSeries(LineSeries, {
        color: '#2962FF',
        lineWidth: 2,
        title: 'SMA 20',
      });
      smaSeries.setData(smaData);
      seriesRef.current.sma = smaSeries;
    }

    // 布林通道
    if (indicators.bollinger) {
      const bbData = calculateBollingerBands(candleData, 20, 2);
      
      const upperSeries = chart.addSeries(LineSeries, {
        color: 'rgba(33, 150, 243, 0.6)',
        lineWidth: 1,
        title: 'BB Upper',
      });
      upperSeries.setData(bbData.upper);

      const middleSeries = chart.addSeries(LineSeries, {
        color: 'rgba(33, 150, 243, 0.3)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
      });
      middleSeries.setData(bbData.middle);

      const lowerSeries = chart.addSeries(LineSeries, {
        color: 'rgba(33, 150, 243, 0.6)',
        lineWidth: 1,
        title: 'BB Lower',
      });
      lowerSeries.setData(bbData.lower);

      seriesRef.current.bbUpper = upperSeries;
      seriesRef.current.bbMiddle = middleSeries;
      seriesRef.current.bbLower = lowerSeries;
    }

    // MACD
    if (indicators.macd) {
      const macdData = calculateMACD(candleData);

      // MACD 柱狀圖
      const histogramSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: 'macd',
      });
      histogramSeries.setData(macdData.histogram);

      // MACD 線
      const macdLineSeries = chart.addSeries(LineSeries, {
        priceScaleId: 'macd',
        color: '#2962FF',
        lineWidth: 1,
        title: 'MACD',
      });
      macdLineSeries.setData(macdData.macdLine);

      // 信號線
      const signalLineSeries = chart.addSeries(LineSeries, {
        priceScaleId: 'macd',
        color: '#FF6D00',
        lineWidth: 1,
        title: 'Signal',
      });
      signalLineSeries.setData(macdData.signalLine);

      chart.priceScale('macd').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      seriesRef.current.macdHistogram = histogramSeries;
      seriesRef.current.macdLine = macdLineSeries;
      seriesRef.current.signalLine = signalLineSeries;
    }

    // 自動調整時間軸
    chart.timeScale().fitContent();

    // 視窗縮放處理
    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [data, indicators, formatCandleData, formatVolumeData, calculateSMA, calculateBollingerBands, calculateMACD]);

  // ============ 指標切換 ============

  const toggleIndicator = (key) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ============ 渲染 ============

  return (
    <div className="tradingview-chart-wrapper">
      <div className="chart-toolbar">
        <span className="chart-title">{title ? title.replace('技術分析', '').replace(/[()]/g, '').trim() : ''}</span>
        <div className="chart-controls">
          <label className={indicators.sma20 ? 'active icon-btn' : 'icon-btn'} title="SMA 20">
            <input
              type="checkbox"
              checked={indicators.sma20}
              onChange={() => toggleIndicator('sma20')}
            />
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <polyline points="1,12 5,8 9,10 13,6 17,8" stroke="#334155" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </label>
          <label className={indicators.bollinger ? 'active icon-btn' : 'icon-btn'} title="布林通道">
            <input
              type="checkbox"
              checked={indicators.bollinger}
              onChange={() => toggleIndicator('bollinger')}
            />
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M1 10 C5 6, 9 6, 13 4 C15 3, 17 3, 17 3" stroke="#334155" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M1 8 C5 10, 9 9, 13 9 C15 9, 17 9, 17 9" stroke="#334155" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.7"/>
            </svg>
          </label>
          <label className={indicators.macd ? 'active icon-btn' : 'icon-btn'} title="MACD">
            <input
              type="checkbox"
              checked={indicators.macd}
              onChange={() => toggleIndicator('macd')}
            />
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <rect x="1" y="7" width="3" height="6" fill="#ef4444" />
              <rect x="6" y="4" width="3" height="9" fill="#ef4444" />
              <rect x="11" y="2" width="3" height="11" fill="#22c55e" />
            </svg>
          </label>
        </div>
      </div>
      <div ref={chartContainerRef} className="chart-container" />
    </div>
  );
}
