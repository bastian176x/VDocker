// app/preload.js
const { contextBridge, ipcRenderer } = require('electron');
alert('¡PRELOAD CARGADO!');
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
    onDockerProgress: (callback) => ipcRenderer.on('docker:progress', callback)
  });
  console.log('✅ Bridge "electronAPI" expuesto correctamente en window');
} catch (error) {
  console.error('❌ Error fatal al exponer electronAPI:', error);
}