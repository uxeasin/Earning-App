'use strict';

const STORAGE_KEY = 'visa-agency-panel-v1';

const VISA_TYPES = [
  { id: 'tourist', label: 'Tourist' },
  { id: 'medical', label: 'Medical' },
  { id: 'student', label: 'Student' },
  { id: 'business', label: 'Business' },
  { id: 'other', label: 'Other' },
];

const STATUSES = [
  { id: 'docs', label: 'Collecting docs' },
  { id: 'ready', label: 'Docs ready' },
  { id: 'booked', label: 'Booked' },
  { id: 'paid', label: 'Paid' },
  { id: 'done', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const METHODS = ['', 'bKash', 'Nagad', 'Upay', 'Rocket', 'Card', 'Net Banking', 'Cash'];
const DOC_KEYS = ['passport', 'form', 'photo', 'support'];
const DEFAULT_IVAC_FEE = 1500;

const $ = (sel) => document.querySelector(sel);
const labelOf = (list, id) => (list.find((x) => x.id === id) || {}).label || id;
const num = (v) => Number(v) || 0;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const taka = (n) => '৳' + num(n).toLocaleString('en-IN');

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- storage ----------
// Opened on claude.ai the panel uses the artifact's database; opened as a
// plain file it falls back to this browser's localStorage.

let sets = [];
let editingId = null;
let db = null;

function loadLocal() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
    return true;
  } catch {
    return false;
  }
}

function showError(msg) {
  const note = $('#storageNote');
  note.textContent = msg;
  note.classList.add('due');
}

async function storeSet(set) {
  if (db) {
    await db.collection('clients').doc(set.id).set(set);
  } else {
    const i = sets.findIndex((s) => s.id === set.id);
    if (i >= 0) sets[i] = set; else sets.push(set);
    if (!saveLocal()) showError('Could not save. Browser storage may be full or blocked. Download a Backup now.');
    render();
  }
}

async function removeSet(id) {
  if (db) {
    await db.collection('clients').doc(id).delete();
  } else {
    sets = sets.filter((s) => s.id !== id);
    saveLocal();
    render();
  }
}

async function connectDb() {
  if (!window.claude || typeof window.claude.use !== 'function') return;
  db = await window.claude.use('db');
  if (!db) return;
  $('#storageNote').textContent = 'Saved online in your private panel. Backup still gives you a copy on your device.';
  db.collection('clients').onSnapshot(
    (snap) => {
      sets = snap.docs.map((d) => normalize(d.data()));
      render();
    },
    () => showError('Lost connection to saved data. Reload the page.'),
  );
}

function normalize(s) {
  return { ...s, files: Array.isArray(s.files) ? s.files : [] };
}

// ---------- helpers ----------

function totalDue(s) {
  return num(s.ivacFee) + num(s.serviceFee) - num(s.received);
}

function docsComplete(file) {
  return DOC_KEYS.every((k) => file.docs && file.docs[k]);
}

function fillSelect(el, options, allLabel) {
  const opts = allLabel ? [{ id: '', label: allLabel }, ...options] : options;
  el.innerHTML = opts.map((o) => `<option value="${o.id}">${escapeHtml(o.label)}</option>`).join('');
}

function ask(text, okLabel = 'OK') {
  const dlg = $('#confirmDialog');
  $('#confirmText').textContent = text;
  $('#confirmYes').textContent = okLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'yes'), { once: true });
  });
}

// ---------- rendering ----------

