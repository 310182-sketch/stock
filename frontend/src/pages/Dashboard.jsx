import { useEffect, memo } from 'react'
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
import { useMarketStore } from '@/stores/useMarketStore'
import Sparkline from '@/components/Sparkline'
import StockModal from '@/components/stock/StockModal'

const Badge = memo(function Badge({ tone = 'neutral', children }) {
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
})

export default function Dashboard() {
  const watchlist = useMarketStore((state) => state.watchlist)
  const potentialStocks = useMarketStore((state) => state.potentialStocks)
  const news = useMarketStore((state) => state.news)
  const sentiment = useMarketStore((state) => state.sentiment)
  const loading = useMarketStore((state) => state.loading)
  const error = useMarketStore((state) => state.error)
  const refreshAll = useMarketStore((state) => state.refreshAll)
  const selectedStock = useMarketStore((state) => state.selectedStock)
  const setSelectedStock = useMarketStore((state) => state.setSelectedStock)

  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const upCount = watchlist.filter((s) => Number(s.changePercent) > 0).length
  const downCount = watchlist.filter((s) => Number(s.changePercent) < 0).length

  const sentimentTone =
    sentiment === 'bullish' ? 'bull' : sentiment === 'bearish' ? 'bear' : 'neutral'

  return (
    <div className="min-h-screen bg-bg-primary text-neutral-light p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">🤖 AI 股票儀表板</h1>
          <p className="text-neutral-light/60 mt-1">
            即時市場資訊與智能策略分析
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={refreshAll}
            disabled={loading}
            className="px-4 py-2 bg-bull-light/20 hover:bg-bull-light/30 text-bull-light rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? '更新中...' : '🔄 刷新資料'}
          </button>
        </div>
      </header>

      {/* Status Bar */}
      {(loading || error) && (
        <div
          className={`glass-card p-3 flex items-center gap-3 ${
            error ? 'border-bear-light/30' : 'border-bull-light/30'
          }`}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-bull-light border-t-transparent"></div>
              <span className="text-sm">正在載入資料...</span>
            </>
          ) : (
            error && (
              <>
                <ShieldCheck className="w-4 h-4 text-bear-light" />
                <span className="text-sm text-bear-light">錯誤: {error}</span>
              </>
            )
          )}
        </div>
      )}

      {/* Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="metric-card">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-bull-light" />
            <span className="text-sm text-neutral-light/70">市場情緒</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold capitalize">{sentiment}</span>
            <Badge tone={sentimentTone}>
              {sentiment === 'bullish' ? '看漲' : sentiment === 'bearish' ? '看跌' : '中性'}
            </Badge>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-bull-light" />
            <span className="text-sm text-neutral-light/70">潛力股數量</span>
          </div>
          <div className="text-3xl font-bold">{potentialStocks.length}</div>
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-3 mb-2">
            <LineChart className="w-5 h-5 text-bull-light" />
            <span className="text-sm text-neutral-light/70">上漲股票</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-bull-light">{upCount}</span>
            <span className="text-sm text-neutral-light/60">/{watchlist.length}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-3 mb-2">
            <AreaChart className="w-5 h-5 text-bear-light" />
            <span className="text-sm text-neutral-light/70">下跌股票</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-bear-light">{downCount}</span>
            <span className="text-sm text-neutral-light/60">/{watchlist.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Watchlist Section */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-6 h-6 text-bull-light" />
            <h2 className="text-2xl font-bold">自選股列表</h2>
          </div>
          <div className="space-y-3">
            {watchlist.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => setSelectedStock(stock)}
                className="w-full glass-card p-4 hover:bg-bg-card/80 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xl font-bold">{stock.symbol}</span>
                    <span className="ml-3 text-neutral-light/70">{stock.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      ${Number(stock.price || 0).toFixed(2)}
                    </div>
                    {stock.changePercent !== undefined && (
                      <Badge tone={Number(stock.changePercent) >= 0 ? 'bull' : 'bear'}>
                        {Number(stock.changePercent) >= 0 ? '+' : ''}
                        {Number(stock.changePercent).toFixed(2)}%
                      </Badge>
                    )}
                  </div>
                </div>
                <Sparkline symbol={stock.symbol} months={3} />
              </button>
            ))}
          </div>
        </div>

        {/* Market Heatmap */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Flame className="w-6 h-6 text-bull-light" />
            <h2 className="text-2xl font-bold">市場熱力圖</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {potentialStocks.slice(0, 6).map((stock, i) => (
              <button
                key={i}
                onClick={() => setSelectedStock(stock)}
                className="glass-card p-3 hover:bg-bg-card/80 transition-all text-center cursor-pointer"
              >
                <div className="text-lg font-bold">{stock.symbol}</div>
                <div className="text-xs text-neutral-light/60 mb-2">{stock.name}</div>
                <Badge
                  tone={
                    Number(stock.changePercent) > 0 ? 'bull' : Number(stock.changePercent) < 0 ? 'bear' : 'neutral'
                  }
                >
                  {Number(stock.changePercent) >= 0 ? '+' : ''}
                  {Number(stock.changePercent || 0).toFixed(2)}%
                </Badge>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Signals Board */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="w-6 h-6 text-bull-light" />
          <h2 className="text-2xl font-bold">AI 戰情室</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-4 border-l-4 border-bull-light">
            <div className="text-sm text-neutral-light/70 mb-1">強烈買入訊號</div>
            <div className="text-3xl font-bold text-bull-light">
              {potentialStocks.filter((s) => Number(s.changePercent) > 2).length}
            </div>
          </div>
          <div className="glass-card p-4 border-l-4 border-neutral-light">
            <div className="text-sm text-neutral-light/70 mb-1">持有觀望訊號</div>
            <div className="text-3xl font-bold">
              {potentialStocks.filter((s) => Number(s.changePercent) >= -2 && Number(s.changePercent) <= 2).length}
            </div>
          </div>
          <div className="glass-card p-4 border-l-4 border-bear-light">
            <div className="text-sm text-neutral-light/70 mb-1">賣出警示訊號</div>
            <div className="text-3xl font-bold text-bear-light">
              {potentialStocks.filter((s) => Number(s.changePercent) < -2).length}
            </div>
          </div>
        </div>
      </div>

      {/* News Timeline */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Newspaper className="w-6 h-6 text-bull-light" />
          <h2 className="text-2xl font-bold">市場新聞與情緒時間軸</h2>
        </div>
        <div className="space-y-3">
          {news.map((item, idx) => (
            <a
              key={idx}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block glass-card p-4 hover:bg-bg-card/80 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-light/60">
                    <Badge tone={item.label === 'positive' ? 'bull' : item.label === 'negative' ? 'bear' : 'neutral'}>
                      情緒分數: {item.score?.toFixed(2) || 'N/A'}
                    </Badge>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  )
}
