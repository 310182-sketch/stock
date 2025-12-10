import { useState } from 'react'
import { Play, Settings } from 'lucide-react'
import { fetchTwBacktest } from '@/services/api'
import { useToastStore } from '@/stores/useToastStore'

export default function BacktestPage() {
  const toast = useToastStore()
  const [formData, setFormData] = useState({
    stockId: '2330',
    months: 6,
    strategy: 'maCross',
    initialCapital: 1000000,
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const strategies = [
    { id: 'maCross', name: 'MA交叉策略', desc: '移動平均線交叉買賣' },
    { id: 'rsi', name: 'RSI策略', desc: 'RSI超買超賣訊號' },
    { id: 'macd', name: 'MACD策略', desc: 'MACD指標交易' },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await fetchTwBacktest(formData)
      setResult(data?.result || data)
    } catch (error) {
      console.error('Backtest failed:', error)
      toast.error('回測失敗: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">回測系統</h1>
          <p className="text-neutral-light/60 mt-1">測試交易策略的歷史表現</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-bull-light" />
            <h2 className="text-xl font-bold">策略設定</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">股票代碼</label>
              <input
                type="text"
                value={formData.stockId}
                onChange={(e) => setFormData({ ...formData, stockId: e.target.value })}
                className="w-full px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none"
                placeholder="2330"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">回測期間 (月)</label>
              <input
                type="number"
                min="1"
                max="36"
                value={formData.months}
                onChange={(e) => setFormData({ ...formData, months: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">交易策略</label>
              <select
                value={formData.strategy}
                onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
                className="w-full px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none"
              >
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-light/60 mt-1">
                {strategies.find((s) => s.id === formData.strategy)?.desc}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">初始資金</label>
              <input
                type="number"
                min="10000"
                step="10000"
                value={formData.initialCapital}
                onChange={(e) => setFormData({ ...formData, initialCapital: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-bull-light/20 hover:bg-bull-light/30 text-bull-light rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              <Play className="w-5 h-5" />
              {loading ? '執行中...' : '開始回測'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="text-xl font-bold mb-6">回測結果</h2>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-pulse text-neutral-light/60">執行回測中...</div>
            </div>
          ) : result ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="glass-card p-4">
                  <p className="text-sm text-neutral-light/70">總報酬率</p>
                  <p className={`text-3xl font-bold ${
                    (result.metrics?.totalReturn || 0) >= 0 ? 'text-bull-light' : 'text-bear-light'
                  }`}>
                    {result.metrics?.totalReturn || 0}%
                  </p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-sm text-neutral-light/70">交易次數</p>
                  <p className="text-3xl font-bold">{result.metrics?.totalTrades || 0}</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-sm text-neutral-light/70">勝率</p>
                  <p className="text-3xl font-bold">{result.metrics?.winRate || 0}%</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-sm text-neutral-light/70">最大回檔</p>
                  <p className="text-2xl font-bold text-bear-light">
                    {result.metrics?.maxDrawdown || 0}%
                  </p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-sm text-neutral-light/70">Sharpe Ratio</p>
                  <p className="text-2xl font-bold">
                    {result.metrics?.sharpeRatio?.toFixed(2) || 'N/A'}
                  </p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-sm text-neutral-light/70">最終資金</p>
                  <p className="text-2xl font-bold">
                    ${result.finalEquity?.toLocaleString() || 'N/A'}
                  </p>
                </div>
              </div>

              {result.trades && result.trades.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">交易紀錄</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {result.trades.slice(-20).reverse().map((trade, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 glass-card">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded font-semibold text-sm ${
                            trade.action === 'BUY' 
                              ? 'bg-bull-light/20 text-bull-light' 
                              : 'bg-bear-light/20 text-bear-light'
                          }`}>
                            {trade.action}
                          </span>
                          <span className="text-neutral-light/70">{trade.date}</span>
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
          ) : (
            <div className="flex items-center justify-center py-20 text-neutral-light/60">
              選擇參數並執行回測以查看結果
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
