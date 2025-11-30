/**
 * 潛力股專區
 * 顯示真實台股證交所數據，包含技術面、基本面、動能面分析
 */

import { useState, useEffect, useMemo } from 'react';
import { fetchPotentialStocks } from './api';
import './PotentialStocks.css';

// API_BASE 改由 api.js 的 VITE_API_BASE 控制

export default function PotentialStocks({ onSelectStock }) {
  const [potentialStocks, setPotentialStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('all'); // all, 半導體, 金融保險, ETF, etc.
  const [sortBy, setSortBy] = useState('score'); // score, change, volume, price
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [page, setPage] = useState(1);
  const [volumeFilter, setVolumeFilter] = useState('medium'); // all, low, medium, high
  const pageSize = 50;

  useEffect(() => {
    loadPotentialStocks();
  }, []);

  const loadPotentialStocks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPotentialStocks();
      
      if (data.success && data.stocks) {
        // 將 API 回傳的資料轉換為前端需要的格式
        const stocks = data.stocks.map(stock => ({
          stockId: stock.id,
          name: stock.name,
          price: stock.price,
          change: stock.changePercent,
          score: stock.aiScore,
          potential: Math.max(0, (stock.potentialScore - 50) * 0.6).toFixed(1),
          volume: stock.volume,
          category: determineCategory(stock),
          reasons: generateReasons(stock),
          targets: calculateTargets(stock.price, stock.aiScore),
          riskLevel: determineRiskLevel(stock),
          industry: stock.industry,
          market: stock.market,
          rsi: stock.rsi,
          signals: stock.signals || [],
          high: stock.high,
          low: stock.low,
          open: stock.open
        }));
        
        setPotentialStocks(stocks);
        setLastUpdate(data.lastUpdate);
        console.log(`✅ 成功載入 ${stocks.length} 檔真實台股資料`);
      } else {
        throw new Error(data.error || '無法取得資料');
      }
    } catch (err) {
      console.error('載入潛力股失敗:', err);
      setError(err.message);
      // 如果 API 失敗，載入備用資料
      loadFallbackData();
    } finally {
      setLoading(false);
    }
  };

  // 備用資料（當 API 無法連接時）
  const loadFallbackData = () => {
    const fallbackStocks = [
      { stockId: '2330', name: '台積電', price: 985, change: 1.2, score: 92, industry: '半導體', market: 'twse' },
      { stockId: '2317', name: '鴻海', price: 178, change: 0.8, score: 85, industry: '電子代工', market: 'twse' },
      { stockId: '2454', name: '聯發科', price: 1450, change: 2.1, score: 88, industry: '半導體', market: 'twse' },
      { stockId: '2308', name: '台達電', price: 385, change: -0.5, score: 80, industry: '電子零組件', market: 'twse' },
      { stockId: '2881', name: '富邦金', price: 85, change: 0.6, score: 78, industry: '金融保險', market: 'twse' },
      { stockId: '2882', name: '國泰金', price: 58, change: 0.3, score: 75, industry: '金融保險', market: 'twse' },
      { stockId: '0050', name: '元大台灣50', price: 185, change: 0.8, score: 82, industry: 'ETF', market: 'twse' },
      { stockId: '0056', name: '元大高股息', price: 38, change: 0.5, score: 80, industry: 'ETF', market: 'twse' }
    ].map(s => ({
      ...s,
      potential: ((s.score - 50) * 0.5).toFixed(1),
      volume: Math.floor(Math.random() * 50000000) + 1000000,
      category: determineCategory(s),
      reasons: ['備用資料', '等待 API 連接'],
      targets: calculateTargets(s.price, s.score),
      riskLevel: 'medium',
      rsi: 50,
      signals: ['觀望']
    }));
    
    setPotentialStocks(fallbackStocks);
  };

  // 根據股票資料判斷分類
  const determineCategory = (stock) => {
    if (stock.rsi < 30 || (stock.signals && stock.signals.includes('RSI超賣'))) {
      return 'technical';
    }
    if (stock.changePercent > 3 || (stock.signals && stock.signals.includes('強勢上漲'))) {
      return 'momentum';
    }
    if (stock.industry === 'ETF' || stock.aiScore > 75) {
      return 'fundamental';
    }
    return stock.aiScore > 60 ? 'momentum' : 'technical';
  };

  // 根據技術指標產生選股理由
  const generateReasons = (stock) => {
    const reasons = [];
    
    if (stock.rsi < 30) reasons.push('RSI 超賣區，反彈機會高');
    if (stock.rsi > 70) reasons.push('RSI 強勢區，動能充沛');
    if (stock.rsi >= 40 && stock.rsi <= 60) reasons.push('RSI 中性區，觀察方向');
    
    if (stock.changePercent > 3) reasons.push('今日強勢上漲');
    if (stock.changePercent < -3) reasons.push('超跌反彈可期');
    
    if (stock.volume > 50000000) reasons.push('成交量放大，活絡交投');
    if (stock.volume > 20000000) reasons.push('成交活絡');
    
    if (stock.signals) {
      stock.signals.forEach(signal => {
        if (!reasons.includes(signal) && reasons.length < 4) {
          reasons.push(signal);
        }
      });
    }
    
    // 產業相關
    if (stock.industry === '半導體') reasons.push('半導體產業領航');
    if (stock.industry === 'ETF') reasons.push('ETF 分散風險');
    if (stock.industry === '金融保險') reasons.push('金融穩健配息');
    
    if (reasons.length < 2) {
      reasons.push('技術面觀察中');
      reasons.push('等待進場訊號');
    }
    
    return reasons.slice(0, 4);
  };

  // 計算目標價
  const calculateTargets = (price, score) => {
    const baseMultiplier = 1 + (score - 50) / 200;
    return {
      short: Math.round(price * (baseMultiplier * 1.02)),
      medium: Math.round(price * (baseMultiplier * 1.08)),
      long: Math.round(price * (baseMultiplier * 1.15))
    };
  };

  // 判斷風險等級
  const determineRiskLevel = (stock) => {
    if (stock.industry === 'ETF') return 'low';
    if (stock.industry === '金融保險' || stock.industry === '電信') return 'low';
    if (stock.aiScore > 80 && Math.abs(stock.changePercent) < 5) return 'low';
    if (stock.aiScore < 50 || Math.abs(stock.changePercent) > 7) return 'high';
    return 'medium';
  };

  // 取得所有產業類別
  const industries = useMemo(() => {
    const uniqueIndustries = [...new Set(potentialStocks.map(s => s.industry).filter(Boolean))];
    return ['all', ...uniqueIndustries.sort()];
  }, [potentialStocks]);

  // 篩選和排序
  const filteredStocks = useMemo(() => {
    // 成交量篩選範圍定義
    const volumeRanges = {
      all: { min: 0, max: Infinity },
      low: { min: 0, max: 5000000 },       // 冷門股 < 500萬
      medium: { min: 5000000, max: 50000000 },  // 適中 500萬~5000萬
      high: { min: 50000000, max: Infinity }  // 熱門股 > 5000萬
    };
    const range = volumeRanges[volumeFilter];
    return potentialStocks
      .filter(stock => {
        // 產業篩選
        if (category !== 'all' && stock.industry !== category) return false;
        // 成交量篩選
        if (stock.volume < range.min || stock.volume > range.max) return false;
        // 搜尋篩選
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          return stock.stockId.includes(term) || 
                 stock.name.toLowerCase().includes(term) ||
                 (stock.industry && stock.industry.toLowerCase().includes(term));
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'score') return b.score - a.score;
        if (sortBy === 'change') return b.change - a.change;
        if (sortBy === 'volume') return b.volume - a.volume;
        if (sortBy === 'price') return b.price - a.price;
        return 0;
      });
  }, [potentialStocks, category, sortBy, searchTerm, volumeFilter]);

  // 分頁
  const paginatedStocks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStocks.slice(start, start + pageSize);
  }, [filteredStocks, page]);

  const totalPages = Math.ceil(filteredStocks.length / pageSize);

  const heroStats = useMemo(() => {
    if (potentialStocks.length === 0) return null;
    const total = potentialStocks.length;
    const avgScore = (potentialStocks.reduce((sum, s) => sum + (s.score || 0), 0) / total).toFixed(1);
    const avgChange = (potentialStocks.reduce((sum, s) => sum + (s.change || 0), 0) / total).toFixed(2);
    const positive = potentialStocks.filter((s) => s.change > 0).length;
    const volumeAvg = Math.round(
      potentialStocks.reduce((sum, s) => sum + (s.volume || 0), 0) / total
    );
    const industryMap = potentialStocks.reduce((map, stock) => {
      if (!stock.industry) return map;
      map[stock.industry] = (map[stock.industry] || 0) + 1;
      return map;
    }, {});
    const hotIndustryEntry = Object.entries(industryMap).sort((a, b) => b[1] - a[1])[0];
    return {
      total,
      avgScore,
      avgChange,
      positiveRatio: ((positive / total) * 100).toFixed(1),
      avgVolume: volumeAvg,
      hotIndustry: hotIndustryEntry
        ? { name: hotIndustryEntry[0], count: hotIndustryEntry[1] }
        : null
    };
  }, [potentialStocks]);

  // 計算統計數據
  const stats = useMemo(() => {
    if (filteredStocks.length === 0) return { total: 0, avgScore: 0, avgChange: 0, highScore: 0, positive: 0 };
    return {
      total: filteredStocks.length,
      avgScore: (filteredStocks.reduce((sum, s) => sum + s.score, 0) / filteredStocks.length).toFixed(1),
      avgChange: (filteredStocks.reduce((sum, s) => sum + s.change, 0) / filteredStocks.length).toFixed(2),
      highScore: filteredStocks.filter(s => s.score >= 75).length,
      positive: filteredStocks.filter(s => s.change > 0).length
    };
  }, [filteredStocks]);

  const getRiskColor = (level) => {
    const colors = {
      low: '#16a34a',
      medium: '#f59e0b',
      high: '#dc2626'
    };
    return colors[level] || '#6b7280';
  };

  const formatVolume = (vol) => {
    if (vol >= 100000000) return (vol / 100000000).toFixed(1) + '億';
    if (vol >= 10000000) return (vol / 10000000).toFixed(1) + '千萬';
    if (vol >= 10000) return (vol / 10000).toFixed(0) + '萬';
    return vol.toLocaleString();
  };

  return (
    <div className="potential-stocks">
      <div className="potential-header">
        <div>
          <h2>💎 潛力股專區 - 台股證交所即時數據</h2>
          <p className="potential-subtitle">
            整合上市櫃 {potentialStocks.length} 檔股票，AI 智能評分分析
            {lastUpdate && <span className="update-time"> (更新: {new Date(lastUpdate).toLocaleTimeString()})</span>}
          </p>
        </div>
        <button className="refresh-btn" onClick={loadPotentialStocks} disabled={loading}>
          {loading ? '⏳ 載入中...' : '🔄 重新整理'}
        </button>
      </div>

      {error && (
        <div className="error-banner">
          ⚠️ {error} - 目前顯示備用資料
        </div>
      )}

      {heroStats && (
        <div className="hero-summary">
          <div className="hero-card hero-card--primary">
            <p className="hero-label">覆蓋股票</p>
            <p className="hero-value">{heroStats.total}</p>
            <p className="hero-sub">平均量 {formatVolume(heroStats.avgVolume)}</p>
          </div>
          <div className="hero-card">
            <p className="hero-label">平均 AI 評分</p>
            <p className="hero-value">{heroStats.avgScore}</p>
            <p className="hero-sub">日均漲幅 {heroStats.avgChange >= 0 ? '+' : ''}{heroStats.avgChange}%</p>
          </div>
          <div className="hero-card">
            <p className="hero-label">上漲佔比</p>
            <p className="hero-value">{heroStats.positiveRatio}%</p>
            <p className="hero-sub">市場動能 {heroStats.avgChange >= 0 ? '偏多' : '偏弱'}</p>
          </div>
          <div className="hero-card">
            <p className="hero-label">熱門產業</p>
            <p className="hero-value">{heroStats.hotIndustry?.name || '待觀察'}</p>
            <p className="hero-sub">
              {heroStats.hotIndustry ? `${heroStats.hotIndustry.count} 檔活躍` : '等待資料'}
            </p>
          </div>
        </div>
      )}

      {/* 搜尋與篩選控制 */}
      <div className="potential-controls">
        <div className="control-group search-group">
          <input
            type="text"
            placeholder="🔍 搜尋股票代號或名稱..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="search-input"
          />
        </div>

        <div className="control-group">
          <label>產業篩選</label>
          <select 
            value={category} 
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          >
            <option value="all">全部產業</option>
            {industries.filter(i => i !== 'all').map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>成交量</label>
          <select 
            value={volumeFilter} 
            onChange={(e) => { setVolumeFilter(e.target.value); setPage(1); }}
          >
            <option value="all">不限</option>
            <option value="low">冷門 (&lt;500萬)</option>
            <option value="medium">適中 (500萬~5000萬)</option>
            <option value="high">熱門 (&gt;5000萬)</option>
          </select>
        </div>

        <div className="control-group">
          <label>排序方式</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="score">AI 評分</option>
            <option value="change">漲跌幅</option>
            <option value="volume">成交量</option>
            <option value="price">股價</option>
          </select>
        </div>
      </div>

      {/* 統計摘要 */}
      {filteredStocks.length > 0 && (
        <div className="stats-summary">
          <div className="summary-item">
            <span className="summary-value">{stats.total}</span>
            <span className="summary-label">篩選標的</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{stats.avgScore}</span>
            <span className="summary-label">平均評分</span>
          </div>
          <div className="summary-item">
            <span className="summary-value" style={{ color: stats.avgChange >= 0 ? '#16a34a' : '#dc2626' }}>
              {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange}%
            </span>
            <span className="summary-label">平均漲幅</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{stats.highScore}</span>
            <span className="summary-label">高分標的</span>
          </div>
          <div className="summary-item">
            <span className="summary-value" style={{ color: '#16a34a' }}>{stats.positive}</span>
            <span className="summary-label">上漲家數</span>
          </div>
        </div>
      )}

      {/* 分頁資訊 */}
      {totalPages > 1 && (
        <div className="pagination-info">
          顯示第 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredStocks.length)} 檔，共 {filteredStocks.length} 檔
        </div>
      )}

      {/* 股票列表 */}
      <div className="potential-grid">
        {paginatedStocks.map((stock) => (
          <div
            key={stock.stockId}
            className="potential-card"
            onClick={() => onSelectStock && onSelectStock(stock.stockId)}
          >
            {/* 評分徽章 */}
            <div className="score-badge" style={{
              background: stock.score >= 85 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' :
                           stock.score >= 70 ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' :
                           stock.score >= 55 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                           'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
            }}>
              {stock.score}
            </div>

            {/* 市場標籤 */}
            <div className="market-badge" style={{
              background: stock.market === 'twse' ? '#2563eb' : '#7c3aed'
            }}>
              {stock.market === 'twse' ? '上市' : '上櫃'}
            </div>

            {/* 股票資訊 */}
            <div className="stock-info">
              <div className="stock-header-row">
                <div>
                  <span className="stock-code">{stock.stockId}</span>
                  <span className="stock-name">{stock.name}</span>
                </div>
                <span className="stock-industry">{stock.industry}</span>
              </div>

              <div className="price-row">
                <span className="current-price">${stock.price?.toFixed(2)}</span>
                <span className={`price-change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                  {stock.change >= 0 ? '▲' : '▼'} {Math.abs(stock.change).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* 技術訊號標籤 */}
            {stock.signals && stock.signals.length > 0 && (
              <div className="signal-tags">
                {stock.signals.slice(0, 3).map((signal, idx) => (
                  <span key={idx} className="signal-tag">{signal}</span>
                ))}
              </div>
            )}

            {/* 關鍵指標 */}
            <div className="key-metrics">
              <div className="metric">
                <span className="metric-label">RSI</span>
                <span className="metric-value" style={{
                  color: stock.rsi < 30 ? '#16a34a' : stock.rsi > 70 ? '#dc2626' : '#6b7280'
                }}>
                  {stock.rsi}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">風險</span>
                <span className="metric-value" style={{ color: getRiskColor(stock.riskLevel) }}>
                  {stock.riskLevel === 'low' ? '低' : stock.riskLevel === 'medium' ? '中' : '高'}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">成交量</span>
                <span className="metric-value">{formatVolume(stock.volume)}</span>
              </div>
            </div>

            {/* 選股理由 */}
            <div className="reasons">
              <div className="reasons-title">選股理由</div>
              <ul>
                {stock.reasons.slice(0, 3).map((reason, idx) => (
                  <li key={idx}>• {reason}</li>
                ))}
              </ul>
            </div>

            {/* 目標價 */}
            <div className="targets">
              <div className="target-item">
                <span className="target-label">短期</span>
                <span className="target-price">${stock.targets.short}</span>
              </div>
              <div className="target-item">
                <span className="target-label">中期</span>
                <span className="target-price">${stock.targets.medium}</span>
              </div>
              <div className="target-item">
                <span className="target-label">長期</span>
                <span className="target-price">${stock.targets.long}</span>
              </div>
            </div>

            {/* 操作按鈕 */}
            <button className="detail-btn" onClick={(e) => {
              e.stopPropagation();
              onSelectStock && onSelectStock(stock.stockId);
            }}>
              查看回測 →
            </button>
          </div>
        ))}
      </div>

      {/* 分頁控制 */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => setPage(1)} 
            disabled={page === 1}
            className="page-btn"
          >
            ⏮️
          </button>
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1}
            className="page-btn"
          >
            ◀️ 上一頁
          </button>
          <span className="page-info">
            第 {page} / {totalPages} 頁
          </span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page === totalPages}
            className="page-btn"
          >
            下一頁 ▶️
          </button>
          <button 
            onClick={() => setPage(totalPages)} 
            disabled={page === totalPages}
            className="page-btn"
          >
            ⏭️
          </button>
        </div>
      )}

      {filteredStocks.length === 0 && !loading && (
        <div className="empty-state">
          <p>😔 目前沒有符合條件的股票</p>
          <button onClick={() => { setCategory('all'); setSearchTerm(''); }}>
            清除篩選條件
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>正在從台灣證券交易所載入資料...</p>
        </div>
      )}
    </div>
  );
}
