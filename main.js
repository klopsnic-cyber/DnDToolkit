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

// ---------- Einstellungen (API-Schlüssel etc., nur lokal) ----------
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch (e) {
    return {};
  }
}

ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:save', (ev, s) => {
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2), 'utf8');
  return s;
});

// ---------- Manueller Update-Check ----------
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) return { status: 'dev', msg: 'Im Entwicklungsmodus gibt es keine Updates.' };
  if (!autoUpdater) return { status: 'error', msg: 'Updater nicht verfügbar.' };
  try {
    const r = await autoUpdater.checkForUpdates();
    const neu = r && r.updateInfo && r.updateInfo.version;
    if (neu && neu !== app.getVersion()) {
      return { status: 'update', msg: 'Version ' + neu + ' gefunden – wird im Hintergrund geladen und beim Beenden installiert.' };
    }
    return { status: 'aktuell', msg: 'Du hast bereits die neueste Version (' + app.getVersion() + ').' };
  } catch (e) {
    return { status: 'error', msg: 'Update-Prüfung fehlgeschlagen: ' + e.message };
  }
});

// ---------- KI-Anbindung (OpenAI, Gemini, Anthropic) ----------
const AI_DEFAULT_MODEL = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-flash-latest',
  anthropic: 'claude-haiku-4-5-20251001'
};

// Falls das Gemini-Modell nicht mehr existiert: verfügbare Modelle abfragen und bestes Flash-Modell wählen
async function discoverGeminiModel(key) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key));
  if (!res.ok) throw new Error('Modell-Liste nicht abrufbar (' + res.status + ')');
  const j = await res.json();
  const usable = (j.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace('models/', ''));
  const flash = usable.filter((n) => n.includes('flash') && !n.includes('image') && !n.includes('live') && !n.includes('tts'));
  // "latest"-Aliasse bevorzugen, sonst höchste Versionsnummer
  const latest = flash.find((n) => n.includes('latest'));
  if (latest) return latest;
  flash.sort().reverse();
  if (flash[0]) return flash[0];
  if (usable[0]) return usable[0];
  throw new Error('Kein nutzbares Gemini-Modell gefunden.');
}

function buildAiRequest(provider, key, model, system, user) {
  if (provider === 'openai') {
    return ['https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        response_format: { type: 'json_object' }
      })
    }];
  }
  if (provider === 'gemini') {
    return ['https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: system + '\n\n' + user }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    }];
  }
  if (provider === 'anthropic') {
    return ['https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: 'user', content: user }] })
    }];
  }
  throw new Error('Unbekannter Anbieter: ' + provider);
}

function friendlyAiError(provider, status, body) {
  if (status === 429 && provider === 'openai') {
    return 'OpenAI-Kontingent aufgebraucht. Das API-Guthaben ist unabhängig vom ChatGPT-Abo – unter platform.openai.com → Billing Guthaben aufladen, oder kostenlos Gemini nutzen.';
  }
  if (status === 401 || status === 403) {
    return 'API-Schlüssel ungültig oder ohne Berechtigung (Fehler ' + status + '). Schlüssel in den Einstellungen prüfen.';
  }
  return 'API-Fehler ' + status + (body ? ': ' + body.slice(0, 200) : '');
}

async function aiRequest(provider, key, model, system, user) {
  let [url, options] = buildAiRequest(provider, key, model, system, user);
  let res = await fetch(url, options);

  // Gemini: Modell veraltet/unbekannt → aktuelles Modell automatisch ermitteln und einmal neu versuchen
  if (!res.ok && provider === 'gemini' && (res.status === 404 || res.status === 400)) {
    const neu = await discoverGeminiModel(key);
    [url, options] = buildAiRequest(provider, key, neu, system, user);
    res = await fetch(url, options);
    if (res.ok) {
      const s = loadSettings();
      s.geminiModel = neu; // merken für nächstes Mal
      fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2), 'utf8');
    }
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(friendlyAiError(provider, res.status, t));
  }
  const j = await res.json();
  if (provider === 'openai') return j.choices[0].message.content;
  if (provider === 'gemini') return j.candidates[0].content.parts[0].text;
  return j.content[0].text;
}

