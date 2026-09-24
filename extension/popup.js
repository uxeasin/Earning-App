'use strict';

// Document requirements per visa type. Common items first, then extras.
const DOCS = {
  common: ['Valid passport', 'Passport photo', 'Application form (printed)', 'National ID copy'],
  tourist: ['Bank statement / solvency', 'Hotel or travel plan'],
  medical: ['Doctor / hospital appointment letter', 'Previous medical papers'],
  student: ['Admission / offer letter', 'Academic certificates'],
  business: ['Company letter / trade licence', 'Invitation letter'],
  other: [],
};

const storage = (chrome.storage && chrome.storage.local) || null;

const state = { applicant: '', visaType: 'tourist', notes: '', checked: {} };

function get(id) { return document.getElementById(id); }

function docsFor(type) {
  return [...DOCS.common, ...(DOCS[type] || [])];
}

function render() {
  const items = docsFor(state.visaType);
  const list = get('checklist');
  list.innerHTML = '';
  let done = 0;
  items.forEach((label, i) => {
    const id = 'doc-' + i;
    const li = document.createElement('li');
    const wrap = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = !!state.checked[label];
    if (cb.checked) done++;
    cb.addEventListener('change', () => {
      state.checked[label] = cb.checked;
      save();
      render();
    });
    const span = document.createElement('span');
    span.textContent = label;
    wrap.append(cb, span);
    li.append(wrap);
    list.append(li);
  });
  get('count').textContent = `${done} / ${items.length}`;
  get('barFill').style.width = items.length ? (done / items.length * 100) + '%' : '0';
  get('ready').hidden = !(items.length && done === items.length);
}

function save() {
  if (!storage) return;
  try { storage.set({ helperState: state }); } catch { /* ignore */ }
}

function load() {
  return new Promise((resolve) => {
    if (!storage) { resolve(); return; }
    try {
      storage.get(['helperState', 'panelUrl'], (res) => {
        if (res && res.helperState) Object.assign(state, res.helperState);
        state.panelUrl = res && res.panelUrl ? res.panelUrl : '';
        resolve();
      });
    } catch { resolve(); }
  });
}

function wire() {
  get('applicant').value = state.applicant || '';
  get('visaType').value = state.visaType || 'tourist';
  get('notes').value = state.notes || '';

  get('applicant').addEventListener('input', (e) => { state.applicant = e.target.value; save(); });
  get('notes').addEventListener('input', (e) => { state.notes = e.target.value; save(); });
  get('visaType').addEventListener('change', (e) => {
    state.visaType = e.target.value;
    save();
    render();
  });

  get('resetBtn').addEventListener('click', () => {
    state.applicant = ''; state.notes = ''; state.checked = {};
    get('applicant').value = ''; get('notes').value = '';
    save();
    render();
  });

  get('openPanelBtn').addEventListener('click', () => {
    const url = state.panelUrl;
    if (url) {
      chrome.tabs ? chrome.tabs.create({ url }) : window.open(url, '_blank');
    } else {
      get('panelHint').hidden = false;
    }
  });

  get('optionsLink').addEventListener('click', (e) => {
    e.preventDefault();
    if (chrome.runtime && chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  });
}

load().then(() => { wire(); render(); });
