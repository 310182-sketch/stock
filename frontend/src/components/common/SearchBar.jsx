import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { fetchTwStocks } from '@/services/api'
import { useMarketStore } from '@/stores/useMarketStore'

export default function SearchBar({ onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const setSelectedStock = useMarketStore((state) => state.setSelectedStock)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const searchStocks = async () => {
      setLoading(true)
      try {
        const data = await fetchTwStocks()
        const filtered = data.filter(
          (stock) =>
            stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
            stock.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10)
        setResults(filtered)
      } catch (e) {
        console.error('Search failed:', e)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(searchStocks, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (stock) => {
    setSelectedStock(stock)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-neutral-dark/30">
          <Search className="w-5 h-5 text-neutral-light/60" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="輸入股票代碼或名稱..."
            className="flex-1 bg-transparent outline-none text-lg"
          />
          <button onClick={onClose} className="p-1 hover:bg-bg-card/60 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-neutral-light/60">搜尋中...</div>
          ) : results.length > 0 ? (
            results.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => handleSelect(stock)}
                className="w-full flex items-center justify-between p-4 hover:bg-bg-card/60 transition-colors border-b border-neutral-dark/10 last:border-0"
              >
                <div className="text-left">
                  <p className="font-semibold">{stock.symbol}</p>
                  <p className="text-sm text-neutral-light/60">{stock.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${Number(stock.price || 0).toFixed(2)}</p>
                  {stock.changePercent !== undefined && (
                    <p
                      className={`text-sm ${
                        Number(stock.changePercent) >= 0 ? 'text-bull-light' : 'text-bear-light'
                      }`}
                    >
                      {Number(stock.changePercent) >= 0 ? '+' : ''}
                      {Number(stock.changePercent).toFixed(2)}%
                    </p>
                  )}
                </div>
              </button>
            ))
          ) : query ? (
            <div className="p-8 text-center text-neutral-light/60">無搜尋結果</div>
          ) : (
            <div className="p-8 text-center text-neutral-light/60">
              輸入股票代碼或名稱開始搜尋
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
