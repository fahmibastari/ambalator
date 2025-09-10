// main.js
const API = '/.netlify/functions/macau-2025';

const $ = (sel) => document.querySelector(sel);
const tbody     = $('#table-body');
const monthSel  = $('#month');
const searchInp = $('#search');
const timeSel   = $('#time-col');
const reloadBtn = $('#reload');

document.getElementById('year').textContent = new Date().getFullYear();

let RAW = []; // [{ dayName, dateISO, dateText, dateShort, monthName, values: {...} }]

async function loadData() {
  tbody.innerHTML = `<tr><td class="center" colspan="7">Memuat data…</td></tr>`;
  try {
    const res = await fetch(API, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Gagal memuat data (${res.status})`);
    const json = await res.json();
    RAW = Array.isArray(json.rows) ? json.rows : [];
    render();
  } catch (e) {
    tbody.innerHTML = `<tr><td class="center" colspan="7">${e.message}</td></tr>`;
  }
}

function render() {
  let rows = [...RAW];

  // filter bulan
  const m = monthSel.value;
  if (m !== 'all') rows = rows.filter(r => r.monthName === m);

  // filter cari (cocokkan ke dateText & dateShort & nama hari)
  const q = (searchInp.value || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter(r =>
      r.dateText.toLowerCase().includes(q) ||
      (r.dateShort && r.dateShort.toLowerCase().includes(q)) ||
      r.dayName.toLowerCase().includes(q)
    );
  }

  // urut terbaru -> lama (server sudah sort, tapi ulangin untuk aman)
  rows.sort((a,b) => b.dateISO.localeCompare(a.dateISO));

  const jam = timeSel.value;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td class="center" colspan="7">Tidak ada data untuk filter saat ini.</td></tr>`;
    return;
  }

  const cell = (v) => (v && v !== '-') ? `<td>${v}</td>` : `<td class="muted">-</td>`;

  tbody.innerHTML = rows.map(r => {
    if (jam === 'all') {
      return `<tr>
        <td><strong>${r.dayName}</strong> — ${r.dateText}</td>
        ${cell(r.values["00:01"])}
        ${cell(r.values["13:00"])}
        ${cell(r.values["16:00"])}
        ${cell(r.values["19:00"])}
        ${cell(r.values["22:00"])}
        ${cell(r.values["23:00"])}
      </tr>`;
    } else {
      const v = r.values[jam];
      return `<tr>
        <td><strong>${r.dayName}</strong> — ${r.dateText}</td>
        <td colspan="6">${(v && v !== '-') ? v : '-'}</td>
      </tr>`;
    }
  }).join('');
}

monthSel.addEventListener('change', render);
searchInp.addEventListener('input', render);
timeSel.addEventListener('change', render);
reloadBtn.addEventListener('click', loadData);

loadData();

// ---- PWA bootstrapping ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error)
  })
}

// Tombol install kustom (opsional)
let deferredPrompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  const btn = document.getElementById('btnInstall')
  if (btn) btn.hidden = false
})

document.getElementById('btnInstall')?.addEventListener('click', async () => {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  await deferredPrompt.userChoice
  deferredPrompt = null
  const btn = document.getElementById('btnInstall')
  if (btn) btn.hidden = true
})
