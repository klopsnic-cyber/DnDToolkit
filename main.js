const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Auto-Updater (nur in gepackter App aktiv)
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) { /* im Dev-Modus ohne node_modules-Updater ok */ }

// ---------- Lokaler Datenspeicher (Bibliothek + Notizen) ----------
const storePath = () => path.join(app.getPath('userData'), 'bibliothek.json');

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch (e) {
    return { entries: [], notes: [] };
  }
}

function saveStore(store) {
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2), 'utf8');
}

// ---------- IPC ----------
ipcMain.handle('store:getAll', () => loadStore());

ipcMain.handle('store:saveEntry', (ev, entry) => {
  const store = loadStore();
  const idx = store.entries.findIndex(e => e.id === entry.id);
  if (idx >= 0) store.entries[idx] = entry;
  else store.entries.unshift(entry);
  saveStore(store);
  return store;
});

ipcMain.handle('store:deleteEntry', (ev, id) => {
  const store = loadStore();
  store.entries = store.entries.filter(e => e.id !== id);
  saveStore(store);
  return store;
});

ipcMain.handle('store:saveNote', (ev, note) => {
  const store = loadStore();
  const idx = store.notes.findIndex(n => n.id === note.id);
  if (idx >= 0) store.notes[idx] = note;
  else store.notes.unshift(note);
  saveStore(store);
  return store;
});

ipcMain.handle('store:deleteNote', (ev, id) => {
  const store = loadStore();
  store.notes = store.notes.filter(n => n.id !== id);
  saveStore(store);
  return store;
});

ipcMain.handle('app:version', () => app.getVersion());

// Spieldaten (SRD + eigene Tabellen) aus dem data-Ordner laden
ipcMain.handle('data:load', () => {
  const dataDir = path.join(__dirname, 'data');
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
  return {
    equipment: read('equipment.json'),
    magicItems: read('magic-items.json'),
    monsters: read('monsters.json'),
    names: read('names.json'),
    tables: read('tables.json')
  };
});

// ---------- Fenster ----------
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 830,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#161210',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  // Auto-Update: prüft GitHub Releases, lädt herunter, installiert beim Beenden
  if (autoUpdater && app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
