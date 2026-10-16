/* =========================================================
   hero.js —— 沉浸式首屏
   ① Canvas 粒子/光线场，鼠标靠近有吸引效果
   ② 名字逐字浮现
   ③ 滚动时首屏视差淡出
   ========================================================= */

(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W, H, DPR, particles = [], mouse = { x: -9999, y: -9999 };

  const css = getComputedStyle(document.documentElement);
  const A1 = (css.getPropertyValue('--a1') || '#6d8bff').trim();
  const A2 = (css.getPropertyValue('--a2') || '#b06dff').trim();
  const A3 = (css.getPropertyValue('--a3') || '#26d9c8').trim();
  const COLORS = [A1, A2, A3];

  function rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function init() {
    const density = Math.min(90, Math.floor((W * H) / 22000));
    particles = [];
    for (let i = 0; i < density; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - .5) * .28,
        vy: (Math.random() - .5) * .28,
        r: Math.random() * 2 + 1.1,
        c: COLORS[i % COLORS.length],
        a: Math.random() * .5 + .25,
      });
    }
  }

  const LINK_DIST = 132;
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 粒子
    for (const p of particles) {
      // 鼠标吸引
      const dx = mouse.x - p.x, dy = mouse.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 22000 && d2 > 1) {
        const f = (1 - d2 / 22000) * .035;
        const d = Math.sqrt(d2);
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }
      p.vx *= .985; p.vy *= .985;
      p.x += p.vx; p.y += p.vy;

      // 边界回弹
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      p.x = Math.max(0, Math.min(W, p.x));
      p.y = Math.max(0, Math.min(H, p.y));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.c, p.a);
      ctx.fill();
    }

    // 连线
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK_DIST) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = rgba(A1, (1 - d / LINK_DIST) * .12);
          ctx.lineWidth = .7;
          ctx.stroke();
        }
      }
    }
  }

  function loop() { draw(); requestAnimationFrame(loop); }

  // 事件
  window.addEventListener('resize', () => { resize(); init(); });
  window.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

  resize(); init();
  if (!reduce) loop(); else draw();

  /* ---------- 名字逐字浮现 ---------- */
  const nameEl = document.getElementById('hero-name');
  function playName() {
    if (!nameEl || reduce) return;
    const text = nameEl.dataset.text || nameEl.textContent;
    nameEl.textContent = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      s.style.display = 'inline-block';
      s.style.opacity = '0';
      s.style.transform = 'translateY(28px) rotateX(-40deg)';
      s.style.transition = 'opacity .6s ease, transform .6s cubic-bezier(.2,.8,.2,1)';
      s.style.transitionDelay = (0.12 + i * 0.055) + 's';
      nameEl.appendChild(s);
      requestAnimationFrame(() => {
        setTimeout(() => {
          s.style.opacity = '1';
          s.style.transform = 'none';
        }, 60);
      });
    });
  }
  nameEl && nameEl.addEventListener('reanimate', playName);

  /* ---------- 滚动视差淡出 ---------- */
  const hero = document.getElementById('hero');
  if (hero && !reduce) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      const h = window.innerHeight;
      if (y < h) {
        const o = Math.max(0, 1 - y / (h * .75));
        hero.style.opacity = o;
        hero.style.transform = `translateY(${y * .28}px) scale(${1 - (1 - o) * .06})`;
      }
    }, { passive: true });
  }
})();
