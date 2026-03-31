'use strict';

// ─── Auth ─────────────────────────────────────────────────────────────────────

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

// ─── Storage keys ─────────────────────────────────────────────────────────────

const SK = {
  cats:    'gastos_categorias',
  cuentas: 'gastos_cuentas',
  pagos:   'gastos_pagos',
};

// ─── State ────────────────────────────────────────────────────────────────────

let cats    = [];
let cuentas = [];
let pagos   = [];

let currentTab      = 'resumen';
let pagosFilter     = 'all';
let editingCuentaId = null;
let editingPagoId   = null;
let editingCatId    = null;

// ─── Default categories ───────────────────────────────────────────────────────

const DEFAULT_CATS = [
  { nombre: 'Vivienda',        descripcion: 'Arriendo, gastos comunes',      color: '#3b82f6' },
  { nombre: 'Servicios',       descripcion: 'Luz, agua, gas, internet',      color: '#f59e0b' },
  { nombre: 'Transporte',      descripcion: 'Combustible, TAG, movilización', color: '#10b981' },
  { nombre: 'Salud',           descripcion: 'Médicos, medicamentos, isapre',  color: '#ef4444' },
  { nombre: 'Entretenimiento', descripcion: 'Streaming, salidas',             color: '#8b5cf6' },
  { nombre: 'Educación',       descripcion: 'Colegiaturas, cursos',           color: '#06b6d4' },
  { nombre: 'Seguros',         descripcion: 'Seguro de vida, hogar, auto',    color: '#6366f1' },
  { nombre: 'Tarjetas',        descripcion: 'Tarjetas de crédito',            color: '#ec4899' },
  { nombre: 'Otro',            descripcion: 'Otros gastos',                   color: '#6b7280' },
];

const COLOR_SWATCHES = [
  '#ef4444','#f59e0b','#10b981','#3b82f6',
  '#8b5cf6','#ec4899','#06b6d4','#6366f1',
  '#84cc16','#6b7280',
];

function seedCats() {
  cats = DEFAULT_CATS.map(c => ({ ...c, id: uid(), creado_en: new Date().toISOString() }));
  localStorage.setItem(SK.cats, JSON.stringify(cats));
}

// ─── Load / Save ──────────────────────────────────────────────────────────────

function loadAll() {
  try { cats    = JSON.parse(localStorage.getItem(SK.cats))    || []; } catch { cats    = []; }
  try { cuentas = JSON.parse(localStorage.getItem(SK.cuentas)) || []; } catch { cuentas = []; }
  try { pagos   = JSON.parse(localStorage.getItem(SK.pagos))   || []; } catch { pagos   = []; }
  if (cats.length === 0) seedCats();
}

function saveAll() {
  localStorage.setItem(SK.cats,    JSON.stringify(cats));
  localStorage.setItem(SK.cuentas, JSON.stringify(cuentas));
  localStorage.setItem(SK.pagos,   JSON.stringify(pagos));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  return '$' + num.toLocaleString('es-CL');
}

function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function getCuenta(id) { return cuentas.find(c => c.id === id); }
function getCat(id)    { return cats.find(c => c.id === id); }

function estadoBadge(estado) {
  const map = { pagado: 'badge-paid', pendiente: 'badge-pending', vencido: 'badge-overdue' };
  const labels = { pagado: 'Pagado', pendiente: 'Pendiente', vencido: 'Vencido' };
  return `<span class="badge ${map[estado] || 'badge-pending'}">${labels[estado] || estado}</span>`;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  renderTab(tab);
}

function renderTab(tab) {
  if (tab === 'resumen')    renderResumen();
  if (tab === 'cuentas')    renderCuentas();
  if (tab === 'pagos')      renderPagos();
  if (tab === 'categorias') renderCategorias();
}

document.getElementById('mainTabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (btn) setTab(btn.dataset.tab);
});

// ─── Resumen ──────────────────────────────────────────────────────────────────

