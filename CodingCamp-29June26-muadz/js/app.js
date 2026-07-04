/* =============================================
   Life Dashboard — app.js
   Vanilla JS | No frameworks | localStorage
   ============================================= */

'use strict';

/* ---- Utility helpers ---- */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/** Show a brief toast at the bottom of the screen. */
function showToast(msg, duration = 2200) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

/** Sanitise a string to prevent XSS in innerHTML. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =============================================
   0. THEME TOGGLE  (light / dark)
   ============================================= */
(function initTheme() {
  const STORAGE_KEY = 'dashboard_theme';
  const html        = document.documentElement;
  const btn         = $('#theme-toggle');
  const iconEl      = $('#theme-icon');

  const ICONS = { dark: '🌙', light: '☀️' };

  /* Apply a theme and persist it */
  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    iconEl.textContent = ICONS[theme];
    localStorage.setItem(STORAGE_KEY, theme);
  }

  /* Load saved preference, fall back to dark */
  const saved = localStorage.getItem(STORAGE_KEY) || 'dark';
  applyTheme(saved);

  btn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
})();

/* =============================================
   1. CLOCK & GREETING  (with editable name)
   ============================================= */
(function initClock() {
  const NAME_KEY    = 'dashboard_username';
  const clockEl     = $('#clock');
  const dateEl      = $('#date');
  const greetingEl  = $('#greeting-text');
  const nameEl      = $('#greeting-name');

  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  /* --- Greeting phrase by time of day --- */
  function getGreetingPhrase(hour) {
    if (hour >= 5  && hour < 12) return '☀️ Good Morning';
    if (hour >= 12 && hour < 17) return '🌤️ Good Afternoon';
    if (hour >= 17 && hour < 21) return '🌅 Good Evening';
    return '🌙 Good Night';
  }

  /* --- Clock tick --- */
  function tick() {
    const now  = new Date();
    const h    = now.getHours();
    const m    = now.getMinutes();
    const s    = now.getSeconds();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = h % 12 || 12;
    const pad  = n => String(n).padStart(2, '0');

    clockEl.textContent = `${pad(h12)}:${pad(m)}:${pad(s)} ${ampm}`;
    dateEl.textContent  = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    greetingEl.textContent = getGreetingPhrase(h);
  }

  tick();
  setInterval(tick, 1000);

  /* --- Editable name --- */
  /* Load saved name */
  const savedName = localStorage.getItem(NAME_KEY);
  if (savedName) nameEl.textContent = savedName;

  /* Save on blur */
  nameEl.addEventListener('blur', () => {
    const name = nameEl.textContent.trim();
    if (!name) {
      nameEl.textContent = 'Friend';   /* fallback if cleared */
    }
    localStorage.setItem(NAME_KEY, nameEl.textContent.trim());
  });

  /* Save on Enter key (blur to commit) */
  nameEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameEl.blur();
    }
    /* Prevent newlines */
    if (e.key === 'Enter' || e.key === 'Tab') e.preventDefault();
  });

  /* Select all text on focus for easy replacement */
  nameEl.addEventListener('focus', () => {
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
})();

/* =============================================
   2. TO-DO LIST  (with sort)
   ============================================= */
