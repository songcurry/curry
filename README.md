# 朋友说 · 个人评价墙

一个「朋友真诚夸你，你体面展示」的三端应用：官网展示 + 朋友填写 + 站长后台。

**技术栈**：原生 HTML/CSS/JS 前端 + Node.js 后端（零 npm 依赖，使用内置 SQLite）。

## 三端一览

| 页面 | 地址 | 谁用 | 功能 |
|---|---|---|---|
| 导航入口 | `/` | 你自己 | 三端入口汇总 |
| 官网 | `/site/` | 所有访客 | 沉浸式首屏（粒子场）+ 星图评价墙 + 关于/近况 |
| 填写端 | `/write/` | 你的朋友 | 写评价、传头像、打分、选择是否公开 |
| 后台 | `/admin/` | 只有你 | 审核/置顶/隐藏/删除留言、编辑资料、切换主题、看统计 |

**后台密码**：默认 `admin123`，生产环境务必用环境变量 `ADMIN_PASSWORD` 修改。

## 快速开始

```bash
# 要求 Node.js >= 22.5（内置 node:sqlite），零 npm 依赖，无需 install
node server.js
# 打开 http://localhost:3000
```

开发模式（改代码自动重启）：

```bash
npm run dev
```

## 目录结构

```
friend-wall/
├── server.js               # ⭐ 后端（API + 静态文件托管，零依赖）
├── package.json
├── index.html              # 导航入口
├── site/                   # 🌐 官网展示端
├── write/                  # ✍️ 朋友填写端
├── admin/                  # 🔐 站长后台
├── shared/
│   ├── style.css           # 全局主题（CSS 变量，三套皮肤）
│   └── api.js              # ⭐ 数据层（对接后端 REST 接口）
├── deploy/
│   ├── friendwall.service  # systemd 服务配置
│   └── DEPLOY.md           # ⭐ 云服务器部署指南（Ubuntu）
└── data/                   # SQLite 数据库（自动创建，git 忽略）
```

## 后端 API

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/testimonials/public` | 已发布的公开留言 | 无 |
| GET | `/api/profile` | 个人资料 | 无 |
| POST | `/api/testimonials` | 提交留言（进入待审核） | 无 |
| POST | `/api/login` | 后台登录，返回 token | 无 |
| GET | `/api/admin/testimonials` | 全部留言 | ✅ |
| GET | `/api/admin/stats` | 统计数据 | ✅ |
| PUT | `/api/admin/testimonial/:id` | 修改/审核/置顶 | ✅ |
| DELETE | `/api/admin/testimonial/:id` | 删除留言 | ✅ |
| PUT | `/api/admin/profile` | 更新个人资料 | ✅ |
| POST | `/api/admin/reset` | 重置演示数据 | ✅ |

鉴权方式：登录后拿 token，后续请求带 `Authorization: Bearer <token>`。

## 部署到云服务器

完整步骤见 **[deploy/DEPLOY.md](deploy/DEPLOY.md)**（Node 安装 → 拉代码 → systemd 服务 → Nginx + HTTPS）。

数据备份：定期拷贝 `data/friendwall.db` 一个文件即可。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | 3000 | 监听端口 |
| `ADMIN_PASSWORD` | admin123 | 后台密码 |
| `DB_PATH` | ./data/friendwall.db | 数据库文件路径 |