function renderStats() {
  const active = sets.filter((s) => s.status !== 'cancelled');
  const count = (list) => ({ sets: list.length, files: list.reduce((n, s) => n + s.files.length, 0) });

  const all = count(active);
  const pending = count(active.filter((s) => s.status === 'docs' || s.status === 'ready'));
  const booked = count(active.filter((s) => s.status === 'booked'));
  const paid = count(active.filter((s) => s.status === 'paid' || s.status === 'done'));

  const card = (cls, label, c, metaLabel) => `
    <div class="stat ${cls}">
      <div class="label">${label}</div>
      <div class="value">${c.sets} <small>${c.sets === 1 ? 'Set' : 'Sets'}</small></div>
      <div class="meta">${metaLabel}: <b>${plural(c.files, 'File')}</b></div>
    </div>`;

  $('#stats').innerHTML =
    card('purple', 'Total clients', all, 'Total') +
    card('amber', 'Pending (docs)', pending, 'Pending') +
    card('', 'Booked, not paid', booked, 'Booked') +
    card('green', 'Paid / completed', paid, 'Paid');

  $('#catTotal').textContent = `${plural(all.files, 'File')} total`;
  $('#cats').innerHTML = VISA_TYPES.map((t) => {
    const c = count(active.filter((s) => s.visaType === t.id));
    return `<div class="cat"><div class="t">${t.label}</div>
      <div class="n">${plural(c.sets, 'Set')}</div><div class="f">${plural(c.files, 'File')}</div></div>`;
  }).join('');

  const service = active.reduce((n, s) => n + num(s.serviceFee), 0);
  const ivac = active.reduce((n, s) => n + num(s.ivacFee), 0);
  const received = active.reduce((n, s) => n + num(s.received), 0);
  const due = active.reduce((n, s) => n + Math.max(0, totalDue(s)), 0);
  $('#money').innerHTML = [
    ['Service fees', service], ['IVAC fees', ivac], ['Received', received], ['Due', due],
  ].map(([t, n]) => `<div><div class="t">${t}</div><div class="n">${taka(n)}</div></div>`).join('');
}

