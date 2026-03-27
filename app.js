'use strict';

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
  const symbols = { MXN: '$', USD: '$', EUR: '€' };
  const sym = symbols[currency] || '$';
  return `${sym}${parseFloat(amount).toFixed(2)} ${currency}`;
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

// ─── Init ─────────────────────────────────────────────────────────────────────

load();
renderBills();
