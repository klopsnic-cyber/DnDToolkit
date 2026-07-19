// ============================================================
// DnD Toolkit – App-Logik (Views, Interaktion, Speicher)
// ============================================================
'use strict';

let DATA = null;          // Spieldaten (SRD + Tabellen)
let STORE = { entries: [], notes: [] };
let currentMerchant = null;
let currentView = 'haendler';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const main = () => $('#main');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------- Init ----------------
(async function init() {
  DATA = await window.api.loadData();
  STORE = await window.api.getAll();
  try { $('#version').textContent = 'v' + (await window.api.getVersion()); } catch (e) {}

  $$('.nav-btn:not(.disabled)').forEach((b) =>
    b.addEventListener('click', () => switchView(b.dataset.view))
  );
  renderView();
})();

function switchView(view) {
  currentView = view;
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  renderView();
}

function renderView() {
  if (currentView === 'haendler') renderMerchantView();
  else if (currentView === 'bibliothek') renderLibrary();
  else if (currentView === 'notizen') renderNotes();
}

// ================= Händler =================
function renderMerchantView() {
  const t = DATA.tables;
  const rassen = Object.entries(DATA.names).map(([id, r]) => `<option value="${id}">${esc(r.label)}</option>`).join('');
  const laeden = t.laeden.map((l) => `<option value="${l.id}">${l.icon} ${esc(l.label)}</option>`).join('');
  const quali = t.qualitaet.map((q) => `<option value="${q.id}">${esc(q.label)}</option>`).join('');

  main().innerHTML = `
    <h1>Händler-Generator</h1>
    <div class="subtitle">Erwürfle komplette Händler mit Persönlichkeit und Inventar – jedes Detail einzeln neu würfelbar.</div>
    <div class="controls">
      <div class="field"><label>Rasse</label><select id="selRasse"><option value="">Zufällig</option>${rassen}</select></div>
      <div class="field"><label>Geschlecht</label><select id="selGeschlecht"><option value="">Zufällig</option><option value="m">Männlich</option><option value="f">Weiblich</option></select></div>
      <div class="field"><label>Ladentyp</label><select id="selLaden"><option value="">Zufällig</option>${laeden}</select></div>
      <div class="field"><label>Qualität</label><select id="selQuali"><option value="">Zufällig</option>${quali}</select></div>
      <button class="btn big" id="btnGen">🎲 Händler erwürfeln</button>
    </div>
    <div id="merchantResult"></div>`;

  $('#btnGen').addEventListener('click', () => {
    currentMerchant = Generator.generateMerchant(DATA, {
      rasse: $('#selRasse').value || undefined,
      geschlecht: $('#selGeschlecht').value || undefined,
      ladenTyp: $('#selLaden').value || undefined,
      qualitaet: $('#selQuali').value || undefined
    });
    renderMerchantCard();
  });

  if (currentMerchant) renderMerchantCard();
}

