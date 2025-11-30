/**
 * AI 股票掃描系統
 * 掃描真實台股、計算技術指標、顯示策略訊號
 */

import { useState } from 'react';
import { scanTwStocks, predictStockPrice } from './api';

// 預設掃描標的
const DEFAULT_STOCKS = [
  '2330', '2317', '2454', '2412', '2308', // 電子股
  '0050', '0056', '00878', '00919', '00929', // ETF
  '2881', '2882', '2891', '2886', '2884', // 金融股
  '2603', '2609', '2615', // 航運股
  '3008', '2345', '2382' // 科技股
];

// 訊號類型的顏色和標籤
const SIGNAL_CONFIG = {
  RSI_OVERSOLD: { color: '#16a34a', bg: '#dcfce7', label: '超賣' },
  RSI_OVERBOUGHT: { color: '#dc2626', bg: '#fee2e2', label: '超買' },
  MA_GOLDEN_CROSS: { color: '#16a34a', bg: '#dcfce7', label: '黃金交叉' },
  MA_DEATH_CROSS: { color: '#dc2626', bg: '#fee2e2', label: '死亡交叉' },
  ABOVE_ALL_MA: { color: '#2563eb', bg: '#dbeafe', label: '站上均線' },
  BELOW_ALL_MA: { color: '#ea580c', bg: '#ffedd5', label: '跌破均線' },
  MOMENTUM_HIGH: { color: '#16a34a', bg: '#dcfce7', label: '創新高' },
  MOMENTUM_LOW: { color: '#dc2626', bg: '#fee2e2', label: '創新低' }
};

