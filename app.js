/* ============================================================
   随手记 · 工作计划  —  纯前端，localStorage 离线存储
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'suibiji.items.v1';
  const STORE = {
    getAll() {
      try { return JSON.parse(localStorage.getItem(KEY)) || []; }
      catch (e) { return []; }
    },
    save(items) { localStorage.setItem(KEY, JSON.stringify(items)); }
  };

  // ---------- 工具 ----------
  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtTime = (ts) => {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const todayStr = () => fmtDate(new Date());
  function dayLabel(dateStr) {
    const today = todayStr();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = fmtDate(y);
    if (dateStr === today) return '今天';
    if (dateStr === yStr) return '昨天';
    const d = new Date(dateStr + 'T00:00:00');
    const wk = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
    return `${dateStr.slice(5)} ${wk}`;
  }

  // ---------- 状态 ----------
  let items = STORE.getAll();
  let currentFilter = 'all';
  let keyword = '';

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
    // 新的在前
    return arr.sort((a, b) => b.createdAt - a.createdAt);
  }

  function render() {
    const arr = filtered();
    // 统计
    const all = items.length;
    const doneCnt = items.filter(i => i.done).length;
    $('#statLabel').textContent = `${all} 条 · 完成 ${doneCnt}`;

    listEl.innerHTML = '';
    if (arr.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    // 按日期分组
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

    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = '✕';
    del.setAttribute('aria-label', '删除');
    del.addEventListener('click', () => remove(it.id));

    node.appendChild(check);
    node.appendChild(body);
    node.appendChild(del);
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
    STORE.save(items);
    render();
  }
  function toggle(id) {
    const it = items.find(i => i.id === id);
    if (!it) return;
    it.done = !it.done;
    it.doneAt = it.done ? Date.now() : null;
    STORE.save(items); render();
  }
  function remove(id) {
    const it = items.find(i => i.id === id);
    const label = it ? it.text.slice(0, 12) : '这条';
    if (!confirm(`确定删除「${label}…」吗？`)) return;
    items = items.filter(i => i.id !== id);
    STORE.save(items); render();
    toast('已删除');
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

  // ---------- 导出/导入 ----------
  function exportData() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `随手记备份_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    closeSheet(); toast('已导出备份');
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('格式错误');
        items = data; STORE.save(items); render();
        closeSheet(); toast(`已导入 ${data.length} 条`);
      } catch (e) { alert('导入失败：文件格式不正确'); }
    };
    reader.readAsText(file);
  }

  // ---------- 菜单 ----------
  function openSheet() { $('#sheetMask').hidden = false; }
  function closeSheet() { $('#sheetMask').hidden = true; }

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
    $('#addBtn').addEventListener('click', () => {
      const inp = $('#input'); add(inp.value); inp.value = ''; inp.focus();
    });
    $('#input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { add(e.target.value); e.target.value = ''; }
    });
    $('#filters').querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $('#filters').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        render();
      });
    });
    $('#searchInput').addEventListener('input', (e) => { keyword = e.target.value; render(); });

    $('#menuBtn').addEventListener('click', openSheet);
    $('#sheetMask').addEventListener('click', (e) => { if (e.target.id === 'sheetMask') closeSheet(); });
    $('#sheetCancel').addEventListener('click', closeSheet);
    $('#exportBtn').addEventListener('click', exportData);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => { if (e.target.files[0]) importData(e.target.files[0]); });
    $('#clearDoneBtn').addEventListener('click', () => { clearDone(); closeSheet(); });
    $('#clearAllBtn').addEventListener('click', () => { clearAll(); closeSheet(); });

    // 顶栏日期
    const d = new Date();
    $('#todayLabel').textContent = `${d.getMonth() + 1}月${d.getDate()}日 · ${['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}`;
  }

  // ---------- 启动 ----------
  bind();
  render();

  // Service Worker 注册（离线缓存应用本身）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {/* 本地直接打开时忽略 */});
    });
  }
})();
