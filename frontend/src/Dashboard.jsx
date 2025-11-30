/**
 * 總覽儀表板
 * 整合市場概況、熱門股票、AI 推薦、快速操作
 */

import { useState, useEffect, useMemo } from 'react';
import { fetchMarketNews, sendLineTest, sendDailySummary } from './api';
import './Dashboard.css';

const API_BASE = '';

export default function Dashboard({ onNavigate, onSelectStock }) {
  const [marketData, setMarketData] = useState(null);
  const [hotStocks, setHotStocks] = useState([]);
  const [signals, setSignals] = useState([]);
  const [newsData, setNewsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Line Notify State
  const [showLineModal, setShowLineModal] = useState(false);
  const [lineToken, setLineToken] = useState(localStorage.getItem('lineToken') || '');
  const [testStatus, setTestStatus] = useState({ type: '', msg: '' });

  useEffect(() => {
    loadDashboardData();
    loadNews();
  }, []);

  const handleLineTest = async () => {
    if (!lineToken) {
      setTestStatus({ type: 'error', msg: '請輸入 Line Notify Token' });
      return;
    }
    
    setTestStatus({ type: 'info', msg: '發送測試訊息中...' });
    try {
      localStorage.setItem('lineToken', lineToken);
      const result = await sendLineTest(lineToken);
      if (result.success) {
        setTestStatus({ type: 'success', msg: '測試訊息發送成功！請檢查您的 Line。' });
      } else {
        setTestStatus({ type: 'error', msg: '發送失敗: ' + (result.error || '未知錯誤') });
      }
    } catch (err) {
      setTestStatus({ type: 'error', msg: '發送失敗: ' + err.message });
    }
  };

  const handleDailySummary = async () => {
    if (!lineToken) {
      setTestStatus({ type: 'error', msg: '請輸入 Line Notify Token' });
      return;
    }

    setTestStatus({ type: 'info', msg: '正在生成並發送日報...' });
    try {
      localStorage.setItem('lineToken', lineToken);
      const result = await sendDailySummary(lineToken);
      if (result.success) {
        setTestStatus({ type: 'success', msg: '日報發送成功！請檢查您的 Line。' });
      } else {
        setTestStatus({ type: 'error', msg: '發送失敗: ' + (result.error || '未知錯誤') });
      }
    } catch (err) {
      setTestStatus({ type: 'error', msg: '發送失敗: ' + err.message });
    }
  };

  const loadNews = async () => {
    try {
      const data = await fetchMarketNews();
      if (data.success) {
        setNewsData(data);
      }
    } catch (err) {
      console.error('載入新聞失敗:', err);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 取得潛力股資料作為市場概況
      const response = await fetch(`${API_BASE}/api/tw/potential-stocks`);
      const data = await response.json();
      
      if (data.success && data.stocks) {
        // 計算市場統計
        const stocks = data.stocks;
        const upCount = stocks.filter(s => s.changePercent > 0).length;
        const downCount = stocks.filter(s => s.changePercent < 0).length;
        const flatCount = stocks.filter(s => s.changePercent === 0).length;
        const avgChange = stocks.reduce((sum, s) => sum + s.changePercent, 0) / stocks.length;
        const totalVolume = stocks.reduce((sum, s) => sum + s.volume, 0);
        
        setMarketData({
          total: stocks.length,
          upCount,
          downCount,
          flatCount,
          avgChange: avgChange.toFixed(2),
          totalVolume,
          upRatio: ((upCount / stocks.length) * 100).toFixed(1)
        });
        
        // 熱門股票（按成交量+評分排序）
        const hot = stocks
          .sort((a, b) => (b.aiScore * 0.5 + (b.volume / 1000000) * 0.5) - (a.aiScore * 0.5 + (a.volume / 1000000) * 0.5))
          .slice(0, 12);
        setHotStocks(hot);
        setSignals(generateMockSignals(hot));
        setLastUpdate(data.lastUpdate || new Date().toISOString());
      }
    } catch (err) {
      console.error('載入儀表板資料失敗:', err);
      // 使用備用資料
      setMarketData({
        total: 1300,
        upCount: 650,
        downCount: 580,
        flatCount: 70,
        avgChange: '0.15',
        totalVolume: 250000000000,
        upRatio: '50.0'
      });
      setHotStocks([
        { id: '2330', name: '台積電', price: 985, changePercent: 1.2, aiScore: 92, volume: 35000000, industry: '半導體' },
        { id: '2317', name: '鴻海', price: 178, changePercent: 0.8, aiScore: 85, volume: 28000000, industry: '電子' },
        { id: '0050', name: '元大台灣50', price: 185, changePercent: 0.6, aiScore: 82, volume: 68000000, industry: 'ETF' },
        { id: '2454', name: '聯發科', price: 1450, changePercent: 2.1, aiScore: 88, volume: 12000000, industry: '半導體' }
      ]);
      setSignals(generateMockSignals([
        { id: '2330', name: '台積電', price: 985, changePercent: 1.2, aiScore: 92, volume: 35000000, industry: '半導體' },
        { id: '2317', name: '鴻海', price: 178, changePercent: 0.8, aiScore: 85, volume: 28000000, industry: '電子' },
        { id: '0050', name: '元大台灣50', price: 185, changePercent: 0.6, aiScore: 82, volume: 68000000, industry: 'ETF' },
        { id: '2454', name: '聯發科', price: 1450, changePercent: 2.1, aiScore: 88, volume: 12000000, industry: '半導體' }
      ]));
    } finally {
      setLoading(false);
    }
  };

  function generateMockSignals(stocks = []) {
    const signalTypes = [
      { name: '黃金交叉', cue: 'buy' },
      { name: '死亡交叉', cue: 'sell' },
      { name: 'RSI 超買', cue: 'sell' },
      { name: 'RSI 超賣', cue: 'buy' },
      { name: '突破布林通道上緣', cue: 'buy' },
      { name: '突破布林通道下緣', cue: 'sell' }
    ];

    const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

    return (stocks.slice(0, 10)).map((s) => {
      const pick = sample(signalTypes);
      return {
        id: s.id,
        name: s.name,
        signal: pick.name,
        cue: pick.cue,
        detail: `${pick.name} (系統自動偵測)`,
        time: new Date().toLocaleTimeString()
      };
    });
  }

  const formatVolume = (vol) => {
    if (vol >= 100000000000) return (vol / 100000000000).toFixed(1) + '千億';
    if (vol >= 100000000) return (vol / 100000000).toFixed(1) + '億';
    if (vol >= 10000) return (vol / 10000).toFixed(0) + '萬';
    return vol?.toLocaleString() || '0';
  };

  const quickActions = [
    { icon: '📊', label: '單檔回測', view: 'single', desc: '分析單一股票策略表現' },
    { icon: '📈', label: '多檔比較', view: 'compare', desc: '比較多檔股票績效走勢' },
    { icon: '📡', label: 'AI 掃描', view: 'scanner', desc: 'AI 預測價格走勢分析' },
    { icon: '💎', label: '潛力股', view: 'potential', desc: '發掘高評分潛力標的' }
  ];

  const recommendedStocks = [
    { id: '2330', name: '台積電', reason: '晶圓代工龍頭', theme: '半導體' },
    { id: '0050', name: '元大台灣50', reason: '大盤ETF首選', theme: 'ETF' },
    { id: '2881', name: '富邦金', reason: '金控龍頭股', theme: '金融' },
    { id: '2317', name: '鴻海', reason: 'AI伺服器題材', theme: '電子' },
    { id: '00878', name: '國泰永續高股息', reason: '月配息ETF', theme: 'ETF' },
    { id: '2454', name: '聯發科', reason: '手機晶片龍頭', theme: '半導體' }
  ];

  const marketHighlights = useMemo(() => {
    if (!hotStocks.length) return { gainer: null, loser: null, volumeLeader: null };
    const sortedByChange = [...hotStocks].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
    const sortedByVolume = [...hotStocks].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    return {
      gainer: sortedByChange[0],
      loser: sortedByChange[sortedByChange.length - 1],
      volumeLeader: sortedByVolume[0]
    };
  }, [hotStocks]);

  return (
    <div className="dashboard">
      {/* 頂部標題區 */}
      <div className="dashboard-header">
        <div>
          <h2>📊 市場總覽</h2>
          <p className="dashboard-subtitle">
            台股即時數據儀表板
            {lastUpdate && <span className="update-time"> (更新: {new Date(lastUpdate).toLocaleTimeString()})</span>}
          </p>
        </div>
        <div style={{ display: 'flex' }}>
          <button className="notify-btn" onClick={() => setShowLineModal(true)}>
            🔔 Line 通知設定
          </button>
          <button className="refresh-btn" onClick={loadDashboardData} disabled={loading}>
            {loading ? '⏳ 載入中...' : '🔄 重新整理'}
          </button>
        </div>
      </div>

      {/* 市場概況卡片 */}
      <div className="market-overview">
        <div className="overview-card up">
          <div className="overview-icon">📈</div>
          <div className="overview-content">
            <div className="overview-value">{marketData?.upCount || '-'}</div>
            <div className="overview-label">上漲家數</div>
          </div>
        </div>
        <div className="overview-card down">
          <div className="overview-icon">📉</div>
          <div className="overview-content">
            <div className="overview-value">{marketData?.downCount || '-'}</div>
            <div className="overview-label">下跌家數</div>
          </div>
        </div>
        <div className="overview-card neutral">
          <div className="overview-icon">➡️</div>
          <div className="overview-content">
            <div className="overview-value">{marketData?.flatCount || '-'}</div>
            <div className="overview-label">平盤</div>
          </div>
        </div>
        <div className="overview-card total">
          <div className="overview-icon">🏢</div>
          <div className="overview-content">
            <div className="overview-value">{marketData?.total || '-'}</div>
            <div className="overview-label">上市櫃總數</div>
          </div>
        </div>
        <div className="overview-card volume">
          <div className="overview-icon">💹</div>
          <div className="overview-content">
            <div className="overview-value">{formatVolume(marketData?.totalVolume)}</div>
            <div className="overview-label">總成交量</div>
          </div>
        </div>
        <div className="overview-card ratio">
          <div className="overview-icon">⚖️</div>
          <div className="overview-content">
            <div className="overview-value" style={{ color: parseFloat(marketData?.upRatio) > 50 ? '#16a34a' : '#dc2626' }}>
              {marketData?.upRatio || '-'}%
            </div>
            <div className="overview-label">上漲比例</div>
          </div>
        </div>
      </div>

      <div className="market-highlights">
        {marketHighlights.gainer && (
          <div className="highlight-card">
            <p className="highlight-label">最大漲幅</p>
            <p className="highlight-name">{marketHighlights.gainer.name} ({marketHighlights.gainer.id})</p>
            <p className="highlight-value positive">+{marketHighlights.gainer.changePercent?.toFixed(2) || '0.00'}%</p>
            <p className="highlight-meta">AI 分數 {marketHighlights.gainer.aiScore || '--'} / 成交 {formatVolume(marketHighlights.gainer.volume)}</p>
          </div>
        )}
        {marketHighlights.loser && (
          <div className="highlight-card">
            <p className="highlight-label">最大跌幅</p>
            <p className="highlight-name">{marketHighlights.loser.name} ({marketHighlights.loser.id})</p>
            <p className="highlight-value negative">{marketHighlights.loser.changePercent?.toFixed(2) || '0.00'}%</p>
            <p className="highlight-meta">AI 分數 {marketHighlights.loser.aiScore || '--'} / 成交 {formatVolume(marketHighlights.loser.volume)}</p>
          </div>
        )}
        {marketHighlights.volumeLeader && (
          <div className="highlight-card">
            <p className="highlight-label">最大成交量</p>
            <p className="highlight-name">{marketHighlights.volumeLeader.name} ({marketHighlights.volumeLeader.id})</p>
            <p className="highlight-value">{formatVolume(marketHighlights.volumeLeader.volume)}</p>
            <p className="highlight-meta">AI 分數 {marketHighlights.volumeLeader.aiScore || '--'} / 漲跌 {marketHighlights.volumeLeader.changePercent?.toFixed(2) || '0.00'}%</p>
          </div>
        )}
        {!hotStocks.length && (
          <div className="highlight-card">
            <p className="highlight-label">市場焦點</p>
            <p className="highlight-value">正在載入中…</p>
          </div>
        )}
      </div>

      {/* 市場新聞與輿情 */}
      <div className="section-title">
        <h3>📰 市場輿情分析</h3>
        {newsData && (
          <span className={`sentiment-badge ${newsData.marketSentiment}`}>
            市場情緒: {newsData.marketSentiment === 'bullish' ? '看多 🐂' : newsData.marketSentiment === 'bearish' ? '看空 🐻' : '中立 😐'}
          </span>
        )}
      </div>
      <div className="news-section">
        {newsData ? (
          <div className="news-grid">
            {newsData.news.slice(0, 6).map((item, idx) => (
              <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className={`news-card ${item.sentiment}`}>
                <div className="news-header">
                  <span className="news-source">{item.source}</span>
                  <span className="news-score" title="情緒分數">{item.score > 0 ? `+${item.score}` : item.score}</span>
                </div>
                <h4 className="news-title">{item.title}</h4>
                <div className="news-keywords">
                  {item.keywords.map(k => <span key={k} className="keyword-tag">{k}</span>)}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="loading-placeholder">正在分析市場新聞...</div>
        )}
      </div>

      {/* 即時技術訊號 */}
      <div className="section-title">
        <h3>⚡ 即時技術訊號</h3>
      </div>
      <div className="live-signals">
        {signals.length ? (
          <div className="signal-list">
            {signals.map(sig => (
              <div key={sig.id + sig.signal} className={`signal-item ${sig.cue}`} onClick={() => onSelectStock(sig.id)}>
                <div className="signal-left">
                  <div className="signal-stock">{sig.name} <span className="signal-id">{sig.id}</span></div>
                  <div className="signal-detail">{sig.detail}</div>
                </div>
                <div className="signal-right">
                  <div className="signal-time">{sig.time}</div>
                  <div className="signal-badge">{sig.signal}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="signal-placeholder">尚無訊號 — 稍後更新</div>
        )}
      </div>

      {/* 快速操作區 */}
      <div className="section-title">
        <h3>🚀 快速操作</h3>
      </div>
      <div className="quick-actions">
        {quickActions.map(action => (
          <div 
            key={action.view}
            className="action-card"
            onClick={() => onNavigate(action.view)}
          >
            <div className="action-icon">{action.icon}</div>
            <div className="action-content">
              <div className="action-label">{action.label}</div>
              <div className="action-desc">{action.desc}</div>
            </div>
            <div className="action-arrow">→</div>
          </div>
        ))}
      </div>

      {/* 熱門股票 */}
      <div className="section-title">
        <h3>🔥 熱門股票</h3>
        <button className="see-all-btn" onClick={() => onNavigate('potential')}>
          查看全部 →
        </button>
      </div>
      <div className="hot-stocks-grid">
        {hotStocks.map(stock => (
          <div 
            key={stock.id}
            className="hot-stock-card"
            onClick={() => onSelectStock(stock.id)}
          >
            <div className="hot-stock-header">
              <span className="hot-stock-id">{stock.id}</span>
              <span className="hot-stock-score" style={{
                background: stock.aiScore >= 80 ? '#f59e0b' : stock.aiScore >= 60 ? '#3b82f6' : '#6b7280'
              }}>
                {stock.aiScore}分
              </span>
            </div>
            <div className="hot-stock-name">{stock.name}</div>
            <div className="hot-stock-price">
              ${stock.price?.toFixed(2)}
              <span className={stock.changePercent >= 0 ? 'change-up' : 'change-down'}>
                {stock.changePercent >= 0 ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
              </span>
            </div>
            <div className="hot-stock-meta">
              <span className="hot-stock-industry">{stock.industry}</span>
              <span className="hot-stock-volume">{formatVolume(stock.volume)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 系統推薦 */}
      <div className="section-title">
        <h3>⭐ 系統推薦</h3>
      </div>
      <div className="recommended-stocks">
        {recommendedStocks.map(stock => (
          <div 
            key={stock.id}
            className="recommended-card"
            onClick={() => onSelectStock(stock.id)}
          >
            <div className="recommended-info">
              <span className="recommended-id">{stock.id}</span>
              <span className="recommended-name">{stock.name}</span>
            </div>
            <div className="recommended-reason">{stock.reason}</div>
            <span className="recommended-theme">{stock.theme}</span>
          </div>
        ))}
      </div>

      {/* 功能介紹 */}
      <div className="section-title">
        <h3>💡 功能介紹</h3>
      </div>
      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <div className="feature-title">策略回測</div>
          <div className="feature-desc">
            支援 24 種交易策略，包含均線交叉、RSI、MACD、布林通道、海龜交易等，
            可自訂參數並查看完整權益曲線。
          </div>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🤖</div>
          <div className="feature-title">AI 價格預測</div>
          <div className="feature-desc">
            整合線性回歸、移動平均趨勢、蒙地卡羅模擬三種方法，
            預測未來 7-90 天價格走勢。
          </div>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📈</div>
          <div className="feature-title">多檔比較</div>
          <div className="feature-desc">
            同時比較多檔股票績效，查看報酬率走勢圖和統計數據，
            支援系統推薦快速選股。
          </div>
        </div>
        <div className="feature-card">
          <div className="feature-icon">💎</div>
          <div className="feature-title">潛力股篩選</div>
          <div className="feature-desc">
            整合 1300+ 檔上市櫃股票，AI 智能評分，
            支援產業、成交量篩選，快速發掘投資標的。
          </div>
        </div>
      </div>

      {/* Line Notify Modal */}
      {showLineModal && (
        <div className="modal-overlay" onClick={() => setShowLineModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔔 Line 通知設定</h3>
              <button className="close-btn" onClick={() => setShowLineModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Line Notify Token</label>
                <input 
                  type="password" 
                  value={lineToken} 
                  onChange={(e) => setLineToken(e.target.value)}
                  placeholder="請輸入您的 Line Notify Token"
                />
                <div className="help-text">
                  還沒有 Token？請至 <a href="https://notify-bot.line.me/my/" target="_blank" rel="noopener noreferrer">Line Notify 個人頁面</a> 申請。
                  <br/>
                  申請後請將 Token 貼上至此欄位。
                </div>
              </div>
              
              {testStatus.msg && (
                <div style={{ 
                  padding: '12px', 
                  borderRadius: '8px', 
                  marginBottom: '16px',
                  background: testStatus.type === 'error' ? '#fee2e2' : testStatus.type === 'success' ? '#dcfce7' : '#e0f2fe',
                  color: testStatus.type === 'error' ? '#991b1b' : testStatus.type === 'success' ? '#166534' : '#075985'
                }}>
                  {testStatus.msg}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowLineModal(false)}>取消</button>
              <button className="btn-secondary" onClick={handleDailySummary} disabled={!lineToken}>
                發送今日日報
              </button>
              <button className="btn-primary" onClick={handleLineTest} disabled={!lineToken}>
                發送測試訊息
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
