/* ─────────────────────────────────────────────────────────
   ping.js — Multi-ping cards with informative log (Premium Style)
───────────────────────────────────────────────────────── */

'use strict';

// ── Ping State ────────────────────────────────────────────────────────────
window.PingState = {};  // id -> { online, latency, loss, sent, received, lost }

const MAX_LOG_LINES = 100;

// ── Card HTML (Exclusive Premium Design) ──────────────────────────────────
function buildPingCardHTML(host) {
  return `
    <div class="card ping-card pending" id="ping-card-${host.id}">
      <div class="card-header">
        <div class="host-info-header">${escHtml(host.name)}</div>
        <div class="header-actions">
          <button title="Traceroute rápido" data-tracert="${host.id}">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          <button title="Scan rápido" data-scan="${host.id}">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
          </button>
          <button title="Copiar IP" data-copy="${host.id}">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <div style="width:1px; height:14px; background:rgba(255,255,255,0.1); margin: 0 4px;"></div>
          <button title="Editar" data-edit="${host.id}">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button title="Remover" data-remove="${host.id}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="ping-log" id="log-${host.id}">
        <div class="log-entry"><span class="log-msg" style="opacity: 0.5;">Iniciando monitoramento...</span></div>
      </div>

      <div class="ping-stats-bar">
        <span>ENVIADOS <b id="stat-sent-${host.id}">0</b></span>
        <span>RECEBIDOS <b id="stat-rec-${host.id}">0</b></span>
        <span>PERDIDOS <b id="stat-lost-${host.id}">0</b></span>
      </div>

      <div class="ping-card-footer">
        <div class="footer-ip">${escHtml(host.address)}</div>
        <button class="stop-btn" data-stop="${host.id}">
          <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          STOP
        </button>
      </div>
    </div>`;
}

// ── Render Grid ───────────────────────────────────────────────────────────
window.renderPingGrid = function () {
  const grid   = document.getElementById('ping-grid');
  const empty  = document.getElementById('ping-empty');
  const hosts  = getAllHosts();

  // Remove cards for deleted hosts
  grid.querySelectorAll('.ping-card[id^="ping-card-"]').forEach(card => {
    const id = card.id.replace('ping-card-', '');
    if (!hosts.find(h => h.id === id)) {
      card.remove();
    }
  });

  // Add new cards
  hosts.forEach(host => {
    if (!document.getElementById('ping-card-' + host.id)) {
      const tmp = document.createElement('div');
      tmp.innerHTML = buildPingCardHTML(host);
      const card = tmp.firstElementChild;
      grid.appendChild(card);
      attachCardListeners(card, host.id);
    }
  });

  empty.style.display = hosts.length === 0 ? 'flex' : 'none';
  updatePingSummary();
};

window.addPingCard = function (host) {
  window.renderPingGrid();
};

function attachCardListeners(card, hostId) {
  card.querySelector('[data-edit]')?.addEventListener('click', () => openModal(hostId));
  card.querySelector('[data-remove]')?.addEventListener('click', () => removeHost(hostId));
  card.querySelector('[data-stop]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.state === 'stopped') {
      const hostObj = getAllHosts().find(h => h.id === hostId);
      if (hostObj) {
        window.api.pingStart(hostId, hostObj.address);
        btn.dataset.state = 'running';
        btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> STOP`;
        btn.style.background = '#ef4444'; // Red
        showToast('Monitoramento iniciado: ' + hostId, 'info');
        appendLog(hostId, null, null, null, 'Monitoramento retomado');
        const cardEl = document.getElementById('ping-card-' + hostId);
        if (cardEl) { cardEl.style.opacity = '1'; cardEl.classList.remove('offline'); }
      }
    } else {
      window.api.pingStop(hostId);
      btn.dataset.state = 'stopped';
      btn.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> START`;
      btn.style.background = '#10b981'; // Green
      showToast('Monitoramento parado: ' + hostId, 'info');
      appendLog(hostId, null, null, null, 'Monitoramento parado pelo usuário');
      const cardEl = document.getElementById('ping-card-' + hostId);
      if (cardEl) { cardEl.style.opacity = '0.7'; cardEl.classList.add('offline'); }
    }
  });

  // Ações Rápidas (Agility)
  card.querySelector('[data-tracert]')?.addEventListener('click', () => {
    const hostObj = getAllHosts().find(h => h.id === hostId);
    if (!hostObj) return;
    document.getElementById('tracert-host').value = hostObj.address;
    if (window.switchTab) window.switchTab('tracert');
    document.getElementById('btn-tracert-run').click();
  });
  
  card.querySelector('[data-scan]')?.addEventListener('click', () => {
    const hostObj = getAllHosts().find(h => h.id === hostId);
    if (!hostObj) return;
    document.getElementById('ps-host').value = hostObj.address;
    if (window.switchTab) window.switchTab('portscan');
    document.getElementById('ps-ports').focus();
    showToast('Pronto para escanear ' + hostObj.address, 'info');
  });

  card.querySelector('[data-copy]')?.addEventListener('click', () => {
    const hostObj = getAllHosts().find(h => h.id === hostId);
    if (hostObj) {
        navigator.clipboard.writeText(hostObj.address).then(() => {
          showToast('IP copiado!', 'success');
        });
    }
  });
}

