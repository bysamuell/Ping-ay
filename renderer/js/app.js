/* ─────────────────────────────────────────────────────────
   app.js — Tab routing, sidebar, host management, modal
───────────────────────────────────────────────────────── */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────

window.AppState = {
  data:        { groups: [] },   // loaded from disk
  editingId:   null,             // host id being edited (null = new)
  MAX_HOSTS:   30,
};

// ── Helpers ───────────────────────────────────────────────────────────────

function generateId() {
  return 'h-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function getAllHosts() {
  return AppState.data.groups.flatMap(g => g.hosts);
}

function getTotalHostCount() {
  return getAllHosts().length;
}

// ── Tab Navigation ────────────────────────────────────────────────────────

window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const tab = document.getElementById('tab-' + tabId);
  if (tab) tab.classList.add('active');

  const nav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (nav) nav.classList.add('active');
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => window.switchTab(item.dataset.tab));
});

// ── Window Controls ───────────────────────────────────────────────────────

document.getElementById('btn-min').addEventListener('click',   () => window.api.minimize());
document.getElementById('btn-max').addEventListener('click',   () => window.api.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.api.close());

// ── Sidebar Rendering ─────────────────────────────────────────────────────

function renderSidebar() {
  const container = document.getElementById('sidebar-hosts');
  container.innerHTML = '';

  AppState.data.groups.forEach(group => {
    const groupEl = document.createElement('div');

    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <span>${escHtml(group.name)}</span>
      <button class="icon-btn" data-add-group="${group.id}" title="Adicionar host neste grupo">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>`;
    groupEl.appendChild(header);

    group.hosts.forEach(host => {
      const pingState = PingState[host.id] || {};
      const dot  = pingState.online === true ? 'online' : pingState.online === false ? 'offline' : 'pending';
      const ms   = pingState.latency != null ? pingState.latency + 'ms' : '—';

      const item = document.createElement('div');
      item.className = 'host-item';
      item.dataset.hostId = host.id;
      item.innerHTML = `
        <div class="host-dot ${dot}"></div>
        <div class="host-name">
          <div class="host-label">${escHtml(host.name)}</div>
          <div class="host-addr">${escHtml(host.address)}</div>
        </div>
        <span class="host-ms">${ms}</span>`;

      item.addEventListener('click', () => {
        window.switchTab('monitor');
        const card = document.getElementById('ping-card-' + host.id);
        if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      });
      groupEl.appendChild(item);
    });

    container.appendChild(groupEl);
  });

  // Group add-host buttons
  container.querySelectorAll('[data-add-group]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openModal(null, btn.dataset.addGroup);
    });
  });

  updateStatusBar();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Status Bar ────────────────────────────────────────────────────────────

function updateStatusBar() {
  const hosts  = getAllHosts();
  const total  = hosts.length;
  const states = hosts.map(h => PingState[h.id] || {});
  const online = states.filter(s => s.online === true).length;
  const offline= states.filter(s => s.online === false).length;

  document.getElementById('hosts-count').textContent = `${total} host${total !== 1 ? 's' : ''}`;

  const latencyVals = states.filter(s => s.latency != null).map(s => s.latency);
  const avg = latencyVals.length ? Math.round(latencyVals.reduce((a,b)=>a+b,0)/latencyVals.length) : null;
  document.getElementById('avg-latency').textContent = avg != null ? `Média: ${avg}ms` : '—';

  const dot   = document.getElementById('global-dot');
  const label = document.getElementById('global-label');

  if (total === 0) {
    dot.className = 'dot'; label.textContent = 'Nenhum host';
  } else if (offline > 0) {
    dot.className = 'dot offline'; label.textContent = `${offline} offline`;
  } else if (online === total) {
    dot.className = 'dot online'; label.textContent = `${online}/${total} online`;
  } else {
    dot.className = 'dot'; label.textContent = `${online}/${total} online`;
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────

function openModal(hostId = null, preselectedGroup = null) {
  const total = getTotalHostCount();
  if (!hostId && total >= AppState.MAX_HOSTS) {
    showToast(`Limite de ${AppState.MAX_HOSTS} hosts atingido`, 'error');
    return;
  }

  AppState.editingId = hostId;
  document.getElementById('modal-title').textContent = hostId ? 'Editar Host' : 'Adicionar Host';

  // Populate group select
  const sel = document.getElementById('host-group-input');
  sel.innerHTML = '';
  AppState.data.groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    sel.appendChild(opt);
  });

  if (hostId) {
    const host = getAllHosts().find(h => h.id === hostId);
    if (!host) return;
    document.getElementById('host-name-input').value  = host.name;
    document.getElementById('host-addr-input').value  = host.address;
    const ownerGroup = AppState.data.groups.find(g => g.hosts.some(h => h.id === hostId));
    if (ownerGroup) sel.value = ownerGroup.id;
  } else {
    document.getElementById('host-name-input').value  = '';
    document.getElementById('host-addr-input').value  = '';
    if (preselectedGroup) sel.value = preselectedGroup;
  }

  document.getElementById('modal-host').classList.add('open');
  document.getElementById('host-name-input').focus();
}

function closeModal() {
  document.getElementById('modal-host').classList.remove('open');
  AppState.editingId = null;
}

document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-host').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

document.getElementById('modal-save').addEventListener('click', saveHost);
document.getElementById('host-addr-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { 
    e.preventDefault(); 
    saveHost(); 
  }
});

function saveHost() {
  const nameInput = document.getElementById('host-name-input').value.trim();
  const addressInput = document.getElementById('host-addr-input').value.trim();
  const groupId = document.getElementById('host-group-input').value;

  if (!addressInput) { showToast('Insira um endereço IP ou hostname', 'error'); return; }

  const group = AppState.data.groups.find(g => g.id === groupId);
  if (!group) return;

  if (AppState.editingId) {
    // Edit existing host — remove from old group, add to new
    AppState.data.groups.forEach(g => {
      g.hosts = g.hosts.filter(h => h.id !== AppState.editingId);
    });
    const host = { id: AppState.editingId, name: nameInput || addressInput, address: addressInput };
    group.hosts.push(host);
    showToast('Host atualizado', 'success');
  } else {
    // Bulk insertion logic
    const addresses = addressInput.split(/[\n,]+/).map(a => a.trim()).filter(a => a);
    let addedCount = 0;

    addresses.forEach(addr => {
      if (getTotalHostCount() >= AppState.MAX_HOSTS) return;
      
      const id = generateId();
      const hostName = (addresses.length === 1 && nameInput) ? nameInput : addr;
      const host = { id, name: hostName, address: addr };
      group.hosts.push(host);
      
      // Start ping immediately
      window.api.pingStart(id, addr);
      if (window.addPingCard) window.addPingCard(host);
      addedCount++;
    });

    if (addedCount > 0) {
      showToast(`${addedCount} host(s) adicionado(s)`, 'success');
    }
  }

  persistData();
  renderSidebar();
  closeModal();
  if (window.renderPingGrid) window.renderPingGrid(); // re-render cards
}

// ── Add Host Buttons ──────────────────────────────────────────────────────

document.getElementById('btn-add-host').addEventListener('click',  () => openModal());
document.getElementById('btn-add-host-2').addEventListener('click',() => openModal());

// ── Persist ───────────────────────────────────────────────────────────────

async function persistData() {
  await window.api.saveHosts(AppState.data);
}

// ── Load & Init ───────────────────────────────────────────────────────────

async function init() {
  AppState.data = await window.api.getHosts();

  // Ensure at least one group
  if (!AppState.data.groups || AppState.data.groups.length === 0) {
    AppState.data.groups = [{ id: 'grp-default', name: 'Geral', hosts: [] }];
  }

  // Smart Window Init
  const smartCheck = document.getElementById('check-smart-window');
  const smartSaved = localStorage.getItem('smartWindow') === 'true';
  smartCheck.checked = smartSaved;
  window.api.setSmartWindow(smartSaved);

  smartCheck.addEventListener('change', (e) => {
    const active = e.target.checked;
    localStorage.setItem('smartWindow', active);
    window.api.setSmartWindow(active);
    showToast(active ? 'Janela Inteligente ativada' : 'Janela Inteligente desativada', 'info');
  });

  window.api.onSmartMode((active) => {
    smartCheck.checked = active;
    localStorage.setItem('smartWindow', active);
  });

  renderSidebar();
  renderPingGrid();

  // Start pings for all hosts
  getAllHosts().forEach(h => {
    window.api.pingStart(h.id, h.address);
  });
}

init();