function parseAiJson(text) {
  let t = String(text).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  // 1. Versuch: direkt parsen
  try { return JSON.parse(t); } catch (e) { /* weiter */ }
  // 2. Versuch: erstes vollständiges JSON-Objekt per Klammerzählung extrahieren
  // (manche Modelle liefern mehrere Objekte oder Erklärtext hintendran)
  const start = t.indexOf('{');
  if (start < 0) throw new Error('Keine JSON-Antwort erhalten.');
  let depth = 0, inStr = false, escNext = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (escNext) { escNext = false; continue; }
    if (c === '\\') { escNext = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return JSON.parse(t.slice(start, i + 1));
    }
  }
  throw new Error('KI-Antwort war kein vollständiges JSON.');
}

const AI_SYSTEM = {
  item: `Du bist ein kreativer D&D-5e-Spielleiter-Assistent. Erzeuge aus der Beschreibung des Nutzers einen magischen Gegenstand für D&D 5e mit vollständigen Spielwerten.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in exakt diesem Format (Feldwerte auf Deutsch, außer rarity):
{"name": "Name des Gegenstands", "itemTyp": "Waffe|Rüstung|Schild|Trank|Schriftrolle|Ring|Stab|Zauberstab|Munition|Wundersamer Gegenstand", "rarity": "Common|Uncommon|Rare|Very Rare|Legendary", "preis": "Zahl gp", "schaden": "Schadenswürfel und -typ bei Waffen, z.B. '1d8 Hieb + 1d6 Feuer', sonst null", "bonus": "magischer Bonus wie '+1', sonst null", "rk": "Rüstungsklasse als Zahl nur bei Rüstungen/Schilden, sonst null", "eigenschaften": "besondere Regeln mit konkreten Werten, Rettungswürfen (SG), Aufladungen usw.", "desc": "stimmungsvolle Beschreibung, 2-4 Sätze"}`,
  monster: `Du bist ein kreativer D&D-5e-Spielleiter-Assistent. Erzeuge aus der Beschreibung des Nutzers ein ausbalanciertes Monster für D&D 5e.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in exakt diesem Format (Feldwerte auf Deutsch, außer size):
{"name": "Name", "cr": "Herausforderungsgrad z.B. 1/2 oder 5", "type": "Kreaturentyp", "size": "Tiny|Small|Medium|Large|Huge|Gargantuan", "ac": "Rüstungsklasse", "hp": "Trefferpunkte", "speed": "z.B. 30 ft.", "text": "Fähigkeiten und Aktionen als Statblock-Text mit Angriffswerten"}`
};

ipcMain.handle('ai:generate', async (ev, { provider, type, prompt }) => {
  const s = loadSettings();
  const keyMap = { openai: s.openaiKey, gemini: s.geminiKey, anthropic: s.anthropicKey };
  const key = keyMap[provider];
  if (!key) return { ok: false, error: 'Kein API-Schlüssel für diesen Anbieter hinterlegt (Einstellungen).' };
  const modelMap = { openai: s.openaiModel, gemini: s.geminiModel, anthropic: s.anthropicModel };
  const model = modelMap[provider] || AI_DEFAULT_MODEL[provider];
  try {
    const raw = await aiRequest(provider, key, model, AI_SYSTEM[type], prompt);
    const obj = parseAiJson(raw);
    if (!obj.name) throw new Error('Antwort enthielt keinen Namen.');
    return { ok: true, result: obj };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---------- Datei-Export (z. B. Foundry VTT) ----------
ipcMain.handle('file:saveText', async (ev, { defaultName, content }) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Exportieren',
    defaultPath: defaultName || 'export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!filePath) return { ok: false };
  fs.writeFileSync(filePath, content, 'utf8');
  return { ok: true };
});

ipcMain.handle('file:saveMany', async (ev, { files }) => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Zielordner für Export wählen',
    properties: ['openDirectory', 'createDirectory']
  });
  if (!filePaths || !filePaths.length) return { ok: false };
  for (const f of files) {
    fs.writeFileSync(path.join(filePaths[0], f.name), f.content, 'utf8');
  }
  return { ok: true, count: files.length };
});

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
