/* =========================================================
   starmap.js —— 评价墙「星图」呈现
   - 每条留言 = 一个发光节点，漂浮在空间里
   - 悬停节点 → 亮起 + 浮出预览卡片
   - 点击 → 弹层展示完整留言
   - 小屏自动降级为卡片流
   ========================================================= */

(function () {
  const stage = document.getElementById('starmap');
  const modal = document.getElementById('t-modal');
  if (!stage) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const A1 = (css.getPropertyValue('--a1') || '#6d8bff').trim();

  const REL_COLOR = {
    '朋友': '#6d8bff', '同事': '#26d9c8', '同学': '#b06dff',
    '网友': '#f78c6c', '家人': '#ffc94d',
  };

  let items = [];
  let nodes = [];

  function esc(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  /* ---------- 主渲染 ---------- */
  async function render() {
    const all = await DB.getPublicTestimonials();
    items = all;
    if (!all.length) { stage.innerHTML = '<p class="dim center" style="padding:60px 0">还没有公开的评价，来做第一个吧 →</p>'; return; }

    const isMobile = window.innerWidth < 760;
    if (isMobile || reduce) return renderList(all);
    renderStar(all);
  }

  /* ---------- 星图模式（桌面） ---------- */
  function renderStar(list) {
    stage.classList.add('is-starmap');
    stage.innerHTML = '';

    const W = stage.clientWidth, H = stage.clientHeight;
    const n = list.length;

    // 斐波那契螺旋 + 少量随机抖动，得到舒展又有序的分布
    const golden = Math.PI * (3 - Math.sqrt(5));
    const maxR = Math.min(W * .42, H * .42);

    nodes = list.map((t, i) => {
      const frac = (i + .5) / n;
      const r = Math.sqrt(frac) * maxR;
      const ang = i * golden;
      const cx = W / 2 + Math.cos(ang) * r * (W / H);
      const cy = H / 2 + Math.sin(ang) * r;

      const el = document.createElement('button');
      el.className = 'star-node';
      const color = REL_COLOR[t.relation] || A1;
      const size = t.pinned ? 20 : (t.rating >= 5 ? 16 : 13);
      el.style.setProperty('--node-color', color);
      el.style.setProperty('--node-size', size + 'px');
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      el.style.animationDelay = (i * .12) + 's';
      el.setAttribute('aria-label', `${t.name} 的评价`);

      el.innerHTML = `
        <span class="node-dot"></span>
        <span class="node-halo"></span>
        <span class="node-pop glass">
          <span class="pop-head">
            <span class="avatar" style="width:32px;height:32px;font-size:13px">${avatarInner(t)}</span>
            <span>
              <strong>${esc(t.name)}</strong>
              <em class="dim">${esc(t.relation)}${t.pinned ? ' · 置顶' : ''}</em>
            </span>
          </span>
          <span class="pop-text">${esc(t.content).slice(0, 60)}${t.content.length > 60 ? '…' : ''}</span>
          <span class="pop-stars">${'★'.repeat(t.rating)}${'☆'.repeat(t.rating ? 5 - t.rating : 0)}</span>
        </span>`;

      el.addEventListener('click', () => openModal(t));
      stage.appendChild(el);
      return { t, el, x: cx, y: cy };
    });

    // 悬停时轻微斥力，营造“空间感”
    stage.addEventListener('mousemove', e => {
      const rect = stage.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      nodes.forEach(n => {
        const dx = n.x - mx, dy = n.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 110 && d > 1) {
          const f = (1 - d / 110) * 14;
          n.el.style.transform = `translate(-50%,-50%) translate(${(dx / d) * f}px,${(dy / d) * f}px) scale(1.18)`;
        } else {
          n.el.style.transform = '';
        }
      });
    });
    stage.addEventListener('mouseleave', () => nodes.forEach(n => n.el.style.transform = ''));
  }

  /* ---------- 列表模式（移动端降级） ---------- */
  function renderList(list) {
    stage.classList.remove('is-starmap');
    stage.style.height = 'auto';
    stage.innerHTML = `<div class="t-list">${list.map(t => `
      <article class="t-card glass reveal" data-id="${t.id}">
        <div class="between mb-16">
          <div class="flex gap-12" style="align-items:center">
            <span class="avatar">${avatarInner(t)}</span>
            <span>
              <strong>${esc(t.name)}</strong>
              <em class="dim" style="display:block;font-style:normal;font-size:12.5px">${esc(t.relation)} · ${fmtDate(t.createdAt)}</em>
            </span>
          </div>
          ${t.pinned ? '<span class="chip hot">置顶</span>' : ''}
        </div>
        <p class="t-text">${esc(t.content)}</p>
        <div class="t-stars">${'★'.repeat(t.rating)}${'☆'.repeat(t.rating ? 5 - t.rating : 0)}</div>
      </article>`).join('')}</div>`;

    // 卡片点击也可展开
    stage.querySelectorAll('.t-card').forEach(c => {
      const t = list.find(x => x.id === c.dataset.id);
      c.addEventListener('click', () => openModal(t));
    });
    observeReveal();
  }

  function avatarInner(t) {
    if (t.avatar) return `<img src="${t.avatar}" alt="">`;
    return esc((t.name || '?').slice(0, 1).toUpperCase());
  }

  /* ---------- 弹层 ---------- */
  function openModal(t) {
    if (!modal) return;
    modal.querySelector('.modal-body').innerHTML = `
      <div class="flex gap-16" style="align-items:center">
        <span class="avatar" style="width:54px;height:54px;font-size:20px">${avatarInner(t)}</span>
        <span>
          <strong style="font-size:18px">${esc(t.name)}</strong>
          <em class="dim" style="display:block;font-style:normal;font-size:13px">${esc(t.relation)} · ${fmtDate(t.createdAt)}</em>
        </span>
      </div>
      <p class="modal-text">${esc(t.content)}</p>
      <div class="modal-stars">${'★'.repeat(t.rating)}${'☆'.repeat(t.rating ? 5 - t.rating : 0)}</div>`;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.closest('.modal-close')) closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }

  /* ---------- 入场观察 ---------- */
  function observeReveal() {
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .12 });
    document.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el));
  }

  /* ---------- 暴露 & 启动 ---------- */
  window.StarMap = { render, observeReveal };
  window.addEventListener('resize', () => {
    if (stage.classList.contains('is-starmap')) { clearTimeout(stage._rt); stage._rt = setTimeout(render, 260); }
  });
})();
