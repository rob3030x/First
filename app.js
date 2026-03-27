'use strict';

// ─── Auth ─────────────────────────────────────────────────────────────────────

// SHA-256 hash of PIN "1234"
const PIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
const AUTH_KEY = 'bills_auth';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

let pinBuffer = '';

function showLockScreen() {
  pinBuffer = '';
  updateDots();
  document.getElementById('pinError').classList.remove('visible');
  document.getElementById('lockScreen').classList.add('visible');
}

function hideLockScreen() {
  sessionStorage.setItem(AUTH_KEY, '1');
  document.getElementById('lockScreen').classList.remove('visible');
}

function updateDots() {
  document.querySelectorAll('#pinDots span').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinBuffer.length);
  });
}

async function checkPin() {
  const hash = await sha256(pinBuffer);
  if (hash === PIN_HASH) {
    hideLockScreen();
  } else {
    pinBuffer = '';
    updateDots();
    const err = document.getElementById('pinError');
    err.classList.add('visible');
    setTimeout(() => err.classList.remove('visible'), 2000);
  }
}

document.getElementById('lockScreen').addEventListener('click', async e => {
  const val = e.target.closest('.pin-key')?.dataset.val;
  if (!val) return;
  if (val === 'clear') {
    pinBuffer = pinBuffer.slice(0, -1);
    updateDots();
  } else if (val === 'ok') {
    if (pinBuffer.length > 0) await checkPin();
  } else {
    if (pinBuffer.length < 4) {
      pinBuffer += val;
      updateDots();
      if (pinBuffer.length === 4) await checkPin();
    }
  }
});

document.getElementById('btnLock').addEventListener('click', () => {
  sessionStorage.removeItem(AUTH_KEY);
  showLockScreen();
});

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'bills_tracker_v1';

const CATEGORY_ICONS = {
  vivienda:       '🏠',
  servicios:      '💡',
  transporte:     '🚗',
  salud:          '🏥',
  entretenimiento:'🎬',
  educacion:      '📚',
  seguro:         '🛡️',
  tarjeta:        '💳',
  otro:           '📦',
};

const FREQUENCY_LABELS = {
  once:       'Una vez',
  monthly:    'Mensual',
  bimonthly:  'Bimestral',
  quarterly:  'Trimestral',
  biannual:   'Semestral',
  annual:     'Anual',
};

// ─── State ───────────────────────────────────────────────────────────────────

let bills = [];
let currentFilter = 'all';
let editingId = null;

