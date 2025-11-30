const POSITIVE_KEYWORDS = [
  '上漲', '漲停', '飆漲', '創高', '新高', '利多', '買進', '看好', '加碼', '強勢', 
  '回升', '成長', '獲利', '優於預期', '旺季', '復甦', '突破', '站上', '紅盤', '大漲',
  '反彈', '收紅', '熱絡', '搶眼', '攻頂'
];

const NEGATIVE_KEYWORDS = [
  '下跌', '跌停', '重挫', '破底', '新低', '利空', '賣出', '看淡', '減碼', '弱勢',
  '回檔', '衰退', '虧損', '不如預期', '淡季', '疲弱', '跌破', '失守', '綠盤', '大跌',
  '修正', '收黑', '低迷', '保守', '探底'
];

function analyzeSentiment(text) {
  if (!text) return { score: 0, sentiment: 'neutral', keywords: [] };
  
  let score = 0;
  const foundPositive = [];
  const foundNegative = [];

  POSITIVE_KEYWORDS.forEach(word => {
    if (text.includes(word)) {
      score += 1;
      foundPositive.push(word);
    }
  });

  NEGATIVE_KEYWORDS.forEach(word => {
    if (text.includes(word)) {
      score -= 1;
      foundNegative.push(word);
    }
  });

  let sentiment = 'neutral';
  if (score > 0) sentiment = 'positive';
  if (score < 0) sentiment = 'negative';

  return {
    score,
    sentiment,
    keywords: [...foundPositive, ...foundNegative]
  };
}

module.exports = { analyzeSentiment };
