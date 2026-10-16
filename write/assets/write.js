/* =========================================================
   write.js —— 填写端交互
   ========================================================= */

(function () {
  let avatarData = '';
  let rating = 0;

  const $ = s => document.querySelector(s);

  /* ---------- 个人化标题 ---------- */
  (async () => {
    const p = await DB.getProfile();
    document.getElementById('nav-logo').textContent = p.name;
    document.querySelector('.write-title').textContent = `给 ${p.name} 留一句话`;
  })();

  /* ---------- 关系选择 ---------- */
  document.querySelectorAll('#relation-opts .opt').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#relation-opts .opt').forEach(o => o.classList.remove('active'));
      el.classList.add('active');
    });
  });

  /* ---------- 星级 ---------- */
  document.querySelectorAll('#stars .star').forEach(s => {
    s.addEventListener('click', () => {
      const v = +s.dataset.v;
      rating = (rating === v) ? 0 : v;  // 再点一次取消
      document.querySelectorAll('#stars .star').forEach(x => {
        x.classList.toggle('on', +x.dataset.v <= rating);
      });
    });
  });

  /* ---------- 字数统计 ---------- */
  const contentEl = document.getElementById('f-content');
  const counter = document.getElementById('counter');
  contentEl.addEventListener('input', () => {
    counter.textContent = `${contentEl.value.length} / 300`;
  });

  /* ---------- 头像上传 + 压缩 ---------- */
  const avatarInput = document.getElementById('f-avatar');
  const preview = document.getElementById('avatar-preview');

  avatarInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) return alert('请选择图片文件');
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        // 压缩到 200x200 以内
        const max = 200;
        let { width: w, height: h } = img;
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        avatarData = c.toDataURL('image/jpeg', 0.82);
        preview.innerHTML = `<img src="${avatarData}" alt="">`;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('avatar-clear').addEventListener('click', () => {
    avatarData = '';
    avatarInput.value = '';
    updateNameAvatar();
  });

  /* 昵称首字母预览 */
  const nameEl = document.getElementById('f-name');
  function updateNameAvatar() {
    if (avatarData) { preview.innerHTML = `<img src="${avatarData}" alt="">`; return; }
    const n = nameEl.value.trim();
    preview.textContent = n ? n.slice(0, 1).toUpperCase() : '?';
  }
  nameEl.addEventListener('input', updateNameAvatar);

  /* ---------- AI 润色 ---------- */
  const polishBtn = document.getElementById('polish-btn');
  const hint = document.getElementById('content-hint');

  // 润色：优先调用真实接口（上线后），否则本地风格化处理
  async function polish(text) {
    // ——— 上线时替换为： await fetch('/api/polish', {...}) ———
    if (window.POLISH_API) {
      const r = await fetch(window.POLISH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const d = await r.json();
      return d.text || text;
    }
    // 本地降级：做温和的排版优化（不改变原意，不编造内容）
    let t = text.trim().replace(/\s+/g, ' ');
    t = t.replace(/([。！？!?]){2,}/g, '$1');
    if (!/[。！？!?~～]$/.test(t)) t += '。';
    return t;
  }

  polishBtn.addEventListener('click', async () => {
    const raw = contentEl.value.trim();
    if (!raw) { hint.textContent = '先写点内容，再让 AI 帮你润色～'; return; }
    polishBtn.disabled = true;
    const old = polishBtn.textContent;
    polishBtn.textContent = '润色中…';
    try {
      const out = await polish(raw);
      contentEl.value = out;
      counter.textContent = `${out.length} / 300`;
      hint.textContent = '已润色，可继续手动修改';
    } catch {
      hint.textContent = '润色服务暂不可用，不影响提交';
    } finally {
      polishBtn.disabled = false;
      polishBtn.textContent = old;
    }
  });

  /* ---------- 提交 ---------- */
  const form = document.getElementById('t-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = nameEl.value.trim();
    const content = contentEl.value.trim();

    if (!name) { nameEl.focus(); return shake(nameEl); }
    if (content.length < 2) { contentEl.focus(); return shake(contentEl); }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true; btn.textContent = '提交中…';

    const relation = document.querySelector('#relation-opts .opt.active')?.dataset.v || '朋友';
    await DB.submitTestimonial({
      name, avatar: avatarData, content, relation,
      rating, isPublic: document.getElementById('f-public').checked,
    });

    // 切到成功态
    document.getElementById('form-view').classList.add('hidden');
    document.getElementById('success-view').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function shake(el) {
    el.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' },
       { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }],
      { duration: 300 }
    );
    el.style.borderColor = 'var(--a2)';
    setTimeout(() => el.style.borderColor = '', 900);
  }

  /* ---------- 再写一条 ---------- */
  document.getElementById('again-btn').addEventListener('click', () => {
    form.reset(); avatarData = ''; rating = 0;
    preview.textContent = '?';
    counter.textContent = '0 / 300';
    document.querySelectorAll('#stars .star').forEach(x => x.classList.remove('on'));
    const btn = document.getElementById('submit-btn');
    btn.disabled = false; btn.textContent = '提交我的留言 →';
    document.getElementById('success-view').classList.add('hidden');
    document.getElementById('form-view').classList.remove('hidden');
  });
})();
