import { X, TrendingUp, TrendingDown, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchTwHistory, fetchTwBacktest } from '@/services/api'
import { useWatchlistStore } from '@/stores/useWatchlistStore'
import CandlestickChart from '@/components/charts/CandlestickChart'
import RSIIndicator from '@/components/indicators/RSIIndicator'

export default function StockModal({ stock, onClose }) {
  const [historyData, setHistoryData] = useState([])
  const [backtestResult, setBacktestResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('chart')
  
  const isInWatchlist = useWatchlistStore((state) => state.isInWatchlist)
  const toggleStock = useWatchlistStore((state) => state.toggleStock)
  const inWatchlist = isInWatchlist(stock.symbol)

  useEffect(() => {
    if (!stock?.symbol) return
    
    const loadData = async () => {
      setLoading(true)
      try {
        const [history, backtest] = await Promise.all([
          fetchTwHistory(stock.symbol, 6),
          fetchTwBacktest({ stockId: stock.symbol, months: 6, strategy: 'maCross' })
        ])
        setHistoryData(history?.data || [])
        setBacktestResult(backtest?.result || null)
      } catch (e) {
        console.error('Failed to load stock detail:', e)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [stock?.symbol])

  if (!stock) return null

  const latestData = historyData[historyData.length - 1]
  const firstData = historyData[0]
  const periodChange = firstData && latestData 
    ? ((latestData.close - firstData.close) / firstData.close) * 100 
    : 0

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" 
      onClick={onClose}
    >
      <div 
        className="glass-card max-w-4xl w-full max-h-[90vh] overflow-y-auto" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur-sm border-b border-neutral-dark/30 p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{stock.symbol} {stock.name}</h2>
              <button
                onClick={() => toggleStock(stock.symbol)}
                className={`p-2 rounded-lg transition-colors ${
                  inWatchlist 
                    ? 'bg-bull-light/20 text-bull-light' 
                    : 'bg-bg-card/60 hover:bg-bg-card'
                }`}
              >
                <Star className={`w-5 h-5 ${inWatchlist ? 'fill-current' : ''}`} />
              </button>
            </div>
            {latestData && (
              <div className="flex items-center gap-4 mt-2">
                <p className="text-3xl font-bold">
                  ${latestData.close?.toFixed(2)}
                </p>
                <span className={`flex items-center gap-1 text-sm font-semibold ${
                  periodChange >= 0 ? 'text-bull-light' : 'text-bear-light'
                }`}>
                  {periodChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(2)}% (6個月)
                </span>
                <span className="text-sm text-neutral-light/60">
                  日期: {latestData.date}
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-bg-card/60 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-2 border-b border-neutral-dark/30">
            {[
              { id: 'chart', label: '走勢圖' },
              { id: 'indicators', label: '技術指標' },
              { id: 'backtest', label: '回測結果' },
              { id: 'stats', label: '統計數據' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'text-bull-light border-b-2 border-bull-light'
                    : 'text-neutral-light/60 hover:text-neutral-light'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-pulse text-neutral-light/60">載入中...</div>
            </div>
          ) : (
            <>
              {activeTab === 'chart' && (
                <div className="space-y-4">
                  <div className="glass-card p-4">
                    <CandlestickChart 
                      symbol={stock.symbol} 
                      data={historyData} 
                      height={400} 
                    />
                  </div>
                  
                  {historyData.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="glass-card p-4">
                        <p className="text-sm text-neutral-light/70">最高價</p>
                        <p className="text-xl font-bold text-bull-light">
                          ${Math.max(...historyData.map(d => d.high)).toFixed(2)}
                        </p>
                      </div>
                      <div className="glass-card p-4">
                        <p className="text-sm text-neutral-light/70">最低價</p>
                        <p className="text-xl font-bold text-bear-light">
                          ${Math.min(...historyData.map(d => d.low)).toFixed(2)}
                        </p>
                      </div>
                      <div className="glass-card p-4">
                        <p className="text-sm text-neutral-light/70">平均成交量</p>
                        <p className="text-xl font-bold">
                          {(historyData.reduce((sum, d) => sum + (d.volume || 0), 0) / historyData.length / 1000).toFixed(0)}K
                        </p>
                      </div>
                      <div className="glass-card p-4">
                        <p className="text-sm text-neutral-light/70">資料點數</p>
                        <p className="text-xl font-bold">{historyData.length}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'indicators' && (
                <div className="space-y-4">
                  <div className="glass-card p-4">
                    <RSIIndicator historyData={historyData} height={250} />
                  </div>
                  
                  {historyData.length >= 15 && (
                    <div className="glass-card p-4">
                      <h3 className="text-lg font-semibold mb-3">技術分析摘要</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-bg-secondary/60 rounded-lg">
                          <p className="text-sm text-neutral-light/70 mb-1">近期趨勢</p>
                          <p className="text-lg font-semibold">
                            {periodChange > 2 ? '📈 強勢上漲' : 
                             periodChange < -2 ? '📉 弱勢下跌' : 
                             '➡️ 盤整'}
                          </p>
                        </div>
                        <div className="p-3 bg-bg-secondary/60 rounded-lg">
                          <p className="text-sm text-neutral-light/70 mb-1">波動性</p>
                          <p className="text-lg font-semibold">
                            {(() => {
                              const priceRange = Math.max(...historyData.map(d => d.high)) - 
                                                Math.min(...historyData.map(d => d.low))
                              const avgPrice = historyData.reduce((sum, d) => sum + d.close, 0) / historyData.length
                              const volatility = (priceRange / avgPrice) * 100
                              return volatility > 20 ? '🔥 高波動' : 
                                     volatility > 10 ? '📊 中等波動' : 
                                     '😌 低波動'
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'backtest' && backtestResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="glass-card p-4">
                      <p className="text-sm text-neutral-light/70">總報酬率</p>
                      <p className={`text-2xl font-bold ${
                        (backtestResult.metrics?.totalReturn || 0) >= 0 ? 'text-bull-light' : 'text-bear-light'
                      }`}>
                        {backtestResult.metrics?.totalReturn || 0}%
                      </p>
                    </div>
                    <div className="glass-card p-4">
                      <p className="text-sm text-neutral-light/70">交易次數</p>
                      <p className="text-2xl font-bold">{backtestResult.metrics?.totalTrades || 0}</p>
                    </div>
                    <div className="glass-card p-4">
                      <p className="text-sm text-neutral-light/70">勝率</p>
                      <p className="text-2xl font-bold">{backtestResult.metrics?.winRate || 0}%</p>
                    </div>
                    <div className="glass-card p-4">
                      <p className="text-sm text-neutral-light/70">最大回檔</p>
                      <p className="text-2xl font-bold text-bear-light">
                        {backtestResult.metrics?.maxDrawdown || 0}%
                      </p>
                    </div>
                    <div className="glass-card p-4">
                      <p className="text-sm text-neutral-light/70">Sharpe Ratio</p>
                      <p className="text-2xl font-bold">{backtestResult.metrics?.sharpeRatio?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div className="glass-card p-4">
                      <p className="text-sm text-neutral-light/70">最終資金</p>
                      <p className="text-2xl font-bold">
                        ${backtestResult.finalEquity?.toLocaleString() || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {backtestResult.trades && backtestResult.trades.length > 0 && (
                    <div className="glass-card p-4">
                      <h3 className="text-lg font-semibold mb-4">近期交易紀錄</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {backtestResult.trades.slice(-10).reverse().map((trade, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-bg-secondary/60 rounded-lg">
                            <div>
                              <span className={`font-semibold ${
                                trade.action === 'BUY' ? 'text-bull-light' : 'text-bear-light'
                              }`}>
                                {trade.action}
                              </span>
                              <span className="ml-3 text-sm text-neutral-light/70">{trade.date}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">${trade.price?.toFixed(2)}</p>
                              <p className="text-xs text-neutral-light/60">{trade.shares} 股</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'stats' && historyData.length > 0 && (
                <div className="glass-card p-4">
                  <h3 className="text-lg font-semibold mb-4">統計資訊</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-neutral-dark/20">
                      <span className="text-neutral-light/70">資料期間</span>
                      <span className="font-semibold">
                        {historyData[0]?.date} ~ {historyData[historyData.length - 1]?.date}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-neutral-dark/20">
                      <span className="text-neutral-light/70">平均收盤價</span>
                      <span className="font-semibold">
                        ${(historyData.reduce((sum, d) => sum + d.close, 0) / historyData.length).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-neutral-dark/20">
                      <span className="text-neutral-light/70">價格波動範圍</span>
                      <span className="font-semibold">
                        ${Math.min(...historyData.map(d => d.low)).toFixed(2)} - ${Math.max(...historyData.map(d => d.high)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-neutral-light/70">期間漲跌</span>
                      <span className={`font-semibold ${periodChange >= 0 ? 'text-bull-light' : 'text-bear-light'}`}>
                        {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
