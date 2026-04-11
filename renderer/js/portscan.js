/* ─────────────────────────────────────────────────────────
   portscan.js — TCP port scanner with presets
───────────────────────────────────────────────────────── */

'use strict';

// Common service names
const SERVICE_NAMES = {
  20: 'FTP Data', 21: 'FTP', 22: 'SSH', 23: 'Telnet',
  25: 'SMTP', 53: 'DNS', 69: 'TFTP', 80: 'HTTP',
  110: 'POP3', 115: 'SFTP', 135: 'RPC', 139: 'NetBIOS',
  143: 'IMAP', 194: 'IRC', 443: 'HTTPS', 445: 'SMB',
  465: 'SMTPS', 514: 'Syslog', 587: 'SMTP (sub)', 631: 'IPP',
  993: 'IMAPS', 995: 'POP3S', 1433: 'MSSQL', 1521: 'Oracle',
  1723: 'PPTP', 3000: 'Dev/Node', 3306: 'MySQL', 3389: 'RDP',
  4000: 'Dev', 5432: 'PostgreSQL', 5900: 'VNC',
  5985: 'WinRM HTTP', 5986: 'WinRM HTTPS', 6379: 'Redis',
  8080: 'HTTP Alt', 8443: 'HTTPS Alt', 8888: 'Jupyter',
  27017: 'MongoDB',
};

// Port presets
document.querySelectorAll('.port-preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('ps-ports').value = btn.dataset.ports;
  });
});

document.getElementById('btn-ps-scan').addEventListener('click', async () => {
  const host  = document.getElementById('ps-host').value.trim();
  const raw   = document.getElementById('ps-ports').value.trim();

  if (!host) { showToast('Insira um host ou IP', 'error'); return; }
  if (!raw)  { showToast('Insira as portas a escanear', 'error'); return; }

  const ports = raw.split(/[,\s]+/).map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0 && p <= 65535);
  if (ports.length === 0) { showToast('Nenhuma porta válida informada', 'error'); return; }

  const spinner = document.getElementById('ps-spinner');
  const results = document.getElementById('portscan-results');

  spinner.innerHTML = `<span class="spinner"></span> <span style="font-size:12px;color:var(--text-2)">Escaneando ${ports.length} porta${ports.length>1?'s'}...</span>`;
  results.innerHTML = '';

  try {
    const data = await window.api.portScan(host, ports);
    spinner.innerHTML = '';
    renderPortResults(host, data);
  } catch (err) {
    spinner.innerHTML = '';
    results.innerHTML = `<div style="color:var(--red);padding:16px">Erro: ${escHtml(String(err))}</div>`;
  }
});

function renderPortResults(host, data) {
  const results = document.getElementById('portscan-results');
  if (!data || data.length === 0) {
    results.innerHTML = '<div class="empty-state"><p>Nenhum resultado</p></div>';
    return;
  }

  const open     = data.filter(r => r.status === 'open').length;
  const closed   = data.filter(r => r.status === 'closed').length;
  const filtered = data.filter(r => r.status === 'filtered').length;

  results.innerHTML = `
    <div style="display:flex;gap:16px;margin-bottom:14px;font-size:13px">
      <span style="color:var(--green)">✓ ${open} aberta${open!==1?'s':''}</span>
      <span style="color:var(--red)">✗ ${closed} fechada${closed!==1?'s':''}</span>
      <span style="color:var(--yellow)">⊘ ${filtered} filtrada${filtered!==1?'s':''}</span>
      <span style="color:var(--text-3);margin-left:auto">Host: ${escHtml(host)}</span>
    </div>
    <table class="port-table">
      <thead>
        <tr>
          <th>Porta</th>
          <th>Serviço</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(r => `
          <tr>
            <td>${r.port}</td>
            <td style="color:var(--text-2)">${SERVICE_NAMES[r.port] || '—'}</td>
            <td>
              <span class="status-badge ${r.status}">
                ${r.status === 'open' ? '●' : r.status === 'closed' ? '✕' : '⊘'}
                ${r.status === 'open' ? 'Aberta' : r.status === 'closed' ? 'Fechada' : 'Filtrada'}
              </span>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  showToast(`Scan concluído: ${open} porta${open!==1?'s':''} aberta${open!==1?'s':''}`, open > 0 ? 'success' : 'info');
}

document.getElementById('ps-host').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-ps-scan').click();
});
