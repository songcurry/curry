/* =========================================================
   server.js —— 「朋友说」后端服务
   零外部依赖：仅用 Node 内置模块（http / node:sqlite / crypto）
   启动：node server.js
   环境变量：
     PORT             监听端口（默认 3000）
     ADMIN_PASSWORD   后台密码（默认 admin123）
     DB_PATH          SQLite 文件路径（默认 ./data/friendwall.db）
   要求 Node.js >= 22.5（内置 node:sqlite）
   ========================================================= */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ROOT = __dirname;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'friendwall.db');

/* ---------- 工具（先声明，供下方使用） ---------- */
const uid = () => 't_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const nowTs = () => Date.now();

/* ---------- 数据库初始化 ---------- */
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS testimonials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    content TEXT NOT NULL,
    relation TEXT DEFAULT '朋友',
    rating INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    pinned INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT
  );
`);

/* ---------- 默认资料 ---------- */
const DEFAULT_PROFILE = {
  name: '你的名字',
  tagline: '设计爱好者 / 咖啡续命 / 永远在路上',
  avatar: '',
  about: '这里是属于我的一块数字自留地。不追流量，不服务 KPI，只收集朋友们真诚的话。',
  now: [
    { k: '在做', v: '搭这个朋友评价墙' },
    { k: '在看', v: '《三体》重读第三遍' },
  ],
  links: [
    { name: 'GitHub', icon: 'GH', url: '#' },
    { name: 'Email', icon: '@', url: 'mailto:hello@example.com' },
  ],
  theme: 'aurora',
};

function getProfile() {
  const row = db.prepare('SELECT data FROM profile WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT INTO profile (id, data) VALUES (1, ?)').run(JSON.stringify(DEFAULT_PROFILE));
    return DEFAULT_PROFILE;
  }
  try { return JSON.parse(row.data); } catch { return DEFAULT_PROFILE; }
}
getProfile();

/* ---------- 演示种子数据（首次空库时写入） ---------- */
(function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM testimonials').get();
  if (n > 0) return;
  const now = nowTs(), day = 86400000;
  const rows = [
    ['阿哲', '朋友', '认识你十年，从没见你对谁敷衍过。有你在的局，永远不冷场。', 5, 1, 1, now - day * 12],
    ['林小雨', '同事', '共事三年，你是我见过最靠谱的搭档。再烂的摊子到你手里都能理出头绪。', 5, 0, 0, now - day * 9],
    ['大熊', '同学', '大学那会儿你总借我抄作业，现在成了我最想成为的那种人。继续加油。', 4, 0, 0, now - day * 7],
    ['Momo', '网友', '虽然只在网上认识，但你每次回复都特别真诚。隔着屏幕都能感觉到你的温暖。', 5, 0, 0, now - day * 5],
    ['老周', '家人', '看着你一步步走到今天，很骄傲。别太拼，记得按时吃饭，累了就回家。', 5, 0, 0, now - day * 3],
    ['Cathy', '朋友', '你的审美一直在线，做的每个东西都好看。别总说自己不行，你比你以为的厉害多了。', 4, 0, 0, now - day * 2],
  ];
  const ins = db.prepare(`INSERT INTO testimonials
    (id, name, avatar, content, relation, rating, is_public, status, pinned, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  rows.forEach(r => ins.run(uid(), r[0], '', r[2], r[1], r[3], 1, 'approved', r[4], r[5], r[5]));
  ins.run(uid(), '待审核测试员', '', '这是一条演示用的待审核留言，去后台点「通过」才会出现在官网。', '朋友', 5, 1, 'pending', 0, now - 3600000, now - 3600000);
})();

/* ---------- 会话（内存 token，重启失效） ---------- */
const sessions = new Set();
function newSession() {
  const t = crypto.randomBytes(24).toString('hex');
  sessions.add(t);
  return t;
}

/* ---------- HTTP 辅助 ---------- */
const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};
const readBody = req => new Promise((resolve, reject) => {
  let d = '';
  req.on('data', c => { d += c; if (d.length > 5e6) req.destroy(); });
  req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
  req.on('error', reject);
});
const rowToT = r => ({
  id: r.id, name: r.name, avatar: r.avatar, content: r.content,
  relation: r.relation, rating: r.rating, isPublic: !!r.is_public,
  status: r.status, pinned: !!r.pinned, createdAt: r.created_at, updatedAt: r.updated_at,
});
function auth(req) {
  const h = req.headers['authorization'] || '';
  return sessions.has(h.replace(/^Bearer\s+/i, ''));
}

