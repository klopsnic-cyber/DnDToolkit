const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

// ---------- Homebrew (eigene Monster & Items, nur lokal) ----------
const homebrewPath = () => path.join(app.getPath('userData'), 'homebrew.json');

function loadHomebrew() {
  try {
    const h = JSON.parse(fs.readFileSync(homebrewPath(), 'utf8'));
    return { monsters: h.monsters || [], items: h.items || [] };
  } catch (e) {
    return { monsters: [], items: [] };
  }
}

function saveHomebrew(h) {
  fs.writeFileSync(homebrewPath(), JSON.stringify(h, null, 2), 'utf8');
}

ipcMain.handle('homebrew:get', () => loadHomebrew());

ipcMain.handle('homebrew:save', (ev, h) => { saveHomebrew(h); return h; });

ipcMain.handle('homebrew:export', async () => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Homebrew exportieren',
    defaultPath: 'homebrew-export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!filePath) return { ok: false };
  fs.writeFileSync(filePath, JSON.stringify(loadHomebrew(), null, 2), 'utf8');
  return { ok: true };
});

ipcMain.handle('homebrew:import', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Homebrew importieren',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (!filePaths || !filePaths.length) return { ok: false };
  try {
    const imp = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    const h = loadHomebrew();
    const merge = (list, add) => {
      for (const x of add || []) {
        if (!x || !x.name) continue;
        const i = list.findIndex((y) => y.id === x.id || y.name === x.name);
        if (i >= 0) list[i] = x; else list.push(x);
      }
    };
    merge(h.monsters, imp.monsters);
    merge(h.items, imp.items);
    saveHomebrew(h);
    return { ok: true, homebrew: h };
  } catch (e) {
    return { ok: false, error: 'Datei konnte nicht gelesen werden: ' + e.message };
  }
});

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
