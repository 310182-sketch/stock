#!/bin/bash

# 快速啟動腳本 - 簡化版本

echo "清理舊進程..."
pkill -9 node 2>/dev/null
pkill -9 -f "npm run" 2>/dev/null
sleep 2

echo "啟動後端伺服器..."
cd /workspaces/stock/backend
node src/app.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "後端 PID: $BACKEND_PID"
sleep 4

echo "啟動前端開發伺服器..."
cd /workspaces/stock/frontend
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "前端 PID: $FRONTEND_PID"
sleep 6

echo ""
echo "════════════════════════════════════════"
echo "系統啟動完成！"
echo "════════════════════════════════════════"
echo ""
echo "後端: http://localhost:3001"
echo "前端: http://localhost:5173"
echo ""
echo "後端日誌: tail -f /tmp/backend.log"
echo "前端日誌: tail -f /tmp/frontend.log"
echo ""
echo "測試連接:"
curl -s http://localhost:3001/health | head -c 100
echo ""
echo ""

# 保持腳本運行以觀察日誌
echo "實時監控日誌（按 Ctrl+C 退出）..."
echo ""
tail -f /tmp/backend.log &
TAIL_PID=$!
wait $TAIL_PID
