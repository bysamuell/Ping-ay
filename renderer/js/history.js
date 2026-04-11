/* ─────────────────────────────────────────────────────────
   history.js — Event history display, filter & CSV export
───────────────────────────────────────────────────────── */

'use strict';

let allHistory = [];

// ── Load ──────────────────────────────────────────────────────────────────

async function loadHistory() {
  allHistory = await window.api.getHistory();
  renderHistory();
}

// ── Render ────────────────────────────────────────────────────────────────

function renderHistory() {
  const filter = (document.getElementById('history-filter').value || '').toLowerCase();
  const list   = document.getElementById('history-list');
  const countEl= document.getElementById('history-count');

  const items = filter
    ? allHistory.filter(e => e.host.toLowerCase().includes(filter))
    : allHistory;

  // Show newest first
  const sorted = [...items].reverse();

  countEl.textContent = `${sorted.length} evento${sorted.length !== 1 ? 's' : ''}`;

  if (sorted.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" width="48" height="48">
          <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/>
        </svg>
        <p>Nenhum evento registrado</p>
        <small>Eventos de queda e reconexão aparecerão aqui</small>
      </div>`;
    return;
  }

  list.innerHTML = sorted.map(ev => {
    const isOffline = ev.event === 'offline';
    const ts = formatTimestamp(ev.timestamp);
    const duration = (ev.event === 'online' && ev.offlineSince)
      ? ' · Duração offline: ' + durationStr(ev.offlineSince, ev.timestamp)
      : '';

    return `
      <div class="history-item ${isOffline ? 'offline-ev' : 'online-ev'}">
        <div class="hi-icon">
          ${isOffline
            ? '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"/></svg>'
            : '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>'}
        </div>
        <div>
          <div class="hi-event">${isOffline ? 'OFFLINE' : 'ONLINE'}</div>
          <div class="hi-host">${escHtml(ev.host)}${duration}</div>
        </div>
        <span class="hi-time">${ts}</span>
      </div>`;
  }).join('');
}

function formatTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function durationStr(from, to) {
  const ms = new Date(to) - new Date(from);
  if (isNaN(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}min ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}min`;
}

// ── Filter ────────────────────────────────────────────────────────────────

document.getElementById('history-filter').addEventListener('input', renderHistory);

// ── Export CSV ────────────────────────────────────────────────────────────

document.getElementById('btn-export-csv').addEventListener('click', () => {
  if (allHistory.length === 0) { showToast('Nenhum dado para exportar', 'error'); return; }

  const header = 'Host,Evento,Timestamp,Offline Desde';
  const rows   = allHistory.map(e =>
    `"${e.host}","${e.event}","${e.timestamp}","${e.offlineSince || ''}"`
  );

  const csv  = [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pingay-history-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado com sucesso', 'success');
});

// ── Clear ─────────────────────────────────────────────────────────────────

document.getElementById('btn-clear-history').addEventListener('click', async () => {
  if (!confirm('Deseja apagar todo o histórico de eventos?')) return;
  await window.api.clearHistory();
  allHistory = [];
  renderHistory();
  showToast('Histórico apagado', 'info');
});

// ── Reload when tab is activated ──────────────────────────────────────────

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if (item.dataset.tab === 'history') loadHistory();
  });
});

// ── Initial load ──────────────────────────────────────────────────────────
loadHistory();
