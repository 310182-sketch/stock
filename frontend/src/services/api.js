import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE || '/api'

const client = axios.create({
  baseURL,
  timeout: 12000,
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

export const fetchStrategies = () => request(client.get('/strategies'))
export const fetchTwStocks = () => request(client.get('/tw/stocks'))
export const fetchRealtime = (symbol) => request(client.get(`/tw/realtime/${encodeURIComponent(symbol)}`))
export const fetchTwHistory = (symbol, months = 6, market = 'twse') =>
  request(client.get(`/tw/history/${encodeURIComponent(symbol)}`, { params: { months, market } }))
export const scanTwStocks = (stockIds = [], months = 3) =>
  request(client.post('/tw/scan', { stockIds, months }))
export const fetchTwBacktest = (payload) => request(client.post('/tw/backtest', payload))
export const compareTwStocks = (payload) => request(client.post('/tw/compare', payload))
export const predictStockPrice = (symbol, months = 6, daysAhead = 5, market = 'twse') =>
  request(client.post('/tw/predict', { symbol, months, daysAhead, market }))
export const fetchPotentialStocks = () => request(client.get('/tw/potential-stocks'))
export const fetchMarketNews = () => request(client.get('/news'))
export const sendLineTest = (token, message) => request(client.post('/notify/test', { token, message }))
export const sendDailySummary = (token) => request(client.post('/notify/daily-summary', { token }))

export { client as apiClient }
