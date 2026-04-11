/* ─────────────────────────────────────────────────────────
   tracert.js — Visual traceroute with hop-by-hop display
───────────────────────────────────────────────────────── */

'use strict';

let tracertRunning  = false;
let maxHopLatency   = 1; // for bar scaling

function parseHopLine(raw) {
  // Windows tracert line:  "  1    <1 ms    <1 ms    <1 ms  192.168.1.1"
  // or with * for timeout: "  3     *        *        *     Request timed out."

  const hopMatch = raw.match(/^\s*(\d+)\s+/);
  if (!hopMatch) return null;

  const hopNum = parseInt(hopMatch[1]);

  // Extract up to 3 RTT values (ms or <1 or *)
  const rttMatches = [...raw.matchAll(/(<?\d+)\s*ms/gi)].map(m => m[1]);
  const timeouts   = [...raw.matchAll(/\*/g)];

  // Extract IP address
  const ipMatch = raw.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
  const ip = ipMatch ? ipMatch[1] : null;

  const rtt1 = rttMatches[0] ?? (timeouts[0] ? '*' : null);
  const rtt2 = rttMatches[1] ?? (timeouts[1] ? '*' : null);
  const rtt3 = rttMatches[2] ?? (timeouts[2] ? '*' : null);

  // Avg latency for bar
  const nums = rttMatches.map(r => r.startsWith('<') ? 1 : parseInt(r)).filter(n => !isNaN(n));
  const avg  = nums.length ? Math.round(nums.reduce((a,b)=>a+b,0)/nums.length) : null;

  return { hopNum, rtt1, rtt2, rtt3, ip, avg };
}

function msClass(ms) {
  if (!ms || ms === '*') return 'timeout';
  const n = parseInt(ms);
  if (n > 150) return 'high';
  return '';
}

function addHopRow(hopData) {
  const { hopNum, rtt1, rtt2, rtt3, ip, avg } = hopData;
  const output = document.getElementById('tracert-output');

  let displayRtt = '*';
  let msClassSuffix = 'hop-timeout';
  
  // As requested by user: ONLY show the IPs, discard timed out hops entirely.
  if (!ip) return;
  
  if (avg != null) {
    displayRtt = `[ ${avg} ms ]`;
    msClassSuffix = 'hop-ms';
  } else if (rtt1 && rtt1 !== '*') {
    displayRtt = `[ ${rtt1} ms ]`;
    msClassSuffix = 'hop-ms';
  }

  const row = document.createElement('div');
  row.className = 'tracert-hop-row';
  if (hopNum % 2 !== 0) row.classList.add('odd');
  
  row.innerHTML = `
    <span class="hop-n">${hopNum}</span>
    <span class="hop-ip" style="${!ip ? 'color:#555' : ''}">${ip ?? '* * *'}</span>
    <span class="${msClassSuffix}">${ip ? displayRtt : ''}</span>
  `;
  output.appendChild(row);
  output.scrollTop = output.scrollHeight;
}

function addInfoLine(text) {
  const output = document.getElementById('tracert-output');
  const line   = document.createElement('div');
  line.className = 'tracert-info-line';
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function setTracertStatus(msg, loading = false) {
  const el = document.getElementById('tracert-status');
  el.innerHTML = loading
    ? `<span class="spinner"></span> ${msg}`
    : msg;
}

// ── Listeners ─────────────────────────────────────────────────────────────

window.api.onTracertHop(data => {
  const parsed = parseHopLine(data.raw);
  if (parsed) addHopRow(parsed);
  else addInfoLine(data.raw);
});

window.api.onTracertLine(data => {
  if (data.line.trim()) addInfoLine(data.line);
});

window.api.onTracertDone(() => {
  tracertRunning = false;
  setTracertStatus('Concluído');
  document.getElementById('tracert-footer').style.display = 'flex';
  showToast('Traceroute concluído', 'success');
});

// ── Controls ──────────────────────────────────────────────────────────────

document.getElementById('btn-tracert-run').addEventListener('click', () => {
  const host = document.getElementById('tracert-host').value.trim();
  if (!host) { showToast('Insira um host ou IP', 'error'); return; }

  document.getElementById('tracert-output').innerHTML = '';
  document.getElementById('tracert-footer').style.display = 'none';
  maxHopLatency = 1;
  tracertRunning = true;

  setTracertStatus(`Rastreando ${host}...`, true);
  window.api.offTracert();
  // Re-bind since we call offTracert
  window.api.onTracertHop(data => {
    const parsed = parseHopLine(data.raw);
    if (parsed) addHopRow(parsed);
    else addInfoLine(data.raw);
  });
  window.api.onTracertLine(data => { if (data.line.trim()) addInfoLine(data.line); });
  window.api.onTracertDone(() => {
    tracertRunning = false;
    setTracertStatus('Concluído');
    document.getElementById('tracert-footer').style.display = 'flex';
    showToast('Traceroute concluído', 'success');
  });

  window.api.tracertRun(host);
});

document.getElementById('btn-tracert-stop').addEventListener('click', () => {
  if (!tracertRunning) return;
  window.api.tracertStop();
  tracertRunning = false;
  setTracertStatus('Cancelado pelo usuário');
  document.getElementById('tracert-footer').style.display = 'flex';
});

document.getElementById('btn-tracert-clear').addEventListener('click', () => {
  document.getElementById('tracert-output').innerHTML = '';
  document.getElementById('tracert-footer').style.display = 'none';
  setTracertStatus('');
  maxHopLatency = 1;
});

document.getElementById('tracert-host').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-tracert-run').click();
});
