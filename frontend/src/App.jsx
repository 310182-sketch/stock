import { useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ComposedChart,
  Scatter,
  Area
} from 'recharts';
import {
  fetchStrategies,
  fetchMockBacktest,
  fetchTwBacktest,
  searchTwStocks,
  fetchRecommendations,
  compareTwStocks
} from './api';
import StockScanner from './StockScanner';
import PotentialStocks from './PotentialStocks';
import Dashboard from './Dashboard';
import TradingViewChart from './components/TradingViewChart';

const VIEW_META = {
  dashboard: {
    eyebrow: '主控台',
    title: '儀表總覽',
    description: '統整掃描結果、潛力股與策略摘要，快速掌握目前市場焦點。',
    hints: ['點擊卡片可跳轉至相對應工具']
  },
  single: {
    eyebrow: '回測工具',
    title: '單檔歷史回測',
    description: '依序設定股票代號、期間與策略參數，再啟動回測查看盈虧軌跡。',
    hints: ['步驟 1-3 依序完成更不易遺漏', '找不到代號可用右下方搜尋']
  },
  compare: {
    eyebrow: '多檔比較',
    title: '多檔績效比較',
    description: '挑選最多六檔標的，檢視一段期間內的相對報酬表現。',
    hints: ['可套用快速選擇群組', '標的太多時請先清空再挑選']
  },
  scanner: {
    eyebrow: 'AI 掃描',
    title: 'AI 盤面掃描',
    description: '即時掃描熱門指標與訊號，快速篩出需要留意的股票。',
    hints: ['點選股票可直接帶入回測']
  },
  potential: {
    eyebrow: '潛力雷達',
    title: '潛力股清單',
    description: '依成交量、技術指標與產業風向綜合評分，列出值得追蹤的標的。',
    hints: ['依評分排序，點擊即可回測']
  }
};

const defaultMockParams = {
  initialCapital: 100000,
  days: 365,
  startPrice: 100,
  volatility: 0.02,
  strategy: 'maCross',
  strategyParams: {
    shortPeriod: 10,
    longPeriod: 50
  }
};

const defaultTwParams = {
  stockId: '2330',
  months: 6,
  initialCapital: 100000,
  strategy: 'maCross'
};

