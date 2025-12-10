# 504 閘道超時錯誤 - 完整故障排除指南

## 快速修復（3 步）

### 步驟 1: 清理並啟動系統
```bash
bash /workspaces/stock/quick-start.sh
```

### 步驟 2: 等待系統完全啟動
```
清理舊進程... ✓
啟動後端伺服器... ✓
啟動前端開發伺服器... ✓
```

### 步驟 3: 打開瀏覽器
```
http://localhost:5173
```

---

## 504 錯誤深度診斷

### 診斷 504 的原因

504 Gateway Timeout 通常由以下原因引起：

| 原因 | 症狀 | 解決方案 |
|------|------|---------|
| 後端伺服器未運行 | curl http://localhost:3001 無反應 | 執行 `node src/app.js` |
| 前端開發伺服器未運行 | curl http://localhost:5173 無反應 | 執行 `npm run dev` |
| 後端啟動超時 | 後端進程存在但無響應 | 檢查日誌，等待更長 |
| 代理配置錯誤 | 代理連接失敗 | 檢查 vite.config.js |
| 網路連接問題 | localhost 無法解析 | 檢查 /etc/hosts |
| 防火牆阻擋 | 無法連接到端口 | 檢查防火牆設置 |

### 運行診斷工具

```bash
bash /workspaces/stock/diagnose-504.sh
```

這個工具會：
1. ✓ 列出所有運行的 Node.js 進程
2. ✓ 檢查端口 3001 和 5173 是否監聽
3. ✓ 測試 HTTP 連接
4. ✓ 顯示後端和前端日誌
5. ✓ 提供修復建議

---

## 常見問題和解決方案

### 問題 1: "curl -s http://localhost:5173 跑不出來"

**症狀**: 前端開發伺服器沒有響應

**解決方案**:
```bash
# 1. 檢查是否有進程運行
ps aux | grep "npm run dev"

# 2. 如果沒有，啟動它
cd /workspaces/stock/frontend
npm run dev > /tmp/frontend.log 2>&1 &

# 3. 等待 5-10 秒讓 Vite 初始化完成
sleep 10
curl -s http://localhost:5173 | head -c 100
```

### 問題 2: "後端伺服器無法連接"

**症狀**: `curl http://localhost:3001/health` 無反應

**解決方案**:
```bash
# 1. 啟動後端
cd /workspaces/stock/backend
node src/app.js > /tmp/backend.log 2>&1 &

# 2. 等待 3-5 秒讓後端初始化
sleep 5

# 3. 測試連接
curl -v http://localhost:3001/health

# 4. 檢查日誌
tail -30 /tmp/backend.log
```

### 問題 3: "代理連接失敗 (API 返回 504)"

**症狀**: 瀏覽器發出 /api/... 請求時返回 504

**解決方案**:
```bash
# 1. 驗證兩個伺服器都在運行
curl http://localhost:3001/health
curl http://localhost:5173

# 2. 測試直接代理連接
curl -v http://localhost:5173/api/tw/stocks

# 3. 檢查 vite.config.js
cat /workspaces/stock/frontend/vite.config.js

# 4. 檢查 Vite 日誌
tail -50 /tmp/frontend.log | grep -i "proxy\|error\|api"
```

### 問題 4: "進程卡住或無反應"

**症狀**: npm run dev 進程運行但頁面無法加載

**解決方案**:
```bash
# 1. 殺死所有舊進程
pkill -9 node
pkill -9 -f "npm run"
sleep 2

# 2. 檢查依賴完整性
cd /workspaces/stock/frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# 3. 重新啟動
npm run dev
```

---

## 詳細的啟動流程

### 後端啟動 (應該看到的日誌)

```
╔════════════════════════════════════════╗
║     🚀 股票回測 API v1.0              ║
╚════════════════════════════════════════╝
API 啟動於 http://0.0.0.0:3001
```

如果沒看到這個，檢查:
```bash
tail -50 /tmp/backend.log
```

### 前端啟動 (應該看到的日誌)

```
  VITE v... dev server running at:

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

如果沒看到，檢查:
```bash
tail -50 /tmp/frontend.log
```

---

## 實時監控日誌

### 同時監控兩個日誌

```bash
# 終端 1: 後端日誌
tail -f /tmp/backend.log

# 終端 2: 前端日誌
tail -f /tmp/frontend.log

# 終端 3: 測試請求
watch -n 1 'curl -s http://localhost:5173/api/health | jq'
```

### 查找特定錯誤

```bash
# 搜索錯誤
grep -i "error\|fail\|timeout" /tmp/backend.log
grep -i "error\|fail\|timeout" /tmp/frontend.log

# 搜索代理相關
grep -i "proxy\|api\|gateway" /tmp/frontend.log
```

---

## 完整重置程序

如果上述所有方法都不工作，執行完整重置:

```bash
#!/bin/bash

# 1. 清理所有進程
echo "清理進程..."
pkill -9 node
pkill -9 -f "npm run"
pkill -9 -f "npm install"
sleep 2

# 2. 清理依賴
echo "清理依賴..."
cd /workspaces/stock/backend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps > /tmp/npm-backend.log 2>&1

cd /workspaces/stock/frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps > /tmp/npm-frontend.log 2>&1

# 3. 啟動系統
echo "啟動系統..."
bash /workspaces/stock/quick-start.sh
```

保存為 `reset.sh` 並執行:
```bash
bash /workspaces/stock/reset.sh
```

---

## 驗證清單

系統啟動成功時，應該通過以下檢查:

- [ ] 後端進程運行中 (`ps aux | grep node`)
- [ ] 前端進程運行中 (`ps aux | grep npm`)
- [ ] 後端響應 (`curl http://localhost:3001/health`)
- [ ] 前端響應 (`curl http://localhost:5173`)
- [ ] 代理工作 (`curl http://localhost:5173/api/tw/stocks`)
- [ ] 瀏覽器可訪問 (`http://localhost:5173`)
- [ ] 無 console 錯誤 (F12 檢查開發者工具)
- [ ] 無 504 錯誤

---

## 關鍵命令參考

```bash
# 查看進程
ps aux | grep -E "node|npm"

# 查看端口
netstat -tuln | grep -E "3001|5173"
lsof -i :3001
lsof -i :5173

# 測試連接
curl -v http://localhost:3001/health
curl -v http://localhost:5173
curl -v http://localhost:5173/api/tw/stocks

# 查看日誌
tail -f /tmp/backend.log
tail -f /tmp/frontend.log

# 清理進程
pkill -9 node
pkill -9 -f "npm run"

# 快速啟動
bash /workspaces/stock/quick-start.sh

# 診斷
bash /workspaces/stock/diagnose-504.sh
```

---

## 聯繫和支援

如果問題仍未解決，請:

1. 運行診斷工具並保存輸出
2. 檢查最後 50 行日誌
3. 確認所有進程都在運行
4. 嘗試完整重置程序
5. 清空瀏覽器快取 (Ctrl+Shift+Delete)

---

**最後更新**: 2025-12-09
**版本**: 1.0
