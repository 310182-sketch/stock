/**
 * 全域常數設定檔
 * 集中管理所有魔術數字和設定值
 */

module.exports = {
  // API 設定
  API: {
    PORT: process.env.PORT || 3001,
    REQUEST_TIMEOUT_MS: 10000,
    REQUEST_DELAY_MS: 300,  // 避免被封鎖的請求間隔
    MAX_RETRIES: 3
  },

  // 快取設定 (毫秒)
  CACHE_TTL: {
    REALTIME: 30 * 1000,        // 即時價: 30 秒
    HISTORY: 5 * 60 * 1000,     // 歷史資料: 5 分鐘
    STOCK_LIST: 10 * 60 * 1000  // 股票清單: 10 分鐘
  },

  // 分頁設定
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 50,
    MAX_PAGE_SIZE: 200
  },

  // 回測設定
  BACKTEST: {
    DEFAULT_INITIAL_CAPITAL: 1000000,
    DEFAULT_POSITION_SIZE: 1,
    COMMISSION_RATE: 0.001425,  // 台股手續費 0.1425%
    TAX_RATE: 0.003,            // 台股交易稅 0.3%
    SLIPPAGE_RATE: 0.001,       // 滑價 0.1%
    FEE_RESERVE: 0.995          // 預留手續費空間
  },

  // 技術指標預設值
  INDICATORS: {
    RSI_PERIOD: 14,
    MA_FAST_PERIOD: 5,
    MA_SLOW_PERIOD: 20,
    MA_LONG_PERIOD: 60,
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9,
    BOLLINGER_PERIOD: 20,
    BOLLINGER_STD: 2,
    KD_K_PERIOD: 9,
    KD_D_PERIOD: 3,
    KD_SLOWING: 3
  },

  // 評分設定
  SCORING: {
    RSI_OVERSOLD: 30,
    RSI_OVERBOUGHT: 70,
    HIGH_VOLUME_THRESHOLD: 50000000,
    LOW_VOLUME_THRESHOLD: 1000000
  },

  // 產業分類
  INDUSTRIES: {
    HOT: ['半導體', 'AI', '電子', 'ETF', '生技醫療'],
    STABLE: ['金融保險', '電信', '公用事業']
  },

  // 驗證正規表達式
  VALIDATION: {
    SYMBOL_REGEX: /^[0-9A-Za-z]{4,6}$/,
    MAX_MONTHS: 36
  },

  // 同步設定
  SYNC: {
    INTERVAL_MS: 5 * 60 * 1000  // 5 分鐘
  }
};