function renderResumen() {
  const month = currentMonth();

  const paidMonth  = pagos.filter(p => p.estado === 'pagado'    && p.fecha_pago?.startsWith(month));
  const pendientes = pagos.filter(p => p.estado === 'pendiente');
  const vencidos   = pagos.filter(p => p.estado === 'vencido');

  const sum = arr => arr.reduce((s, p) => s + (parseFloat(p.monto_pagado) || 0), 0);

  document.getElementById('sumPaidMonth').textContent    = formatMoney(sum(paidMonth));
  document.getElementById('sumPaidCount').textContent    = `${paidMonth.length} pago${paidMonth.length !== 1 ? 's' : ''}`;
  document.getElementById('sumPending').textContent      = formatMoney(sum(pendientes));
  document.getElementById('sumPendingCount').textContent = `${pendientes.length} pago${pendientes.length !== 1 ? 's' : ''}`;
  document.getElementById('sumOverdue').textContent      = formatMoney(sum(vencidos));
  document.getElementById('sumOverdueCount').textContent = `${vencidos.length} pago${vencidos.length !== 1 ? 's' : ''}`;

  // Upcoming accounts
  const activeCuentas = cuentas
    .filter(c => c.activa)
    .sort((a, b) => (a.dia_vencimiento || 99) - (b.dia_vencimiento || 99));

  const upcomingEl = document.getElementById('upcomingList');
  if (activeCuentas.length === 0) {
    upcomingEl.innerHTML = emptyState('📋', 'No hay cuentas activas.', 'Agrega una en la pestaña Cuentas.');
  } else {
    upcomingEl.innerHTML = activeCuentas.slice(0, 6).map(c => {
      const cat   = getCat(c.categoria_id);
      const color = cat?.color ?? '#6b7280';
      return `
        <div class="list-item">
          <div class="list-dot" style="background:${color}"></div>
          <div class="list-info">
            <span class="list-name">${escHtml(c.nombre)}</span>
            <span class="list-sub">
              ${cat ? escHtml(cat.nombre) : 'Sin categoría'} ·
              Día ${c.dia_vencimiento ?? '?'} · ${c.frecuencia}
            </span>
          </div>
          <div class="list-amount">${formatMoney(c.monto_estimado)}</div>
          <button class="btn-sm" data-pay-cuenta="${c.id}">+ Pago</button>
        </div>`;
    }).join('');
  }

  // Recent payments
  const last = [...pagos]
    .sort((a, b) => (b.fecha_pago || '').localeCompare(a.fecha_pago || ''))
    .slice(0, 6);

  const recentEl = document.getElementById('recentPayments');
  if (last.length === 0) {
    recentEl.innerHTML = emptyState('💳', 'No hay pagos registrados.', 'Registra el primero en la pestaña Pagos.');
  } else {
    recentEl.innerHTML = last.map(p => {
      const c     = getCuenta(p.cuenta_id);
      const cat   = c ? getCat(c.categoria_id) : null;
      const color = cat?.color ?? '#6b7280';
      return `
        <div class="list-item">
          <div class="list-dot" style="background:${color}"></div>
          <div class="list-info">
            <span class="list-name">${c ? escHtml(c.nombre) : '—'}</span>
            <span class="list-sub">
              📅 ${formatDate(p.fecha_pago)} · ${escHtml(p.metodo_pago || '—')}
              ${p.comprobante ? ` · Ref: ${escHtml(p.comprobante)}` : ''}
            </span>
          </div>
          <div class="list-amount">${formatMoney(p.monto_pagado)}</div>
          ${estadoBadge(p.estado)}
        </div>`;
    }).join('');
  }
}

document.getElementById('upcomingList').addEventListener('click', e => {
  const btn = e.target.closest('[data-pay-cuenta]');
  if (btn) openPagoModal(null, btn.dataset.payCuenta);
});

// ─── Cuentas ──────────────────────────────────────────────────────────────────

