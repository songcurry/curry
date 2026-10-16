/* =========================================================
   api.js —— 数据层（对接后端 REST 接口）
   后端：server.js（Node + SQLite）
   所有方法保持与原 LocalStorage 版同名同签名，三端页面无需改动。
   ========================================================= */

const DB = (() => {
  const BASE = window.API_BASE || '';   // 同域部署留空；跨域时填后端地址

  let token = sessionStorage.getItem('fw_token') || '';

  async function req(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(BASE + path, { ...opts, headers });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || ('HTTP ' + res.status));
    }
    return res.json();
  }

  return {
    /* ---- 留言：公开读取 ---- */
    getPublicTestimonials: () => req('/api/testimonials/public'),

    /* ---- 留言：提交 ---- */
    submitTestimonial: data => req('/api/testimonials', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    /* ---- 后台：列表 / 统计 ---- */
    getAllTestimonials: () => req('/api/admin/testimonials'),
    getTestimonialsByStatus: async status => {
      const all = await req('/api/admin/testimonials');
      return all.filter(t => t.status === status);
    },
    getStats: () => req('/api/admin/stats'),

    /* ---- 后台：审核动作 ---- */
    updateTestimonial: (id, patch) => req('/api/admin/testimonial/' + id, {
      method: 'PUT', body: JSON.stringify(patch),
    }),
    deleteTestimonial: id => req('/api/admin/testimonial/' + id, { method: 'DELETE' }),
    approve: id => DB.updateTestimonial(id, { status: 'approved' }),
    reject:  id => DB.updateTestimonial(id, { status: 'rejected' }),
    pin:     (id, v) => DB.updateTestimonial(id, { pinned: v }),
    hide:    id => DB.updateTestimonial(id, { status: 'pending' }),

    /* ---- 个人资料 ---- */
    getProfile: () => req('/api/profile'),
    updateProfile: patch => req('/api/admin/profile', {
      method: 'PUT', body: JSON.stringify(patch),
    }),

    /* ---- 登录 ---- */
    async login(password) {
      try {
        const d = await req('/api/login', {
          method: 'POST', body: JSON.stringify({ password }),
        });
        if (d.token) { token = d.token; sessionStorage.setItem('fw_token', token); return true; }
        return false;
      } catch { return false; }
    },
    isLoggedIn: () => !!token,
    logout() {
      token = '';
      sessionStorage.removeItem('fw_token');
    },

    /* ---- 重置演示数据 ---- */
    resetDemo: () => req('/api/admin/reset', { method: 'POST' }),
  };
})();
