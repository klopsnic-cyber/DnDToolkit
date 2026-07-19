// ============================================================
// DnD Toolkit – App-Logik (Views, Interaktion, Speicher)
// ============================================================
'use strict';

let DATA = null;          // Spieldaten (SRD + Tabellen)
let SETTINGS = {};        // API-Schlüssel etc.
let STORE = { entries: [], notes: [] };
let currentMerchant = null;
let currentEncounter = null;
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
  DATA.homebrew = await window.api.getHomebrew();
  SETTINGS = await window.api.getSettings();
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
  else if (currentView === 'encounter') renderEncounterView();
  else if (currentView === 'bibliothek') renderLibrary();
  else if (currentView === 'kompendium') renderCompendium();
  else if (currentView === 'homebrew') renderHomebrew();
  else if (currentView === 'notizen') renderNotes();
  else if (currentView === 'einstellungen') renderSettings();
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

// ================= Encounter =================
function renderEncounterView() {
  const types = [...new Set(DATA.monsters.map((m) => m.type).filter(Boolean))].sort();
  const sources = [...new Set(DATA.monsters.map((m) => m.src))];

  main().innerHTML = `
    <h1>Encounter-Generator</h1>
    <div class="subtitle">Ausbalancierte Begegnungen nach dem XP-Budget-System – aus ${(DATA.monsters.length + DATA.homebrew.monsters.length).toLocaleString('de-DE')} Monstern.</div>
    <div class="controls">
      <div class="field"><label>Gruppengröße</label><select id="encGruppe">${[1,2,3,4,5,6,7,8].map((n) => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Stufe</label><select id="encStufe">${Array.from({ length: 20 }, (_, i) => `<option ${i + 1 === 3 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>
      <div class="field"><label>Schwierigkeit</label><select id="encDiff">
        <option value="leicht">Leicht</option>
        <option value="mittel" selected>Mittel</option>
        <option value="schwer">Schwer</option>
        <option value="toedlich">Tödlich</option>
      </select></div>
      <div class="field"><label>Monstertyp</label><select id="encTyp"><option value="">Alle</option>${types.map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
      <div class="field"><label>Quelle</label><select id="encQuelle"><option value="">Alle</option>${sources.map((s) => `<option>${esc(s)}</option>`).join('')}<option>Homebrew</option></select></div>
      <button class="btn big" id="btnEncGen">🎲 Encounter erwürfeln</button>
    </div>
    <div id="encResult"></div>
    <div id="modal"></div>`;

  $('#btnEncGen').addEventListener('click', () => {
    const enc = Generator.generateEncounter(DATA, {
      stufe: +$('#encStufe').value,
      gruppe: +$('#encGruppe').value,
      schwierigkeit: $('#encDiff').value,
      typ: $('#encTyp').value || undefined,
      quelle: $('#encQuelle').value || undefined
    });
    if (!enc) { toast('Keine passenden Monster gefunden – Filter lockern'); return; }
    currentEncounter = enc;
    renderEncounterCard();
  });

  if (currentEncounter) renderEncounterCard();
}

function encOpts() {
  return {
    typ: ($('#encTyp') && $('#encTyp').value) || undefined,
    quelle: ($('#encQuelle') && $('#encQuelle').value) || undefined
  };
}

function renderEncounterCard() {
  const e = currentEncounter;
  const box = $('#encResult');
  if (!box || !e) return;

  const urteilFarbe = { Trivial: 'var(--text-dim)', Leicht: 'var(--green)', Mittel: 'var(--gold)', Schwer: '#c77b32', 'Tödlich': 'var(--red)' }[e.urteil] || 'var(--gold)';

  const rows = e.monster.map((g, i) => `
    <tr>
      <td><span class="itemname enc-mon" data-i="${i}" title="Statblock anzeigen">${esc(g.name)}</span>
        <div class="itemdesc">${esc([g.type, g.src].filter(Boolean).join(' · '))}</div></td>
      <td class="num">
        <button class="btn ghost small" data-minus="${i}">−</button>
        <b> ${g.count} </b>
        <button class="btn ghost small" data-plus="${i}">+</button>
      </td>
      <td class="num">${esc(String(g.cr))}</td>
      <td class="price">${(g.xp * g.count).toLocaleString('de-DE')} XP</td>
      <td class="num"><button class="reroll" data-swap="${i}" title="Ähnliches Monster einwechseln">🎲</button>
      <button class="row-del" data-del="${i}" title="Entfernen">✕</button></td>
    </tr>`).join('');

  box.innerHTML = `
    <div class="merchant-card">
      <div class="merchant-head">
        <div class="icon">⚔️</div>
        <div>
          <div class="shopname">${esc(e.name)}</div>
          <div class="meta">${e.gruppe} Abenteurer · Stufe ${e.stufe} · Ziel: ${esc(Generator.DIFF_LABEL[e.schwierigkeit])} (${e.budget.toLocaleString('de-DE')} XP Budget)</div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div style="font-size:22px;font-family:var(--serif);color:${urteilFarbe}">${esc(e.urteil)}</div>
          <div class="dim">${e.adjXP.toLocaleString('de-DE')} XP angepasst · ${e.totalXP.toLocaleString('de-DE')} XP Beute-Wert</div>
        </div>
      </div>
      <div class="inventory">
        <table>
          <thead><tr><th>Monster</th><th class="num">Anzahl</th><th class="num">HG</th><th>XP</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="merchant-foot">
        <textarea id="encNotes" placeholder="Eigene Notizen zu dieser Begegnung (Taktik, Gelände, Auslöser…)">${esc(e.notizen)}</textarea>
        <div class="foot-btns">
          <button class="btn" id="btnEncSave">💾 In Bibliothek speichern</button>
          <button class="btn ghost" id="btnEncCopy">📋 Als Text kopieren</button>
        </div>
      </div>
    </div>`;

  const rerender = () => { Generator.recalcEncounter(e); renderEncounterCard(); };

  $$('.enc-mon', box).forEach((el) =>
    el.addEventListener('click', () => {
      const g = e.monster[+el.dataset.i];
      const full = DATA.monsters.find((m) => m.index === g.index)
        || DATA.homebrew.monsters.find((m) => m.id === g.index);
      if (full) showStatblock(full.src ? full : { ...full, src: 'Homebrew' });
    })
  );
  $$('[data-plus]', box).forEach((b) => b.addEventListener('click', () => { e.monster[+b.dataset.plus].count++; rerender(); }));
  $$('[data-minus]', box).forEach((b) => b.addEventListener('click', () => {
    const g = e.monster[+b.dataset.minus];
    g.count--; if (g.count <= 0) e.monster.splice(+b.dataset.minus, 1);
    rerender();
  }));
  $$('[data-del]', box).forEach((b) => b.addEventListener('click', () => { e.monster.splice(+b.dataset.del, 1); rerender(); }));
  $$('[data-swap]', box).forEach((b) => b.addEventListener('click', () => { Generator.swapMonster(DATA, e, +b.dataset.swap, encOpts()); renderEncounterCard(); }));

  $('#encNotes').addEventListener('input', (ev) => { e.notizen = ev.target.value; });
  $('#btnEncSave').addEventListener('click', async () => {
    STORE = await window.api.saveEntry(JSON.parse(JSON.stringify(e)));
    toast('In Bibliothek gespeichert ✓');
  });
  $('#btnEncCopy').addEventListener('click', () => {
    const txt = e.name + '\n' + e.gruppe + ' Abenteurer, Stufe ' + e.stufe + ' – ' + e.urteil + ' (' + e.adjXP + ' XP angepasst, Budget ' + e.budget + ')\n\n' +
      e.monster.map((g) => '  ' + g.count + 'x ' + g.name + ' (HG ' + g.cr + ', je ' + g.xp + ' XP) [' + g.src + ']').join('\n') +
      (e.notizen ? '\n\nNotizen: ' + e.notizen : '');
    navigator.clipboard.writeText(txt);
    toast('In Zwischenablage kopiert ✓');
  });
}

// ================= Bibliothek =================
function renderLibrary(filterText = '') {
  const entries = STORE.entries.filter((e) => {
    const q = filterText.toLowerCase();
    if (!q) return true;
    const inMonster = e.type === 'encounter' && e.monster.some((g) => g.name.toLowerCase().includes(q));
    return e.name.toLowerCase().includes(q) || (e.ladenName || '').toLowerCase().includes(q) || (e.ladenLabel || '').toLowerCase().includes(q) || inMonster;
  });

  const cards = entries.map((e) => {
    let icon, title, sub;
    if (e.type === 'encounter') {
      icon = '⚔️'; title = e.name;
      sub = e.monster.map((g) => g.count + 'x ' + g.name).join(', ').slice(0, 70) + ' · ' + e.urteil;
    } else {
      icon = e.ladenIcon || '📦'; title = e.ladenName || e.name;
      sub = [e.name, e.rasseLabel, e.ladenLabel || e.type].filter(Boolean).join(' · ');
    }
    return `
    <div class="lib-card" data-id="${e.id}">
      <button class="del" data-id="${e.id}" title="Löschen">🗑</button>
      <div class="t">${icon} ${esc(title)}</div>
      <div class="s">${esc(sub)}</div>
      ${e.notizen ? `<div class="s">📝 ${esc(e.notizen.slice(0, 60))}${e.notizen.length > 60 ? '…' : ''}</div>` : ''}
      <div class="d">Erstellt: ${fmtDate(e.createdAt)}</div>
    </div>`;
  }).join('');

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
      if (!entry) return;
      if (entry.type === 'encounter') {
        currentEncounter = JSON.parse(JSON.stringify(entry));
        switchView('encounter');
      } else {
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

// ================= Kompendium =================
let compState = { tab: 'monster', q: '', src: '' };

function allMonsters() {
  return DATA.monsters.concat((DATA.homebrew.monsters || []).map((h) => ({ ...h, src: 'Homebrew' })));
}
function allMagicItems() {
  return DATA.magicItems.concat(
    (DATA.homebrew.items || []).map((h) => ({ ...h, src: 'Homebrew', desc: h.desc || '' }))
  );
}

function renderCompendium() {
  const isMon = compState.tab === 'monster';
  const list = isMon ? allMonsters() : allMagicItems();
  const sources = [...new Set(list.map((x) => x.src))];

  const q = compState.q.toLowerCase();
  let hits = list.filter(
    (x) =>
      (!q || x.name.toLowerCase().includes(q) || (isMon && (x.type || '').toLowerCase().includes(q))) &&
      (!compState.src || x.src === compState.src)
  );
  const total = hits.length;
  hits = hits.slice(0, 200);

  const rows = hits.map((x, i) => isMon
    ? `<tr class="comp-row" data-i="${i}"><td><span class="itemname">${esc(x.name)}</span></td><td>${esc(x.cr ?? '')}</td><td>${esc(x.type || '')}</td><td>${esc(x.size || '')}</td><td class="dim">${esc(x.src)}</td></tr>`
    : `<tr class="comp-row" data-i="${i}"><td><span class="itemname magic">${esc(x.name)}</span></td><td>${esc(x.rarity || '')}</td><td>${esc(x.cat || '')}</td><td class="dim">${esc(x.src)}</td></tr>`
  ).join('');

  main().innerHTML = `
    <h1>Kompendium</h1>
    <div class="subtitle">${allMonsters().length.toLocaleString('de-DE')} Monster und ${allMagicItems().length.toLocaleString('de-DE')} magische Gegenstände – komplett offline.</div>
    <div class="controls">
      <div class="tabs">
        <button class="btn ${isMon ? '' : 'ghost'}" id="tabMon">🐲 Monster</button>
        <button class="btn ${isMon ? 'ghost' : ''}" id="tabItems">✨ Magische Items</button>
      </div>
      <div class="field" style="flex:1"><label>Suche</label><input type="text" id="compSearch" value="${esc(compState.q)}" placeholder="🔍 Name${isMon ? ' oder Typ' : ''}…" /></div>
      <div class="field"><label>Quelle</label><select id="compSrc"><option value="">Alle</option>${sources.map((s) => `<option ${s === compState.src ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
    </div>
    <div class="comp-count">${total.toLocaleString('de-DE')} Treffer${total > 200 ? ' (erste 200 angezeigt – Suche verfeinern)' : ''}</div>
    <table class="comp-table">
      <thead>${isMon ? '<tr><th>Name</th><th>HG</th><th>Typ</th><th>Größe</th><th>Quelle</th></tr>' : '<tr><th>Name</th><th>Seltenheit</th><th>Kategorie</th><th>Quelle</th></tr>'}</thead>
      <tbody>${rows || '<tr><td colspan="5" class="empty">Keine Treffer.</td></tr>'}</tbody>
    </table>
    <div id="modal"></div>`;

  $('#tabMon').addEventListener('click', () => { compState = { tab: 'monster', q: '', src: '' }; renderCompendium(); });
  $('#tabItems').addEventListener('click', () => { compState = { tab: 'items', q: '', src: '' }; renderCompendium(); });
  const s = $('#compSearch');
  s.addEventListener('input', () => { compState.q = s.value; renderCompendium(); });
  s.focus(); s.setSelectionRange(s.value.length, s.value.length);
  $('#compSrc').addEventListener('change', (e) => { compState.src = e.target.value; renderCompendium(); });
  $$('.comp-row').forEach((r) =>
    r.addEventListener('click', () => (isMon ? showStatblock(hits[+r.dataset.i]) : showItemDetail(hits[+r.dataset.i])))
  );
}

const mod = (v) => { const m = Math.floor((v - 10) / 2); return (m >= 0 ? '+' : '') + m; };

function showStatblock(m) {
  const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const line = (label, val) => (val ? `<div class="sb-line"><b>${label}</b> ${esc(val)}</div>` : '');
  const block = (title, arr) => (arr && arr.length)
    ? `<div class="sb-sect">${title ? `<h3>${title}</h3>` : ''}${arr.map((a) => `<p><b><i>${esc(a.name)}.</i></b> ${esc(a.desc || '')}</p>`).join('')}</div>` : '';

  $('#modal').innerHTML = `
    <div class="modal-bg">
      <div class="statblock">
        <button class="modal-close">✕</button>
        <h2>${esc(m.name)}</h2>
        <div class="sb-meta">${esc([m.size, m.type, m.subtype].filter(Boolean).join(' '))}${m.align ? ', ' + esc(m.align) : ''} · <span class="dim">${esc(m.src)}</span></div>
        <hr />
        ${line('Rüstungsklasse', m.ac)}
        ${line('Trefferpunkte', m.hp + (m.hd ? ' (' + m.hd + ')' : ''))}
        ${line('Bewegung', m.speed)}
        <div class="sb-stats">${stats.map((s) => `<div><b>${s.toUpperCase()}</b><br />${m[s] ?? '–'} (${m[s] ? mod(m[s]) : '–'})</div>`).join('')}</div>
        ${line('Immunitäten', m.imm)}
        ${line('Resistenzen', m.res)}
        ${line('Verwundbarkeiten', m.vul)}
        ${line('Zustandsimmunitäten', m.condImm)}
        ${line('Sinne', m.senses)}
        ${line('Sprachen', m.langs)}
        ${line('Herausforderung', m.cr + ' (' + (m.xp || 0).toLocaleString('de-DE') + ' XP)')}
        ${block('', m.traits)}
        ${block('Aktionen', m.actions)}
        ${block('Legendäre Aktionen', m.legendary)}
        ${m.text ? `<div class="sb-sect"><p>${esc(m.text)}</p></div>` : ''}
      </div>
    </div>`;
  $('.modal-close').addEventListener('click', () => ($('#modal').innerHTML = ''));
  $('.modal-bg').addEventListener('click', (e) => { if (e.target.classList.contains('modal-bg')) $('#modal').innerHTML = ''; });
}

function showItemDetail(it) {
  $('#modal').innerHTML = `
    <div class="modal-bg">
      <div class="statblock">
        <button class="modal-close">✕</button>
        <h2 class="magic">${esc(it.name)}</h2>
        <div class="sb-meta">${esc([it.rarity, it.cat].filter(Boolean).join(' · '))}${it.attune ? ' · Einstimmung erforderlich' : ''} · <span class="dim">${esc(it.src)}</span>${it.preis ? ' · ' + esc(it.preis) : ''}</div>
        <hr />
        <div class="sb-sect"><p style="white-space:pre-wrap">${esc(it.desc || 'Keine Beschreibung.')}</p></div>
      </div>
    </div>`;
  $('.modal-close').addEventListener('click', () => ($('#modal').innerHTML = ''));
  $('.modal-bg').addEventListener('click', (e) => { if (e.target.classList.contains('modal-bg')) $('#modal').innerHTML = ''; });
}

// ================= Homebrew =================
let hbState = { tab: 'items', editId: null };

async function persistHomebrew() {
  DATA.homebrew = await window.api.saveHomebrew(DATA.homebrew);
}

function renderHomebrew() {
  const isItems = hbState.tab === 'items';
  const hb = DATA.homebrew;
  const laeden = DATA.tables.laeden;
  const editing = hbState.editId
    ? (isItems ? hb.items : hb.monsters).find((x) => x.id === hbState.editId)
    : null;

  const listCards = (isItems ? hb.items : hb.monsters).map((x) => `
    <div class="lib-card" data-id="${x.id}">
      <button class="del" data-id="${x.id}" title="Löschen">🗑</button>
      <div class="t">${isItems ? '✨' : '🐲'} ${esc(x.name)}</div>
      <div class="s">${isItems
        ? esc([x.rarity, x.preis, x.laden === 'alle' ? 'alle Läden' : (laeden.find((l) => l.id === x.laden)?.label || 'kein Laden')].filter(Boolean).join(' · '))
        : esc(['HG ' + (x.cr || '?'), x.type, x.size].filter(Boolean).join(' · '))}</div>
    </div>`).join('');

  const itemForm = `
    <div class="field"><label>Name *</label><input type="text" id="hbName" value="${esc(editing?.name || '')}" /></div>
    <div class="field"><label>Seltenheit</label><select id="hbRarity">${['', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'].map((r) => `<option ${editing?.rarity === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="field"><label>Preis</label><input type="text" id="hbPreis" value="${esc(editing?.preis || '')}" placeholder="z. B. 150 gp" /></div>
    <div class="field"><label>Erscheint bei Händlern</label><select id="hbLaden">
      <option value="">Nie (nur Kompendium)</option>
      <option value="alle" ${editing?.laden === 'alle' ? 'selected' : ''}>Jeder Ladentyp</option>
      ${laeden.map((l) => `<option value="${l.id}" ${editing?.laden === l.id ? 'selected' : ''}>${l.icon} ${esc(l.label)}</option>`).join('')}
    </select></div>
    <div class="field" style="flex-basis:100%"><label>Beschreibung</label><textarea id="hbDesc" style="min-height:70px">${esc(editing?.desc || '')}</textarea></div>`;

  const monForm = `
    <div class="field"><label>Name *</label><input type="text" id="hbName" value="${esc(editing?.name || '')}" /></div>
    <div class="field"><label>Herausforderungsgrad</label><input type="text" id="hbCr" value="${esc(editing?.cr || '')}" placeholder="z. B. 1/2 oder 5" style="max-width:110px" /></div>
    <div class="field"><label>Typ</label><input type="text" id="hbType" value="${esc(editing?.type || '')}" placeholder="z. B. Untoter" /></div>
    <div class="field"><label>Größe</label><select id="hbSize">${['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'].map((s) => `<option ${editing?.size === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="field"><label>RK</label><input type="text" id="hbAc" value="${esc(editing?.ac ?? '')}" style="max-width:70px" /></div>
    <div class="field"><label>TP</label><input type="text" id="hbHp" value="${esc(editing?.hp ?? '')}" style="max-width:70px" /></div>
    <div class="field"><label>Bewegung</label><input type="text" id="hbSpeed" value="${esc(editing?.speed || '')}" placeholder="z. B. walk 30 ft." /></div>
    <div class="field" style="flex-basis:100%"><label>Fähigkeiten & Aktionen (Freitext)</label><textarea id="hbText" style="min-height:90px">${esc(editing?.text || '')}</textarea></div>`;

  main().innerHTML = `
    <h1>Homebrew</h1>
    <div class="subtitle">Eigene Inhalte – bleiben lokal auf deinem PC und tauchen im Kompendium und bei Händlern auf. Auch zum privaten Übertragen aus deinen Regelbüchern.</div>
    <div class="controls">
      <div class="tabs">
        <button class="btn ${isItems ? '' : 'ghost'}" id="hbTabItems">✨ Items (${hb.items.length})</button>
        <button class="btn ${isItems ? 'ghost' : ''}" id="hbTabMon">🐲 Monster (${hb.monsters.length})</button>
      </div>
      <div style="flex:1"></div>
      <button class="btn ghost" id="hbImport">📥 Importieren</button>
      <button class="btn ghost" id="hbExport">📤 Exportieren</button>
    </div>
    ${renderAiPanel(isItems)}
    <div class="note-editor">
      <h2>${editing ? 'Bearbeiten: ' + esc(editing.name) : (isItems ? 'Neues Item anlegen' : 'Neues Monster anlegen')}</h2>
      <div class="controls" style="margin:0;border:none;padding:0;background:none">${isItems ? itemForm : monForm}</div>
      <div><button class="btn" id="hbSave">${editing ? '💾 Speichern' : '+ Anlegen'}</button>
      ${editing ? '<button class="btn ghost" id="hbCancel">Abbrechen</button>' : ''}</div>
    </div>
    ${listCards ? `<div class="lib-grid">${listCards}</div>` : '<div class="empty">Noch keine eigenen ' + (isItems ? 'Items' : 'Monster') + '.</div>'}`;

  $('#hbTabItems').addEventListener('click', () => { hbState = { tab: 'items', editId: null }; renderHomebrew(); });
  $('#hbTabMon').addEventListener('click', () => { hbState = { tab: 'monster', editId: null }; renderHomebrew(); });

  $('#hbSave').addEventListener('click', async () => {
    const name = $('#hbName').value.trim();
    if (!name) { toast('Name fehlt'); return; }
    let obj;
    if (isItems) {
      obj = {
        id: editing?.id || 'hbi_' + Date.now(),
        name, rarity: $('#hbRarity').value || null,
        preis: $('#hbPreis').value.trim() || null,
        laden: $('#hbLaden').value || null,
        cat: 'wondrous-items',
        desc: $('#hbDesc').value.trim()
      };
    } else {
      obj = {
        id: editing?.id || 'hbm_' + Date.now(),
        name, cr: $('#hbCr').value.trim() || '0',
        type: $('#hbType').value.trim() || null,
        size: $('#hbSize').value,
        ac: $('#hbAc').value.trim() || null,
        hp: $('#hbHp').value.trim() || null,
        speed: $('#hbSpeed').value.trim() || null,
        text: $('#hbText').value.trim(),
        xp: 0
      };
    }
    const list = isItems ? DATA.homebrew.items : DATA.homebrew.monsters;
    const i = list.findIndex((x) => x.id === obj.id);
    if (i >= 0) list[i] = obj; else list.unshift(obj);
    await persistHomebrew();
    hbState.editId = null;
    renderHomebrew();
    toast('Gespeichert ✓');
  });
  if (editing) $('#hbCancel').addEventListener('click', () => { hbState.editId = null; renderHomebrew(); });

  $$('.lib-card').forEach((c) =>
    c.addEventListener('click', (ev) => {
      if (ev.target.classList.contains('del')) return;
      hbState.editId = c.dataset.id;
      renderHomebrew();
    })
  );
  $$('.lib-card .del').forEach((b) =>
    b.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if (isItems) DATA.homebrew.items = DATA.homebrew.items.filter((x) => x.id !== b.dataset.id);
      else DATA.homebrew.monsters = DATA.homebrew.monsters.filter((x) => x.id !== b.dataset.id);
      await persistHomebrew();
      renderHomebrew();
      toast('Gelöscht');
    })
  );

  wireAiPanel(isItems);

  $('#hbExport').addEventListener('click', async () => {
    const r = await window.api.exportHomebrew();
    if (r.ok) toast('Exportiert ✓');
  });
  $('#hbImport').addEventListener('click', async () => {
    const r = await window.api.importHomebrew();
    if (r.ok) { DATA.homebrew = r.homebrew; renderHomebrew(); toast('Importiert ✓'); }
    else if (r.error) toast(r.error);
  });
}

// ================= KI-Assistent (Homebrew) =================
const AI_PROVIDERS = [
  ['gemini', 'Google Gemini', 'geminiKey'],
  ['openai', 'OpenAI (ChatGPT)', 'openaiKey'],
  ['anthropic', 'Anthropic (Claude)', 'anthropicKey']
];

function renderAiPanel(isItems) {
  const avail = AI_PROVIDERS.filter(([, , k]) => SETTINGS[k]);
  if (!avail.length) {
    return `<div class="ai-panel dim">🤖 Tipp: Hinterlege in den <a href="#" id="aiGotoSettings">Einstellungen</a> einen KI-API-Schlüssel,
    dann kann dir eine KI ${isItems ? 'Items' : 'Monster'} aus einer kurzen Beschreibung generieren.</div>`;
  }
  return `
    <div class="ai-panel">
      <h2>🤖 Mit KI generieren</h2>
      <div class="controls" style="margin:0;border:none;padding:0;background:none">
        <div class="field" style="flex:1"><label>Beschreibung</label>
          <input type="text" id="aiPrompt" placeholder="${isItems ? 'z. B. ein verfluchtes Schwert, das nachts flüstert' : 'z. B. ein Frostwolf-Alphatier für Stufe-4-Gruppe'}" /></div>
        <div class="field"><label>Anbieter</label><select id="aiProvider">${avail.map(([id, label]) => `<option value="${id}" ${SETTINGS.aiProvider === id ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
        <button class="btn" id="aiGen">✨ Generieren</button>
      </div>
      <div id="aiStatus" class="dim"></div>
    </div>`;
}

function wireAiPanel(isItems) {
  const goto = $('#aiGotoSettings');
  if (goto) { goto.addEventListener('click', (e) => { e.preventDefault(); switchView('einstellungen'); }); return; }
  const btn = $('#aiGen');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const prompt = $('#aiPrompt').value.trim();
    if (!prompt) { toast('Bitte erst eine Beschreibung eingeben'); return; }
    const provider = $('#aiProvider').value;
    SETTINGS.aiProvider = provider;
    window.api.saveSettings(SETTINGS);
    btn.disabled = true;
    $('#aiStatus').textContent = '🎲 Die KI würfelt… (kann ein paar Sekunden dauern)';
    const r = await window.api.aiGenerate({ provider, type: isItems ? 'item' : 'monster', prompt });
    btn.disabled = false;
    if (!r.ok) { $('#aiStatus').textContent = '⚠️ ' + r.error; return; }
    $('#aiStatus').textContent = '✓ Vorschlag eingetragen – prüfen, anpassen, dann Anlegen klicken.';
    const g = r.result;
    if (isItems) {
      $('#hbName').value = g.name || '';
      if (g.rarity) $('#hbRarity').value = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'].includes(g.rarity) ? g.rarity : '';
      $('#hbPreis').value = g.preis || '';
      $('#hbDesc').value = g.desc || '';
    } else {
      $('#hbName').value = g.name || '';
      $('#hbCr').value = g.cr || '';
      $('#hbType').value = g.type || '';
      if (g.size && $('#hbSize').querySelector(`option[value]`) !== null) $('#hbSize').value = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'].includes(g.size) ? g.size : 'Medium';
      $('#hbAc').value = g.ac ?? '';
      $('#hbHp').value = g.hp ?? '';
      $('#hbSpeed').value = g.speed || '';
      $('#hbText').value = g.text || '';
    }
  });
}

// ================= Einstellungen =================
async function renderSettings() {
  const s = await window.api.getSettings();

  main().innerHTML = `
    <h1>Einstellungen</h1>
    <div class="subtitle">API-Schlüssel werden nur lokal auf deinem PC gespeichert und nie ins Repo hochgeladen.</div>

    <div class="note-editor">
      <h2>🤖 KI-Anbieter für Homebrew-Generierung</h2>
      <div class="settings-hint">Du brauchst mindestens einen Schlüssel. Google Gemini hat ein kostenloses Kontingent
      (<b>aistudio.google.com/apikey</b>), OpenAI (<b>platform.openai.com/api-keys</b>) und Anthropic (<b>console.anthropic.com</b>) kosten Centbeträge pro Anfrage.</div>
      <div class="field"><label>Google Gemini API-Schlüssel</label><input type="password" id="setGemini" value="${esc(s.geminiKey || '')}" placeholder="AIza…" /></div>
      <div class="field"><label>OpenAI API-Schlüssel</label><input type="password" id="setOpenai" value="${esc(s.openaiKey || '')}" placeholder="sk-…" /></div>
      <div class="field"><label>Anthropic API-Schlüssel</label><input type="password" id="setAnthropic" value="${esc(s.anthropicKey || '')}" placeholder="sk-ant-…" /></div>
      <div><button class="btn" id="btnSaveSettings">💾 Speichern</button></div>
    </div>

    <div class="note-editor">
      <h2>🔄 Updates</h2>
      <div class="settings-hint">Die App prüft bei jedem Start automatisch auf neue Versionen. Hier kannst du manuell prüfen:</div>
      <div><button class="btn ghost" id="btnCheckUpdate">Nach Updates suchen</button> <span id="updateStatus" class="dim"></span></div>
    </div>`;

  $('#btnSaveSettings').addEventListener('click', async () => {
    SETTINGS = await window.api.saveSettings({
      ...s,
      geminiKey: $('#setGemini').value.trim(),
      openaiKey: $('#setOpenai').value.trim(),
      anthropicKey: $('#setAnthropic').value.trim()
    });
    toast('Einstellungen gespeichert ✓');
  });

  $('#btnCheckUpdate').addEventListener('click', async () => {
    $('#updateStatus').textContent = 'Prüfe…';
    const r = await window.api.checkUpdate();
    $('#updateStatus').textContent = r.msg;
  });
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
