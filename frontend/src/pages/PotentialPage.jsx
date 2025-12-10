import { useEffect, useState } from 'react'
import { TrendingUp, Filter } from 'lucide-react'
import { fetchPotentialStocks } from '@/services/api'
import { useMarketStore } from '@/stores/useMarketStore'
import Sparkline from '@/components/Sparkline'

export default function PotentialPage() {
  const setSelectedStock = useMarketStore((state) => state.setSelectedStock)
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [filterIndustry, setFilterIndustry] = useState('all')
  const itemsPerPage = 12

  useEffect(() => {
    const loadStocks = async () => {
      setLoading(true)
      try {
        const data = await fetchPotentialStocks()
        setStocks(data?.stocks || [])
      } catch (error) {
        console.error('Failed to load potential stocks:', error)
      } finally {
        setLoading(false)
      }
    }
    loadStocks()
  }, [])

  const industries = ['all', ...new Set(stocks.map(s => s.industry).filter(Boolean))]

  const filteredStocks = filterIndustry === 'all' 
    ? stocks 
    : stocks.filter(s => s.industry === filterIndustry)

  const totalPages = Math.ceil(filteredStocks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedStocks = filteredStocks.slice(startIndex, startIndex + itemsPerPage)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">潛力股推薦</h1>
          <p className="text-neutral-light/60 mt-1">AI 分析推薦的投資標的</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-bull-light" />
          <span className="font-semibold">產業篩選:</span>
        </div>
        <select
          value={filterIndustry}
          onChange={(e) => {
            setFilterIndustry(e.target.value)
            setCurrentPage(1)
          }}
          className="px-4 py-2 bg-bg-card rounded-lg border border-neutral-dark/30 focus:border-bull-light outline-none"
        >
          {industries.map((industry) => (
            <option key={industry} value={industry}>
              {industry === 'all' ? '全部產業' : industry}
            </option>
          ))}
        </select>
        <span className="text-sm text-neutral-light/60">
          共 {filteredStocks.length} 支股票
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-neutral-light/60">載入中...</div>
        </div>
      ) : paginatedStocks.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedStocks.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => setSelectedStock(stock)}
                className="glass-card p-5 hover:bg-bg-card/80 transition-all text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold">{stock.symbol}</h3>
                    <p className="text-sm text-neutral-light/60">{stock.name}</p>
                  </div>
                  <TrendingUp className={`w-5 h-5 ${
                    Number(stock.changePercent || 0) >= 0 ? 'text-bull-light' : 'text-bear-light'
                  }`} />
                </div>

                {stock.industry && (
                  <div className="mb-3">
                    <span className="px-2 py-1 bg-bg-secondary/60 rounded text-xs">
                      {stock.industry}
                    </span>
                  </div>
                )}

                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-2xl font-bold">
                      ${Number(stock.price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className={`text-sm font-semibold ${
                    Number(stock.changePercent || 0) >= 0 ? 'text-bull-light' : 'text-bear-light'
                  }`}>
                    {Number(stock.changePercent || 0) >= 0 ? '+' : ''}
                    {Number(stock.changePercent || 0).toFixed(2)}%
                  </div>
                </div>

                <Sparkline symbol={stock.symbol} months={3} height={60} />

                {stock.aiScore && (
                  <div className="mt-3 pt-3 border-t border-neutral-dark/20">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-light/60">AI 評分</span>
                      <span className="font-semibold text-bull-light">
                        {stock.aiScore}/100
                      </span>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-bg-card rounded-lg hover:bg-bg-card/80 transition-colors disabled:opacity-50"
              >
                上一頁
              </button>
              <span className="px-4 py-2">
                第 {currentPage} / {totalPages} 頁
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-bg-card rounded-lg hover:bg-bg-card/80 transition-colors disabled:opacity-50"
              >
                下一頁
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center py-20 text-neutral-light/60">
          暫無潛力股資料
        </div>
      )}
    </div>
  )
}
