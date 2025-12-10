const axios = require('axios');

// FBS integration wrapper (lightweight). Requires two env vars:
// - FBS_API_KEY: API key/token
// - FBS_BASE_URL: base URL for market-data endpoints (e.g. https://api.fbs.com.tw)
// NOTE: exact endpoint paths depend on FBS spec; this wrapper is conservative and
// will return null/[] when no credentials are present. You can refine endpoints
// after providing actual API docs or credentials.

const BASE = process.env.FBS_BASE_URL || null;
const KEY = process.env.FBS_API_KEY || null;

async function fetchRealtime(stockId) {
  if (!BASE || !KEY) return null;
  try {
    // Expected usage: GET {BASE}/v1/market/quote?symbol=2330
    const url = `${BASE.replace(/\/$/, '')}/v1/market/quote`;
    const resp = await axios.get(url, { params: { symbol: stockId }, headers: { 'Authorization': `Bearer ${KEY}` }, timeout: 8000 });
    const data = resp.data;
    if (!data) return null;
    // Try common fields
    const item = data.data || data.result || data;
    if (!item) return null;
    // Normalization: try to map common fields if present
    const price = Number(item.price ?? item.last ?? item.close) || 0;
    const yesterday = Number(item.prev_close ?? item.yesterday ?? item.previous) || 0;
    return {
      stockId: String(stockId),
      name: item.name || item.symbol || null,
      price,
      open: Number(item.open) || 0,
      high: Number(item.high) || 0,
      low: Number(item.low) || 0,
      yesterday,
      volume: Number(item.volume) || 0,
      time: item.time || item.timestamp || null,
      change: price - yesterday,
      changePercent: yesterday > 0 ? ((price - yesterday) / yesterday * 100).toFixed(2) : '0.00'
    };
  } catch (e) {
    return null;
  }
}

async function fetchHistory(stockId, startDate, endDate) {
  if (!BASE || !KEY) return [];
  try {
    // Expected: GET {BASE}/v1/market/history?symbol=2330&start=YYYY-MM-DD&end=YYYY-MM-DD
    const url = `${BASE.replace(/\/$/, '')}/v1/market/history`;
    const resp = await axios.get(url, { params: { symbol: stockId, start: startDate, end: endDate }, headers: { 'Authorization': `Bearer ${KEY}` }, timeout: 15000 });
    const arr = resp.data?.data || resp.data?.result || resp.data || [];
    if (!Array.isArray(arr)) return [];
    return arr.map(r => ({ date: r.date || r.time || r.t, open: Number(r.open) || 0, high: Number(r.high) || 0, low: Number(r.low) || 0, close: Number(r.close) || Number(r.price) || 0, volume: Number(r.volume) || 0 }));
  } catch (e) {
    return [];
  }
}

module.exports = { fetchRealtime, fetchHistory };
