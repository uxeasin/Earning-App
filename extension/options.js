'use strict';
const storage = (chrome.storage && chrome.storage.local) || null;
const input = document.getElementById('panelUrl');
if (storage) {
  try { storage.get(['panelUrl'], (r) => { if (r && r.panelUrl) input.value = r.panelUrl; }); } catch {}
}
document.getElementById('saveBtn').addEventListener('click', () => {
  const url = input.value.trim();
  if (storage) { try { storage.set({ panelUrl: url }); } catch {} }
  const saved = document.getElementById('saved');
  saved.hidden = false;
  setTimeout(() => { saved.hidden = true; }, 1500);
});
