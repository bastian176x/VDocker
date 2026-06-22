// app/main.js
const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron'); // Modified import
const path = require('path');
const topologyGenerator = require('./topology/generator');
const { saveComposeFile } = require('./filesystem/composeWriter');
const dockerService = require('./docker/service');
const projectManager = require('./filesystem/projectManager');

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
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: preloadPath, // Usamos la ruta absoluta
      contextIsolation: true, // OBLIGATORIO para que contextBridge funcione
      nodeIntegration: false, // Por seguridad
      sandbox: false,
      webSecurity: false
    },
    show: false // Oculto al nacer, se muestra en 'ready-to-show'
  });
  Menu.setApplicationMenu(null);

  // Esperar a que la ventana esté lista para mostrarse y forzar el foco
  win.once('ready-to-show', () => {
    win.show();
    win.focus(); // <--- Esto es lo importante: pide el teclado al SO
  });

  if (app.isPackaged) {
    // MODO PRODUCCIÓN (.exe)
    // Buscamos el archivo index.html compilado.
    // Como main.js está en 'app/', subimos uno (..) y entramos a 'frontend/dist/'
    const indexPath = path.join(__dirname, '../frontend/dist/index.html');

    // DEBUG DE EMERGENCIA: Si no existe, muestra un error visual
    if (!fs.existsSync(indexPath)) {
      dialog.showErrorBox("Error Fatal", "No encuentro el archivo HTML en:\n" + indexPath);
    }

    win.loadFile(indexPath);

  } else {
    // MODO DESARROLLO (npm run dev)
    win.loadURL('http://localhost:3000');

    // Opcional: Abrir herramientas de desarrollo automáticamente en modo dev
    // win.webContents.openDevTools(); 
  }


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

let isDeployingLab = false;

// Handle Docker Compose generation
ipcMain.handle('docker:run', async (event, topology) => {
  if (isDeployingLab) {
    return { success: false, message: 'Procesando...' };
  }
  isDeployingLab = true;
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
    const result = await dockerService.startLab(savedPath, containerNames);

    if (result.success) {
      dockerService.streamLabLogs(savedPath, (logLine) => {
        sender.send('docker:log', { message: logLine });
      });
    }
    return result;

  } catch (error) {
    console.error('Error en Run:', error);
    return { success: false, message: error.message };
  } finally {
    isDeployingLab = false;
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

ipcMain.handle('terminal:start', async (event, containerId) => {
  const sender = event.sender;
  return await dockerService.attachTerminal(containerId, (data) => {
    sender.send(`terminal:data:${containerId}`, data);
  });
});

ipcMain.on('terminal:write', (event, { containerId, data }) => {
  dockerService.writeTerminal(containerId, data);
});

ipcMain.on('terminal:stop', (event, containerId) => {
  dockerService.stopTerminal(containerId);
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

// --- HANDLERS DE PERSISTENCIA DE PROYECTO (.json) ---

// GUARDAR PROYECTO INTEGRAL
ipcMain.handle('project:save', async (event, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Guardar Proyecto Integral',
    defaultPath: `laboratorio-${Date.now()}.vdlab`,
    filters: [{ name: 'Archivos VDocker Lab', extensions: ['vdlab'] }, { name: 'Todos los archivos', extensions: ['*'] }]
  });

  if (canceled || !filePath) return { success: false };
  return await projectManager.saveFullProject(filePath, data);
});

// ELIMINAR VOLUMEN ZOMBI
ipcMain.handle('volume:delete', async (event, nodeName, nodeId) => {
  const rawName = nodeName || `service-${nodeId}`;
  const safeName = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const volumePath = path.join(os.tmpdir(), 'docker-topology-lab', 'volumes', safeName);
  try {
    if (fs.existsSync(volumePath)) {
      fs.rmSync(volumePath, { recursive: true, force: true });
      console.log(`🧹 Volumen zombi eliminado: ${safeName}`);
    }
    return { success: true };
  } catch (error) {
    console.error(`Error eliminando volumen ${safeName}:`, error);
    return { success: false, error: error.message };
  }
});

// RENOMBRAR VOLUMEN ZOMBI
ipcMain.handle('volume:rename', async (event, oldName, newName, nodeId) => {
  const oldRaw = oldName || `service-${nodeId}`;
  const newRaw = newName || `service-${nodeId}`;
  const safeOld = oldRaw.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const safeNew = newRaw.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

  if (safeOld === safeNew) return { success: true };

  const volumesDir = path.join(os.tmpdir(), 'docker-topology-lab', 'volumes');
  const oldPath = path.join(volumesDir, safeOld);
  const newPath = path.join(volumesDir, safeNew);

  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`📁 Volumen renombrado: ${safeOld} → ${safeNew}`);
    }
    return { success: true };
  } catch (error) {
    console.error(`Error renombrando volumen ${safeOld} → ${safeNew}:`, error);
    return { success: false, error: error.message };
  }
});