function renderCuentas() {
  const search    = document.getElementById('searchCuentas').value.toLowerCase();
  const showInact = document.getElementById('showInactive').checked;

  const list = cuentas.filter(c => {
    if (!showInact && !c.activa) return false;
    if (search && !c.nombre.toLowerCase().includes(search)) return false;
    return true;
  }).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const el = document.getElementById('cuentasList');
  if (list.length === 0) {
    el.innerHTML = emptyState('🗂️', 'No hay cuentas.', 'Haz clic en "Nueva Cuenta" para comenzar.');
    return;
  }

  el.innerHTML = list.map(c => {
    const cat       = getCat(c.categoria_id);
    const color     = cat?.color ?? '#6b7280';
    const lastPago  = pagos
      .filter(p => p.cuenta_id === c.id)
      .sort((a, b) => (b.fecha_pago || '').localeCompare(a.fecha_pago || ''))[0];

    return `
      <div class="list-item${c.activa ? '' : ' inactive'}">
        <div class="list-dot" style="background:${color}"></div>
        <div class="list-info">
          <span class="list-name">
            ${escHtml(c.nombre)}
            ${!c.activa ? '<span class="badge-tag">Inactiva</span>' : ''}
          </span>
          <span class="list-sub">
            ${cat ? escHtml(cat.nombre) : 'Sin categoría'} ·
            Día ${c.dia_vencimiento ?? '?'} · ${c.frecuencia}
            ${lastPago ? ` · Último pago: ${formatDate(lastPago.fecha_pago)}` : ''}
          </span>
          ${c.notas ? `<span class="list-sub">📝 ${escHtml(c.notas)}</span>` : ''}
        </div>
        <div class="list-amount">${formatMoney(c.monto_estimado)}</div>
        <div class="list-actions">
          <button class="btn-sm" data-pay-cuenta="${c.id}">+ Pago</button>
          <button class="btn-icon btn-edit-cuenta" data-id="${c.id}" title="Editar">✏️</button>
          <button class="btn-icon btn-del-cuenta"  data-id="${c.id}" title="Eliminar">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

document.getElementById('searchCuentas').addEventListener('input', renderCuentas);
document.getElementById('showInactive').addEventListener('change', renderCuentas);

document.getElementById('cuentasList').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.payCuenta)                    openPagoModal(null, btn.dataset.payCuenta);
  if (btn.classList.contains('btn-edit-cuenta')) openCuentaModal(getCuenta(id));
  if (btn.classList.contains('btn-del-cuenta')) {
    if (!confirm('¿Eliminar esta cuenta? También se eliminarán sus pagos.')) return;
    cuentas = cuentas.filter(c => c.id !== id);
    pagos   = pagos.filter(p => p.cuenta_id !== id);
    saveAll();
    renderCuentas();
  }
});

// ─── Pagos ────────────────────────────────────────────────────────────────────

function renderPagos() {
  const month = document.getElementById('filterMonth').value;

  const list = pagos.filter(p => {
    if (pagosFilter !== 'all' && p.estado !== pagosFilter) return false;
    if (month && !p.fecha_pago?.startsWith(month)) return false;
    return true;
  }).sort((a, b) => (b.fecha_pago || '').localeCompare(a.fecha_pago || ''));

  const el = document.getElementById('pagosList');
  if (list.length === 0) {
    el.innerHTML = emptyState('💰', 'No hay pagos registrados.', 'Haz clic en "Nuevo Pago" para registrar uno.');
    return;
  }

  el.innerHTML = list.map(p => {
    const c     = getCuenta(p.cuenta_id);
    const cat   = c ? getCat(c.categoria_id) : null;
    const color = cat?.color ?? '#6b7280';
    return `
      <div class="list-item">
        <div class="list-dot" style="background:${color}"></div>
        <div class="list-info">
          <span class="list-name">${c ? escHtml(c.nombre) : '—'}</span>
          <span class="list-sub">
            📅 ${formatDate(p.fecha_pago)}
            ${p.fecha_vence ? ` · Vence: ${formatDate(p.fecha_vence)}` : ''}
            · ${escHtml(p.metodo_pago || '—')}
            ${p.comprobante ? ` · Ref: ${escHtml(p.comprobante)}` : ''}
          </span>
          ${p.notas ? `<span class="list-sub">📝 ${escHtml(p.notas)}</span>` : ''}
        </div>
        <div class="list-amount">${formatMoney(p.monto_pagado)}</div>
        <div class="list-actions">
          ${estadoBadge(p.estado)}
          <button class="btn-icon btn-edit-pago" data-id="${p.id}" title="Editar">✏️</button>
          <button class="btn-icon btn-del-pago"  data-id="${p.id}" title="Eliminar">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

document.getElementById('filterMonth').addEventListener('change', renderPagos);

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pagosFilter = btn.dataset.filter;
    renderPagos();
  });
});

document.getElementById('pagosList').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.classList.contains('btn-edit-pago')) openPagoModal(pagos.find(p => p.id === id));
  if (btn.classList.contains('btn-del-pago')) {
    if (!confirm('¿Eliminar este pago?')) return;
    pagos = pagos.filter(p => p.id !== id);
    saveAll();
    renderPagos();
  }
});

// ─── Categorías ───────────────────────────────────────────────────────────────

