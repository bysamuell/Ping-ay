const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path   = require('path');
const { spawn } = require('child_process');
const fs     = require('fs');
const net    = require('net');

let mainWindow;
let notifWindow;
const activePings = new Map(); // id -> { interval, host, isOffline, offlineSince }
let notificationHistory = [];
const MAX_NOTIF_LINES = 5;

// ─────────────────────────── Persistence ────────────────────────────────────

function getDataPath()    { return path.join(app.getPath('userData'), 'hosts.json');   }
function getHistoryPath() { return path.join(app.getPath('userData'), 'history.json'); }

function loadData() {
  const p = getDataPath();
  if (!fs.existsSync(p)) {
    const def = { groups: [{ id: 'grp-default', name: 'Geral', hosts: [] }] };
    fs.writeFileSync(p, JSON.stringify(def, null, 2));
    return def;
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return { groups: [{ id: 'grp-default', name: 'Geral', hosts: [] }] }; }
}

function saveData(data) { fs.writeFileSync(getDataPath(), JSON.stringify(data, null, 2)); }

function loadHistory() {
  const p = getHistoryPath();
  if (!fs.existsSync(p)) { fs.writeFileSync(p, '[]'); return []; }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return []; }
}

function saveHistory(h) {
  fs.writeFileSync(getHistoryPath(), JSON.stringify(h.slice(-2000), null, 2));
}

// ─────────────────────────── Ping Helpers ───────────────────────────────────

function parsePingOutput(output) {
  const result = { online: false, latency: null, loss: 100 };

  const offline = [
    'Request timed out', 'Esgotado o tempo limite',
    'could not find host', 'não foi possível encontrar',
    'unreachable', 'inacessível', 'failure', 'falha'
  ];
  if (offline.some(k => output.toLowerCase().includes(k.toLowerCase()))) return result;

  // latency: time=12ms  or  tempo=12ms
  const tMatch = output.match(/(?:time|tempo)[<=](\d+)\s*ms/i);
  if (tMatch) { result.online = true; result.latency = parseInt(tMatch[1]); }

  // packet loss
  const lMatch = output.match(/(\d+)%\s*(?:loss|perdido)/i);
  if (lMatch) result.loss = parseInt(lMatch[1]);
  else if (result.online) result.loss = 0;

  return result;
}

function executePing(host) {
  return new Promise((resolve) => {
    let out = '';
    const proc = spawn('ping', ['-n', '1', '-w', '2000', host], { shell: true });

    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { out += d.toString(); });
    proc.on('close', () => resolve(parsePingOutput(out)));

    const timer = setTimeout(() => {
      try { proc.kill(); } catch (_) {}
      resolve({ online: false, latency: null, loss: 100 });
    }, 6000);

    proc.on('close', () => clearTimeout(timer));
  });
}

// ─────────────────────────── Window ─────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900,
    minWidth: 1100, minHeight: 680,
    frame: false,
    backgroundColor: '#0a0e1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
}

function createNotifWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.workArea;

  const winW = 320;
  const winH = 400; // Slightly shorter

  notifWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: x + width - winW - 10,
    y: y + height - winH - 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  notifWindow.loadFile(path.join(__dirname, 'renderer', 'notification.html'));
  notifWindow.setIgnoreMouseEvents(true);

  // Re-position on screen change/resize
  screen.on('display-metrics-changed', () => {
    const area = screen.getPrimaryDisplay().workArea;
    if (notifWindow && !notifWindow.isDestroyed()) {
        notifWindow.setPosition(area.x + area.width - 330, area.y + area.height - 410);
    }
  });

  notifWindow.on('closed', () => { notifWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  createNotifWindow();
});

app.on('window-all-closed', () => {
  activePings.forEach(p => clearInterval(p.interval));
  if (process.platform !== 'darwin') app.quit();
});

// ─────────────────────────── IPC: Window Controls ───────────────────────────

ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow.close());

// ─────────────────────────── IPC: Hosts ─────────────────────────────────────

ipcMain.handle('hosts:get',  ()       => loadData());
ipcMain.handle('hosts:save', (_, d)   => { saveData(d); return true; });

// ─────────────────────────── IPC: Ping ──────────────────────────────────────

