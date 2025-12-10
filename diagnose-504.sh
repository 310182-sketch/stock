#!/bin/bash

# 診斷 504 錯誤的工具

echo "════════════════════════════════════════"
echo "  504 錯誤診斷工具"
echo "════════════════════════════════════════"
echo ""

echo "[1] 檢查 Node.js 進程"
echo "────────────────────────────────────────"
ps aux | grep -E "node|npm" | grep -v grep
echo ""

echo "[2] 檢查端口監聽"
echo "────────────────────────────────────────"
echo "後端伺服器 (3001):"
netstat -tuln 2>/dev/null | grep 3001 || echo "  ✗ 未監聽"
echo ""
echo "前端開發伺服器 (5173):"
netstat -tuln 2>/dev/null | grep 5173 || echo "  ✗ 未監聽"
echo ""

echo "[3] 連接測試"
echo "────────────────────────────────────────"
echo "測試後端健康檢查 (http://localhost:3001/health):"
timeout 5 curl -v http://localhost:3001/health 2>&1 | head -20
echo ""
echo "測試前端 (http://localhost:5173):"
timeout 5 curl -v http://localhost:5173 2>&1 | head -20
echo ""

echo "[4] 日誌診斷"
echo "────────────────────────────────────────"
echo "後端日誌 (最後 30 行):"
if [ -f /tmp/backend.log ]; then
  tail -30 /tmp/backend.log
else
  echo "  日誌文件不存在: /tmp/backend.log"
fi
echo ""
echo "前端日誌 (最後 30 行):"
if [ -f /tmp/frontend.log ]; then
  tail -30 /tmp/frontend.log
else
  echo "  日誌文件不存在: /tmp/frontend.log"
fi
echo ""

echo "[5] 快速修復建議"
echo "────────────────────────────────────────"
echo "1. 清理所有進程並重新啟動:"
echo "   bash /workspaces/stock/quick-start.sh"
echo ""
echo "2. 檢查後端是否啟動成功:"
echo "   curl -v http://localhost:3001/health"
echo ""
echo "3. 清空前端快取並重新加載:"
echo "   - 瀏覽器: Ctrl+Shift+Delete 清空快取"
echo "   - 重新載入頁面: Ctrl+F5"
echo ""
echo "4. 檢查 Vite 代理配置:"
echo "   cat /workspaces/stock/frontend/vite.config.js"
echo ""
echo "5. 查看完整日誌:"
echo "   tail -f /tmp/backend.log"
echo "   tail -f /tmp/frontend.log"
echo ""
echo "════════════════════════════════════════"