function renderCategorias() {
  const el = document.getElementById('catGrid');
  if (cats.length === 0) {
    el.innerHTML = emptyState('🏷️', 'No hay categorías.', '');
    return;
  }
  el.innerHTML = cats.map(c => {
    const count = cuentas.filter(cu => cu.categoria_id === c.id).length;
    return `
      <div class="cat-card">
        <div class="cat-color-bar" style="background:${c.color}"></div>
        <div class="cat-info">
          <div class="cat-nombre">${escHtml(c.nombre)}</div>
          ${c.descripcion ? `<div class="cat-desc">${escHtml(c.descripcion)}</div>` : ''}
          <div class="cat-count">${count} cuenta${count !== 1 ? 's' : ''}</div>
        </div>
        <div class="cat-actions">
          <button class="btn-icon btn-edit-cat" data-id="${c.id}" title="Editar">✏️</button>
          <button class="btn-icon btn-del-cat"  data-id="${c.id}" title="Eliminar">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

document.getElementById('catGrid').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.classList.contains('btn-edit-cat')) openCatModal(getCat(id));
  if (btn.classList.contains('btn-del-cat')) {
    if (!confirm('¿Eliminar esta categoría?')) return;
    cats = cats.filter(c => c.id !== id);
    cuentas.forEach(c => { if (c.categoria_id === id) c.categoria_id = null; });
    saveAll();
    renderCategorias();
  }
});

// ─── Modal helpers ────────────────────────────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') ['modalCuenta', 'modalPago', 'modalCat'].forEach(closeModal);
});

// ─── Cuenta modal ─────────────────────────────────────────────────────────────

function buildCatOptions(selectedId = '') {
  document.getElementById('cuentaCategoria').innerHTML =
    '<option value="">Sin categoría</option>' +
    cats.map(c =>
      `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${escHtml(c.nombre)}</option>`
    ).join('');
}

function openCuentaModal(cuenta = null) {
  editingCuentaId = cuenta?.id ?? null;
  document.getElementById('modalCuentaTitle').textContent = cuenta ? 'Editar Cuenta' : 'Nueva Cuenta';
  document.getElementById('cuentaId').value         = cuenta?.id ?? '';
  document.getElementById('cuentaNombre').value     = cuenta?.nombre ?? '';
  document.getElementById('cuentaMonto').value      = cuenta?.monto_estimado ?? '';
  document.getElementById('cuentaDia').value        = cuenta?.dia_vencimiento ?? '';
  document.getElementById('cuentaFrecuencia').value = cuenta?.frecuencia ?? 'mensual';
  document.getElementById('cuentaNotas').value      = cuenta?.notas ?? '';
  document.getElementById('cuentaActiva').checked   = cuenta ? cuenta.activa : true;
  buildCatOptions(cuenta?.categoria_id ?? '');
  openModal('modalCuenta');
  document.getElementById('cuentaNombre').focus();
}

document.getElementById('btnNewCuenta').addEventListener('click', () => openCuentaModal());

document.getElementById('formCuenta').addEventListener('submit', e => {
  e.preventDefault();
  const obj = {
    id:              editingCuentaId ?? uid(),
    nombre:          document.getElementById('cuentaNombre').value.trim(),
    categoria_id:    document.getElementById('cuentaCategoria').value || null,
    monto_estimado:  parseFloat(document.getElementById('cuentaMonto').value) || 0,
    dia_vencimiento: parseInt(document.getElementById('cuentaDia').value) || null,
    frecuencia:      document.getElementById('cuentaFrecuencia').value,
    activa:          document.getElementById('cuentaActiva').checked,
    notas:           document.getElementById('cuentaNotas').value.trim(),
    creado_en:       editingCuentaId
      ? (getCuenta(editingCuentaId)?.creado_en ?? new Date().toISOString())
      : new Date().toISOString(),
  };

  if (editingCuentaId) {
    const idx = cuentas.findIndex(c => c.id === editingCuentaId);
    if (idx !== -1) cuentas[idx] = obj;
  } else {
    cuentas.push(obj);
  }

  saveAll();
  closeModal('modalCuenta');
  renderTab(currentTab);
});

// ─── Pago modal ───────────────────────────────────────────────────────────────

function buildCuentaOptions(selectedId = '') {
  const all = cuentas.filter(c => c.activa || c.id === selectedId);
  document.getElementById('pagoCuenta').innerHTML =
    all.map(c =>
      `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${escHtml(c.nombre)}</option>`
    ).join('');
}

function openPagoModal(pago = null, prefillCuentaId = null) {
  editingPagoId = pago?.id ?? null;
  document.getElementById('modalPagoTitle').textContent  = pago ? 'Editar Pago' : 'Nuevo Pago';
  document.getElementById('pagoId').value          = pago?.id ?? '';
  document.getElementById('pagoMonto').value       = pago?.monto_pagado ?? '';
  document.getElementById('pagoFecha').value       = pago?.fecha_pago ?? today();
  document.getElementById('pagoVence').value       = pago?.fecha_vence ?? '';
  document.getElementById('pagoMetodo').value      = pago?.metodo_pago ?? 'transferencia';
  document.getElementById('pagoComprobante').value = pago?.comprobante ?? '';
  document.getElementById('pagoEstado').value      = pago?.estado ?? 'pagado';
  document.getElementById('pagoNotas').value       = pago?.notas ?? '';
  buildCuentaOptions(pago?.cuenta_id ?? prefillCuentaId ?? '');
  openModal('modalPago');
  document.getElementById('pagoMonto').focus();
}

document.getElementById('btnNewPago').addEventListener('click', () => openPagoModal());

document.getElementById('formPago').addEventListener('submit', e => {
  e.preventDefault();
  const obj = {
    id:           editingPagoId ?? uid(),
    cuenta_id:    document.getElementById('pagoCuenta').value,
    monto_pagado: parseFloat(document.getElementById('pagoMonto').value) || 0,
    fecha_pago:   document.getElementById('pagoFecha').value,
    fecha_vence:  document.getElementById('pagoVence').value || null,
    metodo_pago:  document.getElementById('pagoMetodo').value,
    comprobante:  document.getElementById('pagoComprobante').value.trim(),
    estado:       document.getElementById('pagoEstado').value,
    notas:        document.getElementById('pagoNotas').value.trim(),
    creado_en:    editingPagoId
      ? (pagos.find(p => p.id === editingPagoId)?.creado_en ?? new Date().toISOString())
      : new Date().toISOString(),
  };

  if (editingPagoId) {
    const idx = pagos.findIndex(p => p.id === editingPagoId);
    if (idx !== -1) pagos[idx] = obj;
  } else {
    pagos.push(obj);
  }

  saveAll();
  closeModal('modalPago');
  renderTab(currentTab);
});

// ─── Categoría modal ──────────────────────────────────────────────────────────

function buildSwatches() {
  document.getElementById('colorSwatches').innerHTML =
    COLOR_SWATCHES.map(c =>
      `<div class="swatch" style="background:${c}" data-color="${c}" title="${c}"></div>`
    ).join('');
}

function openCatModal(cat = null) {
  editingCatId = cat?.id ?? null;
  document.getElementById('modalCatTitle').textContent = cat ? 'Editar Categoría' : 'Nueva Categoría';
  document.getElementById('catId').value     = cat?.id ?? '';
  document.getElementById('catNombre').value = cat?.nombre ?? '';
  document.getElementById('catDesc').value   = cat?.descripcion ?? '';
  document.getElementById('catColor').value  = cat?.color ?? '#3b82f6';
  buildSwatches();
  openModal('modalCat');
  document.getElementById('catNombre').focus();
}

document.getElementById('colorSwatches').addEventListener('click', e => {
  const sw = e.target.closest('.swatch');
  if (sw) document.getElementById('catColor').value = sw.dataset.color;
});

document.getElementById('btnNewCat').addEventListener('click', () => openCatModal());

document.getElementById('formCat').addEventListener('submit', e => {
  e.preventDefault();
  const obj = {
    id:          editingCatId ?? uid(),
    nombre:      document.getElementById('catNombre').value.trim(),
    descripcion: document.getElementById('catDesc').value.trim(),
    color:       document.getElementById('catColor').value,
    creado_en:   editingCatId
      ? (getCat(editingCatId)?.creado_en ?? new Date().toISOString())
      : new Date().toISOString(),
  };

  if (editingCatId) {
    const idx = cats.findIndex(c => c.id === editingCatId);
    if (idx !== -1) cats[idx] = obj;
  } else {
    cats.push(obj);
  }

  saveAll();
  closeModal('modalCat');
  renderCategorias();
});

// ─── Empty state helper ───────────────────────────────────────────────────────

function emptyState(icon, line1, line2 = '') {
  return `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <p>${line1}</p>
    ${line2 ? `<p>${line2}</p>` : ''}
  </div>`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadAll();
document.getElementById('filterMonth').value = currentMonth();
renderTab('resumen');

if (!sessionStorage.getItem(AUTH_KEY)) {
  showLockScreen();
}
