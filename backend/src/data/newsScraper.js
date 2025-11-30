const axios = require('axios');
const cheerio = require('cheerio');

const NEWS_URL = 'https://tw.stock.yahoo.com/news/';

async function fetchMarketNews() {
  try {
    const { data } = await axios.get(NEWS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 5000
    });
    const $ = cheerio.load(data);
    const newsItems = [];

    // 嘗試抓取 Yahoo 股市新聞列表
    // 選擇器可能需要根據 Yahoo 改版調整，這裡抓取常見的標題結構
    $('li, div').each((i, el) => {
      if (newsItems.length >= 10) return;

      const titleEl = $(el).find('h3 a');
      if (titleEl.length > 0) {
        const title = titleEl.text().trim();
        let link = titleEl.attr('href');
        
        if (title && link && title.length > 5) {
           if (!link.startsWith('http')) {
             link = `https://tw.stock.yahoo.com${link}`;
           }
           
           // 避免重複
           if (!newsItems.some(n => n.title === title)) {
             newsItems.push({
               title,
               link,
               source: 'Yahoo股市',
               time: new Date().toISOString()
             });
           }
        }
      }
    });

    if (newsItems.length === 0) {
      console.log('Yahoo scraper returned 0 items, using fallback.');
      return getMockNews();
    }

    return newsItems;
  } catch (error) {
    console.error('News scraping failed:', error.message);
    return getMockNews();
  }
}

function getMockNews() {
  return [
    {
      title: '台積電法說會釋利多 營收可望再創新高',
      link: '#',
      source: '模擬新聞',
      time: new Date().toISOString()
    },
    {
      title: '美股重挫影響 台股開盤下跌百點',
      link: '#',
      source: '模擬新聞',
      time: new Date().toISOString()
    },
    {
      title: 'AI 需求強勁 伺服器供應鏈受惠',
      link: '#',
      source: '模擬新聞',
      time: new Date().toISOString()
    },
    {
      title: '金融股獲利亮眼 殖利率題材發酵',
      link: '#',
      source: '模擬新聞',
      time: new Date().toISOString()
    },
    {
      title: '外資賣超百億 台幣貶值壓力大',
      link: '#',
      source: '模擬新聞',
      time: new Date().toISOString()
    }
  ];
}

module.exports = { fetchMarketNews };
