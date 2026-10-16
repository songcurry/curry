# 云服务器部署指南（Ubuntu / Debian）

从零把「朋友说」部署到你的云服务器。

---

## 🤔 要不要用 Docker？

**默认推荐：直接部署，不用 Docker。** 原因：

- 本项目**零 npm 依赖**（只用 Node 内置模块）+ **SQLite 单文件数据库**
- Docker 的价值（解决依赖隔离、复杂环境、多机编排）在这里**一条都不需要**
- 直接部署只需 1 条命令，Docker 要多一层镜像构建、卷挂载、网络概念

> 除非你**个人想统一用 Docker 管理所有服务**，否则没必要。想用的话见文末「Docker 部署」。

---

## ✅ 方式一：一键脚本（推荐）

把代码 clone 下来后，**一条命令搞定一切**（自动装 Node、部署、配开机自启）：

```bash
# 1. 拉代码
git clone https://github.com/songcurry/curry.git ~/curry
cd ~/curry

# 2. 一键部署（换成你自己的密码！）
sudo ADMIN_PASSWORD='你的强密码' bash deploy/install.sh
```

脚本会自动完成：检查/安装 Node 22 → 复制到 `/opt/friend-wall` → 注册 systemd 服务 → 启动 → 打印访问地址。

完成后访问 `http://你的服务器IP:3000/`。

> **记得去云控制台【安全组】放行 3000 端口**，否则外网打不开。

---

## 🔧 方式二：手动部署（了解每一步）

### 1. 安装 Node.js 22（必须 ≥ 22.5，用到内置 SQLite）

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # 应显示 v22.x
```

> 本项目零 npm 依赖，**不需要** `npm install`。

### 2. 获取代码

```bash
sudo mkdir -p /opt/friend-wall
sudo chown $USER /opt/friend-wall
git clone https://github.com/songcurry/curry.git /opt/friend-wall
cd /opt/friend-wall
```

### 3. 先手动试跑一次

```bash
PORT=3000 ADMIN_PASSWORD=你的密码 node server.js
# 看到 "🟢 朋友说 已启动" 即成功，Ctrl+C 退出
```

浏览器访问 `http://服务器公网IP:3000/` 确认能打开。
（打不开就去云控制台检查安全组是否放行 3000 端口）

### 4. 配置成系统服务（开机自启、崩溃自动重启）

```bash
# 编辑服务文件，改 User 和 ADMIN_PASSWORD 两处
vim deploy/friendwall.service

sudo cp deploy/friendwall.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now friendwall

# 常用管理命令
sudo systemctl status friendwall    # 看状态
sudo systemctl restart friendwall   # 重启
journalctl -u friendwall -f         # 看实时日志
```

### 5.（推荐）Nginx 反向代理 + 域名 + HTTPS

有了域名后（DNS A 记录指向服务器 IP）：

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/sites-available/friendwall > /dev/null <<'EOF'
server {
    listen 80;
    server_name 你的域名.com;   # 改成你的域名

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 5m;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/friendwall /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 一条命令配好 HTTPS 证书（自动续期）
sudo certbot --nginx -d 你的域名.com
```

之后直接访问 `https://你的域名.com` 即可。

---

## 🐳 方式三：Docker 部署（可选）

> 需要先装 Docker：`curl -fsSL https://get.docker.com | sh`

```bash
cd /opt/friend-wall/deploy

# 改 docker-compose.yml 里的 ADMIN_PASSWORD
vim docker-compose.yml

# 构建并启动
docker compose up -d --build

# 常用命令
docker compose logs -f       # 看日志
docker compose restart       # 重启
docker compose down          # 停止
```

数据通过 volume 挂载在 `deploy/data/`，容器删了数据还在。

---

## 数据与运维

- 所有数据存在 `/opt/friend-wall/data/friendwall.db`（SQLite 单文件）
- **备份**：`cp data/friendwall.db ~/backup-$(date +%F).db`
- **后台密码**：务必用 `ADMIN_PASSWORD` 环境变量改掉默认的 `admin123`
- **更新代码**：`cd /opt/friend-wall && git pull && sudo systemctl restart friendwall`

## 常见问题

| 问题 | 排查 |
|---|---|
| 打不开页面 | 安全组/防火墙是否放行端口；`systemctl status friendwall` 是否 active |
| 502 Bad Gateway | 后端没起来，`journalctl -u friendwall -n 50` 看日志 |
| Node 版本太低 | `node -v` 必须 ≥ 22.5（node:sqlite 要求） |
| 想换端口 | 改 service 文件里的 `Environment=PORT=xxx` 后 restart |
| 上传头像失败 | Nginx 下加大 `client_max_body_size` |
