#!/bin/bash

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}  股票應用啟動腳本 v1.0${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"

# 步驟 1: 清理舊進程
echo -e "\n${YELLOW}[1/6] 清理舊進程...${NC}"
pkill -9 -f "node src/app.js" 2>/dev/null
pkill -9 -f "npm run dev" 2>/dev/null
pkill -9 node 2>/dev/null
sleep 2
echo -e "${GREEN}✓ 舊進程已清理${NC}"

# 步驟 2: 驗證目錄
echo -e "\n${YELLOW}[2/6] 驗證項目結構...${NC}"
if [ ! -d "/workspaces/stock/backend" ]; then
  echo -e "${RED}✗ 後端目錄不存在${NC}"
  exit 1
fi
if [ ! -d "/workspaces/stock/frontend" ]; then
  echo -e "${RED}✗ 前端目錄不存在${NC}"
  exit 1
fi
echo -e "${GREEN}✓ 項目結構正確${NC}"

# 步驟 3: 啟動後端
echo -e "\n${YELLOW}[3/6] 啟動後端伺服器...${NC}"
cd /workspaces/stock/backend
echo "執行: node src/app.js"
node src/app.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "後端進程 PID: ${BLUE}$BACKEND_PID${NC}"

# 等待後端啟動
sleep 4
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo -e "${GREEN}✓ 後端已啟動${NC}"
  curl -s http://localhost:3001/health | head -c 150
  echo -e "\n"
else
  echo -e "${RED}✗ 後端啟動失敗或無法響應${NC}"
  echo -e "檢查日誌: ${BLUE}tail -30 /tmp/backend.log${NC}"
  echo "日誌內容："
  tail -20 /tmp/backend.log
fi

# 步驟 4: 啟動前端
echo -e "\n${YELLOW}[4/6] 啟動前端開發伺服器...${NC}"
cd /workspaces/stock/frontend
echo "執行: npm run dev"
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "前端進程 PID: ${BLUE}$FRONTEND_PID${NC}"

# 等待前端啟動
sleep 6
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ 前端已啟動${NC}"
else
  echo -e "${RED}⚠ 前端可能未完全啟動${NC}"
  echo -e "檢查日誌: ${BLUE}tail -30 /tmp/frontend.log${NC}"
  echo "日誌內容："
  tail -20 /tmp/frontend.log
fi

# 步驟 5: 驗證連接
echo -e "\n${YELLOW}[5/6] 驗證系統連接...${NC}"
echo "後端健康檢查 (http://localhost:3001/health):"
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo -e "${GREEN}✓ 後端可達${NC}"
else
  echo -e "${RED}✗ 後端不可達${NC}"
fi

echo "前端連接 (http://localhost:5173):"
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ 前端可達${NC}"
else
  echo -e "${RED}✗ 前端不可達${NC}"
fi

echo "代理連接 (http://localhost:5173/api/health):"
if curl -s http://localhost:5173/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}✓ 代理可達${NC}"
else
  echo -e "${RED}⚠ 代理暫不可達（可能是正常的，前端可能還在初始化）${NC}"
fi

# 步驟 6: 總結
echo -e "\n${YELLOW}[6/6] 啟動摘要${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "後端伺服器: ${BLUE}http://localhost:3001${NC} (PID: $BACKEND_PID)"
echo -e "前端應用:  ${BLUE}http://localhost:5173${NC} (PID: $FRONTEND_PID)"
echo -e "API 代理:  ${BLUE}http://localhost:5173/api${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}日誌文件位置:${NC}"
echo -e "  後端: ${BLUE}tail -f /tmp/backend.log${NC}"
echo -e "  前端: ${BLUE}tail -f /tmp/frontend.log${NC}"

echo -e "\n${YELLOW}停止服務:${NC}"
echo -e "  ${BLUE}pkill -9 -f 'node src/app.js'${NC}"
echo -e "  ${BLUE}pkill -9 -f 'npm run dev'${NC}"

echo -e "\n${YELLOW}清空進程並重新啟動:${NC}"
echo -e "  ${BLUE}bash /workspaces/stock/startup.sh${NC}"

echo -e "\n${GREEN}✓ 啟動完成！${NC}"
echo -e "請在瀏覽器中打開: ${BLUE}http://localhost:5173${NC}"