function renderMerchantCard() {
  const m = currentMerchant;
  const box = $('#merchantResult');
  if (!box || !m) return;

  const rows = m.inventar.map((it, i) => `
    <tr>
      <td>
        <div class="itemname ${it.typ === 'magie' ? 'magic' : ''}">${esc(it.name)}${it.raritaet ? ` <span class="badge magic">${esc(it.raritaet)}</span>` : ''}</div>
        ${it.desc ? `<div class="itemdesc">${esc(it.desc)}</div>` : ''}
      </td>
      <td class="num">${it.anzahl}</td>
      <td class="price">${esc(it.preis)}</td>
      <td class="num"><button class="row-del" data-i="${i}" title="Entfernen">✕</button></td>
    </tr>`).join('');

  const persona = (key, label, value, sub) => `
    <div class="persona-row">
      <div class="k">${label}</div>
      <div class="v">${esc(value)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>
      <button class="reroll" data-key="${key}" title="Neu würfeln">🎲</button>
    </div>`;

  box.innerHTML = `
    <div class="merchant-card">
      <div class="merchant-head">
        <div class="icon">${m.ladenIcon}</div>
        <div>
          <div class="shopname">„${esc(m.ladenName)}" <button class="reroll" data-key="ladenName" title="Neu würfeln">🎲</button><span class="badge">${esc(m.qualitaetLabel)}</span></div>
          <div class="meta">${esc(m.ladenLabel)} · geführt von <b>${esc(m.name)}</b> <button class="reroll" data-key="name" title="Neu würfeln">🎲</button> (${esc(m.rasseLabel)}, ${m.geschlecht === 'f' ? 'weiblich' : 'männlich'})</div>
        </div>
      </div>
      <div class="merchant-body">
        <div class="persona">
          <h2>Persönlichkeit</h2>
          ${persona('persoenlichkeit', 'Wesen', m.persoenlichkeit)}
          ${persona('eigenheit', 'Eigenheit', m.eigenheit)}
          ${persona('stimme', 'Stimme', m.stimme)}
          ${persona('feilschen', 'Feilschen', m.feilschen.label, m.feilschen.mod)}
          ${persona('geheimnis', 'Geheimnis', m.geheimnis)}
        </div>
        <div class="inventory">
          <div class="inv-head">
            <h2>Inventar (${m.inventar.length})</h2>
            <button class="btn ghost small" id="btnRerollInv">🎲 Inventar neu würfeln</button>
          </div>
          <table>
            <thead><tr><th>Ware</th><th class="num">Anz.</th><th>Preis</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="add-item-row">
            <input type="text" id="addName" placeholder="Eigenen Gegenstand hinzufügen…" />
            <input type="text" id="addPreis" placeholder="Preis (z. B. 25 gp)" style="max-width:130px" />
            <button class="btn ghost" id="btnAddItem">+ Hinzufügen</button>
          </div>
        </div>
      </div>
      <div class="merchant-foot">
        <textarea id="merchNotes" placeholder="Eigene Notizen zu diesem Händler…">${esc(m.notizen)}</textarea>
        <div class="foot-btns">
          <button class="btn" id="btnSave">💾 In Bibliothek speichern</button>
          <button class="btn ghost" id="btnCopy">📋 Als Text kopieren</button>
        </div>
      </div>
    </div>`;

  // --- Events ---
  $$('.reroll', box).forEach((b) =>
    b.addEventListener('click', () => {
      Generator.reroll[b.dataset.key](DATA, m);
      renderMerchantCard();
    })
  );
  $('#btnRerollInv').addEventListener('click', () => { Generator.reroll.inventar(DATA, m); renderMerchantCard(); });
  $$('.row-del', box).forEach((b) =>
    b.addEventListener('click', () => { m.inventar.splice(+b.dataset.i, 1); renderMerchantCard(); })
  );
  $('#btnAddItem').addEventListener('click', () => {
    const name = $('#addName').value.trim();
    if (!name) return;
    const kupfer = Generator.toCopper($('#addPreis').value.trim() || '0 gp');
    m.inventar.push({ name, desc: null, typ: 'custom', preisKupfer: kupfer, preis: Generator.fmtPrice(kupfer), anzahl: 1 });
    renderMerchantCard();
  });
  $('#merchNotes').addEventListener('input', (e) => { m.notizen = e.target.value; });
  $('#btnSave').addEventListener('click', async () => {
    STORE = await window.api.saveEntry(JSON.parse(JSON.stringify(m)));
    toast('In Bibliothek gespeichert ✓');
  });
  $('#btnCopy').addEventListener('click', () => {
    navigator.clipboard.writeText(merchantAsText(m));
    toast('In Zwischenablage kopiert ✓');
  });
}

function merchantAsText(m) {
  const inv = m.inventar.map((i) => `  - ${i.name} (x${i.anzahl}) – ${i.preis}`).join('\n');
  return `„${m.ladenName}" – ${m.ladenLabel} (${m.qualitaetLabel})
Inhaber: ${m.name} (${m.rasseLabel}, ${m.geschlecht === 'f' ? 'weiblich' : 'männlich'})
Wesen: ${m.persoenlichkeit}
Eigenheit: ${m.eigenheit}
Stimme: ${m.stimme}
Feilschen: ${m.feilschen.label} (${m.feilschen.mod})
Geheimnis: ${m.geheimnis}

Inventar:
${inv}
${m.notizen ? '\nNotizen: ' + m.notizen : ''}`;
}