function StatCard({ label, value, suffix, emphasis }) {
  return (
    <div className={`stat-card ${emphasis ? 'stat-card--emphasis' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {suffix && <span className="stat-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function App() {
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem('compactMode') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('compactMode', compact ? '1' : '0'); } catch {}
  }, [compact]);
  const [mode, setMode] = useState('tw'); // 'mock' | 'tw'
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'single' | 'compare' | 'scanner' | 'potential'
  const [strategies, setStrategies] = useState([
    { id: 'ma-cross', name: '均線交叉', description: '簡單均線交叉策略' },
    { id: 'rsi', name: 'RSI 反轉', description: 'RSI 超買超賣反轉' }
  ]);
  const [mockParams, setMockParams] = useState(defaultMockParams);
  const [twParams, setTwParams] = useState(defaultTwParams);
  const [twSearchKeyword, setTwSearchKeyword] = useState('');
  const [twSearchResults, setTwSearchResults] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [compareSelected, setCompareSelected] = useState(['2330', '0050']);
  const [compareMonths, setCompareMonths] = useState(12);
  const [compareSeries, setCompareSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const currentViewMeta = VIEW_META[view] || VIEW_META.dashboard;
  const isFullView = view === 'dashboard' || view === 'scanner' || view === 'potential';

  useEffect(() => {
    // 初始化系統推薦標的
    const stockRecommendations = [
      // 半導體類股
      { id: '2330', name: '台積電', theme: '半導體', reason: '全球晶圓代工龍頭' },
      { id: '2454', name: '聯發科', theme: '半導體', reason: '手機晶片領導廠商' },
      { id: '2379', name: '瑞昱', theme: '半導體', reason: 'IC設計領導者' },
      { id: '3034', name: '聯詠', theme: '半導體', reason: '驅動IC龍頭' },
      
      // 科技股
      { id: '2317', name: '鴻海', theme: '電子', reason: '全球電子代工龍頭' },
      { id: '2382', name: '廣達', theme: '電子', reason: '筆電代工大廠' },
      { id: '2357', name: '華碩', theme: '電子', reason: '品牌電腦大廠' },
      
      // 金融股
      { id: '2881', name: '富邦金', theme: '金融', reason: '金控龍頭之一' },
      { id: '2882', name: '國泰金', theme: '金融', reason: '壽險與銀行雙強' },
      { id: '2886', name: '兆豐金', theme: '金融', reason: '官股金控代表' },
      { id: '2891', name: '中信金', theme: '金融', reason: '信用卡市占第一' },
      
      // ETF
      { id: '0050', name: '元大台灣50', theme: 'ETF', reason: '台股市值前50大' },
      { id: '0056', name: '元大高股息', theme: 'ETF', reason: '高股息投資首選' },
      { id: '00878', name: '國泰永續高股息', theme: 'ETF', reason: 'ESG高股息' },
      { id: '00919', name: '群益台灣精選高息', theme: 'ETF', reason: '月配息ETF' },
      { id: '006208', name: '富邦台50', theme: 'ETF', reason: '0050替代選擇' },
      
      // 傳產股
      { id: '2603', name: '長榮', theme: '航運', reason: '貨櫃航運龍頭' },
      { id: '2609', name: '陽明', theme: '航運', reason: '國營航運公司' },
      { id: '2912', name: '統一超', theme: '零售', reason: '便利商店龍頭' },
      { id: '1301', name: '台塑', theme: '塑化', reason: '台塑集團核心' },
      { id: '1303', name: '南亞', theme: '塑化', reason: '台塑集團成員' }
    ];
    
    setRecommendations(stockRecommendations);
  }, []);

  const currentMetrics = result?.metrics;

  const chartData = useMemo(() => {
    if (!result?.equityCurve) return [];
    const tradesByDate = new Map();
    (result.trades || []).forEach((t) => {
      tradesByDate.set(t.date, t);
    });

    return result.equityCurve.map((p) => ({
      ...p,
      tradeType: tradesByDate.get(p.date)?.type || null
    }));
  }, [result]);

  const handleRunBacktest = async () => {
    setLoading(true);
    setError('');
    try {
      let res;
      // Always use TW backtest
      res = await fetchTwBacktest(twParams);
      
      if (!res.success) throw new Error(res.error || '回測失敗');
      setResult(res.result || res); // tw/backtest 包在 result 裡
      setHistoricalData(res.historicalData || []);
    } catch (e) {
      setError(e.message || '發生未知錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleRunCompare = async () => {
    if (compareSelected.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await compareTwStocks({
        stocks: compareSelected,
        months: compareMonths
      });
      if (!res.success) throw new Error(res.error || '比較失敗');
      setCompareSeries(res.series || []);
    } catch (e) {
      setError(e.message || '發生未知錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchStock = async () => {
    if (!twSearchKeyword.trim()) return;
    setError('');
    try {
      const res = await searchTwStocks(twSearchKeyword.trim());
      if (!res.success) throw new Error(res.error || '搜尋失敗');
      setTwSearchResults(res.results || []);
    } catch (e) {
      setError(e.message || '搜尋錯誤');
    }
  };

  const activeStrategyDef = useMemo(
    () => strategies.find((s) => s.id === (mode === 'mock' ? mockParams.strategy : twParams.strategy)),
    [strategies, mode, mockParams.strategy, twParams.strategy]
  );

  return (
    <div className={`app-root ${compact ? 'compact' : ''}`}>
      <header className="app-header">
        <div>
          <h1>台股回測工具</h1>
          <p className="subtitle">模擬數據 + 台股實際歷史，一鍵回測策略表現</p>
          <p className="subtitle-small">
            回測 = 把既定交易規則套用到「過去資料」，觀察資產曲線與風險表現，
            並不保證未來一定複製，但能幫助你先淘汰明顯不穩定的策略。
          </p>
        </div>
        <div className="header-right">
          <div style={{ marginRight: 8 }}>
            <button
              className={compact ? 'mode-btn active' : 'mode-btn'}
              title="切換緊湊模式"
              onClick={() => setCompact((c) => !c)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M3 12h18" stroke="#334155" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M7 6h10" stroke="#334155" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M9 18h6" stroke="#334155" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          {/* Mode toggle removed - only TW history supported */}
          <div className="view-toggle">
            <button
              className={view === 'dashboard' ? 'view-btn active' : 'view-btn'}
              onClick={() => setView('dashboard')}
            >
              🏠 總覽
            </button>
            <button
              className={view === 'single' ? 'view-btn active' : 'view-btn'}
              onClick={() => setView('single')}
            >
              單檔回測
            </button>
            <button
              className={view === 'compare' ? 'view-btn active' : 'view-btn'}
              onClick={() => setView('compare')}
            >
              多檔比較
            </button>
            <button
              className={view === 'scanner' ? 'view-btn active' : 'view-btn'}
              onClick={() => setView('scanner')}
            >
              📡 AI 掃描
            </button>
            <button
              className={view === 'potential' ? 'view-btn active' : 'view-btn'}
              onClick={() => setView('potential')}
            >
              💎 潛力股
            </button>
          </div>
        </div>
      </header>

      {currentViewMeta && (
        <section className="view-intro">
          <div>
            <p className="view-eyebrow">{currentViewMeta.eyebrow}</p>
            <h2>{currentViewMeta.title}</h2>
            <p className="view-description">{currentViewMeta.description}</p>
          </div>
          {currentViewMeta.hints?.length ? (
            <div className="view-hints">
              {currentViewMeta.hints.map((hint) => (
                <span key={hint} className="hint-chip">{hint}</span>
              ))}
            </div>
          ) : null}
        </section>
      )}

      <main className={`layout ${isFullView ? 'layout-single' : 'layout-split'}`}>
        {view === 'dashboard' ? (
          <section className="panel panel-full">
            <Dashboard 
              onNavigate={(targetView) => setView(targetView)}
              onSelectStock={(stockId) => {
                setTwParams(prev => ({ ...prev, stockId }));
                setMode('tw');
                setView('single');
              }}
            />
          </section>
        ) : view === 'scanner' ? (
          <section className="panel panel-full">
            <StockScanner 
              onSelectStock={(stockId) => {
                setTwParams(prev => ({ ...prev, stockId }));
                setMode('tw');
                setView('single');
              }}
            />
          </section>
        ) : view === 'potential' ? (
          <section className="panel panel-full">
            <PotentialStocks 
              onSelectStock={(stockId) => {
                setTwParams(prev => ({ ...prev, stockId }));
                setMode('tw');
                setView('single');
              }}
            />
          </section>
        ) : (
          <>
        <section className="panel panel-left">
          {view === 'compare' ? (
            <CompareConfig
              selected={compareSelected}
              setSelected={setCompareSelected}
              months={compareMonths}
              setMonths={setCompareMonths}
              recommendations={recommendations}
            />
          ) : (
            <TwConfig
              params={twParams}
              setParams={setTwParams}
              strategies={strategies}
              activeStrategyDef={activeStrategyDef}
              searchKeyword={twSearchKeyword}
              setSearchKeyword={setTwSearchKeyword}
              searchResults={twSearchResults}
              onSearch={handleSearchStock}
            />
          )}

          {view === 'compare' ? (
            <button
              className="primary-btn run-btn"
              onClick={handleRunCompare}
              disabled={loading}
            >
              {loading ? '比較執行中…' : '開始比較'}
            </button>
          ) : (
            <button
              className="primary-btn run-btn"
              onClick={handleRunBacktest}
              disabled={loading}
            >
              {loading ? '回測執行中…' : '開始回測'}
            </button>
          )}
          {error && <div className="error-banner">{error}</div>}
        </section>

        <section className="panel panel-right">
          {view === 'compare' ? (
            <CompareChart series={compareSeries} />
          ) : currentMetrics ? (
            <>
              <MetricsGrid metrics={currentMetrics} />
              {historicalData.length > 0 && (
                <TradingViewChart data={historicalData} title={`技術分析 (${twParams.stockId})`} />
              )}
              <div className="chart-card">
                <h3>策略權益曲線</h3>
                <EquityChart data={chartData} />
              </div>
            </>
          ) : (
            <div className="placeholder">請先設定參數並執行回測，這裡將顯示結果。</div>
          )}
        </section>
          </>
        )}
      </main>
    </div>
  );
}

function MockConfig({ params, setParams, strategies, activeStrategyDef }) {
  const updateField = (field, value) => {
    setParams((prev) => ({ ...prev, [field]: value }));
  };

  const updateStrategyParam = (name, value) => {
    setParams((prev) => ({
      ...prev,
      strategyParams: { ...prev.strategyParams, [name]: value }
    }));
  };

  return (
    <div className="config-section">
      <h2>模擬數據回測</h2>
      <div className="form-grid">
        <label className="field">
          <span>初始資金</span>
          <input
            type="number"
            value={params.initialCapital}
            onChange={(e) => updateField('initialCapital', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>天數</span>
          <input
            type="number"
            value={params.days}
            onChange={(e) => updateField('days', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>起始價格</span>
          <input
            type="number"
            value={params.startPrice}
            onChange={(e) => updateField('startPrice', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>波動率</span>
          <input
            type="number"
            step="0.01"
            value={params.volatility}
            onChange={(e) => updateField('volatility', Number(e.target.value))}
          />
        </label>
        <label className="field full">
          <span>策略</span>
          <select
            value={params.strategy}
            onChange={(e) => updateField('strategy', e.target.value)}
          >
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeStrategyDef && (
        <div className="strategy-panel">
          <p className="strategy-desc">{activeStrategyDef.description}</p>
          <div className="form-grid">
            {activeStrategyDef.params?.map((p) => (
              <label key={p.name} className="field">
                <span>{p.label}</span>
                <input
                  type="number"
                  value={params.strategyParams?.[p.name] ?? p.default}
                  min={p.min}
                  max={p.max}
                  onChange={(e) => updateStrategyParam(p.name, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TwConfig({
  params,
  setParams,
  strategies,
  activeStrategyDef,
  searchKeyword,
  setSearchKeyword,
  searchResults,
  onSearch
}) {
  const updateField = (field, value) => {
    setParams((prev) => ({ ...prev, [field]: value }));
  };

  const updateStrategyParam = (name, value) => {
    setParams((prev) => ({
      ...prev,
      strategyParams: { ...prev.strategyParams, [name]: value }
    }));
  };

  return (
    <div className="config-section">
      <div className="section-card">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">步驟 1</p>
            <h3>設定股票與期間</h3>
          </div>
          <p className="section-note">輸入常見 4~5 位數代號或貼上清單中的熱門股票。</p>
        </div>
        <div className="form-grid">
          <label className="field full">
            <span>股票代號</span>
            <input
              type="text"
              value={params.stockId}
              onChange={(e) => updateField('stockId', e.target.value)}
            />
          </label>
          <label className="field">
            <span>歷史月數</span>
            <input
              type="number"
              value={params.months}
              onChange={(e) => updateField('months', Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>初始資金</span>
            <input
              type="number"
              value={params.initialCapital}
              onChange={(e) => updateField('initialCapital', Number(e.target.value))}
            />
          </label>
          <label className="field full">
            <span>策略</span>
            <select
              value={params.strategy}
              onChange={(e) => updateField('strategy', e.target.value)}
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="inline-hint">建議至少回測 6 個月以上，較能平滑掉短期噪音。</p>
      </div>

      {activeStrategyDef && (
        <div className="section-card">
          <div className="section-header">
            <div>
              <p className="section-eyebrow">步驟 2</p>
              <h3>調整策略參數</h3>
            </div>
            <p className="section-note">{activeStrategyDef.description}</p>
          </div>
          <div className="form-grid">
            {activeStrategyDef.params?.map((p) => (
              <label key={p.name} className="field">
                <span>{p.label}</span>
                <input
                  type="number"
                  value={params.strategyParams?.[p.name] ?? p.default}
                  min={p.min}
                  max={p.max}
                  onChange={(e) => updateStrategyParam(p.name, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="section-card">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">快速搜尋</p>
            <h3>查找台股代號</h3>
          </div>
          <p className="section-note">輸入名稱或代號片段即可模糊查詢，點一下直接帶入。</p>
        </div>
        <div className="search-panel">
          <div className="search-row">
            <input
              type="text"
              placeholder="輸入代號或名稱搜尋台股 (例如：2330 或 台積)"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            <button className="secondary-btn" type="button" onClick={onSearch}>
              搜尋
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="search-item"
                  onClick={() => updateField('stockId', s.id)}
                >
                  <span className="search-code">{s.id}</span>
                  <span className="search-name">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricsGrid({ metrics }) {
  return (
    <div className="metrics-grid">
      <StatCard label="總報酬率" value={`${metrics.totalReturn}%`} emphasis />
      <StatCard label="年化報酬" value={`${metrics.annualizedReturn}%`} />
      <StatCard label="最終資產" value={metrics.finalEquity.toLocaleString()} />
      <StatCard label="最大回檔" value={`${metrics.maxDrawdownPercent}%`} />
      <StatCard label="Sharpe Ratio" value={metrics.sharpeRatio} />
      <StatCard label="交易次數" value={metrics.totalTrades} />
      <StatCard label="勝率" value={`${metrics.winRate}%`} />
      <StatCard label="平均獲利" value={`${metrics.avgWin}%`} />
      <StatCard label="平均虧損" value={`${metrics.avgLoss}%`} />
    </div>
  );
}

function EquityChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-placeholder">尚無資料</div>;
  }

  const tradePoints = data.filter((d) => d.tradeType);

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05}/>
            </linearGradient>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2f3b52" />
          <XAxis dataKey="date" hide tick={{ fontSize: 10 }} />
          <YAxis
            yAxisId="left"
            orientation="left"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            stroke="#64748b"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: '#22c55e' }}
            stroke="#22c55e"
          />
          <Tooltip
            contentStyle={{
              background: '#020617',
              border: '1px solid #1e293b',
              borderRadius: 8,
              fontSize: 12
            }}
            formatter={(value, name) => {
              if (name === '權益' || name === '平滑權益') {
                return ['$' + value.toLocaleString('zh-TW', { maximumFractionDigits: 0 }), name];
              }
              return [value.toFixed(2), name];
            }}
          />
          {/* 使用 Area 圖表替代 Line，增加漸變填充 */}
          <Area
            type="monotone"
            dataKey="smoothedEquity"
            name="平滑權益"
            yAxisId="left"
            stroke="#22c55e"
            fill="url(#equityGradient)"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={true}
            animationDuration={800}
          />
          {/* 如果沒有平滑數據，顯示原始權益 */}
          {!data[0]?.smoothedEquity && (
            <Area
              type="monotone"
              dataKey="equity"
              name="權益"
              yAxisId="left"
              stroke="#22c55e"
              fill="url(#equityGradient)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={true}
              animationDuration={800}
            />
          )}
          <Line
            type="monotone"
            dataKey="price"
            name="收盤價"
            yAxisId="right"
            stroke="#38bdf8"
            dot={false}
            strokeWidth={1.8}
            strokeDasharray="5 5"
            isAnimationActive={true}
            animationDuration={800}
          />
          <Scatter
            yAxisId="right"
            data={tradePoints}
            dataKey="price"
            name="交易點"
            fill="#f97316"
            shape="circle"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function CompareConfig({ selected, setSelected, months, setMonths, recommendations }) {
  const toggleCode = (code) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code].slice(0, 6)
    );
  };

  const selectPreset = (preset) => {
    setSelected(preset);
  };

  const clearAll = () => {
    setSelected([]);
  };

  return (
    <div className="config-section">
      <div className="section-card">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">步驟 1</p>
            <h3>設定比較條件</h3>
          </div>
          <p className="section-note">最多可同時比較 6 檔標的，建議選同產業較易對照。</p>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>比較期間（月）</span>
            <input
              type="number"
              value={months}
              min={3}
              max={60}
              onChange={(e) => setMonths(Number(e.target.value))}
            />
          </label>
          <div className="field full">
            <span>已選標的（最多 6 檔）</span>
            <div className="selected-tags">
              {selected.map((code) => (
                <button
                  key={code}
                  type="button"
                  className="tag-chip"
                  onClick={() => toggleCode(code)}
                >
                  {code}
                  <span className="tag-remove">×</span>
                </button>
              ))}
              {selected.length === 0 && (
                <span className="tag-placeholder">從下方推薦點選加入比較</span>
              )}
            </div>
          </div>
          <div className="field full">
            <span>快速選擇</span>
            <div className="preset-buttons">
              <button
                type="button"
                className="preset-btn"
                onClick={() => selectPreset(['2330', '2317', '2454', '2379'])}
              >
                半導體四雄
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => selectPreset(['0050', '0056', '00878', '00919'])}
              >
                熱門 ETF
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => selectPreset(['2330', '0050', '2317', '2454'])}
              >
                績優組合
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => selectPreset(['2881', '2882', '2886', '2891'])}
              >
                金融四雄
              </button>
              <button
                type="button"
                className="preset-btn preset-btn-clear"
                onClick={clearAll}
              >
                ✕ 清空
              </button>
            </div>
          </div>
        </div>
        <p className="inline-hint">提示：選擇不同產業能看出輪動，選同產業則可辨識領頭羊。</p>
      </div>

      {recommendations.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <div>
              <p className="section-eyebrow">步驟 2</p>
              <h3>加入推薦標的</h3>
            </div>
            <p className="section-note">點擊即可加入或取消勾選（最多 6 檔）。</p>
          </div>
          <div className="recommend-list">
            {recommendations.map((item) => {
              const active = selected.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`recommend-item ${active ? 'active' : ''}`}
                  onClick={() => toggleCode(item.id)}
                >
                  <div className="recommend-main">
                    <span className="recommend-code">{item.id}</span>
                    <span className="recommend-name">{item.name}</span>
                  </div>
                  <div className="recommend-meta">
                    <span className="recommend-theme">{item.theme}</span>
                    <span className="recommend-reason">{item.reason}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CompareChart({ series }) {
  if (!series || series.length === 0) {
    return <div className="placeholder">選擇標的並點擊「開始比較」，這裡將顯示多檔績效曲線。</div>;
  }

  // 將多檔資料對齊日期，生成一個合併 data 陣列
  const dateSet = new Set();
  series.forEach((s) => s.data.forEach((p) => dateSet.add(p.date)));
  const dates = Array.from(dateSet).sort();

  const merged = dates.map((date) => {
    const row = { date };
    series.forEach((s, idx) => {
      const found = s.data.find((p) => p.date === date);
      row[`s${idx}`] = found ? found.value : null;
    });
    return row;
  });

  // 計算每檔股票的統計數據
  const stats = series.map((s) => {
    const values = s.data.map(d => d.value);
    const finalReturn = values[values.length - 1];
    const maxReturn = Math.max(...values);
    const minReturn = Math.min(...values);
    const volatility = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - finalReturn, 2), 0) / values.length
    );
    
    return {
      symbol: s.symbol,
      finalReturn: finalReturn.toFixed(2),
      maxReturn: maxReturn.toFixed(2),
      minReturn: minReturn.toFixed(2),
      volatility: volatility.toFixed(2)
    };
  });

  const colors = ['#22c55e', '#3b82f6', '#f97316', '#8b5cf6', '#06b6d4', '#ef4444'];

  return (
    <div className="chart-card">
      <h3>多檔台股報酬比較（起點 = 0%）</h3>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={merged} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
            <YAxis
              tick={{ fontSize: 10, fill: '#6b7280' }}
              stroke="#9ca3af"
              domain={['auto', 'auto']}
              label={{ value: '報酬率 (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 12
              }}
              formatter={(value) => (value != null ? `${value.toFixed(2)}%` : 'N/A')}
            />
            {series.map((s, idx) => (
              <Line
                key={s.symbol}
                type="monotone"
                dataKey={`s${idx}`}
                name={s.symbol}
                stroke={colors[idx % colors.length]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* 績效統計表 */}
      <div className="compare-stats">
        <h4>績效統計</h4>
        <div className="stats-table">
          <div className="stats-header">
            <div className="stats-cell">股票</div>
            <div className="stats-cell">總報酬</div>
            <div className="stats-cell">最高報酬</div>
            <div className="stats-cell">最低報酬</div>
            <div className="stats-cell">波動率</div>
          </div>
          {stats.map((stat, idx) => (
            <div key={stat.symbol} className="stats-row">
              <div className="stats-cell">
                <span 
                  className="stats-symbol"
                  style={{ 
                    color: colors[idx % colors.length],
                    fontWeight: 'bold'
                  }}
                >
                  {stat.symbol}
                </span>
              </div>
              <div className="stats-cell">
                <span className={stat.finalReturn >= 0 ? 'positive' : 'negative'}>
                  {stat.finalReturn >= 0 ? '+' : ''}{stat.finalReturn}%
                </span>
              </div>
              <div className="stats-cell positive">+{stat.maxReturn}%</div>
              <div className="stats-cell negative">{stat.minReturn}%</div>
              <div className="stats-cell">{stat.volatility}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Recommendations({ items, onSelect }) {
  return (
    <div className="recommend-panel">
      <div className="recommend-header">
        <span className="recommend-title">系統推薦標的</span>
        <span className="recommend-subtitle">常用台股／ETF，點擊可帶入代號</span>
      </div>
      <div className="recommend-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="recommend-item"
            onClick={() => onSelect(item.id)}
          >
            <div className="recommend-main">
              <span className="recommend-code">{item.id}</span>
              <span className="recommend-name">{item.name}</span>
            </div>
            <div className="recommend-meta">
              <span className="recommend-theme">{item.theme}</span>
              <span className="recommend-reason">{item.reason}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
