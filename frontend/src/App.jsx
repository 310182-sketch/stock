import { useEffect, useMemo } from 'react'
import {
  Activity,
  AreaChart,
  BarChart3,
  Brain,
  Flame,
  LineChart,
  Newspaper,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { useMarketStore } from './stores/useMarketStore'
import Sparkline from './components/Sparkline'

function Badge({ tone = 'neutral', children }) {
  const toneClass = {
    bull: 'text-bull-light bg-bull/10 border-bull/30',
    bear: 'text-bear-light bg-bear/10 border-bear/30',
    neutral: 'text-neutral-light bg-bg-secondary/60 border-bg-card/60',
  }[tone]

  return (
    <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  )
}

function App() {
  const watchlist = useMarketStore((state) => state.watchlist)
  const potentialStocks = useMarketStore((state) => state.potentialStocks)
  const news = useMarketStore((state) => state.news)
  const sentiment = useMarketStore((state) => state.sentiment)
  const loading = useMarketStore((state) => state.loading)
  const error = useMarketStore((state) => state.error)
  const lastUpdated = useMarketStore((state) => state.lastUpdated)
  const refreshAll = useMarketStore((state) => state.refreshAll)

  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const upCount = useMemo(() => watchlist.filter((w) => (w.changePercent ?? 0) > 0).length, [watchlist])

  const metrics = useMemo(
    () => [
      {
        label: '市場情緒',
        value: sentiment === 'bullish' ? '偏多' : sentiment === 'bearish' ? '偏空' : '中性',
        icon: Brain,
        tone: sentiment === 'bearish' ? 'bear' : sentiment === 'bullish' ? 'bull' : 'neutral',
      },
      {
        label: '潛力股',
        value: `${potentialStocks.length || 0} 檔`,
        icon: Zap,
        tone: potentialStocks.length > 0 ? 'bull' : 'neutral',
      },
      {
        label: '漲跌家數',
        value: `${upCount} / ${Math.max(watchlist.length - upCount, 0)}`,
        icon: Activity,
        tone: 'neutral',
      },
      {
        label: '最後更新',
        value: lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '等待同步',
        icon: ShieldCheck,
        tone: 'neutral',
      },
    ],
    [sentiment, potentialStocks.length, upCount, watchlist.length, lastUpdated],
  )

  const signals = useMemo(
    () => [
      { label: 'AI 預測', value: sentiment === 'bearish' ? '看空' : '看多', icon: Flame, tone: sentiment === 'bearish' ? 'bear' : 'bull' },
      { label: '量價背離', value: '監控中', icon: BarChart3, tone: 'neutral' },
      { label: '趨勢強度', value: upCount >= (watchlist.length || 1) / 2 ? '偏強' : '偏弱', icon: LineChart, tone: upCount >= (watchlist.length || 1) / 2 ? 'bull' : 'bear' },
      { label: '超買/超賣', value: '等待即時 RSI', icon: AreaChart, tone: 'neutral' },
    ],
    [sentiment, upCount, watchlist.length],
  )

  const tickerList = watchlist.length ? watchlist : []

  const sectorCards = potentialStocks.slice(0, 6)

  const newsItems = news.slice(0, 4)

  const formatChange = (change) => {
    if (change === undefined || change === null) return '0.0%'
    const num = Number(change)
    const sign = Number.isFinite(num) && num > 0 ? '+' : ''
    return Number.isFinite(num) ? `${sign}${num.toFixed(2)}%` : `${change}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-primary via-[#0c1434] to-[#0b193c] text-neutral-light">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-neutral-light/70">Stock AI Pro</p>
            <h1 className="text-3xl md:text-4xl font-semibold mt-1">全新前端工作站草案</h1>
            <p className="text-neutral-light/70 mt-2">更豐富的互動圖表、AI 戰情室、回測競技場與市場熱力圖。</p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <button
              className="self-start md:self-end px-4 py-2 rounded-lg border border-bg-card/60 bg-bg-secondary/80 text-sm hover:bg-bg-card/60"
              onClick={refreshAll}
              disabled={loading}
            >
              {loading ? '同步中…' : '重新整理 /api 資料'}
            </button>
            <div className="ticker-tape">
              <div className="flex gap-6 animate-ticker">
                {(tickerList.length ? tickerList : [{ symbol: 'LOADING', changePercent: 0, volume: '-' }]).map((item) => (
                  <div key={item.symbol} className="flex items-center gap-2">
                    <span className="font-semibold">{item.symbol}</span>
                    <span className={(item.changePercent ?? 0) < 0 ? 'text-bear-light' : 'text-bull-light'}>
                      {formatChange(item.changePercent)}
                    </span>
                    <span className="text-neutral-light/60 text-xs">Vol {item.volume || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-bear-light">⚠️ {error}</p>}
          </div>
        </header>

        {(loading || error) && (
          <div className={`glass-card p-3 text-sm flex items-center justify-between ${loading ? 'border-neutral/30' : 'border-bear-light/40'}`}>
            <span className="font-semibold">狀態</span>
            <span className="text-neutral-light/80">
              {loading ? '同步中，請稍候…' : `⚠️ ${error}`}
            </span>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, icon: Icon, tone }) => (
            <article key={label} className="metric-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-neutral-light/70">{label}</p>
                <Badge tone={tone}>{tone === 'bull' ? 'BULL' : tone === 'bear' ? 'BEAR' : 'NEUTRAL'}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-bg-secondary/80 border border-bg-card/60">
                  <Icon className="w-5 h-5 text-neutral-light" />
                </span>
                <p className="text-xl font-semibold">{value}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="glass-card p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-neutral-light/70">市場熱力圖</p>
                <h2 className="text-2xl font-semibold">資金流向與板塊對比</h2>
              </div>
              <Badge tone="neutral">即將接軌後端 /api</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(sectorCards.length ? sectorCards : potentialStocks.slice(0, 6)).map((item, idx) => (
                <div key={item.id || item.name || idx} className="aspect-video rounded-lg bg-gradient-to-br from-bg-secondary to-bg-card flex items-center justify-between px-3 py-2 border border-bg-card/60">
                  <div>
                    <p className="text-sm text-neutral-light/70">{item.industry || '未分類'}</p>
                    <p className={`text-lg font-semibold ${(item.changePercent ?? 0) < 0 ? 'text-bear-light' : 'text-bull-light'}`}>
                      {formatChange(item.changePercent ?? item.change)}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-bg-primary/60 border border-bg-card/60 flex items-center justify-center text-xs text-neutral-light/70">
                    {item.id || item.stockId || idx + 1}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-light/70">AI 戰情室</p>
                <h2 className="text-xl font-semibold">信心儀表板</h2>
              </div>
              <Badge tone="bull">高信心</Badge>
            </div>
            <div className="space-y-3">
              {signals.map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-bg-card/60 bg-bg-secondary/80 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-bg-card/60 border border-bg-card/60">
                      <Icon className="w-4 h-4 text-neutral-light" />
                    </span>
                    <div>
                      <p className="text-sm text-neutral-light/70">{label}</p>
                      <p className="font-semibold">{value}</p>
                    </div>
                  </div>
                  <Badge tone={tone}>{tone === 'bull' ? '多' : tone === 'bear' ? '空' : '中性'}</Badge>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-neutral-light/70">即時觀察</p>
                <h2 className="text-xl font-semibold">自選股</h2>
              </div>
              <Badge tone="neutral">待接 API</Badge>
            </div>
            <div className="space-y-3">
              {(watchlist.length ? watchlist : tickerList).map((item) => (
                <div key={item.symbol} className="flex items-center justify-between rounded-lg border border-bg-card/60 bg-bg-secondary/80 px-3 py-2 gap-3">
                  <div className="min-w-[96px]">
                    <p className="font-semibold">{item.symbol}</p>
                    <p className="text-sm text-neutral-light/70">{item.name || '待載入'}</p>
                  </div>
                  <div className="flex-1 hidden md:block">
                    <Sparkline symbol={item.symbol} />
                  </div>
                  <div className="text-right min-w-[90px]">
                    <p className={(item.changePercent ?? 0) < 0 ? 'text-bear-light' : 'text-bull-light'}>{formatChange(item.changePercent ?? item.change)}</p>
                    <p className="text-xs text-neutral-light/60">Vol {item.volume || '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="glass-card p-6 space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-light/70">市場新聞</p>
                <h2 className="text-xl font-semibold">情緒時間軸</h2>
              </div>
              <div className="flex gap-2">
                <Badge tone="bull">正向</Badge>
                <Badge tone="neutral">即將串接</Badge>
              </div>
            </div>
            <div className="space-y-2">
              {newsItems.map((item, i) => (
                <div key={item.title || i} className="rounded-lg border border-bg-card/60 bg-bg-secondary/80 px-3 py-2 flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-bg-card/60 border border-bg-card/60">
                    <Newspaper className="w-4 h-4 text-neutral-light" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-neutral-light/70">{item.label ? `情緒: ${item.label}` : '等待 /api/news'}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}

export default App