// ─── Storage ─────────────────────────────────────────────────────────────────

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    bills = raw ? JSON.parse(raw) : [];
  } catch {
    bills = [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return Math.round((due - now) / 86400000);
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatAmount(amount, currency) {
  const symbols = { MXN: '$', CLP: '$', USD: '$', EUR: '€' };
  const sym = symbols[currency] || '$';
  const decimals = currency === 'CLP' ? 0 : 2;
  return `${sym}${parseFloat(amount).toFixed(decimals)} ${currency}`;
}

function getStatus(bill) {
  if (bill.paid) return 'paid';
  const days = daysUntil(bill.dueDate);
  if (days < 0)  return 'overdue';
  if (days <= 7) return 'due-soon';
  return 'upcoming';
}

function statusLabel(status) {
  return {
    overdue:  'Vencida',
    'due-soon':'Próxima',
    upcoming: 'Pendiente',
    paid:     'Pagada',
  }[status] || '';
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderBills() {
  const list = document.getElementById('billsList');
  const empty = document.getElementById('emptyState');

  let filtered = bills.filter(b => {
    if (currentFilter === 'paid')    return b.paid;
    if (currentFilter === 'pending') return !b.paid;
    return true;
  });

  // Sort: overdue → due-soon → upcoming (by date) → paid
  filtered.sort((a, b) => {
    const order = { overdue: 0, 'due-soon': 1, upcoming: 2, paid: 3 };
    const sa = getStatus(a), sb = getStatus(b);
    if (order[sa] !== order[sb]) return order[sa] - order[sb];
    return a.dueDate.localeCompare(b.dueDate);
  });

  // Remove existing bill items
  list.querySelectorAll('.bill-item').forEach(el => el.remove());

  if (filtered.length === 0) {
    empty.style.display = '';
    updateSummary();
    return;
  }

  empty.style.display = 'none';

  filtered.forEach(bill => {
    const status = getStatus(bill);
    const days   = daysUntil(bill.dueDate);
    const icon   = CATEGORY_ICONS[bill.category] || '📦';

    let daysText;
    if (status === 'paid')    daysText = 'Pagada';
    else if (days < 0)        daysText = `Venció hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`;
    else if (days === 0)      daysText = 'Vence hoy';
    else                      daysText = `Vence en ${days} día${days !== 1 ? 's' : ''}`;

    const item = document.createElement('div');
    item.className = `bill-item ${status}${bill.paid ? ' bill-paid' : ''}`;
    item.dataset.id = bill.id;

    item.innerHTML = `
      <div class="bill-icon">${icon}</div>
      <div class="bill-info">
        <div class="bill-name">${escHtml(bill.name)}</div>
        <div class="bill-meta">
          <span>📅 ${formatDate(bill.dueDate)}</span>
          <span>${daysText}</span>
          <span class="bill-badge badge-${status}">${statusLabel(status)}</span>
          ${bill.frequency !== 'once' ? `<span>🔄 ${FREQUENCY_LABELS[bill.frequency]}</span>` : ''}
        </div>
        ${bill.notes ? `<div class="bill-meta"><span>📝 ${escHtml(bill.notes)}</span></div>` : ''}
      </div>
      <div class="bill-amount">${formatAmount(bill.amount, bill.currency)}</div>
      <div class="bill-actions">
        ${!bill.paid
          ? `<button class="btn-icon btn-pay" title="Marcar como pagada" data-id="${bill.id}">✅</button>`
          : `<button class="btn-icon btn-pay" title="Marcar como pendiente" data-id="${bill.id}">↩️</button>`}
        <button class="btn-icon btn-edit" title="Editar" data-id="${bill.id}">✏️</button>
        <button class="btn-icon btn-del"  title="Eliminar" data-id="${bill.id}">🗑️</button>
      </div>
    `;

    list.appendChild(item);
  });

  updateSummary();
  if (typeof currentView !== 'undefined' && currentView === 'cal') renderCalendar();
}

function updateSummary() {
  const unpaid = bills.filter(b => !b.paid);
  const overdue = unpaid.filter(b => daysUntil(b.dueDate) < 0);
  const soon    = unpaid.filter(b => { const d = daysUntil(b.dueDate); return d >= 0 && d <= 7; });

  const sum = arr => arr.reduce((acc, b) => acc + parseFloat(b.amount), 0);

  document.getElementById('totalOverdue').textContent = `$${sum(overdue).toFixed(2)}`;
  document.getElementById('countOverdue').textContent = `${overdue.length} cuenta${overdue.length !== 1 ? 's' : ''}`;

  document.getElementById('totalSoon').textContent = `$${sum(soon).toFixed(2)}`;
  document.getElementById('countSoon').textContent = `${soon.length} cuenta${soon.length !== 1 ? 's' : ''}`;

  document.getElementById('totalPending').textContent = `$${sum(unpaid).toFixed(2)}`;
  document.getElementById('countPending').textContent = `${unpaid.length} cuenta${unpaid.length !== 1 ? 's' : ''}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openModal(bill = null) {
  editingId = bill ? bill.id : null;
  document.getElementById('modalTitle').textContent = bill ? 'Editar Cuenta' : 'Agregar Cuenta';
  document.getElementById('billId').value       = bill ? bill.id : '';
  document.getElementById('billName').value     = bill ? bill.name : '';
  document.getElementById('billAmount').value   = bill ? bill.amount : '';
  document.getElementById('billCurrency').value = bill ? bill.currency : 'MXN';
  document.getElementById('billDueDate').value  = bill ? bill.dueDate : today();
  document.getElementById('billCategory').value = bill ? bill.category : 'servicios';
  document.getElementById('billFrequency').value= bill ? bill.frequency : 'monthly';
  document.getElementById('billNotes').value    = bill ? bill.notes : '';
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('billName').focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('billForm').reset();
  editingId = null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function saveBill(e) {
  e.preventDefault();
  const name      = document.getElementById('billName').value.trim();
  const amount    = parseFloat(document.getElementById('billAmount').value);
  const currency  = document.getElementById('billCurrency').value;
  const dueDate   = document.getElementById('billDueDate').value;
  const category  = document.getElementById('billCategory').value;
  const frequency = document.getElementById('billFrequency').value;
  const notes     = document.getElementById('billNotes').value.trim();

  if (!name || isNaN(amount) || !dueDate) return;

  if (editingId) {
    const idx = bills.findIndex(b => b.id === editingId);
    if (idx !== -1) {
      bills[idx] = { ...bills[idx], name, amount, currency, dueDate, category, frequency, notes };
    }
  } else {
    bills.push({ id: uid(), name, amount, currency, dueDate, category, frequency, notes, paid: false, createdAt: new Date().toISOString() });
  }

  save();
  closeModal();
  renderBills();
}

function togglePaid(id) {
  const bill = bills.find(b => b.id === id);
  if (!bill) return;
  bill.paid = !bill.paid;
  if (bill.paid) bill.paidAt = new Date().toISOString();
  else delete bill.paidAt;
  save();
  renderBills();
}

function deleteBill(id) {
  if (!confirm('¿Eliminar esta cuenta?')) return;
  bills = bills.filter(b => b.id !== id);
  save();
  renderBills();
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

// ─── Calendar ─────────────────────────────────────────────────────────────────

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function renderCalendar() {
  const title = document.getElementById('calTitle');
  const grid  = document.getElementById('calGrid');
  title.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;
  grid.innerHTML = '';

  // Build a map: "YYYY-MM-DD" → [bill, ...]
  const dayMap = {};
  bills.forEach(bill => {
    const key = bill.dueDate;
    if (!dayMap[key]) dayMap[key] = [];
    dayMap[key].push(bill);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate();
  const todayStr    = today();

  // Previous month filler
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const cell = document.createElement('div');
    cell.className = 'cal-day other-month';
    cell.innerHTML = `<div class="cal-day-num">${d}</div>`;
    grid.appendChild(cell);
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(calMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const key = `${calYear}-${mm}-${dd}`;
    const isToday = key === todayStr;

    const cell = document.createElement('div');
    cell.className = `cal-day${isToday ? ' is-today' : ''}`;
    cell.innerHTML = `<div class="cal-day-num">${d}</div><div class="cal-dots"></div>`;

    const dotsEl = cell.querySelector('.cal-dots');
    if (dayMap[key]) {
      dayMap[key].forEach(bill => {
        const status = getStatus(bill);
        const dot = document.createElement('div');
        dot.className = `cal-dot ${status}`;
        dot.title = `${bill.name} — ${formatAmount(bill.amount, bill.currency)}`;
        dotsEl.appendChild(dot);
      });
    }
    grid.appendChild(cell);
  }

  // Next month filler
  const totalCells = firstDay + daysInMonth;
  const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= remaining; d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day other-month';
    cell.innerHTML = `<div class="cal-day-num">${d}</div>`;
    grid.appendChild(cell);
  }
}

let currentView = 'list';

function setView(view) {
  currentView = view;
  const isList = view === 'list';
  document.getElementById('billsList').style.display    = isList ? '' : 'none';
  document.getElementById('calendarView').style.display = isList ? 'none' : '';
  document.getElementById('btnViewList').classList.toggle('active',  isList);
  document.getElementById('btnViewCal').classList.toggle('active',  !isList);
  if (!isList) renderCalendar();
}

document.getElementById('btnViewList').addEventListener('click', () => setView('list'));
document.getElementById('btnViewCal').addEventListener('click',  () => setView('cal'));
document.getElementById('calPrev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
document.getElementById('calNext').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

// ─── Events ───────────────────────────────────────────────────────────────────

document.getElementById('btnAdd').addEventListener('click', () => openModal());
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('billForm').addEventListener('submit', saveBill);

document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

document.getElementById('billsList').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.classList.contains('btn-pay'))  togglePaid(id);
  if (btn.classList.contains('btn-edit')) openModal(bills.find(b => b.id === id));
  if (btn.classList.contains('btn-del'))  deleteBill(id);
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderBills();
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ─── ICS Export ───────────────────────────────────────────────────────────────

function exportICS() {
  const unpaid = bills.filter(b => !b.paid);
  if (unpaid.length === 0) {
    alert('No hay cuentas pendientes para exportar.');
    return;
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cuentas por Pagar//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  unpaid.forEach(bill => {
    const [y, m, d] = bill.dueDate.split('-');
    const dtDate = `${y}${m}${d}`;

    // Next day for DTEND
    const due = new Date(bill.dueDate + 'T00:00:00');
    due.setDate(due.getDate() + 1);
    const endDate = `${due.getFullYear()}${String(due.getMonth()+1).padStart(2,'0')}${String(due.getDate()).padStart(2,'0')}`;

    const uid = `bill-${bill.id}@cuentas`;
    const summary  = bill.name.replace(/[,;\\]/g, ' ');
    const desc = `Monto: ${formatAmount(bill.amount, bill.currency)}${bill.notes ? ' | ' + bill.notes.replace(/[,;\\]/g, ' ') : ''}`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtDate}T000000Z`,
      `DTSTART;VALUE=DATE:${dtDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      `SUMMARY:💳 ${summary}`,
      `DESCRIPTION:${desc}`,
      'BEGIN:VALARM',
      'TRIGGER:-P3D',
      'ACTION:DISPLAY',
      `DESCRIPTION:Vence en 3 días: ${summary}`,
      'END:VALARM',
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'cuentas-por-pagar.ics';
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('btnExportICS').addEventListener('click', exportICS);

// ─── Init ─────────────────────────────────────────────────────────────────────

load();
renderBills();

if (!sessionStorage.getItem(AUTH_KEY)) {
  showLockScreen();
}
