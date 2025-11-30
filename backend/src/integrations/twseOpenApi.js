const axios = require('axios');

const BASE_URL = process.env.TWSE_OPENAPI_BASE || 'https://openapi.twse.com.tw';
const API_KEY = process.env.OPENAPI_TWSE_KEY || process.env.TWSE_OPENAPI_KEY || null;

async function fetchOpenApi(path, params = {}) {
  if (!path) throw new Error('path is required');

  const url = `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

  const headers = {
    'Accept': 'application/json'
  };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

  try {
    const resp = await axios.get(url, { params, headers, timeout: 10000 });
    return resp.data;
  } catch (err) {
    const msg = err.response ? `HTTP ${err.response.status} - ${err.response.statusText}` : err.message;
    throw new Error(`TWSE OpenAPI request failed: ${msg}`);
  }
}

module.exports = { fetchOpenApi };