ipcMain.on('ping:start', (_, { id, host }) => {
  if (activePings.has(id)) return;

  let isOffline = false;
  let offlineSince = null;

  const run = async () => {
    const res = await executePing(host);

    // State-change logging
    if (!res.online && !isOffline) {
      isOffline    = true;
      offlineSince = new Date().toISOString();
      const h = loadHistory();
      h.push({ id, host, event: 'offline', timestamp: offlineSince });
      saveHistory(h);
    } else if (res.online && isOffline) {
      const h = loadHistory();
      h.push({ id, host, event: 'online', timestamp: new Date().toISOString(), offlineSince });
      saveHistory(h);
      isOffline = false; offlineSince = null;
    }

    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ping:result', { id, host, ...res, timestamp: new Date().toISOString() });
    }
  };

  run();
  const interval = setInterval(run, 1000);
  activePings.set(id, { interval, host });
});

ipcMain.on('ping:stop', (_, { id }) => {
  const p = activePings.get(id);
  if (p) { clearInterval(p.interval); activePings.delete(id); }
});

ipcMain.on('ping:stop-all', () => {
  activePings.forEach(p => clearInterval(p.interval));
  activePings.clear();
});

// ─────────────────────────── IPC: Traceroute ────────────────────────────────

let currentTracert = null;

ipcMain.on('tracert:run', (_, { host }) => {
  if (currentTracert) { try { currentTracert.kill(); } catch (_) {} }

  const proc = spawn('tracert', ['-d', '-h', '20', '-w', '1000', host], { shell: true });
  currentTracert = proc;

  proc.stdout.on('data', data => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const hopMatch = trimmed.match(/^\s*(\d+)\s+/);
      if (hopMatch) {
        mainWindow.webContents.send('tracert:hop', { raw: trimmed, hopNum: parseInt(hopMatch[1]) });
      } else {
        mainWindow.webContents.send('tracert:line', { line: trimmed });
      }
    });
  });

  proc.stderr.on('data', data => {
    mainWindow.webContents.send('tracert:line', { line: data.toString() });
  });

  proc.on('close', () => {
    mainWindow.webContents.send('tracert:done', {});
    currentTracert = null;
  });
});

ipcMain.on('tracert:stop', () => {
  if (currentTracert) { try { currentTracert.kill(); } catch (_) {} currentTracert = null; }
  if (!mainWindow.isDestroyed()) mainWindow.webContents.send('tracert:done', {});
});

// ─────────────────────────── IPC: DNS ───────────────────────────────────────

ipcMain.handle('dns:lookup', (_, { host, type }) => {
  return new Promise((resolve) => {
    let out = '';
    const args = type === 'PTR' ? [host] : [`-type=${type}`, host];
    const proc = spawn('nslookup', args, { shell: true });
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { out += d.toString(); });
    proc.on('close', () => resolve(out));
    setTimeout(() => { try { proc.kill(); } catch (_) {} resolve(out || 'Timeout'); }, 10000);
  });
});

// ─────────────────────────── IPC: Port Scanner ──────────────────────────────

ipcMain.handle('portscan:scan', (_, { host, ports }) => {
  return new Promise((resolve) => {
    const results = [];
    const promises = ports.map(port => new Promise(res => {
      const sock = new net.Socket();
      sock.setTimeout(2000);
      sock.on('connect', () => { results.push({ port, status: 'open'     }); sock.destroy(); res(); });
      sock.on('timeout', () => { results.push({ port, status: 'filtered' }); sock.destroy(); res(); });
      sock.on('error',  err => {
        results.push({ port, status: err.code === 'ECONNREFUSED' ? 'closed' : 'filtered' });
        res();
      });
      sock.connect(port, host);
    }));
    Promise.all(promises).then(() => resolve(results.sort((a, b) => a.port - b.port)));
  });
});

// ─────────────────────────── IPC: History ───────────────────────────────────

ipcMain.handle('history:get',   ()  => loadHistory());
ipcMain.handle('history:clear', ()  => { saveHistory([]); return true; });

// ─────────────────────────── IPC: Network Info ──────────────────────────────

ipcMain.handle('network:info', () => new Promise(resolve => {
  let out = '';
  const proc = spawn('ipconfig', ['/all'], { shell: true });
  proc.stdout.on('data', d => { out += d.toString(); });
  proc.on('close', () => resolve(out));
  setTimeout(() => { try { proc.kill(); } catch (_) {} resolve(out); }, 8000);
}));
ipcMain.on('app:notify', (_, { title, body }) => {
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  
  const eventData = { title, body, timestamp };

  // Send to our custom notification overlay
  if (notifWindow && !notifWindow.isDestroyed()) {
      notifWindow.webContents.send('notify:update', eventData);
  }
});
