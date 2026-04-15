'use strict';

const grid = document.getElementById('smart-grid');

// State for synchronization
const PingState = {}; 

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function init() {
  const data = await window.api.getHosts();
  const allHosts = data.groups.flatMap(g => g.hosts);
  
  // Render cards for all hosts initially
  // We can filter for only active ones if main process provides that, 
  // but for now we render all and start them.
  allHosts.forEach(host => {
    createMiniCard(host);
  });
}

function createMiniCard(host) {
  const card = document.createElement('div');
  card.className = 'card ping-card pending mini';
  card.id = `smart-card-${host.id}`;
  
  card.innerHTML = `
    <div class="card-header">
      <div class="host-info-header">${escHtml(host.name)}</div>
      <div class="header-actions">
        <button title="Recolher" data-action="collapse">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 12H6"/></svg>
        </button>
        <button title="Parar" data-action="stop">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
    <div class="mini-body">
      <div class="ping-log" id="log-${host.id}"></div>
      <div class="ping-stats-bar">
        <span>ENVIADOS <b id="stat-sent-${host.id}">0</b></span>
        <span>REC <b id="stat-rec-${host.id}">0</b></span>
        <span>LOST <b id="stat-lost-${host.id}">0</b></span>
        <span id="stat-ms-${host.id}" style="color:var(--accent); font-weight:bold; font-family:monospace; text-align:right;">—</span>
      </div>
    </div>
  `;

  // Listeners
  card.querySelector('[data-action="collapse"]').onclick = () => {
    card.classList.toggle('collapsed');
    const isCollapsed = card.classList.contains('collapsed');
    card.querySelector('.mini-body').style.display = isCollapsed ? 'none' : 'block';
  };

  card.querySelector('[data-action="stop"]').onclick = () => {
    window.api.pingStop(host.id);
    card.remove(); // Remove físicamente o card da janela inteligente
  };

  grid.appendChild(card);
}

// Handle stops from other windows (sync)
window.api.onPingStopped && window.api.onPingStopped((data) => {
  const card = document.getElementById(`smart-card-${data.id}`);
  if (card) card.remove();
});

window.api.onPingResult((data) => {
  const { id, online, latency, host } = data;
  const card = document.getElementById(`smart-card-${id}`);
  if (!card) return;

  if (!PingState[id]) {
    PingState[id] = { sent: 0, received: 0, lost: 0 };
  }
  const state = PingState[id];
  state.sent++;
  if (online) state.received++; else state.lost++;

  // UI Updates
  card.classList.toggle('online', online === true);
  card.classList.toggle('offline', online === false);
  card.style.opacity = '1';

  document.getElementById(`stat-sent-${id}`).textContent = state.sent;
  document.getElementById(`stat-rec-${id}`).textContent  = state.received;
  document.getElementById(`stat-lost-${id}`).textContent = state.lost;
  document.getElementById(`stat-ms-${id}`).textContent   = latency ? `${latency}ms` : '—';

  // Mini Log
  const logArea = document.getElementById(`log-${id}`);
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const now = new Date();
  const ts = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
  
  entry.innerHTML = `<span class="log-ts" style="font-size:9px">[${ts}]</span> <span class="log-msg" style="color:${online?'#fff':'#f87171'}">${online ? latency+'ms' : 'Timeout'}</span>`;
  logArea.appendChild(entry);
  if (logArea.children.length > 10) logArea.children[0].remove();
  logArea.scrollTop = logArea.scrollHeight;
});

// Window controls
document.getElementById('smart-btn-min').onclick   = () => window.api.smartMinWindow();
document.getElementById('smart-btn-close').onclick = () => window.api.smartCloseWindow();

init();