function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const status = $('#statusFilter').value;
  const type = $('#typeFilter').value;

  const rows = sets
    .filter((s) => !status || s.status === status)
    .filter((s) => !type || s.visaType === type)
    .filter((s) => {
      if (!q) return true;
      const hay = [s.name, s.phone, s.txnId, s.notes, ...s.files.flatMap((f) => [f.name, f.passport])]
        .join(' ').toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (!rows.length) {
    $('#list').innerHTML = `<div class="empty">${sets.length ? 'No clients match the filter.' : 'No clients yet. Click “+ New client” to add one.'}</div>`;
    return;
  }

  $('#list').innerHTML = rows.map((s) => {
    const docsDone = s.files.filter(docsComplete).length;
    const due = totalDue(s);
    const appt = s.appointmentDate ? `📅 ${s.appointmentDate}${s.appointmentTime ? ' ' + s.appointmentTime : ''}` : '';
    return `
      <div class="item" data-id="${s.id}" tabindex="0">
        <div>
          <div class="title">${escapeHtml(s.name)}</div>
          <div class="meta">${labelOf(VISA_TYPES, s.visaType)} · ${plural(s.files.length, 'file')} · docs ${docsDone}/${s.files.length}
            ${s.phone ? ' · ' + escapeHtml(s.phone) : ''}</div>
          <div class="meta">${appt}</div>
        </div>
        <div class="right">
          <span class="badge s-${s.status}">${labelOf(STATUSES, s.status)}</span>
          ${due > 0 && s.status !== 'cancelled' ? `<div class="due">Due ${taka(due)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function render() {
  renderStats();
  renderList();
}

// ---------- dialog ----------

function addFileRow(file = {}) {
  const row = $('#fileRowTpl').content.firstElementChild.cloneNode(true);
  row.querySelector('.f-name').value = file.name || '';
  row.querySelector('.f-passport').value = file.passport || '';
  row.querySelector('.f-role').value = file.role || ($('#filesBox').children.length ? 'Secondary' : 'Primary');
  for (const k of DOC_KEYS) row.querySelector('.d-' + k).checked = !!(file.docs && file.docs[k]);
  row.querySelector('.remove').addEventListener('click', () => row.remove());
  $('#filesBox').appendChild(row);
}

function openDialog(id) {
  editingId = id || null;
  const s = sets.find((x) => x.id === id) || {
    visaType: 'tourist', status: 'docs', ivacFee: DEFAULT_IVAC_FEE, files: [{}],
  };
  const form = $('#setForm');
  form.reset();
  for (const key of ['name', 'phone', 'visaType', 'status', 'appointmentDate', 'appointmentTime',
    'ivacFee', 'serviceFee', 'received', 'method', 'txnId', 'notes']) {
    form.elements[key].value = s[key] ?? '';
  }
  $('#filesBox').innerHTML = '';
  (s.files.length ? s.files : [{}]).forEach(addFileRow);
  $('#dialogTitle').textContent = id ? 'Edit client' : 'New client';
  $('#deleteBtn').hidden = !id;
  $('#setDialog').showModal();
}

function readForm() {
  const f = $('#setForm').elements;
  const files = [...document.querySelectorAll('#filesBox .file-row')].map((row) => ({
    name: row.querySelector('.f-name').value.trim(),
    passport: row.querySelector('.f-passport').value.trim().toUpperCase(),
    role: row.querySelector('.f-role').value,
    docs: Object.fromEntries(DOC_KEYS.map((k) => [k, row.querySelector('.d-' + k).checked])),
  })).filter((x) => x.name || x.passport);

  return {
    name: f.name.value.trim(),
    phone: f.phone.value.trim(),
    visaType: f.visaType.value,
    status: f.status.value,
    appointmentDate: f.appointmentDate.value,
    appointmentTime: f.appointmentTime.value,
    ivacFee: num(f.ivacFee.value),
    serviceFee: num(f.serviceFee.value),
    received: num(f.received.value),
    method: f.method.value,
    txnId: f.txnId.value.trim(),
    notes: f.notes.value.trim(),
    files,
  };
}

// ---------- backup ----------

async function exportData() {
  const filename = `visa-panel-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const json = JSON.stringify(sets, null, 2);
  const downloads = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  if (downloads) {
    try { await downloads.save({ filename, data: json }); } catch { /* declined or unavailable */ }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    let data;
    try {
      data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('not a list');
    } catch {
      showError('That file is not a valid backup.');
      return;
    }
    const ok = await ask(`Replace current data (${sets.length} clients) with the backup (${data.length} clients)?`, 'Replace');
    if (!ok) return;
    const incoming = data.map((s) => normalize({ ...s, id: s.id || newId() }));
    if (db) {
      const keep = new Set(incoming.map((s) => s.id));
      for (const s of sets) if (!keep.has(s.id)) await removeSet(s.id);
      for (const s of incoming) await storeSet(s);
    } else {
      sets = incoming;
      saveLocal();
      render();
    }
  };
  reader.readAsText(file);
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
}

// ---------- wiring ----------

function init() {
  fillSelect($('#statusFilter'), STATUSES, 'All statuses');
  fillSelect($('#typeFilter'), VISA_TYPES, 'All visa types');
  const f = $('#setForm').elements;
  fillSelect(f.visaType, VISA_TYPES);
  fillSelect(f.status, STATUSES);
  fillSelect(f.method, METHODS.map((m) => ({ id: m, label: m || '—' })));

  $('#newSetBtn').addEventListener('click', () => openDialog());
  $('#addFileBtn').addEventListener('click', () => addFileRow());
  $('#cancelBtn').addEventListener('click', () => $('#setDialog').close());

  $('#setForm').addEventListener('submit', async (e) => {
    const data = readForm();
    if (!data.name) { e.preventDefault(); return; }
    const now = Date.now();
    const prev = sets.find((s) => s.id === editingId);
    const set = prev
      ? { ...prev, ...data, updatedAt: now }
      : { id: newId(), ...data, createdAt: now, updatedAt: now };
    try {
      await storeSet(set);
    } catch {
      showError('Could not save that client. Check your connection and try again.');
    }
  });

  $('#deleteBtn').addEventListener('click', async () => {
    if (!editingId) return;
    const id = editingId;
    $('#setDialog').close();
    if (!(await ask('Delete this client? This cannot be undone.', 'Delete'))) return;
    try {
      await removeSet(id);
    } catch {
      showError('Could not delete that client. Try again.');
    }
  });

  $('#list').addEventListener('click', (e) => {
    const item = e.target.closest('.item');
    if (item) openDialog(item.dataset.id);
  });
  $('#list').addEventListener('keydown', (e) => {
    const item = e.target.closest('.item');
    if (item && e.key === 'Enter') openDialog(item.dataset.id);
  });

  for (const id of ['#search', '#statusFilter', '#typeFilter']) {
    $(id).addEventListener('input', renderList);
  }

  $('#exportBtn').addEventListener('click', exportData);
  $('#importInput').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  sets = loadLocal().map(normalize);
  render();
  connectDb();
}

init();