/* ---------- 静态文件 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.md': 'text/markdown; charset=utf-8',
};
function sendFile(res, fp) {
  const ext = path.extname(fp).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
}
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) return json(res, 403, { error: 'forbidden' });

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) return sendFile(res, filePath);
    const alt = path.join(filePath, 'index.html');
    if (fs.existsSync(alt) && alt.startsWith(ROOT)) return sendFile(res, alt);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  });
}

/* ---------- 路由 ---------- */
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    /* ===== 公开接口 ===== */
    if (method === 'GET' && url === '/api/testimonials/public') {
      const rows = db.prepare(
        `SELECT * FROM testimonials WHERE status='approved' AND is_public=1
         ORDER BY pinned DESC, created_at DESC`
      ).all();
      return json(res, 200, rows.map(rowToT));
    }

    if (method === 'GET' && url === '/api/profile') {
      return json(res, 200, getProfile());
    }

    if (method === 'POST' && url === '/api/testimonials') {
      const b = await readBody(req);
      const name = String(b.name || '').trim().slice(0, 20);
      const content = String(b.content || '').trim().slice(0, 300);
      if (!name || !content) return json(res, 400, { error: '缺少称呼或内容' });
      const item = {
        id: uid(), name,
        avatar: typeof b.avatar === 'string' ? b.avatar.slice(0, 400000) : '',
        content,
        relation: String(b.relation || '朋友').slice(0, 10),
        rating: Math.max(0, Math.min(5, Number(b.rating) || 0)),
        is_public: b.isPublic === false ? 0 : 1,
        status: 'pending', pinned: 0,
        created_at: nowTs(), updated_at: nowTs(),
      };
      db.prepare(`INSERT INTO testimonials
        (id, name, avatar, content, relation, rating, is_public, status, pinned, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        item.id, item.name, item.avatar, item.content, item.relation,
        item.rating, item.is_public, item.status, item.pinned, item.created_at, item.updated_at);
      return json(res, 201, { ok: true, id: item.id });
    }

    /* ===== 登录 ===== */
    if (method === 'POST' && url === '/api/login') {
      const b = await readBody(req);
      if (String(b.password) === ADMIN_PASSWORD) {
        return json(res, 200, { ok: true, token: newSession() });
      }
      return json(res, 401, { ok: false, error: '密码错误' });
    }

    /* ===== 以下需登录 ===== */
    if (url.startsWith('/api/admin/')) {
      if (!auth(req)) return json(res, 401, { error: 'unauthorized' });

      if (method === 'GET' && url === '/api/admin/testimonials') {
        const rows = db.prepare('SELECT * FROM testimonials ORDER BY created_at DESC').all();
        return json(res, 200, rows.map(rowToT));
      }
      if (method === 'GET' && url === '/api/admin/stats') {
        const all = db.prepare('SELECT * FROM testimonials').all();
        const approved = all.filter(t => t.status === 'approved');
        const rated = approved.filter(t => t.rating > 0);
        const byRelation = {};
        approved.forEach(t => { byRelation[t.relation] = (byRelation[t.relation] || 0) + 1; });
        return json(res, 200, {
          total: all.length, approved: approved.length,
          pending: all.filter(t => t.status === 'pending').length,
          rejected: all.filter(t => t.status === 'rejected').length,
          avgRating: rated.length ? rated.reduce((s, t) => s + t.rating, 0) / rated.length : 0,
          byRelation,
        });
      }
      if (method === 'PUT' && url.startsWith('/api/admin/testimonial/')) {
        const id = url.split('/').pop();
        const b = await readBody(req);
        const cur = db.prepare('SELECT * FROM testimonials WHERE id=?').get(id);
        if (!cur) return json(res, 404, { error: 'not found' });
        const next = {
          name: b.name !== undefined ? String(b.name).slice(0, 20) : cur.name,
          content: b.content !== undefined ? String(b.content).slice(0, 300) : cur.content,
          relation: b.relation !== undefined ? String(b.relation).slice(0, 10) : cur.relation,
          rating: b.rating !== undefined ? Math.max(0, Math.min(5, Number(b.rating) || 0)) : cur.rating,
          status: b.status !== undefined ? b.status : cur.status,
          pinned: b.pinned !== undefined ? (b.pinned ? 1 : 0) : cur.pinned,
          is_public: b.isPublic !== undefined ? (b.isPublic ? 1 : 0) : cur.is_public,
        };
        db.prepare(`UPDATE testimonials SET name=?, content=?, relation=?, rating=?,
          status=?, pinned=?, is_public=?, updated_at=? WHERE id=?`).run(
          next.name, next.content, next.relation, next.rating,
          next.status, next.pinned, next.is_public, nowTs(), id);
        return json(res, 200, rowToT(db.prepare('SELECT * FROM testimonials WHERE id=?').get(id)));
      }
      if (method === 'DELETE' && url.startsWith('/api/admin/testimonial/')) {
        const id = url.split('/').pop();
        db.prepare('DELETE FROM testimonials WHERE id=?').run(id);
        return json(res, 200, { ok: true });
      }
      if (method === 'PUT' && url === '/api/admin/profile') {
        const b = await readBody(req);
        const cur = getProfile();
        const next = { ...cur, ...b };
        db.prepare('UPDATE profile SET data=? WHERE id=1').run(JSON.stringify(next));
        return json(res, 200, next);
      }
      if (method === 'POST' && url === '/api/admin/reset') {
        db.exec('DELETE FROM testimonials');
        db.prepare('DELETE FROM profile WHERE id=1').run();
        seedIfEmpty();
        getProfile();
        return json(res, 200, { ok: true });
      }
    }

    // 其余交给静态文件
    if (method === 'GET') return serveStatic(req, res);
    return json(res, 404, { error: 'not found' });

  } catch (err) {
    console.error('[error]', err);
    return json(res, 500, { error: 'server error', detail: String(err && err.message || err) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🟢 朋友说 已启动: http://0.0.0.0:${PORT}`);
  console.log(`   数据库: ${DB_PATH}`);
  console.log(`   后台密码: ${ADMIN_PASSWORD === 'admin123' ? 'admin123 (默认，建议用环境变量修改)' : '已自定义'}`);
});