// CARGAR PROYECTO INTEGRAL
ipcMain.handle('project:load', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Abrir Proyecto',
    properties: ['openFile'],
    filters: [{ name: 'Archivos VDocker Lab', extensions: ['vdlab'] }, { name: 'Todos los archivos', extensions: ['*'] }]
  });

  if (canceled || filePaths.length === 0) return { success: false };
  return await projectManager.loadFullProject(filePaths[0]);
});

// --- FIX 4: LIMPIEZA DE ZOMBIES (Anti-Orphans) ---
const { spawnSync } = require('child_process');

function cleanupContainersSynchronously() {
  if (currentComposePath) {
    console.log(`💀 Iniciando limpieza síncrona de contenedores en: ${currentComposePath}`);

    // Verificación de seguridad: ¿El archivo existe?
    if (fs.existsSync(currentComposePath)) {
      try {
        // Ejecutamos docker compose down. 
        // Omitimos 'stdio: inherit' para evitar que se cuelgue si la terminal ya murió.
        const result = spawnSync('docker', ['compose', '-f', currentComposePath, 'down', '--remove-orphans'], {
          // El truco mágico: Si el proceso padre (Electron) muere, el hijo (Docker) NO muere.
          windowsHide: true,
          timeout: 10000 // Máximo 10 segundos para no bloquear la PC eternamente
        });

        if (result.error) {
          console.error('❌ Error ejecutando spawnSync:', result.error);
        } else {
          console.log(`✅ Limpieza completada. Código de salida: ${result.status}`);
        }
      } catch (err) {
        console.error('❌ Excepción fatal durante la limpieza:', err);
      }
    } else {
      console.warn('⚠️ No se encontró el archivo compose para limpiar:', currentComposePath);
    }

    currentComposePath = null;
  }

  const tempDir = path.join(os.tmpdir(), 'docker-topology-lab');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('🧹 Directorio temporal y volúmenes destruidos al cerrar.');
  }
}

// 1. Cierre normal de la ventana (La "X")
app.on('before-quit', (e) => {
  if (currentComposePath) {
    // Pausar el cierre solo si hay algo que limpiar
    e.preventDefault();
    cleanupContainersSynchronously();
    app.quit(); // Ahora sí, ciérrate.
  }
});

// 2. Cierre por consola (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n🛑 Recibida señal SIGINT (Ctrl+C). Limpiando antes de morir...');
  cleanupContainersSynchronously();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recibida señal SIGTERM. Limpiando antes de morir...');
  cleanupContainersSynchronously();
  process.exit(0);
});

// 3. Opcional pero recomendado: Capturar errores fatales para que tampoco dejen zombies
process.on('uncaughtException', (err) => {
  console.error('\n💥 ERROR FATAL (uncaughtException). Limpiando antes de morir...', err);
  cleanupContainersSynchronously();
  process.exit(1);
});