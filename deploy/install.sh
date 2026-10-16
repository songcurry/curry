#!/usr/bin/env bash
# =============================================================
#  朋友说 · 一键部署脚本（Ubuntu / Debian）
#  用法：
#     sudo bash deploy/install.sh                    # 用默认密码
#     sudo ADMIN_PASSWORD=你的密码 bash deploy/install.sh
#  做的事：
#     1. 检查/安装 Node.js 22
#     2. 把当前项目复制到 /opt/friend-wall
#     3. 注册 systemd 服务并启动
# =============================================================
set -e

# ---------- 配置（可改） ----------
APP_DIR="/opt/friend-wall"
PORT="${PORT:-3000}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
NODE_MAJOR=22
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"   # 项目根目录

# ---------- 颜色 ----------
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
info(){ echo -e "${G}[✓]${N} $1"; }
warn(){ echo -e "${Y}[!]${N} $1"; }
err(){  echo -e "${R}[✗]${N} $1"; exit 1; }

# ---------- 必须 root ----------
[ "$(id -u)" -eq 0 ] || err "请用 root 运行：sudo bash deploy/install.sh"

echo "=========================================="
echo "  朋友说 · 部署开始"
echo "  项目目录：$SRC_DIR"
echo "  安装到：  $APP_DIR"
echo "  端口：    $PORT"
echo "=========================================="

# ---------- 1. 安装 Node ----------
need_node=0
if ! command -v node >/dev/null 2>&1; then
  need_node=1
else
  cur="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
  [ "$cur" -lt 22 ] && need_node=1
fi

if [ "$need_node" -eq 1 ]; then
  info "安装 Node.js ${NODE_MAJOR}.x ..."
  apt-get update -qq
  apt-get install -y -qq curl ca-certificates >/dev/null
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
fi
info "Node 版本：$(node -v)"

# 检查内置 sqlite 是否可用
node -e "require('node:sqlite')" 2>/dev/null || err "当前 Node 不支持 node:sqlite，请升级到 >= 22.5"
info "node:sqlite 可用"

# ---------- 2. 复制项目 ----------
info "复制项目到 $APP_DIR ..."
mkdir -p "$APP_DIR"
# 保留已有数据库（如果之前部署过）
if [ -f "$APP_DIR/data/friendwall.db" ]; then
  warn "检测到已有数据库，备份到 data/friendwall.db.bak"
  cp "$APP_DIR/data/friendwall.db" "$APP_DIR/data/friendwall.db.bak"
fi
cp -r "$SRC_DIR"/* "$APP_DIR"/ 2>/dev/null || true
# 排除一些文件
rm -rf "$APP_DIR/.git" "$APP_DIR/node_modules" 2>/dev/null || true
info "项目文件已就位"

# ---------- 3. systemd 服务 ----------
info "注册系统服务 ..."
cat > /etc/systemd/system/friendwall.service <<EOF
[Unit]
Description=Friend Wall - personal testimonial wall
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
ExecStart=$(command -v node) server.js
Environment=PORT=${PORT}
Environment=ADMIN_PASSWORD=${ADMIN_PASSWORD}
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable friendwall >/dev/null 2>&1
systemctl restart friendwall
sleep 2

# ---------- 4. 检查结果 ----------
if systemctl is-active --quiet friendwall; then
  info "服务已启动！"
else
  err "服务启动失败，查看日志：journalctl -u friendwall -n 50"
fi

# ---------- 5. 防火墙提示 ----------
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "${PORT}/tcp" >/dev/null 2>&1 && info "ufw 已放行 ${PORT} 端口"
fi

IP="$(curl -fsSL --max-time 5 ifconfig.me 2>/dev/null || echo '你的服务器IP')"

echo ""
echo "=========================================="
echo -e "  ${G}部署完成 🎉${N}"
echo "=========================================="
echo "  访问地址：  http://${IP}:${PORT}/"
echo "  后台地址：  http://${IP}:${PORT}/admin/"
echo "  后台密码：  ${ADMIN_PASSWORD}"
echo ""
echo "  常用命令："
echo "    systemctl status friendwall      # 查看状态"
echo "    systemctl restart friendwall     # 重启"
echo "    journalctl -u friendwall -f      # 实时日志"
echo ""
warn "如果浏览器打不开，请去云控制台【安全组】放行 ${PORT} 端口。"
warn "密码还是 admin123 的话，请尽快修改：编辑 /etc/systemd/system/friendwall.service"
