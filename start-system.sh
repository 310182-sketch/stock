#!/bin/bash

# 色彩定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 工作目錄
WORK_DIR="/workspaces/stock"
BACKEND_DIR="$WORK_DIR/backend"
FRONTEND_DIR="$WORK_DIR/frontend"

# 函數：打印標題
print_title() {
  echo -e "\n${BLUE}╔════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  $1${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}\n"
}

# 函數：檢查命令是否存在
check_cmd() {
  if ! command -v $1 &> /dev/null; then
    echo -e "${RED}✗ $1 未安裝${NC}"
    return 1
  fi
  return 0
}

# 函數：檢查端口
check_port() {
  local port=$1
  local service=$2
  if netstat -tuln 2>/dev/null | grep -q ":$port"; then
    echo -e "${GREEN}✓ $service 正在監聽端口 $port${NC}"
    return 0
  else
    echo -e "${YELLOW}⚠ 端口 $port 未被使用${NC}"
    return 1
  fi
}

# 函數：測試連接
test_connection() {
  local url=$1
  local name=$2
  if curl -s --connect-timeout 3 "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ $name 可連接${NC}"
    return 0
  else
    echo -e "${RED}✗ $name 無法連接${NC}"
    return 1
  fi
}

print_title "系統診斷和啟動"

# ================== 環境檢查 ==================
echo -e "${CYAN}[環境檢查]${NC}"
check_cmd "node" || { echo -e "${RED}Node.js 未安裝${NC}"; exit 1; }
check_cmd "npm" || { echo -e "${RED}npm 未安裝${NC}"; exit 1; }
check_cmd "curl" || { echo -e "${RED}curl 未安裝${NC}"; exit 1; }
echo -e "${GREEN}✓ 所有必需命令已安裝${NC}\n"

# ================== 驗證目錄 ==================
echo -e "${CYAN}[目錄驗證]${NC}"
if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
  echo -e "${RED}✗ 項目目錄不完整${NC}"
  exit 1
fi
echo -e "${GREEN}✓ 後端目錄: $BACKEND_DIR${NC}"
echo -e "${GREEN}✓ 前端目錄: $FRONTEND_DIR${NC}\n"

# ================== 清理舊進程 ==================
print_title "清理舊進程"
echo -e "${CYAN}[清理 Node.js 進程]${NC}"
pkill -9 -f "node src/app.js" 2>/dev/null
pkill -9 -f "npm run dev" 2>/dev/null
pkill -9 -f "npm run build" 2>/dev/null
pkill -9 node 2>/dev/null
sleep 2
echo -e "${GREEN}✓ 已清理所有 Node.js 進程${NC}\n"

# ================== 驗證依賴 ==================
print_title "驗證依賴"
echo -e "${CYAN}[檢查後端依賴]${NC}"
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo -e "${YELLOW}⚠ 後端 node_modules 不存在，正在安裝...${NC}"
  cd "$BACKEND_DIR"
  npm install --legacy-peer-deps > /tmp/npm-backend.log 2>&1
  echo -e "${GREEN}✓ 後端依賴已安裝${NC}\n"
else
  echo -e "${GREEN}✓ 後端依賴已存在${NC}\n"
fi

echo -e "${CYAN}[檢查前端依賴]${NC}"
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo -e "${YELLOW}⚠ 前端 node_modules 不存在，正在安裝...${NC}"
  cd "$FRONTEND_DIR"
  npm install --legacy-peer-deps > /tmp/npm-frontend.log 2>&1
  echo -e "${GREEN}✓ 前端依賴已安裝${NC}\n"
else
  echo -e "${GREEN}✓ 前端依賴已存在${NC}\n"
fi

# ================== 啟動後端 ==================
print_title "啟動後端伺服器"
cd "$BACKEND_DIR"
echo -e "${CYAN}[啟動過程]${NC}"
echo "命令: node src/app.js"
node src/app.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "進程 PID: ${BLUE}$BACKEND_PID${NC}"

# 等待後端啟動
echo -e "\n${CYAN}[等待後端初始化]${NC}"
for i in {1..15}; do
  if test_connection "http://localhost:3001/health" "後端"; then
    sleep 1
    echo -e "${GREEN}✓ 後端已完全啟動${NC}"
    curl -s http://localhost:3001/health | head -c 200
    echo -e "\n"
    break
  fi
  echo -n "."
  sleep 1
done

# ================== 啟動前端 ==================
print_title "啟動前端開發伺服器"
cd "$FRONTEND_DIR"
echo -e "${CYAN}[啟動過程]${NC}"
echo "命令: npm run dev"
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "進程 PID: ${BLUE}$FRONTEND_PID${NC}"

# 等待前端啟動
echo -e "\n${CYAN}[等待前端初始化]${NC}"
for i in {1..20}; do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 前端已完全啟動${NC}\n"
    break
  fi
  echo -n "."
  sleep 1
done

# ================== 系統驗證 ==================
print_title "系統驗證"

echo -e "${CYAN}[進程檢查]${NC}"
ps aux | grep "node src/app.js" | grep -v grep && echo -e "${GREEN}✓ 後端進程運行中${NC}" || echo -e "${RED}✗ 後端進程未運行${NC}"
ps aux | grep "npm run dev" | grep -v grep && echo -e "${GREEN}✓ 前端進程運行中${NC}" || echo -e "${RED}✗ 前端進程未運行${NC}"

echo -e "\n${CYAN}[連接測試]${NC}"
test_connection "http://localhost:3001/health" "後端 API (3001)"
test_connection "http://localhost:5173" "前端應用 (5173)"
test_connection "http://localhost:5173/api/tw/stocks" "API 代理"

# ================== 最終摘要 ==================
print_title "啟動完成"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "後端伺服器: ${CYAN}http://localhost:3001${NC}"
echo -e "  ├─ 健康檢查: ${CYAN}http://localhost:3001/health${NC}"
echo -e "  └─ PID: ${BLUE}$BACKEND_PID${NC}"
echo -e "\n前端應用: ${CYAN}http://localhost:5173${NC}"
echo -e "  ├─ 開發伺服器: ${CYAN}http://localhost:5173${NC}"
echo -e "  ├─ API 代理: ${CYAN}http://localhost:5173/api${NC}"
echo -e "  └─ PID: ${BLUE}$FRONTEND_PID${NC}"
echo -e "\n${GREEN}════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}日誌位置:${NC}"
echo -e "  後端: ${BLUE}tail -f /tmp/backend.log${NC}"
echo -e "  前端: ${BLUE}tail -f /tmp/frontend.log${NC}"

echo -e "\n${YELLOW}常用命令:${NC}"
echo -e "  ${BLUE}# 查看實時日誌${NC}"
echo -e "  ${CYAN}tail -f /tmp/backend.log${NC}"
echo -e "  ${CYAN}tail -f /tmp/frontend.log${NC}"

echo -e "\n  ${BLUE}# 停止服務${NC}"
echo -e "  ${CYAN}pkill -9 -f 'node src/app.js'${NC}"
echo -e "  ${CYAN}pkill -9 -f 'npm run dev'${NC}"

echo -e "\n  ${BLUE}# 重新啟動${NC}"
echo -e "  ${CYAN}bash /workspaces/stock/startup.sh${NC}"

echo -e "\n${GREEN}✓ 系統已就緒！${NC}"
echo -e "在瀏覽器中打開: ${CYAN}http://localhost:5173${NC}\n"
