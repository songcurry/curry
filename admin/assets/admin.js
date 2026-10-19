/* =========================================================
   admin.js —— 后台管理端
   ========================================================= */

(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  const REL_COLOR = { '朋友': '#6d8bff', '同事': '#26d9c8', '同学': '#b06dff', '网友': '#f78c6c', '家人': '#ffc94d' };
  const esc = s => (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = ts => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const av = t => t.avatar ? `<img src="${t.avatar}" alt="">` : esc((t.name || '?').slice(0, 1).toUpperCase());

  /* ================= 登录 ================= */
  const loginView = $('#login-view');
  const adminView = $('#admin-view');

  function afterLogin() {
    loginView.classList.add('hidden');
    adminView.classList.remove('hidden');
    refreshAll();
  }

  $('#login-btn').addEventListener('click', doLogin);
  $('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  async function doLogin() {
    const pw = $('#pw').value;
    const ok = await DB.login(pw);
    if (ok) afterLogin();
    else { $('#login-hint').textContent = '密码不对，再试试（演示密码：admin123）'; $('#login-hint').style.color = 'var(--a2)'; }
  }

  $('#logout-btn').addEventListener('click', () => { DB.logout(); location.reload(); });

  $('#reset-btn').addEventListener('click', async () => {
    if (!confirm('确定重置为演示数据？当前所有留言和资料将被覆盖。')) return;
    await DB.resetDemo();
    refreshAll();
  });

  /* ================= 侧栏切换 ================= */
  $$('.side-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.side-item[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === btn.dataset.tab));
    });
  });

  /* ================= 渲染：待审核 ================= */
  async function renderPending() {
    const list = await DB.getTestimonialsByStatus('pending');
    $('#badge-pending').textContent = list.length;
    $('#badge-pending').style.display = list.length ? '' : 'none';

    $('#pending-list').innerHTML = list.length ? list.map(t => `
      <article class="a-card glass" data-id="${t.id}">
        <div class="a-card-head">
          <span class="avatar">${av(t)}</span>
          <span class="a-meta">
            <strong>${esc(t.name)}</strong>
            <span class="dim">${esc(t.relation)} · ${fmt(t.createdAt)} · ${t.isPublic ? '愿意公开' : '仅站长可见'}</span>
          </span>
          <span class="a-stars dim">${'★'.repeat(t.rating)}</span>
        </div>
        <p class="a-text">${esc(t.content)}</p>
        <div class="a-actions">
          <button class="btn btn-sm btn-approve" data-act="approve">✓ 通过</button>
          <button class="btn btn-sm btn-ghost" data-act="reject">✕ 拒绝</button>
          <button class="btn btn-sm btn-ghost" data-act="edit">编辑</button>
          <button class="btn btn-sm btn-ghost btn-danger" data-act="delete">删除</button>
        </div>
      </article>`).join('')
      : `<div class="empty glass">🎉 没有待审核的留言了</div>`;
  }

  /* ================= 渲染：已发布 ================= */
  async function renderPublished() {
    const list = await DB.getTestimonialsByStatus('approved');
    $('#published-list').innerHTML = list.length ? list.map(t => `
      <article class="a-card glass ${t.pinned ? 'is-pinned' : ''}" data-id="${t.id}">
        <div class="a-card-head">
          <span class="avatar">${av(t)}</span>
          <span class="a-meta">
            <strong>${esc(t.name)}</strong>
            <span class="dim">${esc(t.relation)} · ${fmt(t.createdAt)}${t.pinned ? ' · 已置顶' : ''}</span>
          </span>
          <span class="a-stars dim">${'★'.repeat(t.rating)}</span>
        </div>
        <p class="a-text">${esc(t.content)}</p>
        <div class="a-actions">
          <button class="btn btn-sm ${t.pinned ? 'btn-primary' : 'btn-ghost'}" data-act="pin">${t.pinned ? '取消置顶' : '置顶'}</button>
          <button class="btn btn-sm btn-ghost" data-act="hide">隐藏</button>
          <button class="btn btn-sm btn-ghost" data-act="edit">编辑</button>
          <button class="btn btn-sm btn-ghost btn-danger" data-act="delete">删除</button>
        </div>
      </article>`).join('')
      : `<div class="empty glass">还没有已发布的留言</div>`;
  }

  /* ================= 渲染：统计 ================= */
  async function renderStats() {
    const s = await DB.getStats();
    const cards = [
      { k: '总留言', v: s.total, c: 'var(--a1)' },
      { k: '已发布', v: s.approved, c: 'var(--a3)' },
      { k: '待审核', v: s.pending, c: 'var(--a2)' },
      { k: '平均评分', v: s.avgRating ? s.avgRating.toFixed(1) : '—', c: '#ffc94d' },
    ];
    $('#stat-grid').innerHTML = cards.map(c => `
      <div class="stat-card glass">
        <span class="stat-num" style="color:${c.c}">${c.v}</span>
        <span class="stat-k dim">${c.k}</span>
      </div>`).join('');

    const total = Object.values(s.byRelation).reduce((a, b) => a + b, 0) || 1;
    $('#bar-chart').innerHTML = Object.entries(s.byRelation).length
      ? Object.entries(s.byRelation).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
        <div class="bar-row">
          <span class="bar-k">${k}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${(v / total * 100)}%;background:${REL_COLOR[k] || 'var(--a1)'}"></span></span>
          <span class="bar-v dim">${v}</span>
        </div>`).join('')
      : '<p class="dim center">暂无数据</p>';
  }

  /* ================= 渲染：资料 ================= */
  let bgData = '';          // 当前背景图（base64）

  async function renderProfile() {
    const p = await DB.getProfile();
    $('#side-logo').textContent = p.name;
    $('#p-name').value = p.name || '';
    $('#p-tagline').value = p.tagline || '';
    $('#p-about').value = p.about || '';
    $('#p-now').value = (p.now || []).map(n => `${n.k}：${n.v}`).join('\n');
    $('#p-links').value = (p.links || []).map(l => `${l.name}|${l.url}`).join('\n');
    $$('#theme-opts .opt').forEach(o => o.classList.toggle('active', o.dataset.v === (p.theme || 'aurora')));
    bgData = p.danmuBg || '';
    updateBgPreview();
  }

  /* ================= 背景图上传 ================= */
  function updateBgPreview() {
    const box = $('#bg-preview');
    if (bgData) {
      box.style.backgroundImage = `url("${bgData}")`;
      box.innerHTML = '';
    } else {
      box.style.backgroundImage = '';
      box.innerHTML = '<span class="dim">未设置背景，使用默认渐变</span>';
    }
  }

  $('#p-bg').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { alert('请选择图片文件'); return; }

    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        // 压缩到最长边 1600，质量 0.82
        const MAX = 1600;
        let { width: w, height: h } = img;
        const scale = Math.min(1, MAX / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        bgData = c.toDataURL('image/jpeg', 0.82);
        updateBgPreview();
        $('#save-tip').textContent = '图片已就绪，记得点「保存资料」';
        setTimeout(() => $('#save-tip').textContent = '', 3000);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  $('#bg-clear').addEventListener('click', () => {
    bgData = '';
    $('#p-bg').value = '';
    updateBgPreview();
  });

  /* ================= 资料表单 ================= */
  $$('#theme-opts .opt').forEach(el => {
    el.addEventListener('click', () => {
      $$('#theme-opts .opt').forEach(o => o.classList.remove('active'));
      el.classList.add('active');
    });
  });

  $('#profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    const now = $('#p-now').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const i = l.indexOf('：') > -1 ? l.indexOf('：') : l.indexOf(':');
      return i > -1 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : { k: '近况', v: l };
    });
    const links = $('#p-links').value.split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => {
      const [name, url] = l.split('|').map(x => x.trim());
      return { name: name || ('链接' + (i + 1)), icon: (name || 'L').slice(0, 2).toUpperCase(), url: url || '#' };
    });
    await DB.updateProfile({
      name: $('#p-name').value.trim(),
      tagline: $('#p-tagline').value.trim(),
      about: $('#p-about').value.trim(),
      now, links,
      theme: document.querySelector('#theme-opts .opt.active')?.dataset.v || 'aurora',
      danmuBg: bgData,
    });
    $('#side-logo').textContent = $('#p-name').value.trim();
    const tip = $('#save-tip');
    tip.textContent = '✓ 已保存';
    setTimeout(() => tip.textContent = '', 2000);
  });

  /* ================= 卡片操作（事件委托） ================= */
  async function refreshLists() { await Promise.all([renderPending(), renderPublished(), renderStats()]); }

  function bindListActions(container) {
    container.addEventListener('click', async e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const card = btn.closest('.a-card');
      const id = card.dataset.id;
      const act = btn.dataset.act;

      if (act === 'approve') await DB.approve(id);
      else if (act === 'reject') await DB.reject(id);
      else if (act === 'hide') await DB.hide(id);
      else if (act === 'pin') {
        const all = await DB.getAllTestimonials();
        const t = all.find(x => x.id === id);
        await DB.pin(id, !t.pinned);
      }
      else if (act === 'delete') {
        if (!confirm('确定删除这条留言？')) return;
        await DB.deleteTestimonial(id);
      }
      else if (act === 'edit') { openEdit(id); return; }

      card.style.transition = 'opacity .25s, transform .25s';
      card.style.opacity = '0'; card.style.transform = 'translateX(20px)';
      setTimeout(refreshLists, 250);
    });
  }
  bindListActions($('#pending-list'));
  bindListActions($('#published-list'));

  /* ================= 编辑弹层 ================= */
  const editModal = $('#edit-modal');
  let editingId = null;

  async function openEdit(id) {
    const all = await DB.getAllTestimonials();
    const t = all.find(x => x.id === id);
    if (!t) return;
    editingId = id;
    $('#e-name').value = t.name;
    $('#e-content').value = t.content;
    $('#e-rating').value = t.rating || 0;
    $$('#e-relation .opt').forEach(o => o.classList.toggle('active', o.dataset.v === t.relation));
    editModal.classList.add('open');
  }
  $$('#e-relation .opt').forEach(el => {
    el.addEventListener('click', () => {
      $$('#e-relation .opt').forEach(o => o.classList.remove('active'));
      el.classList.add('active');
    });
  });
  editModal.addEventListener('click', e => {
    if (e.target === editModal || e.target.closest('.modal-close')) editModal.classList.remove('open');
  });
  $('#edit-save').addEventListener('click', async () => {
    await DB.updateTestimonial(editingId, {
      name: $('#e-name').value.trim(),
      content: $('#e-content').value.trim(),
      rating: Math.max(0, Math.min(5, +$('#e-rating').value || 0)),
      relation: document.querySelector('#e-relation .opt.active')?.dataset.v || '朋友',
    });
    editModal.classList.remove('open');
    refreshLists();
  });

  /* ================= 启动 ================= */
  async function refreshAll() {
    await refreshLists();
    await renderProfile();
  }

  if (DB.isLoggedIn()) afterLogin();
})();
