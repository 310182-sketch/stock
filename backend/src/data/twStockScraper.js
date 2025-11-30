const axios = require('axios');
const cheerio = require('cheerio');
const pLimit = require('p-limit');

const TWSE_BASE = 'https://www.twse.com.tw/exchangeReport';
const TPEX_BASE = 'https://www.tpex.org.tw/web/stock';

async function fetchHtml(url, timeout = 15000) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MyStockCrawler/1.0; +https://example.com)'
      },
      timeout
    });
    return res.data;
  } catch (err) {
    console.error(`fetchHtml error for ${url}: ${err.message}`);
    throw err;
  }
}

function parseTWSEStockDayHtml(html) {
  const $ = cheerio.load(html);
  const rows = $('table tbody tr');
  const results = [];
  rows.each((i, el) => {
    const tds = $(el).find('td');
    if (tds.length < 9) return;
    const date = $(tds[0]).text().trim();
    const volume = $(tds[1]).text().trim().replace(/,/g, '') || '0';
    const turnover = $(tds[2]).text().trim().replace(/,/g, '') || '0';
    const open = parseFloat($(tds[3]).text().trim().replace(/,/g, '')) || 0;
    const high = parseFloat($(tds[4]).text().trim().replace(/,/g, '')) || 0;
    const low = parseFloat($(tds[5]).text().trim().replace(/,/g, '')) || 0;
    const close = parseFloat($(tds[6]).text().trim().replace(/,/g, '')) || 0;
    const change = parseFloat($(tds[7]).text().trim().replace(/,/g, '')) || 0;
    results.push({ date, volume: parseInt(volume, 10), turnover: parseInt(turnover, 10), open, high, low, close, change });
  });
  return results;
}

async function getTWSEStockDataFromHTML(stockId, year, month) {
  // Build date  YYYYMM01
  const date = `${year}${String(month).padStart(2, '0')}01`;
  const url = `${TWSE_BASE}/STOCK_DAY?response=html&date=${date}&stockNo=${stockId}`;
  try {
    const html = await fetchHtml(url);
    return parseTWSEStockDayHtml(html);
  } catch (err) {
    console.error(`getTWSEStockDataFromHTML failed: ${err.message}`);
    return [];
  }
}

function parseTWSEAllHtml(html) {
  const $ = cheerio.load(html);
  const rows = $('table tbody tr');
  const results = [];
  rows.each((i, el) => {
    const tds = $(el).find('td');
    if (tds.length < 10) return;
    const stockId = $(tds[0]).text().trim();
    const name = $(tds[1]).text().trim();
    const volume = parseInt($(tds[2]).text().trim().replace(/,/g, ''), 10) || 0;
    const tradeValue = parseInt($(tds[3]).text().trim().replace(/,/g, ''), 10) || 0;
    const open = parseFloat($(tds[4]).text().trim().replace(/,/g, '')) || 0;
    const high = parseFloat($(tds[5]).text().trim().replace(/,/g, '')) || 0;
    const low = parseFloat($(tds[6]).text().trim().replace(/,/g, '')) || 0;
    const close = parseFloat($(tds[7]).text().trim().replace(/,/g, '')) || 0;
    const change = parseFloat($(tds[8]).text().trim().replace(/,/g, '')) || 0;
    const transactions = parseInt($(tds[9]).text().trim().replace(/,/g, ''), 10) || 0;
    results.push({ stockId, name, volume, tradeValue, open, high, low, close, change, transactions, market: 'twse' });
  });
  return results;
}

async function getAllTWSEStocksFromHTML() {
  const url = `${TWSE_BASE}/STOCK_DAY_ALL?response=html`;
  try {
    const html = await fetchHtml(url, 30000);
    return parseTWSEAllHtml(html);
  } catch (err) {
    console.error('getAllTWSEStocksFromHTML failed', err.message);
    return [];
  }
}

function parseTPEXHtml(html) {
  const $ = cheerio.load(html);
  const rows = $('table tbody tr');
  const results = [];
  rows.each((i, el) => {
    const tds = $(el).find('td');
    if (tds.length < 10) return;
    const stockId = $(tds[0]).text().trim();
    const name = $(tds[1]).text().trim();
    const close = parseFloat($(tds[2]).text().trim().replace(/,/g, '')) || 0;
    const change = parseFloat($(tds[3]).text().trim().replace(/,/g, '')) || 0;
    const open = parseFloat($(tds[4]).text().trim().replace(/,/g, '')) || 0;
    const high = parseFloat($(tds[5]).text().trim().replace(/,/g, '')) || 0;
    const low = parseFloat($(tds[6]).text().trim().replace(/,/g, '')) || 0;
    const volume = parseInt($(tds[7]).text().trim().replace(/,/g, ''), 10) * 1000 || 0;
    const tradeValue = parseInt($(tds[8]).text().trim().replace(/,/g, ''), 10) * 1000 || 0;
    const transactions = parseInt($(tds[9]).text().trim().replace(/,/g, ''), 10) || 0;
    results.push({ stockId, name, close, change, open, high, low, volume, tradeValue, transactions, market: 'tpex' });
  });
  return results;
}

async function getAllTPExStocksFromHTML() {
  const today = new Date();
  const dateStr = `${today.getFullYear() - 1911}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
  const url = `${TPEX_BASE}/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&d=${dateStr}&se=EW`;
  try {
    const html = await fetchHtml(url, 30000);
    return parseTPEXHtml(html);
  } catch (err) {
    console.error('getAllTPExStocksFromHTML failed', err.message);
    return [];
  }
}

// Controlled concurrent scraper for many symbols
async function scrapeMany(fn, symbols, concurrency = 6) {
  const limit = pLimit(concurrency);
  const tasks = symbols.map(s => limit(() => fn(s)));
  return (await Promise.all(tasks)).flat();
}

module.exports = {
  fetchHtml,
  getTWSEStockDataFromHTML,
  getAllTWSEStocksFromHTML,
  getAllTPExStocksFromHTML,
  parseTPEXHtml,
  parseTWSEAllHtml,
  scrapeMany
};
