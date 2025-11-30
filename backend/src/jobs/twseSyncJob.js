const TwseOpenApi = require('../integrations/twseOpenApi');
const { upsertStock } = require('../db');

function normalizeExternalQuote(data) {
  // 對常見欄位做容錯的標準化
  // 回傳物件形如 { id, name, price, change, changePercent, volume, market, industry, signals }
  if (!data) return null;
  const out = {};
  out.id = data.stockId || data.symbol || data.id || data.code || data.ticker;
  out.name = data.name || data.stockName || data.company || data.fullName || '';
  out.price = data.price || data.lastPrice || data.close || data.tradePrice || 0;
  out.change = (typeof data.change === 'number') ? data.change : (data.price && data.prevClose ? data.price - data.prevClose : data.change || 0);
  out.changePercent = data.changePercent || data.pctChange || (out.change && out.price ? (out.change / (out.price - out.change) * 100) : 0);
  out.volume = data.volume || data.tradeVolume || data.qty || 0;
  out.market = data.market || 'twse';
  out.industry = data.industry || data.sector || '';
  out.signals = data.signals || [];
  return out;
}

const fs = require('fs');
const { join } = require('path');

async function fetchAndStoreSingle(db, symbol, pathTemplate) {
  try {
    const path = pathTemplate.replace('{symbol}', symbol);
    const resp = await TwseOpenApi.fetchOpenApi(path, { symbol });
    // resp可能是直接物件或包含 data 層級
    const payload = resp && resp.data ? resp.data : resp;

    // 如果 payload 是陣列，找第一個或找到對應 symbol
    let item = null;
    if (Array.isArray(payload)) {
      item = payload.find(p => (p.stockId || p.symbol || p.id) == symbol) || payload[0];
    } else {
      item = payload;
    }

    const normalized = normalizeExternalQuote(item);
    if (normalized && normalized.id) {
      await upsertStock(db, normalized);
      return { success: true, id: normalized.id };
    }

    // 如果無法標準化，將原始回傳寫入 debug 檔以便分析
    try {
      const debugDir = join(__dirname, '../../data/debug');
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      const outPath = join(debugDir, `twse-debug-${symbol}-${Date.now()}.json`);
      fs.writeFileSync(outPath, JSON.stringify({ requestedPath: path, payload }, null, 2), 'utf-8');
      console.warn(`wrote debug payload for ${symbol} -> ${outPath}`);
    } catch (werr) {
      console.error('failed to write debug payload:', werr.message);
    }

    console.warn('no normalized data for symbol, raw payload saved');
    return { success: false, error: 'no normalized data', raw: payload };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function startSync(db, opts = {}) {
  const symbolsEnv = process.env.TWSE_SYNC_SYMBOLS || '';
  const symbols = opts.symbols && opts.symbols.length ? opts.symbols : (symbolsEnv ? symbolsEnv.split(',').map(s => s.trim()).filter(Boolean) : []);
  const intervalMs = parseInt(process.env.TWSE_SYNC_INTERVAL_MS || opts.intervalMs || (5 * 60 * 1000), 10);
  const pathTemplate = process.env.TWSE_OPENAPI_QUOTE_PATH || opts.pathTemplate || '/v1/quote/{symbol}';

  if (!db) throw new Error('db is required');

  let stopped = false;

  async function runOnce() {
    try {
      let targetSymbols = symbols.slice();
      if (!targetSymbols.length) {
        // fallback: read from db existing stocks
        targetSymbols = (db.data?.stocks || []).map(s => s.id).slice(0, 200);
      }

      if (!targetSymbols.length && typeof opts.getAll === 'function') {
        // try to get from helper
        targetSymbols = await opts.getAll();
      }

      if (!targetSymbols.length) return;

      for (const sym of targetSymbols) {
        if (stopped) break;
        const r = await fetchAndStoreSingle(db, sym, pathTemplate);
        if (!r.success) console.warn('sync single failed', sym, r.error);
        // small pause to avoid hammering
        await new Promise(r => setTimeout(r, 120));
      }

      await db.write();
    } catch (err) {
      console.error('twseSyncJob runOnce error:', err.message);
    }
  }

  // run immediately
  runOnce();

  const timer = setInterval(() => runOnce(), intervalMs);

  return {
    stop: () => { stopped = true; clearInterval(timer); }
  };
}

module.exports = { startSync };
