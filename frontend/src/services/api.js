import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE || '/api'

const client = axios.create({
  baseURL,
  timeout: 15000,
})

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
    throw new Error(toErrorMessage(error))
  }
}

// === 基本 API ===
export const fetchStrategies = () => request(client.get('/strategies'))
export const fetchTwStocks = () => request(client.get('/tw/stocks'))
export const fetchRealtime = (symbol) => request(client.get(`/tw/realtime/${encodeURIComponent(symbol)}`))
export const fetchTwHistory = (symbol, months = 6, market = 'twse') =>
  request(client.get(`/tw/history/${encodeURIComponent(symbol)}`, { params: { months, market } }))

// === 掃描 API (支援篩選條件) ===
export const scanTwStocks = (criteria = {}) => {
  // 支援兩種模式：stockIds 陣列或篩選條件物件
  if (Array.isArray(criteria)) {
    return request(client.post('/tw/scan', { stockIds: criteria }))
  }
  return request(client.post('/tw/scan', criteria))
}

// === 回測 API ===
export const fetchTwBacktest = (payload) => request(client.post('/tw/backtest', payload))

// === 比較 API (symbols -> stocks 轉換) ===
export const compareTwStocks = (payload) => {
  const body = {
    stocks: payload.symbols || payload.stocks || [],
    months: payload.months || 12,
    market: payload.market || 'twse'
  }
  return request(client.post('/tw/compare', body))
}

// === 預測 API ===
export const predictStockPrice = (symbol, months = 6, daysAhead = 5, market = 'twse') =>
  request(client.post('/tw/predict', { symbol, months, daysAhead, market }))

// === 潛力股與新聞 API ===
export const fetchPotentialStocks = () => request(client.get('/tw/potential-stocks'))
export const fetchMarketNews = () => request(client.get('/news'))

// === 通知 API ===
export const sendLineTest = (token, message) => request(client.post('/notify/test', { token, message }))
export const sendDailySummary = (token) => request(client.post('/notify/daily-summary', { token }))

// === 健康檢查 ===
export const checkHealth = () => request(client.get('/health'))

export { client as apiClient }
