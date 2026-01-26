// app/main.js
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const topologyGenerator = require('./topology/generator');
const { saveComposeFile } = require('./filesystem/composeWriter');
const dockerService = require('./docker/service');

const preloadPath = path.resolve(__dirname, 'preload.js');
const fs = require('fs');
const os = require('os'); // NECESARIO para tmpdir

if (fs.existsSync(preloadPath)) {
  console.log('✅ Preload file found at:', preloadPath);
} else {
  console.error('❌ Preload file NOT found at:', preloadPath);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: preloadPath, // Usamos la ruta absoluta
      contextIsolation: true, // OBLIGATORIO para que contextBridge funcione
      nodeIntegration: false, // Por seguridad
      sandbox: false,
      webSecurity: false
    },
    show: false // Oculto al nacer, se muestra en 'ready-to-show'
  });

  // Esperar a que la ventana esté lista para mostrarse y forzar el foco
  win.once('ready-to-show', () => {
    win.show();
    win.focus(); // <--- Esto es lo importante: pide el teclado al SO
  });

  // Forzamos localhost para asegurar que vemos los cambios en tiempo real
  win.loadURL('http://localhost:3000');

  // win.loadFile(path.join(__dirname, '../frontend/dist/index.html')); // Comentamos esto por ahora
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// VARIABLE GLOBAL PARA RECORDAR LA RUTA
let currentComposePath = null;

// ... setup de ventana ...

// Handle Docker Compose generation
ipcMain.handle('docker:run', async (event, topology) => {
  try {
    const yamlContent = topologyGenerator.generateComposeYAML(topology.nodes, topology.connections || []);

    // Guardamos en %TEMP% para evitar bloqueos de permisos en Windows
    const tempDir = path.join(os.tmpdir(), 'docker-topology-lab');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const savedPath = path.join(tempDir, 'docker-compose.generated.yml');
    fs.writeFileSync(savedPath, yamlContent);

    currentComposePath = savedPath; // Referencia para el stop/limpieza

    console.log(`YAML Guardado en: ${savedPath}`);

    const sender = event.sender;
    const requiredImages = topology.nodes.map(n => n.data.dockerImage).filter(img => img);

    await dockerService.pullImages(requiredImages, (message) => sender.send('docker:progress', { message }));

    const containerNames = topology.nodes.map(n => n.data.containerName).filter(n => n);
    return await dockerService.startLab(savedPath, containerNames);

  } catch (error) {
    console.error('Error en Run:', error);
    return { success: false, message: error.message };
  }
});

// Handle Docker Stop
ipcMain.handle('docker:stop', async (event) => {
  const sender = event.sender;
  // Fallback si se pierde la referencia
  if (!currentComposePath) {
    currentComposePath = path.join(os.tmpdir(), 'docker-topology-lab', 'docker-compose.generated.yml');
  }
  try {
    return await dockerService.stopLab(currentComposePath, (msg) => sender.send('docker:progress', { message: msg }));
  } catch (error) {
    return { success: false, message: error.message };
  }
});


ipcMain.handle('docker:terminal', async (event, containerId) => {
  // Solo pasamos la llamada al servicio
  return await dockerService.openTerminal(containerId);
});

ipcMain.handle('docker:status', async () => {

  // Asegúrate de que dockerService esté disponible en este scope
  return await dockerService.getLabStatus();
});

ipcMain.handle('docker:prune', async () => {
  return await dockerService.pruneSystem();
});

ipcMain.handle('docker:check', async () => {
  return await dockerService.checkDaemon();
});

// --- FIX 4: LIMPIEZA DE ZOMBIES (Anti-Orphans) ---
app.on('before-quit', (event) => {
  if (currentComposePath) {
    console.log('💀 Aplicación cerrándose. Limpiando contenedores...');
    event.preventDefault(); // Pausamos el cierre un momento

    const { spawn } = require('child_process');
    // Ejecutamos limpieza forzosa
    const child = spawn('docker', ['compose', '-f', currentComposePath, 'down', '--remove-orphans']);

    child.on('close', () => {
      console.log('✅ Limpieza completada.');
      currentComposePath = null;
      app.quit(); // Salimos definitivamente
    });

    // Timeout de seguridad (5s) por si Docker no responde
    setTimeout(() => {
      console.warn('⚠️ Timeout en limpieza, saliendo a la fuerza.');
      app.exit(0);
    }, 5000);
  }
});