function removeHost(id) {
  window.api.pingStop(id);
  delete PingState[id];

  AppState.data.groups.forEach(g => {
    g.hosts = g.hosts.filter(h => h.id !== id);
  });

  persistData();
  renderSidebar();
  renderPingGrid();
  showToast('Host removido', 'info');
}

// ── Receive Ping Results ──────────────────────────────────────────────────

window.api.onPingResult(result => {
  const { id, online, latency, host } = result;

  if (!PingState[id]) {
    PingState[id] = { 
      online: null, 
      sent: 0, 
      received: 0, 
      lost: 0,
      latency: null
    };
  }
  
  const state = PingState[id];
  const wasOnline = state.online;

  state.sent++;
  if (online) {
    state.received++;
    state.online = true;
  } else {
    state.lost++;
    state.online = false;
  }
  state.latency = latency;

  // Update card UI
  updatePingCard(id, state, result);

  // Update sidebar info
  const sidebarDot = document.querySelector(`.host-item[data-host-id="${id}"] .host-dot`);
  if (sidebarDot) {
    sidebarDot.className = 'host-dot ' + (online ? 'online' : 'offline');
  }
  const sidebarMs = document.querySelector(`.host-item[data-host-id="${id}"] .host-ms`);
  if (sidebarMs) sidebarMs.textContent = latency != null ? latency + 'ms' : '—';

  // Alert on status change to offline
  if (!online && wasOnline === true) {
    playOfflineBeep();
    window.api.notify('⚠️ Host em Queda', `O host ${result.host || id} parou de responder.`);
  } else if (online && wasOnline === false) {
    window.api.notify('✅ Host Recuperado', `O host ${result.host || id} voltou a responder.`);
  }

  updateStatusBar();
  updatePingSummary();
});

function updatePingCard(id, state, result) {
  const card = document.getElementById('ping-card-' + id);
  if (!card) return;

  // Neon glow effects based on status
  card.classList.toggle('online', state.online === true);
  card.classList.toggle('offline', state.online === false);
  card.classList.toggle('pending', state.online === null);

  // Update stats display
  document.getElementById('stat-sent-' + id).textContent = state.sent;
  document.getElementById('stat-rec-' + id).textContent  = state.received;
  document.getElementById('stat-lost-' + id).textContent = state.lost;

  // Log entry with Portuguese messages
  appendLog(id, state.online, result.latency, result.host);
}

function appendLog(id, online, latency, host, customMsg) {
  const logArea = document.getElementById('log-' + id);
  if (!logArea) return;

  const now = new Date();
  const ts  = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
  
  let msg = '';
  let className = 'log-entry';

  if (customMsg) {
    msg = customMsg;
    className += ' entry-offline';
  } else if (online) {
    msg = `Resposta de ${host || '...'}: ${latency} ms`;
  } else {
    msg = `Solicitação expirou.`;
    className += ' entry-offline';
  }

  const entry = document.createElement('div');
  entry.className = className;
  entry.innerHTML = `<span class="log-ts">${ts}</span><span class="log-msg">${msg}</span>`;

  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;

  if (logArea.children.length > MAX_LOG_LINES) {
    logArea.removeChild(logArea.firstChild);
  }
}

// ── Ping Summary at Header ────────────────────────────────────────────────

function updatePingSummary() {
  const hosts = getAllHosts();
  const online  = hosts.filter(h => PingState[h.id]?.online === true).length;
  const offline = hosts.filter(h => PingState[h.id]?.online === false).length;
  const el = document.getElementById('ping-summary');
  if (el) {
    if (hosts.length === 0) el.textContent = 'Aguardando hosts...';
    else el.textContent = `${online} online · ${offline} offline · ${hosts.length - online - offline} pendente`;
  }
}

// ── Global Actions ────────────────────────────────────────────────────────

document.getElementById('btn-start-all').addEventListener('click', () => {
  getAllHosts().forEach(h => window.api.pingStart(h.id, h.address));
  showToast('Iniciando monitoramento global', 'info');
});

document.getElementById('btn-stop-all').addEventListener('click', () => {
  window.api.pingStopAll();
  
  // Update all cards with UI feedback
  getAllHosts().forEach(host => {
    const btn = document.querySelector(`#ping-card-${host.id} [data-stop]`);
    if (btn && btn.dataset.state !== 'stopped') {
      btn.dataset.state = 'stopped';
      btn.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> START`;
      btn.style.background = '#10b981'; // Green
      appendLog(host.id, null, null, null, 'Monitoramento parado pelo usuário');
      
      const cardEl = document.getElementById('ping-card-' + host.id);
      if (cardEl) {
        cardEl.style.opacity = '0.7';
        cardEl.classList.add('offline');
      }
    }
  });

  showToast('Monitoramento global pausado', 'info');
});

// ── System Beep ───────────────────────────────────────────────────────────
function playOfflineBeep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 520; // Slightly higher frequency for exclusive feel
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  } catch (_) {}
}