export default function StockScanner({ onSelectStock }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customStocks, setCustomStocks] = useState('');
  const [months, setMonths] = useState(3);
  const [filter, setFilter] = useState('all'); // all, bullish, bearish
  const [lastScanTime, setLastScanTime] = useState(null);
  const [predictions, setPredictions] = useState({}); // 儲存預測結果
  const [loadingPrediction, setLoadingPrediction] = useState({}); // 載入狀態

  // 執行掃描
  const runScan = async (stockIds = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const idsToScan = stockIds || DEFAULT_STOCKS;
      const data = await scanTwStocks(idsToScan, months);
      
      if (data.success) {
        setResults(data.results);
        setLastScanTime(new Date().toLocaleTimeString('zh-TW'));
      } else {
        setError(data.error || '掃描失敗');
      }
    } catch (err) {
      setError(err.message || '連接後端失敗');
    } finally {
      setLoading(false);
    }
  };

  // 預測股價
  const handlePredict = async (stockId, e) => {
    e.stopPropagation(); // 防止觸發卡片點擊
    
    setLoadingPrediction(prev => ({ ...prev, [stockId]: true }));
    
    try {
      const data = await predictStockPrice(stockId, 6, 5);
      
      if (data.success) {
        setPredictions(prev => ({ 
          ...prev, 
          [stockId]: {
            ...data.prediction,
            currentPrice: data.currentPrice,
            currentDate: data.currentDate
          }
        }));
      }
    } catch (err) {
      console.error('預測失敗:', err);
    } finally {
      setLoadingPrediction(prev => ({ ...prev, [stockId]: false }));
    }
  };

  // 自訂股票掃描
  const handleCustomScan = () => {
    if (!customStocks.trim()) {
      runScan(DEFAULT_STOCKS);
      return;
    }
    
    const ids = customStocks
      .split(/[,\s，]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (ids.length > 0) {
      runScan(ids);
    }
  };

  // 過濾結果
  const filteredResults = results.filter(stock => {
    if (filter === 'all') return true;
    
    const hasBullish = stock.signals.some(s => 
      ['RSI_OVERSOLD', 'MA_GOLDEN_CROSS', 'ABOVE_ALL_MA', 'MOMENTUM_HIGH'].includes(s.type)
    );
    const hasBearish = stock.signals.some(s => 
      ['RSI_OVERBOUGHT', 'MA_DEATH_CROSS', 'BELOW_ALL_MA', 'MOMENTUM_LOW'].includes(s.type)
    );
    
    if (filter === 'bullish') return hasBullish;
    if (filter === 'bearish') return hasBearish;
    return true;
  });

  return (
    <div className="stock-scanner">
      <div className="scanner-header">
        <h2>📡 AI 台股掃描器</h2>
        <p className="scanner-subtitle">即時掃描台股技術指標，發現投資機會</p>
      </div>

      {/* 控制面板 */}
      <div className="scanner-controls">
        <div className="control-row">
          <div className="control-group">
            <label>掃描月份</label>
            <select value={months} onChange={e => setMonths(Number(e.target.value))}>
              <option value={1}>1 個月</option>
              <option value={3}>3 個月</option>
              <option value={6}>6 個月</option>
              <option value={12}>12 個月</option>
            </select>
          </div>
          
          <div className="control-group">
            <label>篩選訊號</label>
            <select value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">全部訊號</option>
              <option value="bullish">多頭訊號</option>
              <option value="bearish">空頭訊號</option>
            </select>
          </div>
        </div>

        <div className="control-row">
          <div className="control-group flex-grow">
            <label>自訂股票代號（逗號分隔）</label>
            <input
              type="text"
              value={customStocks}
              onChange={e => setCustomStocks(e.target.value)}
              placeholder="例: 2330, 2317, 0050"
            />
          </div>
        </div>

        <div className="control-row">
          <button 
            className="scan-btn primary" 
            onClick={handleCustomScan}
            disabled={loading}
          >
            {loading ? '⏳ 掃描中...' : '🔍 開始掃描'}
          </button>
          
          <button 
            className="scan-btn secondary" 
            onClick={() => runScan(DEFAULT_STOCKS)}
            disabled={loading}
          >
            📋 掃描熱門股
          </button>
        </div>

        {lastScanTime && (
          <p className="scan-time">最後掃描: {lastScanTime}</p>
        )}
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="scanner-error">
          ⚠️ {error}
        </div>
      )}

      {/* 載入中 */}
      {loading && (
        <div className="scanner-loading">
          <div className="spinner"></div>
          <p>正在從證交所取得即時資料並分析...</p>
          <p className="loading-hint">首次掃描可能需要 30-60 秒</p>
        </div>
      )}

      {/* 結果列表 */}
      {!loading && results.length > 0 && (
        <div className="scanner-results">
          <div className="results-header">
            <span>找到 {filteredResults.length} 檔股票</span>
            <span className="signal-count">共 {filteredResults.reduce((acc, s) => acc + s.signalCount, 0)} 個訊號</span>
          </div>

          <div className="stock-grid">
            {filteredResults.map(stock => (
              <div 
                key={stock.stockId} 
                className={`stock-card ${stock.signalCount > 0 ? 'has-signals' : ''}`}
                onClick={() => onSelectStock && onSelectStock(stock.stockId)}
              >
                <div className="stock-header">
                  <div className="stock-id-group">
                    <span className="stock-id">{stock.stockId}</span>
                    <span className="stock-name">{stock.name}</span>
                  </div>
                  <span className={`stock-change ${stock.change1d >= 0 ? 'positive' : 'negative'}`}>
                    {stock.change1d >= 0 ? '+' : ''}{stock.change1d}%
                  </span>
                </div>

                <div className="stock-price">
                  ${stock.price.toFixed(2)}
                </div>

                <div className="stock-stats">
                  <div className="stat">
                    <span className="stat-label">5日</span>
                    <span className={`stat-value ${stock.change5d >= 0 ? 'positive' : 'negative'}`}>
                      {stock.change5d >= 0 ? '+' : ''}{stock.change5d}%
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">20日動能</span>
                    <span className={`stat-value ${stock.momentum20 >= 0 ? 'positive' : 'negative'}`}>
                      {stock.momentum20 >= 0 ? '+' : ''}{stock.momentum20}%
                    </span>
                  </div>
                </div>

                <div className="stock-indicators">
                  {stock.indicators?.rsi14 && (
                    <span className="indicator">
                      RSI: {stock.indicators.rsi14.toFixed(1)}
                    </span>
                  )}
                  {stock.indicators?.ma5 && (
                    <span className="indicator">
                      MA5: {stock.indicators.ma5.toFixed(1)}
                    </span>
                  )}
                </div>

                {stock.signals && stock.signals.length > 0 && (
                  <div className="stock-signals">
                    {stock.signals.map((signal, idx) => {
                      const config = SIGNAL_CONFIG[signal.type] || { color: '#666', bg: '#f0f0f0', label: signal.message || signal.type };
                      return (
                        <span 
                          key={idx}
                          className="signal-badge"
                          style={{ 
                            backgroundColor: config.bg, 
                            color: config.color,
                            borderColor: config.color
                          }}
                          title={signal.message}
                        >
                          {signal.strength === 'strong' && '⚡'} {config.label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* 預測按鈕 */}
                <button
                  className="predict-btn"
                  onClick={(e) => handlePredict(stock.stockId, e)}
                  disabled={loadingPrediction[stock.stockId]}
                  style={{ marginTop: '8px', width: '100%' }}
                >
                  {loadingPrediction[stock.stockId] ? '⏳ 預測中...' : '🔮 5日價格預測'}
                </button>

                {/* 預測結果 */}
                {predictions[stock.stockId] && (
                  <div className="prediction-panel" style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '8px',
                    color: 'white'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                      📈 未來 5 日預測
                    </div>
                    
                    {predictions[stock.stockId].predictions?.consensus?.map((pred, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 0',
                        borderBottom: idx < 4 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                        fontSize: '13px'
                      }}>
                        <span>第 {pred.day} 天</span>
                        <span style={{ fontWeight: 'bold' }}>
                          ${pred.price.toFixed(2)} 
                          <span style={{ 
                            marginLeft: '8px',
                            color: pred.change >= 0 ? '#4ade80' : '#f87171'
                          }}>
                            ({pred.change >= 0 ? '+' : ''}{pred.change.toFixed(2)}%)
                          </span>
                        </span>
                      </div>
                    ))}
                    
                    {predictions[stock.stockId].marketAnalysis && (
                      <div style={{ 
                        marginTop: '10px', 
                        paddingTop: '10px', 
                        borderTop: '1px solid rgba(255,255,255,0.3)',
                        fontSize: '12px'
                      }}>
                        <div>
                          趨勢: {predictions[stock.stockId].marketAnalysis.currentTrend === 'bullish' ? '📈 多頭' : 
                                predictions[stock.stockId].marketAnalysis.currentTrend === 'bearish' ? '📉 空頭' : '➡️ 盤整'}
                          <span style={{ marginLeft: '10px' }}>
                            波動: {predictions[stock.stockId].marketAnalysis.volatility}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="stock-date">
                  資料日期: {stock.latestDate}
                </div>

                {/* AI 分析區塊 */}
                {stock.analysis && (
                  <div className="stock-analysis">
                    <div className="analysis-header">
                      <span className="analysis-title">🤖 AI 分析</span>
                      <span className={`analysis-score score-${stock.analysis.score >= 70 ? 'high' : stock.analysis.score >= 50 ? 'mid' : 'low'}`}>
                        {stock.analysis.score} 分
                      </span>
                    </div>
                    
                    {stock.analysis.pros.length > 0 && (
                      <div className="analysis-section pros">
                        <span className="section-icon">✅</span>
                        <ul>
                          {stock.analysis.pros.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    {stock.analysis.cons.length > 0 && (
                      <div className="analysis-section cons">
                        <span className="section-icon">⚠️</span>
                        <ul>
                          {stock.analysis.cons.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                    )}

                    {stock.analysis.suggestions.length > 0 && (
                      <div className="analysis-section suggestions">
                        <span className="section-icon">💡</span>
                        <ul>
                          {stock.analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}

                    <div className="analysis-summary">
                      📊 {stock.analysis.summary}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空結果 */}
      {!loading && !error && results.length === 0 && (
        <div className="scanner-empty">
          <p>👆 點擊上方按鈕開始掃描台股</p>
          <p className="empty-hint">系統將連接台灣證交所 API 取得即時資料</p>
        </div>
      )}
    </div>
  );
}
