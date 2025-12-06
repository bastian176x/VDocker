const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:3000"); // ← Vite dev server
  } else {
    win.loadFile(path.join(__dirname, "frontend/dist/index.html"));
  }
}

app.whenReady().then(createWindow);