(function initTodo() {
  const STORAGE_KEY  = 'dashboard_todos';
  const SORT_KEY     = 'dashboard_todo_sort';

  /* --- State --- */
  let todos     = [];
  let editingId = null;

  /* --- Persistence --- */
  function loadTodos() {
    try { todos = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { todos = []; }
  }

  function saveTodos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }

  /* --- DOM refs --- */
  const listEl     = $('#todo-list');
  const inputEl    = $('#todo-input');
  const addBtn     = $('#todo-add-btn');
  const clearBtn   = $('#todo-clear-btn');
  const countEl    = $('#todo-count');
  const sortSelect = $('#todo-sort');
  const modal      = $('#edit-modal');
  const editInput  = $('#edit-input');
  const editSave   = $('#edit-save-btn');
  const editCancel = $('#edit-cancel-btn');

  /* --- Restore saved sort preference --- */
  const savedSort = localStorage.getItem(SORT_KEY) || 'newest';
  sortSelect.value = savedSort;

  /* --- Sort logic --- */
  function getSortedTodos() {
    const mode = sortSelect.value;
    const copy = [...todos];
    switch (mode) {
      case 'newest': return copy.sort((a, b) => b.id - a.id);
      case 'oldest': return copy.sort((a, b) => a.id - b.id);
      case 'az':     return copy.sort((a, b) => a.text.localeCompare(b.text));
      case 'za':     return copy.sort((a, b) => b.text.localeCompare(a.text));
      case 'active': return copy.sort((a, b) => Number(a.done) - Number(b.done));
      case 'done':   return copy.sort((a, b) => Number(b.done) - Number(a.done));
      default:       return copy;
    }
  }

  sortSelect.addEventListener('change', () => {
    localStorage.setItem(SORT_KEY, sortSelect.value);
    render();
  });

  /* --- Render --- */
  function render() {
    listEl.innerHTML = '';

    const sorted = getSortedTodos();

    if (sorted.length === 0) {
      listEl.innerHTML = '<li class="empty-hint" style="padding:16px 0;">No tasks yet. Add one above!</li>';
    } else {
      sorted.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item${todo.done ? ' done' : ''}`;
        li.dataset.id = todo.id;
        li.innerHTML = `
          <input
            type="checkbox"
            class="todo-checkbox"
            aria-label="Mark as done"
            ${todo.done ? 'checked' : ''}
          />
          <span class="todo-text">${escapeHtml(todo.text)}</span>
          <div class="todo-actions">
            <button class="btn btn-ghost btn-sm edit-btn"   aria-label="Edit task">✏️</button>
            <button class="btn btn-danger btn-sm delete-btn" aria-label="Delete task">🗑️</button>
          </div>
        `;
        listEl.appendChild(li);
      });
    }

    const remaining = todos.filter(t => !t.done).length;
    countEl.textContent = `${remaining} task${remaining !== 1 ? 's' : ''} remaining`;
  }

  /* --- Add --- */
  function addTodo() {
    const text = inputEl.value.trim();
    if (!text) { showToast('Please enter a task first.'); return; }
    todos.unshift({ id: Date.now(), text, done: false });
    saveTodos();
    render();
    inputEl.value = '';
    inputEl.focus();
    showToast('Task added ✓');
  }

  addBtn.addEventListener('click', addTodo);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

  /* --- Event delegation: toggle / edit / delete --- */
  listEl.addEventListener('click', e => {
    const item = e.target.closest('.todo-item');
    if (!item) return;
    const id = Number(item.dataset.id);

    if (e.target.matches('.todo-checkbox')) {
      const todo = todos.find(t => t.id === id);
      if (todo) { todo.done = !todo.done; saveTodos(); render(); }
    }
    if (e.target.closest('.edit-btn'))   openEdit(id);
    if (e.target.closest('.delete-btn')) deleteTodo(id);
  });

  /* --- Delete --- */
  function deleteTodo(id) {
    todos = todos.filter(t => t.id !== id);
    saveTodos();
    render();
    showToast('Task deleted.');
  }

  /* --- Clear completed --- */
  clearBtn.addEventListener('click', () => {
    const before = todos.length;
    todos = todos.filter(t => !t.done);
    if (todos.length === before) { showToast('No completed tasks to clear.'); return; }
    saveTodos();
    render();
    showToast('Completed tasks cleared.');
  });

  /* --- Edit modal --- */
  function openEdit(id) {
    editingId = id;
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    editInput.value = todo.text;
    modal.hidden = false;
    editInput.focus();
    editInput.select();
  }

  function closeEdit() {
    modal.hidden = true;
    editingId = null;
    editInput.value = '';
  }

  function saveEdit() {
    const text = editInput.value.trim();
    if (!text) { showToast('Task cannot be empty.'); return; }
    const todo = todos.find(t => t.id === editingId);
    if (todo) { todo.text = text; saveTodos(); render(); }
    closeEdit();
    showToast('Task updated ✓');
  }

  editSave.addEventListener('click', saveEdit);
  editCancel.addEventListener('click', closeEdit);
  editInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveEdit();
    if (e.key === 'Escape') closeEdit();
  });
  modal.addEventListener('click', e => { if (e.target === modal) closeEdit(); });

  /* --- Init --- */
  loadTodos();
  render();
})();

/* =============================================
   3. FOCUS TIMER
   ============================================= */
(function initTimer() {
  const SESSION_KEY   = 'dashboard_sessions';
  const CIRCUMFERENCE = 2 * Math.PI * 52;   /* 2πr, r = 52 */

  /* --- State --- */
  let totalSeconds = 25 * 60;
  let remaining    = totalSeconds;
  let intervalId   = null;
  let isRunning    = false;

  /* --- DOM refs --- */
  const displayEl  = $('#timer-display');
  const labelEl    = $('#timer-label');
  const startBtn   = $('#timer-start-btn');
  const stopBtn    = $('#timer-stop-btn');
  const resetBtn   = $('#timer-reset-btn');
  const ringEl     = $('#timer-ring-progress');
  const sessionEl  = $('#session-count');
  const presetBtns = $$('.preset-btn');

  /* --- Session counter (resets each day) --- */
  function getSessions() {
    const today = new Date().toDateString();
    try {
      const data = JSON.parse(localStorage.getItem(SESSION_KEY)) || {};
      return data.date === today ? data.count : 0;
    } catch { return 0; }
  }

  function incrementSession() {
    const today = new Date().toDateString();
    const count = getSessions() + 1;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ date: today, count }));
    sessionEl.textContent = count;
  }

  /* --- Ring & display --- */
  function updateRing() {
    const pct    = remaining / totalSeconds;
    const offset = CIRCUMFERENCE * (1 - pct);
    ringEl.style.strokeDashoffset = offset;
    ringEl.classList.remove('warning', 'danger');
    if (pct <= 0.1)       ringEl.classList.add('danger');
    else if (pct <= 0.25) ringEl.classList.add('warning');
  }

  function renderDisplay() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    displayEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    updateRing();
  }

  /* --- Tick --- */
  function tick() {
    if (remaining <= 0) {
      clearInterval(intervalId);
      isRunning = false;
      remaining = 0;
      renderDisplay();
      labelEl.textContent = '🎉 Session complete!';
      startBtn.disabled   = false;
      stopBtn.disabled    = true;
      incrementSession();
      showToast('Focus session complete! Great work 🎉', 3500);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Focus session complete!', { body: 'Time for a break.' });
      }
      return;
    }
    remaining--;
    renderDisplay();
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    labelEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} remaining`;
  }

  /* --- Controls --- */
  startBtn.addEventListener('click', () => {
    if (remaining <= 0) remaining = totalSeconds;
    isRunning           = true;
    labelEl.textContent = 'Focusing…';
    startBtn.disabled   = true;
    stopBtn.disabled    = false;
    intervalId          = setInterval(tick, 1000);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  });

  stopBtn.addEventListener('click', () => {
    clearInterval(intervalId);
    isRunning           = false;
    labelEl.textContent = 'Paused — press Start to continue';
    startBtn.disabled   = false;
    stopBtn.disabled    = true;
  });

  resetBtn.addEventListener('click', () => {
    clearInterval(intervalId);
    isRunning           = false;
    remaining           = totalSeconds;
    labelEl.textContent = 'Ready to focus';
    startBtn.disabled   = false;
    stopBtn.disabled    = true;
    renderDisplay();
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isRunning) { clearInterval(intervalId); isRunning = false; }
      const minutes       = Number(btn.dataset.minutes);
      totalSeconds        = minutes * 60;
      remaining           = totalSeconds;
      labelEl.textContent = `${minutes}-min timer set. Ready!`;
      startBtn.disabled   = false;
      stopBtn.disabled    = true;
      renderDisplay();
    });
  });

  /* --- Init --- */
  renderDisplay();
  sessionEl.textContent = getSessions();
})();

