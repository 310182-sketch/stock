import { useState } from 'react'
import { GitCompare, Plus, X } from 'lucide-react'
import { compareTwStocks } from '@/services/api'
import { useToastStore } from '@/stores/useToastStore'

export default function ComparePage() {
  const toast = useToastStore()
  const [symbols, setSymbols] = useState(['2330', '2317'])
  const [newSymbol, setNewSymbol] = useState('')
  const [compareData, setCompareData] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleAddSymbol = () => {
    if (newSymbol && symbols.length < 4 && !symbols.includes(newSymbol)) {
      setSymbols([...symbols, newSymbol])
      setNewSymbol('')
    }
  }

  const handleRemoveSymbol = (symbol) => {
    setSymbols(symbols.filter(s => s !== symbol))
  }

  const handleCompare = async () => {
    if (symbols.length < 2) {
      toast.warning('至少需要選擇2支股票進行比較')
      return
    }

    setLoading(true)
    try {
      const data = await compareTwStocks({ symbols })
      setCompareData(data)
    } catch (error) {
      console.error('Compare failed:', error)
      toast.error('比較失敗: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const metrics = [
    { key: 'price', label: '價格', format: (v) => `$${v?.toFixed(2) || 'N/A'}` },
    { key: 'changePercent', label: '漲跌幅', format: (v) => `${v >= 0 ? '+' : ''}${v?.toFixed(2) || '0'}%` },
    { key: 'volume', label: '成交量', format: (v) => v ? `${(v / 1000).toFixed(0)}K` : 'N/A' },
    { key: 'marketCap', label: '市值', format: (v) => v ? `${(v / 1e9).toFixed(2)}B` : 'N/A' },
    { key: 'pe', label: '本益比', format: (v) => v?.toFixed(2) || 'N/A' },
    { key: 'rsi', label: 'RSI', format: (v) => v?.toFixed(2) || 'N/A' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">股票對比</h1>
          <p className="text-neutral-light/60 mt-1">同時比較多支股票的關鍵指標</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitCompare className="w-5 h-5 text-bull-light" />
          <h2 className="text-xl font-bold">選擇股票 (最多4支)</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          {symbols.map((symbol) => (
            <div key={symbol} className="flex items-center gap-2 px-3 py-2 bg-bg-card rounded-lg">
              <span className="font-semibold">{symbol}</span>
              <button
                onClick={() => handleRemoveSymbol(symbol)}
                className="p-1 hover:bg-bear-light/20 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {symbols.length < 4 && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleAddSymbol()}
                placeholder="股票代碼"
                className="px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none"
              />
              <button
                onClick={handleAddSymbol}
                className="p-2 bg-bull-light/20 hover:bg-bull-light/30 text-bull-light rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleCompare}
          disabled={loading || symbols.length < 2}
          className="px-6 py-3 bg-bull-light/20 hover:bg-bull-light/30 text-bull-light rounded-lg font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? '比較中...' : '開始比較'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-neutral-light/60">載入比較資料...</div>
        </div>
      ) : compareData ? (
        <div className="glass-card p-6 overflow-x-auto">
          <h2 className="text-xl font-bold mb-6">比較結果</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-dark/30">
                <th className="text-left py-3 px-4 font-semibold">指標</th>
                {symbols.map((symbol) => (
                  <th key={symbol} className="text-center py-3 px-4 font-semibold">
                    {symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.key} className="border-b border-neutral-dark/10">
                  <td className="py-3 px-4 font-semibold text-neutral-light/70">
                    {metric.label}
                  </td>
                  {symbols.map((symbol) => {
                    const stockData = compareData.stocks?.find(s => s.symbol === symbol)
                    const value = stockData?.[metric.key]
                    return (
                      <td key={symbol} className="py-3 px-4 text-center font-semibold">
                        {metric.format(value)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center justify-center py-20 text-neutral-light/60">
          選擇股票並開始比較
        </div>
      )}
    </div>
  )
}
