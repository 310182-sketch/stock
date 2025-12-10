import { NavLink } from 'react-router-dom'
import { Home, LineChart, ScanSearch, TrendingUp, GitCompare, BarChart3 } from 'lucide-react'

const navItems = [
  { path: '/', icon: Home, label: '儀表板' },
  { path: '/backtest', icon: LineChart, label: '回測系統' },
  { path: '/scanner', icon: ScanSearch, label: '股票掃描' },
  { path: '/potential', icon: TrendingUp, label: '潛力股' },
  { path: '/compare', icon: GitCompare, label: '股票對比' },
]

export default function Sidebar() {
  return (
    <aside className="w-64 bg-bg-secondary border-r border-neutral-dark/30 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-neutral-dark/30">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-bull-light" />
          <div>
            <h1 className="text-xl font-bold">StockAI</h1>
            <p className="text-xs text-neutral-light/60">智能交易系統</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-bull-light/20 text-bull-light font-semibold'
                  : 'text-neutral-light/70 hover:bg-bg-card/60 hover:text-neutral-light'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-dark/30">
        <p className="text-xs text-neutral-light/50 text-center">
          © 2025 StockAI Platform
        </p>
      </div>
    </aside>
  )
}
