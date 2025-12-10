import { useState } from 'react'
import { ScanSearch, Filter } from 'lucide-react'
import { scanTwStocks } from '@/services/api'
import { useMarketStore } from '@/stores/useMarketStore'
import { useToastStore } from '@/stores/useToastStore'

export default function ScannerPage() {
  const toast = useToastStore()
  const setSelectedStock = useMarketStore((state) => state.setSelectedStock)
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    minChange: '',
    maxChange: '',
    minVolume: '',
    minRsi: '',
    maxRsi: '',
  })
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState('changePercent')
  const [sortOrder, setSortOrder] = useState('desc')

  const handleScan = async () => {
    setLoading(true)
    try {
      const criteria = {}
      if (filters.minPrice) criteria.minPrice = parseFloat(filters.minPrice)
      if (filters.maxPrice) criteria.maxPrice = parseFloat(filters.maxPrice)
      if (filters.minChange) criteria.minChange = parseFloat(filters.minChange)
      if (filters.maxChange) criteria.maxChange = parseFloat(filters.maxChange)
      if (filters.minVolume) criteria.minVolume = parseInt(filters.minVolume)
      if (filters.minRsi) criteria.minRsi = parseFloat(filters.minRsi)
      if (filters.maxRsi) criteria.maxRsi = parseFloat(filters.maxRsi)

      const data = await scanTwStocks(criteria)
      setResults(data?.stocks || [])
    } catch (error) {
      console.error('Scan failed:', error)
      toast.error('掃描失敗: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const sortedResults = [...results].sort((a, b) => {
    const aVal = a[sortBy] || 0
    const bVal = b[sortBy] || 0
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
  })

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">股票掃描器</h1>
          <p className="text-neutral-light/60 mt-1">依條件篩選符合的股票</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Filter className="w-5 h-5 text-bull-light" />
            <h2 className="text-xl font-bold">篩選條件</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">價格範圍</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="最低"
                  value={filters.minPrice}
                  onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none text-sm"
                />
                <input
                  type="number"
                  placeholder="最高"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">漲跌幅 (%)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="最低"
                  value={filters.minChange}
                  onChange={(e) => setFilters({ ...filters, minChange: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none text-sm"
                />
                <input
                  type="number"
                  placeholder="最高"
                  value={filters.maxChange}
                  onChange={(e) => setFilters({ ...filters, maxChange: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">最低成交量</label>
              <input
                type="number"
                placeholder="10000"
                value={filters.minVolume}
                onChange={(e) => setFilters({ ...filters, minVolume: e.target.value })}
                className="w-full px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">RSI 範圍</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="30"
                  value={filters.minRsi}
                  onChange={(e) => setFilters({ ...filters, minRsi: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none text-sm"
                />
                <input
                  type="number"
                  placeholder="70"
                  value={filters.maxRsi}
                  onChange={(e) => setFilters({ ...filters, maxRsi: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleScan}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-bull-light/20 hover:bg-bull-light/30 text-bull-light rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              <ScanSearch className="w-5 h-5" />
              {loading ? '掃描中...' : '開始掃描'}
            </button>

            <button
              onClick={() => setFilters({
                minPrice: '',
                maxPrice: '',
                minChange: '',
                maxChange: '',
                minVolume: '',
                minRsi: '',
                maxRsi: '',
              })}
              className="w-full px-4 py-2 bg-bg-card/60 hover:bg-bg-card rounded-lg transition-colors text-sm"
            >
              重置條件
            </button>
          </div>
        </div>

        <div className="lg:col-span-3 glass-card p-6">
          <h2 className="text-xl font-bold mb-6">掃描結果 ({sortedResults.length})</h2>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-pulse text-neutral-light/60">掃描中...</div>
            </div>
          ) : sortedResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-dark/30">
                    <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:text-bull-light" onClick={() => handleSort('symbol')}>
                      代碼
                    </th>
                    <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:text-bull-light" onClick={() => handleSort('name')}>
                      名稱
                    </th>
                    <th className="text-right py-3 px-4 font-semibold cursor-pointer hover:text-bull-light" onClick={() => handleSort('price')}>
                      價格
                    </th>
                    <th className="text-right py-3 px-4 font-semibold cursor-pointer hover:text-bull-light" onClick={() => handleSort('changePercent')}>
                      漲跌幅
                    </th>
                    <th className="text-right py-3 px-4 font-semibold cursor-pointer hover:text-bull-light" onClick={() => handleSort('volume')}>
                      成交量
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((stock) => (
                    <tr key={stock.symbol} className="border-b border-neutral-dark/10 hover:bg-bg-card/40 transition-colors">
                      <td className="py-3 px-4 font-semibold">{stock.symbol}</td>
                      <td className="py-3 px-4">{stock.name}</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        ${Number(stock.price || 0).toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold ${
                        Number(stock.changePercent || 0) >= 0 ? 'text-bull-light' : 'text-bear-light'
                      }`}>
                        {Number(stock.changePercent || 0) >= 0 ? '+' : ''}
                        {Number(stock.changePercent || 0).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        {stock.volume ? (stock.volume / 1000).toFixed(0) + 'K' : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedStock(stock)}
                          className="px-3 py-1 bg-bull-light/20 hover:bg-bull-light/30 text-bull-light rounded text-sm font-semibold transition-colors"
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 text-neutral-light/60">
              設定篩選條件並執行掃描
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