/* =============================================
   4. QUICK LINKS
   ============================================= */
(function initLinks() {
  const STORAGE_KEY = 'dashboard_links';

  const DEFAULTS = [
    { id: 1, name: 'Google',  url: 'https://google.com' },
    { id: 2, name: 'GitHub',  url: 'https://github.com' },
    { id: 3, name: 'YouTube', url: 'https://youtube.com' },
  ];

  let links = [];

  function loadLinks() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      links = Array.isArray(stored) ? stored : DEFAULTS;
    } catch { links = DEFAULTS; }
  }

  function saveLinks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  }

  /* --- DOM refs --- */
  const gridEl    = $('#links-grid');
  const emptyEl   = $('#links-empty');
  const nameInput = $('#link-name-input');
  const urlInput  = $('#link-url-input');
  const addBtn    = $('#link-add-btn');

  function faviconUrl(url) {
    try {
      const { hostname } = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch { return ''; }
  }

  /* --- Render --- */
  function render() {
    gridEl.innerHTML = '';
    emptyEl.style.display = links.length === 0 ? 'block' : 'none';

    links.forEach(link => {
      const chip = document.createElement('div');
      chip.className  = 'link-chip';
      chip.dataset.id = link.id;
      const favicon   = faviconUrl(link.url);
      chip.innerHTML  = `
        ${favicon ? `<img class="link-chip-favicon" src="${escapeHtml(favicon)}" alt="" aria-hidden="true" onerror="this.style.display='none'">` : ''}
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
           style="color:inherit;text-decoration:none;">${escapeHtml(link.name)}</a>
        <button class="link-chip-delete" aria-label="Remove ${escapeHtml(link.name)}">✕</button>
      `;
      gridEl.appendChild(chip);
    });
  }

  /* --- Add --- */
  function addLink() {
    const name = nameInput.value.trim();
    let   url  = urlInput.value.trim();
    if (!name) { showToast('Please enter a link name.'); nameInput.focus(); return; }
    if (!url)  { showToast('Please enter a URL.'); urlInput.focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); } catch {
      showToast("That doesn't look like a valid URL."); urlInput.focus(); return;
    }
    links.push({ id: Date.now(), name, url });
    saveLinks();
    render();
    nameInput.value = '';
    urlInput.value  = '';
    nameInput.focus();
    showToast(`${name} added ✓`);
  }

  addBtn.addEventListener('click', addLink);
  urlInput.addEventListener('keydown',  e => { if (e.key === 'Enter') addLink(); });
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') urlInput.focus(); });

  /* --- Delete (event delegation) --- */
  gridEl.addEventListener('click', e => {
    const deleteBtn = e.target.closest('.link-chip-delete');
    if (!deleteBtn) return;
    e.preventDefault();
    const chip = deleteBtn.closest('.link-chip');
    if (!chip) return;
    const id   = Number(chip.dataset.id);
    const link = links.find(l => l.id === id);
    links = links.filter(l => l.id !== id);
    saveLinks();
    render();
    showToast(`${link?.name || 'Link'} removed.`);
  });

  /* --- Init --- */
  loadLinks();
  render();
})();
