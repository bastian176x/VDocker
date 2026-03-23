// app/preload.js
const { contextBridge, ipcRenderer } = require('electron');
console.log('🔌 Cargando Preload Script...');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    runDocker: (topology) => {
      console.log('🚀 Enviando evento docker:run desde el frontend');
      return ipcRenderer.invoke('docker:run', topology);
    },
    stopDocker: () => ipcRenderer.invoke('docker:stop'),
    getDockerStatus: () => ipcRenderer.invoke('docker:status'),
    pruneDocker: () => ipcRenderer.invoke('docker:prune'),
    checkDocker: () => ipcRenderer.invoke('docker:check'),
    openTerminal: (containerId) => ipcRenderer.invoke('docker:terminal', containerId),
    startTerminal: (containerId, onData) => {
      ipcRenderer.on(`terminal:data:${containerId}`, (event, data) => onData(data));
      return ipcRenderer.invoke('terminal:start', containerId);
    },
    writeTerminal: (containerId, data) => ipcRenderer.send('terminal:write', { containerId, data }),
    stopTerminal: (containerId) => {
      ipcRenderer.removeAllListeners(`terminal:data:${containerId}`);
      ipcRenderer.send('terminal:stop', containerId);
    },
    saveProject: (data) => ipcRenderer.invoke('project:save', data),
    loadProject: () => ipcRenderer.invoke('project:load'),
    onDockerProgress: (callback) => ipcRenderer.on('docker:progress', callback),
    onDockerLog: (callback) => ipcRenderer.on('docker:log', callback)
  });
  console.log('✅ Bridge "electronAPI" expuesto correctamente en window');
} catch (error) {
  console.error('❌ Error fatal al exponer electronAPI:', error);
}