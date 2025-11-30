const API_BASE = (() => {
  const envBase = import.meta.env?.VITE_API_BASE;
  if (envBase) return envBase;
  return '/api';
})();

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'API 請求失敗');
  }
  return res.json();
}

export async function fetchStrategies() {
  const res = await fetch(`${API_BASE}/strategies`);
  return handleResponse(res);
}

export async function fetchMockBacktest(payload) {
  const res = await fetch(`${API_BASE}/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function searchTwStocks(keyword) {
  const res = await fetch(`${API_BASE}/tw/search?keyword=${encodeURIComponent(keyword)}`);
  return handleResponse(res);
}

export async function fetchTwHistory(stockId, months = 6) {
  const res = await fetch(`${API_BASE}/tw/stock/${encodeURIComponent(stockId)}?months=${months}`);
  return handleResponse(res);
}

export async function fetchTwBacktest(payload) {
  const res = await fetch(`${API_BASE}/tw/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function compareTwStocks(payload) {
  const res = await fetch(`${API_BASE}/tw/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function fetchRecommendations() {
  const res = await fetch(`${API_BASE}/recommendations`);
  return handleResponse(res);
}

export async function scanTwStocks(stockIds = [], months = 3) {
  const res = await fetch(`${API_BASE}/tw/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stockIds, months })
  });
  return handleResponse(res);
}

export async function fetchGcnAnalysis(stockIds = [], months = 6, trainEpochs = 0) {
  const res = await fetch(`${API_BASE}/tw/gcn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stockIds, months, trainEpochs })
  });
  return handleResponse(res);
}

export async function predictStockPrice(symbol, months = 6, daysAhead = 5, market = 'twse') {
  const res = await fetch(`${API_BASE}/tw/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, months, daysAhead, market })
  });
  return handleResponse(res);
}

export async function fetchPotentialStocks() {
  const res = await fetch(`${API_BASE}/tw/potential-stocks`);
  return handleResponse(res);
}
