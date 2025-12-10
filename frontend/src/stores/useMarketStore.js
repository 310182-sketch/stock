import { create } from 'zustand'
import {
  fetchTwStocks,
  fetchRealtime,
  fetchPotentialStocks,
  fetchMarketNews,
} from '@/services/api'

const FALLBACK_WATCHLIST = [
  { symbol: '2330', name: '台積電', changePercent: 0.8, price: 985, volume: 21400000000 },
  { symbol: '2317', name: '鴻海', changePercent: 0.5, price: 178, volume: 9200000000 },
  { symbol: '0050', name: '台灣50', changePercent: 0.3, price: 185, volume: 4100000000 },
]

const FALLBACK_NEWS = [
  { title: '等待接入後端新聞 API', url: '#', score: 0, label: 'neutral' },
]

export const useMarketStore = create((set, get) => ({
  watchlist: [],
  potentialStocks: [],
  news: FALLBACK_NEWS,
  sentiment: 'neutral',
  loading: false,
  error: null,
  lastUpdated: null,
  selectedStock: null,
  stockHistory: {},
  backtestResults: {},
  scanResults: [],
  compareStocks: [],

  setSelectedStock: (stock) => set({ selectedStock: stock }),

  fetchWatchlist: async () => {
    try {
      const data = await fetchTwStocks()
      const stocks = data?.stocks || []
      if (!stocks.length) {
        set({ watchlist: FALLBACK_WATCHLIST })
        return
      }

      const enriched = await Promise.all(
        stocks.slice(0, 6).map(async (s) => {
          try {
            const rt = await fetchRealtime(s.symbol)
            const rtData = rt?.data || rt
            return {
              ...s,
              ...rtData,
              changePercent: rtData?.changePercent ?? rtData?.change ?? s.changePercent,
              volume: rtData?.volume ?? s.volume,
            }
          } catch {
            return s
          }
        }),
      )

      set({ watchlist: enriched })
    } catch (e) {
      set({ watchlist: FALLBACK_WATCHLIST, error: e.message })
    }
  },

  fetchPotential: async () => {
    try {
      const data = await fetchPotentialStocks()
      set({ potentialStocks: data?.stocks || [] })
    } catch (e) {
      console.warn('Failed to fetch potential stocks:', e.message)
      set({ potentialStocks: [], error: null })
    }
  },

  fetchNews: async () => {
    try {
      const data = await fetchMarketNews()
      set({ news: data?.news || FALLBACK_NEWS, sentiment: data?.marketSentiment || 'neutral' })
    } catch (e) {
      set({ news: FALLBACK_NEWS, sentiment: 'neutral', error: e.message })
    }
  },

  refreshAll: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      await Promise.all([get().fetchWatchlist(), get().fetchPotential(), get().fetchNews()])
      set({ lastUpdated: Date.now() })
    } catch (e) {
      set({ error: e.message })
    } finally {
      set({ loading: false })
    }
  },
}))
