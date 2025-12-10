import { Search, Bell, Clock } from 'lucide-react'
import { useState } from 'react'
import { useMarketStore } from '@/stores/useMarketStore'
import SearchBar from '@/components/common/SearchBar'

export default function Header() {
  const lastUpdated = useMarketStore((state) => state.lastUpdated)
  const [showSearch, setShowSearch] = useState(false)

  return (
    <header className="h-16 bg-bg-secondary border-b border-neutral-dark/30 flex items-center justify-between px-6">
      {/* Search Trigger */}
      <button
        onClick={() => setShowSearch(true)}
        className="flex items-center gap-2 px-4 py-2 bg-bg-card/60 rounded-lg hover:bg-bg-card transition-colors"
      >
        <Search className="w-4 h-4 text-neutral-light/60" />
        <span className="text-sm text-neutral-light/60">搜尋股票代碼或名稱...</span>
      </button>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Last Update Time */}
        {lastUpdated && (
          <div className="flex items-center gap-2 text-sm text-neutral-light/60">
            <Clock className="w-4 h-4" />
            <span>最後更新: {lastUpdated}</span>
          </div>
        )}

        {/* Notifications */}
        <button className="p-2 hover:bg-bg-card/60 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5 text-neutral-light/70" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-bull-light rounded-full"></span>
        </button>
      </div>

      {/* Search Modal */}
      {showSearch && <SearchBar onClose={() => setShowSearch(false)} />}
    </header>
  )
}
