/* ============================================================
   随手记 · 工作计划  —  纯前端，localStorage 离线存储 + 本地账号隔离
   ============================================================ */
(function () {
  'use strict';

  // ---------- 本地账号（无后端，弱认证，仅用于隔离各账号数据） ----------
  const AUTH = {
    USERS: 'suibiji.users',
    SESSION: 'suibiji.session',
    hash(pw) {
      let h = 0; pw = 's@lt' + (pw || '');
      for (let i = 0; i < pw.length; i++) { h = (h << 5) - h + pw.charCodeAt(i); h |= 0; }
      return 'h' + h.toString(16);
    },
    users() { try { return JSON.parse(localStorage.getItem(this.USERS)) || {}; } catch (e) { return {}; } },
    saveUsers(u) { localStorage.setItem(this.USERS, JSON.stringify(u)); },
    register(name, pw) {
      name = (name || '').trim();
      if (name.length < 2) return { ok: false, msg: '账号至少 2 个字符' };
      if ((pw || '').length < 4) return { ok: false, msg: '密码至少 4 位' };
      const u = this.users();
      if (u[name]) return { ok: false, msg: '该账号已存在' };
      u[name] = { hash: this.hash(pw) };
      this.saveUsers(u);
      // 首次注册：把旧版全局数据迁移到该账号，避免已有笔记“消失”
      if (Object.keys(u).length === 1) {
        try {
          const old = JSON.parse(localStorage.getItem('suibiji.items.v1') || '[]');
          if (Array.isArray(old) && old.length) {
            localStorage.setItem('suibiji.items.' + name, JSON.stringify(old));
            localStorage.removeItem('suibiji.items.v1');
          }
        } catch (e) {}
      }
      this.setSession(name);
      return { ok: true };
    },
    login(name, pw) {
      name = (name || '').trim();
      const u = this.users();
      if (!u[name]) return { ok: false, msg: '账号不存在，请先注册' };
      if (u[name].hash !== this.hash(pw || '')) return { ok: false, msg: '密码错误' };
      this.setSession(name);
      return { ok: true };
    },
    setSession(name) {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(this.SESSION, JSON.stringify({ username: name, token }));
    },
    current() { try { return JSON.parse(localStorage.getItem(this.SESSION)); } catch (e) { return null; } },
    logout() { localStorage.removeItem(this.SESSION); }
  };

  // ---------- 本地存储（按账号隔离） ----------
  const STORE = {
    key() { const s = AUTH.current(); return 'suibiji.items.' + (s ? s.username : '_none'); },
    getAll() {
      try { return JSON.parse(localStorage.getItem(this.key())) || []; }
      catch (e) { return []; }
    },
    save(items) { localStorage.setItem(this.key(), JSON.stringify(items)); }
  };

  // ---------- 工具 ----------
  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtTime = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const todayStr = () => fmtDate(new Date());
  function dayLabel(dateStr) {
    const today = todayStr();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = fmtDate(y);
    if (dateStr === today) return '今天';
    if (dateStr === yStr) return '昨天';
    const d = new Date(dateStr + 'T00:00:00');
    const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    return `${dateStr.slice(5)} ${wk}`;
  }

  // ---------- 状态 ----------
  let items = [];  // 登录后由 showMain 加载当前账号数据
  let currentFilter = 'todo';
  let keyword = '';
  let editingId = null;

  // ---------- 渲染 ----------
  const listEl = $('#list');
  const emptyEl = $('#emptyState');

  function filtered() {
    let arr = items.slice();
    if (currentFilter === 'today') arr = arr.filter(i => i.date === todayStr());
    else if (currentFilter === 'todo') arr = arr.filter(i => !i.done);
    else if (currentFilter === 'done') arr = arr.filter(i => i.done);
    if (keyword) {
      const k = keyword.toLowerCase();
      arr = arr.filter(i => i.text.toLowerCase().includes(k));
    }
    return arr.sort((a, b) => b.createdAt - a.createdAt);
  }

  function render() {
    const arr = filtered();
    const all = items.length;
    const doneCnt = items.filter(i => i.done).length;
    $('#statLabel').textContent = `${all} 条 · 完成 ${doneCnt}`;
    listEl.innerHTML = '';
    if (arr.length === 0) { emptyEl.hidden = false; return; }
    emptyEl.hidden = true;
    const groups = {};
    arr.forEach(it => { (groups[it.date] = groups[it.date] || []).push(it); });
    Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(date => {
      const wrap = document.createElement('section');
      wrap.className = 'day-group';
      const head = document.createElement('div');
      head.className = 'day-head';
      head.innerHTML = `<span>${dayLabel(date)}</span>`;
      wrap.appendChild(head);
      groups[date].forEach(it => wrap.appendChild(itemNode(it)));
      listEl.appendChild(wrap);
    });
  }

  function itemNode(it) {
    const node = document.createElement('div');
    node.className = 'item' + (it.done ? ' done' : '');
    node.dataset.id = it.id;
    const check = document.createElement('div');
    check.className = 'check';
    check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';
    check.addEventListener('click', () => toggle(it.id));
    const body = document.createElement('div');
    body.className = 'item-body';
    const txt = document.createElement('div');
    txt.className = 'item-text';
    txt.textContent = it.text;
    const time = document.createElement('div');
    time.className = 'item-time';
    time.textContent = fmtTime(it.createdAt) + (it.done && it.doneAt ? ' · 已完成' : '');
    body.appendChild(txt); body.appendChild(time);
    body.addEventListener('click', () => openEdit(it.id));
    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = '✕';
    del.setAttribute('aria-label', '删除');
    del.addEventListener('click', () => remove(it.id));
    node.appendChild(check); node.appendChild(body); node.appendChild(del);
    return node;
  }

  // ---------- 操作 ----------
  function add(text) {
    text = text.trim();
    if (!text) return;
    const now = Date.now();
    items.push({
      id: 'i' + now + Math.random().toString(36).slice(2, 7),
      text, createdAt: now, date: todayStr(), done: false, doneAt: null
    });
    STORE.save(items); render();
  }
  function toggle(id) {
    const it = items.find(i => i.id === id);
    if (!it) return;
    it.done = !it.done; it.doneAt = it.done ? Date.now() : null;
    STORE.save(items); render();
  }
  function remove(id) {
    const it = items.find(i => i.id === id);
    const label = it ? it.text.slice(0, 12) : '这条';
    if (!confirm(`确定删除「${label}…」吗？`)) return;
    items = items.filter(i => i.id !== id);
    STORE.save(items); render(); toast('已删除');
  }
  function clearDone() {
    const n = items.filter(i => i.done).length;
    if (!n) return toast('没有已完成的记录');
    if (!confirm(`清除 ${n} 条已完成的记录？`)) return;
    items = items.filter(i => !i.done);
    STORE.save(items); render(); toast('已清除已完成');
  }
  function clearAll() {
    if (!items.length) return toast('列表已是空的');
    if (!confirm('⚠️ 清空全部记录？此操作不可恢复，建议先导出备份。')) return;
    items = []; STORE.save(items); render(); toast('已清空');
  }

  // ---------- 编辑记录 ----------
  function openEdit(id) {
    const it = items.find(i => i.id === id);
    if (!it) return;
    editingId = id;
    $('#editText').value = it.text;
    $('#editMask').hidden = false;
    setTimeout(() => { $('#editText').focus(); $('#editText').setSelectionRange(it.text.length, it.text.length); }, 50);
  }
  function closeEdit() { $('#editMask').hidden = true; editingId = null; }
  function saveEdit() {
    const it = items.find(i => i.id === editingId);
    if (!it) return closeEdit();
    const v = $('#editText').value.trim();
    if (!v) { toast('内容不能为空'); return; }
    it.text = v;
    STORE.save(items); render(); closeEdit(); toast('已保存');
  }
  function deleteEdit() {
    const it = items.find(i => i.id === editingId);
    const label = it ? it.text.slice(0, 12) : '这条';
    if (!confirm(`确定删除「${label}…」吗？`)) return;
    items = items.filter(i => i.id !== editingId);
    STORE.save(items); render(); closeEdit(); toast('已删除');
  }

  // ---------- 导出/导入 ----------
  function exportData() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `随手记备份_${todayStr()}.json`; a.click();
    URL.revokeObjectURL(url); closeSheet(); toast('已导出备份');
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('格式错误');
        items = data; STORE.save(items); render(); closeSheet(); toast(`已导入 ${data.length} 条`);
      } catch (e) { alert('导入失败：文件格式不正确'); }
    };
    reader.readAsText(file);
  }

  // ---------- 菜单 ----------
  function openSheet() {
    const s = AUTH.current();
    $('#sheetAccount').textContent = s ? ('👤 ' + s.username) : '';
    $('#sheetMask').hidden = false;
  }
  function closeSheet() { $('#sheetMask').hidden = true; }

  // ---------- 视图切换 ----------
  function showLogin() {
    $('#loginView').hidden = false;
    $('#mainView').hidden = true;
  }
  function showMain() {
    items = STORE.getAll();
    $('#mainView').hidden = false;
    $('#loginView').hidden = true;
    render();
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
  }

  // ---------- 事件绑定 ----------
  function bind() {
    const input = $('#input');
    const composerEl = $('#composer');

    // 键盘弹出时整体上移，确保 + 号不被遮挡
    function adjustKeyboard() {
      if (!window.visualViewport) return;
      const vk = window.visualViewport;
      const kb = window.innerHeight - vk.height - vk.offsetTop;
      composerEl.style.bottom = kb > 0 ? kb + 'px' : '0px';
      const em = $('#editMask');
      if (em) em.style.paddingBottom = kb > 0 ? kb + 'px' : '0px';
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', adjustKeyboard);
      window.visualViewport.addEventListener('scroll', adjustKeyboard);
    }
    input.addEventListener('focus', () => setTimeout(adjustKeyboard, 300));
    input.addEventListener('blur', () => { composerEl.style.bottom = '0px'; });

    // 语音输入
    const micBtn = $('#micBtn');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognizing = false;
    if (SR) {
      const rec = new SR();
      rec.lang = 'zh-CN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e) => {
        let txt = '';
        for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
        input.value = txt;
      };
      rec.onend = () => { recognizing = false; micBtn.classList.remove('recording'); };
      rec.onerror = (e) => { recognizing = false; micBtn.classList.remove('recording'); if (e.error === 'not-allowed') toast('麦克风权限被拒绝'); };
      micBtn.addEventListener('click', () => {
        if (recognizing) { rec.stop(); return; }
        try { rec.start(); recognizing = true; micBtn.classList.add('recording'); } catch (_) {}
      });
    } else {
      micBtn.style.display = 'none';
    }

    // 添加记录
    $('#addBtn').addEventListener('click', () => {
      const inp = $('#input'); add(inp.value); inp.value = ''; inp.focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { add(e.target.value); e.target.value = ''; }
    });

    // 筛选
    $('#filters').querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $('#filters').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        render();
      });
    });
    $('#searchInput').addEventListener('input', (e) => { keyword = e.target.value; render(); });

    // 菜单
    $('#menuBtn').addEventListener('click', openSheet);
    $('#sheetMask').addEventListener('click', (e) => { if (e.target.id === 'sheetMask') closeSheet(); });
    $('#sheetCancel').addEventListener('click', closeSheet);
    $('#exportBtn').addEventListener('click', exportData);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => { if (e.target.files[0]) importData(e.target.files[0]); });
    $('#clearDoneBtn').addEventListener('click', () => { clearDone(); closeSheet(); });
    $('#clearAllBtn').addEventListener('click', () => { clearAll(); closeSheet(); });

    // 编辑记录
    $('#editSaveBtn').addEventListener('click', saveEdit);
    $('#editDeleteBtn').addEventListener('click', deleteEdit);
    $('#editCancel').addEventListener('click', closeEdit);
    $('#editMask').addEventListener('click', (e) => { if (e.target.id === 'editMask') closeEdit(); });
    $('#editText').addEventListener('focus', () => setTimeout(adjustKeyboard, 300));
    $('#editText').addEventListener('blur', () => { $('#editMask').style.paddingBottom = '0px'; });

    // 登录 / 注册 / 退出
    $('#loginBtn').addEventListener('click', () => {
      const r = AUTH.login($('#loginUser').value, $('#loginPw').value);
      $('#loginMsg').textContent = r.ok ? '' : r.msg;
      if (r.ok) { $('#loginUser').value = ''; $('#loginPw').value = ''; showMain(); }
    });
    $('#registerBtn').addEventListener('click', () => {
      const r = AUTH.register($('#loginUser').value, $('#loginPw').value);
      $('#loginMsg').textContent = r.ok ? '注册成功，已自动登录' : r.msg;
      if (r.ok) { $('#loginUser').value = ''; $('#loginPw').value = ''; showMain(); }
    });
    $('#loginPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#loginBtn').click(); });
    $('#logoutBtn').addEventListener('click', () => { AUTH.logout(); items = []; closeSheet(); showLogin(); });

    // 顶栏日期
    const d = new Date();
    $('#todayLabel').textContent = `${d.getMonth() + 1}月${d.getDate()}日 · ${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]}`;
  }

  // ---------- 启动 ----------
  bind();
  if (AUTH.current()) showMain();
  else showLogin();

  // Service Worker 注册（离线缓存应用本身）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        // 发现新版本：安装完成后提示用户更新
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast();
          });
        });
      }).catch(() => {/* 本地直接打开时忽略 */});

      // 新 SW 接管后自动刷新一次，加载最新页面
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });
    });
  }

  // 顶部“有新版本”提示，点击即激活新 SW
  function showUpdateToast() {
    let t = document.getElementById('updateToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'updateToast';
      t.className = 'toast update-toast';
      t.addEventListener('click', () => {
        const sw = navigator.serviceWorker;
        if (sw.waiting) sw.waiting.postMessage('skipWaiting');
        else location.reload();
      });
      document.body.appendChild(t);
    }
    t.textContent = '🆕 有新版本，点此更新';
    t.classList.add('show');
  }
})();
