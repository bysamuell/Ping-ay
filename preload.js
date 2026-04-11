const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close:    () => ipcRenderer.send('window:close'),

  // Hosts CRUD
  getHosts: ()       => ipcRenderer.invoke('hosts:get'),
  saveHosts: (data)  => ipcRenderer.invoke('hosts:save', data),

  // Ping
  pingStart: (id, host) => ipcRenderer.send('ping:start', { id, host }),
  pingStop:  (id)        => ipcRenderer.send('ping:stop',  { id }),
  pingStopAll: ()        => ipcRenderer.send('ping:stop-all'),
  onPingResult: (cb) => {
    ipcRenderer.on('ping:result', (_, data) => cb(data));
  },
  offPingResult: () => ipcRenderer.removeAllListeners('ping:result'),

  // Traceroute
  tracertRun:  (host) => ipcRenderer.send('tracert:run',  { host }),
  tracertStop: ()     => ipcRenderer.send('tracert:stop'),
  onTracertHop:  (cb) => ipcRenderer.on('tracert:hop',  (_, d) => cb(d)),
  onTracertLine: (cb) => ipcRenderer.on('tracert:line', (_, d) => cb(d)),
  onTracertDone: (cb) => ipcRenderer.on('tracert:done', (_, d) => cb(d)),
  offTracert: () => {
    ipcRenderer.removeAllListeners('tracert:hop');
    ipcRenderer.removeAllListeners('tracert:line');
    ipcRenderer.removeAllListeners('tracert:done');
  },

  // DNS
  dnsLookup: (host, type) => ipcRenderer.invoke('dns:lookup', { host, type }),

  // Port Scanner
  portScan: (host, ports) => ipcRenderer.invoke('portscan:scan', { host, ports }),

  // History
  getHistory:   () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // Network Info
  getNetworkInfo: () => ipcRenderer.invoke('network:info'),

  // Notifications
  notify: (title, body) => ipcRenderer.send('app:notify', { title, body }),
});
