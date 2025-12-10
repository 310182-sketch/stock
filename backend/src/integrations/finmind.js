const axios = require('axios');

const FINMIND_API = 'https://api.finmindtrade.com/api/v4/data';

async function fetchHistorical(stockId, startDate, endDate, dataset = 'TaiwanStockPrice', token) {
  if (!token) throw new Error('FinMind token required');
  const params = {
    dataset,
    data_id: String(stockId),
    start_date: startDate,
    end_date: endDate,
    token
  };
  const resp = await axios.get(FINMIND_API, { params, timeout: 15000 });
  if (!resp.data || !resp.data.data) return [];
  // normalize to [{ date, open, high, low, close, volume }]
  return resp.data.data.map(r => ({
    date: r.date,
    open: Number(r.open) || 0,
    high: Number(r.high) || 0,
    low: Number(r.low) || 0,
    close: Number(r.close) || 0,
    volume: Number(r.volume) || 0
  }));
}

module.exports = { fetchHistorical };
