import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchTwStocks, fetchRealtime } from '@/services/api'

export const useWatchlistStore = create(
  persist(
    (set, get) => ({
      watchlist: [],

      addStock: async (symbol) => {
        const current = get().watchlist
        if (current.find((s) => s.symbol === symbol)) return

        try {
          const data = await fetchTwStocks()
          const stock = data.stocks?.find((s) => s.symbol === symbol)
          if (stock) {
            const rt = await fetchRealtime(symbol)
            const enriched = { ...stock, ...rt?.data }
            set({ watchlist: [...current, enriched] })
          }
        } catch (e) {
          console.error('Failed to add stock:', e)
        }
      },

      removeStock: (symbol) => {
        set({ watchlist: get().watchlist.filter((s) => s.symbol !== symbol) })
      },

      toggleStock: async (symbol) => {
        const current = get().watchlist
        if (current.find((s) => s.symbol === symbol)) {
          get().removeStock(symbol)
        } else {
          await get().addStock(symbol)
        }
      },

      isInWatchlist: (symbol) => {
        return get().watchlist.some((s) => s.symbol === symbol)
      },

      syncWithApi: async () => {
        const symbols = get().watchlist.map((s) => s.symbol)
        const updated = await Promise.all(
          symbols.map(async (symbol) => {
            try {
              const rt = await fetchRealtime(symbol)
              return { symbol, ...rt?.data }
            } catch {
              return get().watchlist.find((s) => s.symbol === symbol)
            }
          }),
        )
        set({ watchlist: updated })
      },
    }),
    {
      name: 'stock-watchlist',
    },
  ),
)
