/* ─────────────────────────────────────────────────────────
   dns.js — DNS lookup via nslookup
───────────────────────────────────────────────────────── */

'use strict';

function formatDnsOutput(raw) {
  // Color-code the output slightly using CSS spans
  return raw
    .split('\n')
    .map(line => {
      line = line.trimEnd();
      if (!line) return '';
      if (line.match(/^Server:|^Address:/i)) {
        return `<span style="color:var(--text-3)">${escHtml(line)}</span>`;
      }
      if (line.match(/^Name:|canonical name|mail exchanger|nameserver/i)) {
        return `<span style="color:var(--accent)">${escHtml(line)}</span>`;
      }
      if (line.match(/\d{1,3}(\.\d{1,3}){3}/)) {
        return `<span style="color:var(--green)">${escHtml(line)}</span>`;
      }
      if (line.match(/Non-existent|can't find|NXDOMAIN|failed/i)) {
        return `<span style="color:var(--red)">${escHtml(line)}</span>`;
      }
      return `<span style="color:var(--text-2)">${escHtml(line)}</span>`;
    })
    .filter(l => l !== '')
    .join('\n');
}

document.getElementById('btn-dns-lookup').addEventListener('click', async () => {
  const host = document.getElementById('dns-host').value.trim();
  const type = document.getElementById('dns-type').value;

  if (!host) { showToast('Insira um host ou IP', 'error'); return; }

  const output  = document.getElementById('dns-output');
  const spinner = document.getElementById('dns-spinner');

  output.innerHTML  = '<span style="color:var(--text-3)">Consultando...</span>';
  spinner.innerHTML = '<span class="spinner"></span>';

  try {
    const result = await window.api.dnsLookup(host, type);
    output.innerHTML = formatDnsOutput(result) || '<span style="color:var(--text-3)">Sem resultado</span>';
  } catch (err) {
    output.innerHTML = `<span style="color:var(--red)">Erro: ${escHtml(String(err))}</span>`;
  } finally {
    spinner.innerHTML = '';
  }
});

document.getElementById('btn-dns-clear').addEventListener('click', () => {
  document.getElementById('dns-output').innerHTML = 'Aguardando consulta...';
  document.getElementById('dns-host').value = '';
});

document.getElementById('dns-host').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-dns-lookup').click();
});
