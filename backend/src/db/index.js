const { join } = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const fs = require('fs');

const DB_PATH = join(__dirname, '../../data/stocks-db.json');

function ensureDataDir() {
  const dataDir = join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

const DEFAULT_DATA = { stocks: [] };

async function init() {
  ensureDataDir();
  const adapter = new JSONFile(DB_PATH);
  const db = new Low(adapter, { ...DEFAULT_DATA });
  await db.read();
  db.data = db.data || { ...DEFAULT_DATA };
  await db.write();
  return db;
}

function convertSignals(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str;
  try { return JSON.parse(str); } catch (e) { return [String(str)]; }
}

async function upsertStock(db, stock) {
  const existingIdx = db.data.stocks.findIndex(s => s.id === stock.id);
  const record = {
    id: stock.id,
    name: stock.name,
    market: stock.market,
    industry: stock.industry,
    price: stock.price || stock.close || 0,
    change: stock.change || 0,
    changePercent: stock.changePercent || 0,
    volume: stock.volume || 0,
    rsi: stock.rsi || 0,
    ma5: stock.ma5 || 0,
    ma20: stock.ma20 || 0,
    ma60: stock.ma60 || 0,
    aiScore: stock.aiScore || 0,
    potentialScore: stock.potentialScore || 0,
    technicalScore: stock.technicalScore || 0,
    signals: convertSignals(stock.signals),
    lastUpdate: new Date().toISOString()
  };
  if (existingIdx === -1) {
    db.data.stocks.push(record);
  } else {
    db.data.stocks[existingIdx] = { ...db.data.stocks[existingIdx], ...record };
  }
}

async function bulkUpsert(db, stocks) {
  for (const stock of stocks) {
    await upsertStock(db, stock);
  }
  await db.write();
}

// Query helper
function queryStocks(db, { market, industry, search, page = 1, pageSize = 50, minVolume, maxVolume }) {
  let results = db.data.stocks.slice();
  if (market) results = results.filter(s => s.market === market);
  if (industry) results = results.filter(s => (s.industry || '').toLowerCase().includes(industry.toLowerCase()));
  if (search) {
    const term = String(search).toLowerCase();
    results = results.filter(s => s.id.includes(term) || (s.name || '').toLowerCase().includes(term));
  }
  if (typeof minVolume === 'number') results = results.filter(s => s.volume >= minVolume);
  if (typeof maxVolume === 'number') results = results.filter(s => s.volume <= maxVolume);
  const total = results.length;
  const start = (page - 1) * pageSize;
  const paged = results.slice(start, start + pageSize);
  return { total, page, pageSize, data: paged };
}

module.exports = { init, upsertStock, bulkUpsert, queryStocks, DB_PATH };
