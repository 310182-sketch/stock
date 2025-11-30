const axios = require('axios');

const LINE_NOTIFY_API = 'https://notify-api.line.me/api/notify';

class LineNotify {
  constructor(token) {
    this.token = token;
  }

  /**
   * 發送 Line Notify 訊息
   * @param {string} message - 要發送的文字訊息
   * @returns {Promise<boolean>} - 是否發送成功
   */
  async send(message) {
    if (!this.token) {
      console.warn('Line Notify Token 未設定');
      return false;
    }

    try {
      const params = new URLSearchParams();
      params.append('message', message);

      await axios.post(LINE_NOTIFY_API, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${this.token}`
        }
      });
      console.log('Line Notify 發送成功');
      return true;
    } catch (error) {
      console.error('Line Notify 發送失敗:', error.response ? error.response.data : error.message);
      return false;
    }
  }
}

module.exports = LineNotify;
