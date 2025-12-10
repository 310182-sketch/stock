import axios from 'axios'

// GitHub Pages 使用環境變數指定 API 位置，本地開發使用 proxy
const isGitHubPages = import.meta.env.VITE_GITHUB_PAGES === 'true'
const baseURL = import.meta.env.VITE_API_BASE || (isGitHubPages ? '' : '/api')

const client = axios.create({
  baseURL,
  timeout: 15000,
})

// GitHub Pages 靜態模式的 mock 資料
const MOCK_STOCKS = [
  { symbol: '2330', name: '台積電', price: 1050, changePercent: 1.2, volume: 25000000, industry: '半導體' },
  { symbol: '2317', name: '鴻海', price: 178, changePercent: 0.8, volume: 15000000, industry: '電子零組件' },
  { symbol: '2454', name: '聯發科', price: 1280, changePercent: -0.5, volume: 8000000, industry: '半導體' },
  { symbol: '2412', name: '中華電', price: 128, changePercent: 0.2, volume: 5000000, industry: '電信' },
  { symbol: '0050', name: '元大台灣50', price: 185, changePercent: 0.5, volume: 12000000, industry: 'ETF' },
  { symbol: '2881', name: '富邦金', price: 88, changePercent: -0.3, volume: 9000000, industry: '金融' },
]

const MOCK_NEWS = [
  { title: '台積電法說會釋出正面展望', url: '#', score: 0.8, label: 'positive' },
  { title: '美股科技股回落影響台股', url: '#', score: -0.3, label: 'negative' },
  { title: '外資連續買超電子股', url: '#', score: 0.5, label: 'positive' },
]

function toErrorMessage(error) {
  if (error?.response?.data) {
    const d = error.response.data
    return d.error || d.message || JSON.stringify(d)
  }
  if (error?.message) return error.message
  return 'Unknown API error'
}

async function request(promise) {
  try {
    const res = await promise
    return res.data
  } catch (error) {
    // GitHub Pages 靜態模式返回 mock 資料
    if (isGitHubPages) {
      console.warn('API unavailable in static mode, using mock data')
      return null
    }
    throw new Error(toErrorMessage(error))
  }
}

// === 靜態模式 mock 函數 ===
const mockResponse = (data) => Promise.resolve(data)

// === 基本 API ===
export const fetchStrategies = () => isGitHubPages 
  ? mockResponse({ strategies: ['maCross', 'rsi', 'macd'] })
  : request(client.get('/strategies'))

export const fetchTwStocks = () => isGitHubPages
  ? mockResponse({ success: true, stocks: MOCK_STOCKS })
  : request(client.get('/tw/stocks'))

export const fetchRealtime = (symbol) => isGitHubPages
  ? mockResponse({ data: MOCK_STOCKS.find(s => s.symbol === symbol) || MOCK_STOCKS[0] })
  : request(client.get(`/tw/realtime/${encodeURIComponent(symbol)}`))

export const fetchTwHistory = (symbol, months = 6, market = 'twse') => isGitHubPages
  ? mockResponse({ data: generateMockHistory(months * 20) })
  : request(client.get(`/tw/history/${encodeURIComponent(symbol)}`, { params: { months, market } }))

// === 掃描 API (支援篩選條件) ===
export const scanTwStocks = (criteria = {}) => {
  if (isGitHubPages) {
    return mockResponse({ success: true, total: MOCK_STOCKS.length, stocks: MOCK_STOCKS })
  }
  if (Array.isArray(criteria)) {
    return request(client.post('/tw/scan', { stockIds: criteria }))
  }
  return request(client.post('/tw/scan', criteria))
}

// === 回測 API ===
export const fetchTwBacktest = (payload) => isGitHubPages
  ? mockResponse({ success: true, result: generateMockBacktest() })
  : request(client.post('/tw/backtest', payload))

// === 比較 API (symbols -> stocks 轉換) ===
export const compareTwStocks = (payload) => {
  if (isGitHubPages) {
    const symbols = payload.symbols || payload.stocks || ['2330', '2317']
    return mockResponse({ 
      success: true, 
      stocks: MOCK_STOCKS.filter(s => symbols.includes(s.symbol)),
      series: symbols.map(s => ({ symbol: s, data: [] }))
    })
  }
  const body = {
    stocks: payload.symbols || payload.stocks || [],
    months: payload.months || 12,
    market: payload.market || 'twse'
  }
  return request(client.post('/tw/compare', body))
}

// === 預測 API ===
export const predictStockPrice = (symbol, months = 6, daysAhead = 5, market = 'twse') => isGitHubPages
  ? mockResponse({ success: true, prediction: { trend: 'up', confidence: 0.75 } })
  : request(client.post('/tw/predict', { symbol, months, daysAhead, market }))

// === 潛力股與新聞 API ===
export const fetchPotentialStocks = () => isGitHubPages
  ? mockResponse({ success: true, total: MOCK_STOCKS.length, stocks: MOCK_STOCKS.map(s => ({ ...s, aiScore: Math.floor(Math.random() * 30) + 60, rsi: Math.floor(Math.random() * 40) + 30, signals: ['觀望'] })) })
  : request(client.get('/tw/potential-stocks'))

export const fetchMarketNews = () => isGitHubPages
  ? mockResponse({ success: true, news: MOCK_NEWS, marketSentiment: 'neutral' })
  : request(client.get('/news'))

// === 通知 API ===
export const sendLineTest = (token, message) => isGitHubPages
  ? mockResponse({ success: true, message: 'Mock notification sent' })
  : request(client.post('/notify/test', { token, message }))

export const sendDailySummary = (token) => isGitHubPages
  ? mockResponse({ success: true })
  : request(client.post('/notify/daily-summary', { token }))

// === 健康檢查 ===
export const checkHealth = () => isGitHubPages
  ? mockResponse({ status: 'ok (static mode)', uptime: 'N/A', stocks: MOCK_STOCKS.length })
  : request(client.get('/health'))

// === Mock 資料生成器 ===
function generateMockHistory(days) {
  const data = []
  let price = 1000
  const today = new Date()
  for (let i = days; i > 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const change = (Math.random() - 0.5) * 40
    price = Math.max(800, Math.min(1200, price + change))
    data.push({
      date: date.toISOString().slice(0, 10),
      open: price - Math.random() * 10,
      high: price + Math.random() * 15,
      low: price - Math.random() * 15,
      close: price,
      volume: Math.floor(Math.random() * 10000000) + 5000000
    })
  }
  return data
}

function generateMockBacktest() {
  return {
    finalEquity: 1150000,
    trades: [
      { date: '2025-01-15', action: 'BUY', price: 980, shares: 1000 },
      { date: '2025-03-20', action: 'SELL', price: 1050, shares: 1000 },
      { date: '2025-05-10', action: 'BUY', price: 1020, shares: 1000 },
    ],
    metrics: {
      totalReturn: 15,
      totalTrades: 3,
      winRate: 66.7,
      maxDrawdown: -5.2,
      sharpeRatio: 1.25
    }
  }
}

export { client as apiClient }