// ================= Bibliothek =================
function renderLibrary(filterText = '') {
  const entries = STORE.entries.filter((e) => {
    const q = filterText.toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || (e.ladenName || '').toLowerCase().includes(q) || (e.ladenLabel || '').toLowerCase().includes(q);
  });

  const cards = entries.map((e) => `
    <div class="lib-card" data-id="${e.id}">
      <button class="del" data-id="${e.id}" title="Löschen">🗑</button>
      <div class="t">${e.ladenIcon || '📦'} ${esc(e.ladenName || e.name)}</div>
      <div class="s">${esc(e.name)} · ${esc(e.rasseLabel || '')} · ${esc(e.ladenLabel || e.type)}</div>
      ${e.notizen ? `<div class="s">📝 ${esc(e.notizen.slice(0, 60))}${e.notizen.length > 60 ? '…' : ''}</div>` : ''}
      <div class="d">Erstellt: ${fmtDate(e.createdAt)}</div>
    </div>`).join('');

  main().innerHTML = `
    <h1>Bibliothek</h1>
    <div class="subtitle">Alle gespeicherten Kreationen – anklicken zum Öffnen und Weiterbearbeiten.</div>
    <div class="lib-controls">
      <input type="text" id="libSearch" placeholder="🔍 Suchen nach Name, Laden…" value="${esc(filterText)}" />
    </div>
    ${entries.length ? `<div class="lib-grid">${cards}</div>` : '<div class="empty">Noch nichts gespeichert. Erwürfle einen Händler und speichere ihn!</div>'}`;

  const search = $('#libSearch');
  search.addEventListener('input', () => renderLibrary(search.value));
  search.focus();
  if (filterText) search.setSelectionRange(filterText.length, filterText.length);

  $$('.lib-card').forEach((c) =>
    c.addEventListener('click', (ev) => {
      if (ev.target.classList.contains('del')) return;
      const entry = STORE.entries.find((e) => e.id === c.dataset.id);
      if (entry) {
        currentMerchant = JSON.parse(JSON.stringify(entry));
        switchView('haendler');
      }
    })
  );
  $$('.lib-card .del').forEach((b) =>
    b.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      STORE = await window.api.deleteEntry(b.dataset.id);
      renderLibrary($('#libSearch').value);
      toast('Eintrag gelöscht');
    })
  );
}

// ================= Notizen =================
function renderNotes(editId = null) {
  const editing = editId ? STORE.notes.find((n) => n.id === editId) : null;

  const noteCards = STORE.notes.map((n) => `
    <div class="note-card">
      <div class="actions">
        <button class="btn ghost small" data-edit="${n.id}">✎</button>
        <button class="btn danger small" data-del="${n.id}">🗑</button>
      </div>
      <div class="t">${esc(n.titel)}</div>
      <div class="body">${esc(n.text)}</div>
      <div class="d">${fmtDate(n.updatedAt || n.createdAt)}</div>
    </div>`).join('');

  main().innerHTML = `
    <h1>Notizen</h1>
    <div class="subtitle">Freie Kampagnen-Notizen – Ideen, Plots, NPCs, was immer du brauchst.</div>
    <div class="note-editor">
      <input type="text" id="noteTitle" placeholder="Titel…" value="${esc(editing ? editing.titel : '')}" />
      <textarea id="noteText" placeholder="Deine Notiz…">${esc(editing ? editing.text : '')}</textarea>
      <div><button class="btn" id="btnSaveNote">${editing ? '💾 Änderung speichern' : '+ Notiz anlegen'}</button>
      ${editing ? '<button class="btn ghost" id="btnCancelEdit">Abbrechen</button>' : ''}</div>
    </div>
    ${STORE.notes.length ? noteCards : '<div class="empty">Noch keine Notizen.</div>'}`;

  $('#btnSaveNote').addEventListener('click', async () => {
    const titel = $('#noteTitle').value.trim();
    const text = $('#noteText').value.trim();
    if (!titel && !text) return;
    const note = editing
      ? { ...editing, titel: titel || 'Ohne Titel', text, updatedAt: new Date().toISOString() }
      : { id: 'n_' + Date.now(), titel: titel || 'Ohne Titel', text, createdAt: new Date().toISOString() };
    STORE = await window.api.saveNote(note);
    renderNotes();
    toast('Notiz gespeichert ✓');
  });
  if (editing) $('#btnCancelEdit').addEventListener('click', () => renderNotes());

  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => renderNotes(b.dataset.edit)));
  $$('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      STORE = await window.api.deleteNote(b.dataset.del);
      renderNotes();
      toast('Notiz gelöscht');
    })
  );
}
