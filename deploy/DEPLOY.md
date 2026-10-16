# 云服务器部署指南（Ubuntu / Debian）

从零把「朋友说」部署到你的云服务器，全程约 10 分钟。

## 前提

- 一台 Ubuntu/Debian 云服务器，能 SSH 登录
- 服务器安全组/防火墙放行端口（下文用 3000，可自定）

## 1. 安装 Node.js 22（必须 ≥ 22.5，用到内置 SQLite）

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # 应显示 v22.x
```

> 本项目零 npm 依赖，不需要 `npm install`。

## 2. 获取代码

```bash
sudo mkdir -p /opt/friend-wall
sudo chown $USER /opt/friend-wall
git clone https://github.com/songcurry/curry.git /opt/friend-wall
cd /opt/friend-wall
```

## 3. 先手动试跑一次

```bash
PORT=3000 ADMIN_PASSWORD=你的密码 node server.js
# 看到 "🟢 朋友说 已启动" 即成功，Ctrl+C 退出
```

浏览器访问 `http://服务器公网IP:3000/` 确认能打开。
（如果打不开，去云控制台检查安全组是否放行 3000 端口）

## 4. 配置成系统服务（开机自启、崩溃自动重启）

```bash
# 编辑服务文件，改两处：User 和 ADMIN_PASSWORD
vim deploy/friendwall.service

sudo cp deploy/friendwall.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now friendwall

# 常用管理命令
sudo systemctl status friendwall    # 看状态
sudo systemctl restart friendwall   # 重启
journalctl -u friendwall -f         # 看实时日志
```

## 5.（推荐）Nginx 反向代理 + 域名 + HTTPS

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

# 一条命令配好 HTTPS 证书
sudo certbot --nginx -d 你的域名.com
```

之后直接访问 `https://你的域名.com` 即可。

## 数据说明

- 所有数据存在 `/opt/friend-wall/data/friendwall.db`（SQLite 单文件）
- **备份**：定期拷走这个文件即可 `cp data/friendwall.db ~/backup/$(date +%F).db`
- **后台密码**：务必用环境变量 `ADMIN_PASSWORD` 改掉默认的 `admin123`

## 更新代码

```bash
cd /opt/friend-wall
git pull
sudo systemctl restart friendwall
```

## 常见问题

| 问题 | 排查 |
|---|---|
| 打不开页面 | 安全组/防火墙是否放行端口；`systemctl status friendwall` 是否 active |
| 502 Bad Gateway | 后端没起来，`journalctl -u friendwall -n 50` 看日志 |
| Node 版本太低 | `node -v` 必须 ≥ 22.5（node:sqlite 要求） |
| 想换端口 | 改 service 文件里的 `Environment=PORT=xxx` 后 restart |
