const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');

const PORT = process.env.PORT || 8790;
const START_ROUTE = process.env.START_ROUTE || '/landing';
const START_URL = process.env.START_URL || `http://localhost:${PORT}${START_ROUTE}`;

let serverProcess = null;

function pingServer(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    try {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        try { req.destroy(new Error('timeout')); } catch (_) {}
        reject(new Error('timeout'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function waitForServer(url, retries = 120, intervalMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      await pingServer(url);
      return;
    } catch (_) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new Error('Server not reachable at ' + url);
}

async function ensureServerRunning() {
  try {
    // Try ping health endpoint first for a quick check
    await pingServer(`http://localhost:${PORT}/health`);
    return; // already running
  } catch (_) {
    // Jalankan server di proses utama untuk menghindari masalah spawn ENOENT
    const appRoot = path.join(__dirname, '..');
    const serverPath = path.join(appRoot, 'server', 'index.js');
    process.env.PORT = String(PORT);
    process.env.NODE_ENV = app.isPackaged ? 'production' : (process.env.NODE_ENV || 'development');
    try { process.chdir(appRoot); } catch (_) {}
    const serverUrl = pathToFileURL(serverPath).href;
    await import(serverUrl);
    await waitForServer(`http://localhost:${PORT}/health`);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadURL(START_URL);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length) {
      const w = wins[0];
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await ensureServerRunning();
      createWindow();
    } catch (err) {
      console.error('Failed to start/load server:', err);
      // Still create window and show an error page
      const win = new BrowserWindow({ width: 800, height: 600 });
      win.loadURL('data:text/plain,Failed to start server. ' + encodeURIComponent(String(err)));
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (serverProcess) {
    try {
      if (process.platform === 'win32') {
        serverProcess.kill();
      } else {
        process.kill(-serverProcess.pid);
      }
    } catch (_) {}
  }
});