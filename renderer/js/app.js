// ============================================================
// DnD Toolkit – App-Logik (Views, Interaktion, Speicher)
// ============================================================
'use strict';

let DATA = null;          // Spieldaten (SRD + Tabellen)
let SETTINGS = {};        // API-Schlüssel etc.
let STORE = { entries: [], notes: [] };
let currentMerchant = null;
let currentEncounter = null;
let currentCity = null;
let currentLoot = null;
let currentNpc = null;
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
  else if (currentView === 'stadt') renderCityView();
  else if (currentView === 'loot') renderLootView();
  else if (currentView === 'npc') renderNpcView();
  else if (currentView === 'suche') renderGlobalSearch();
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
          <button class="btn ghost" id="btnMerchFoundry">🎲 Foundry-Export (NPC + Waren)</button>
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
  $('#btnMerchFoundry').addEventListener('click', async () => {
    const r = await window.api.saveText({
      defaultName: 'fvtt-' + Foundry.slug(m.name) + '.json',
      content: JSON.stringify(Foundry.merchantToFoundry(m), null, 2)
    });
    if (r.ok) toast('Foundry-Export gespeichert ✓ (In Foundry: Akteur anlegen → Import Data)');
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
          <button class="btn ghost" id="btnEncFoundry">🎲 Foundry-Export (alle Monster)</button>
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
  $('#btnEncFoundry').addEventListener('click', async () => {
    const files = e.monster.map((g) => {
      const full = DATA.monsters.find((m) => m.index === g.index)
        || DATA.homebrew.monsters.find((m) => m.id === g.index) || g;
      return {
        name: 'fvtt-' + Foundry.slug(g.name) + '.json',
        content: JSON.stringify(Foundry.monsterToFoundry(full), null, 2)
      };
    });
    const r = await window.api.saveMany({ files });
    if (r.ok) toast(r.count + ' Foundry-Dateien gespeichert ✓');
  });
  $('#btnEncCopy').addEventListener('click', () => {
    const txt = e.name + '\n' + e.gruppe + ' Abenteurer, Stufe ' + e.stufe + ' – ' + e.urteil + ' (' + e.adjXP + ' XP angepasst, Budget ' + e.budget + ')\n\n' +
      e.monster.map((g) => '  ' + g.count + 'x ' + g.name + ' (HG ' + g.cr + ', je ' + g.xp + ' XP) [' + g.src + ']').join('\n') +
      (e.notizen ? '\n\nNotizen: ' + e.notizen : '');
    navigator.clipboard.writeText(txt);
    toast('In Zwischenablage kopiert ✓');
  });
}

// ================= Städte =================
function renderCityView() {
  const st = DATA.tables.stadt;

  main().innerHTML = `
    <h1>Städte-Generator</h1>
    <div class="subtitle">Komplette Siedlungen mit Läden (echte Händler!), Tavernen, wichtigen NPCs und Gerüchten.</div>
    <div class="controls">
      <div class="field"><label>Größe</label><select id="citySize"><option value="">Zufällig</option>${st.groessen.map((g) => `<option value="${g.id}">${esc(g.label)}</option>`).join('')}</select></div>
      <button class="btn big" id="btnCityGen">🎲 Stadt erwürfeln</button>
    </div>
    <div id="cityResult"></div>
    <div id="modal"></div>`;

  $('#btnCityGen').addEventListener('click', () => {
    currentCity = Generator.generateCity(DATA, { groesse: $('#citySize').value || undefined });
    renderCityCard();
  });

  if (currentCity) renderCityCard();
}

function renderCityCard() {
  const s = currentCity;
  const box = $('#cityResult');
  if (!box || !s) return;

  const info = (key, label, value) => `
    <div class="persona-row">
      <div class="k">${label}</div>
      <div class="v">${esc(value)}</div>
      ${key ? `<button class="reroll" data-city="${key}" title="Neu würfeln">🎲</button>` : ''}
    </div>`;

  const ladenCards = s.laeden.map((l, i) => `
    <div class="lib-card" data-laden="${i}">
      <div class="t">${l.ladenIcon} ${esc(l.ladenName)}</div>
      <div class="s">${esc(l.ladenLabel)} · ${esc(l.name)} (${esc(l.rasseLabel)})</div>
      <div class="d">${esc(l.qualitaetLabel)} · ${l.inventar.length} Waren – anklicken zum Öffnen</div>
    </div>`).join('');

  const tavCards = s.tavernen.map((t) => `
    <div class="lib-card" style="cursor:default">
      <div class="t">🍺 ${esc(t.name)}</div>
      <div class="s">Wirt: ${esc(t.wirt)}</div>
      <div class="s">Spezialität: ${esc(t.gericht)}</div>
      <div class="s">${esc(t.besonderheit)}</div>
      <div class="d">🗣️ ${esc(t.geruecht)}</div>
    </div>`).join('');

  const npcRows = s.npcs.map((n) => `
    <div class="persona-row">
      <div class="k">${esc(n.amt)}</div>
      <div class="v">${esc(n.name)} (${esc(n.rasse)})<small>${esc(n.wesen)} · ${esc(n.eigenheit)}</small></div>
    </div>`).join('');

  box.innerHTML = `
    <div class="merchant-card">
      <div class="merchant-head">
        <div class="icon">🏰</div>
        <div>
          <div class="shopname">${esc(s.name)} <button class="reroll" data-city="name" title="Neu würfeln">🎲</button><span class="badge">${esc(s.groesseLabel)}</span></div>
          <div class="meta">${s.einwohner.toLocaleString('de-DE')} Einwohner</div>
        </div>
      </div>
      <div class="merchant-body">
        <div class="persona">
          <h2>Überblick</h2>
          ${info('regierung', 'Regierung', 'Regiert von ' + s.regierung)}
          ${info('merkmal', 'Merkmal', 'Die Siedlung ' + s.merkmal)}
          ${info('verteidigung', 'Verteidigung', 'Geschützt durch ' + s.verteidigung)}
          <h2 style="margin-top:16px">Wichtige Personen</h2>
          ${npcRows}
          <h2 style="margin-top:16px">Gerüchte & Aufhänger <button class="reroll" data-city="geruechte" title="Neu würfeln">🎲</button></h2>
          ${s.geruechte.map((g) => `<div class="persona-row"><div class="v">🗣️ ${esc(g)}</div></div>`).join('')}
        </div>
        <div class="inventory">
          <h2>Läden (${s.laeden.length})</h2>
          <div class="lib-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${ladenCards}</div>
          <h2 style="margin-top:18px">Tavernen (${s.tavernen.length})</h2>
          <div class="lib-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${tavCards}</div>
        </div>
      </div>
      <div class="merchant-foot">
        <textarea id="cityNotes" placeholder="Eigene Notizen zu dieser Siedlung…">${esc(s.notizen)}</textarea>
        <div class="foot-btns">
          <button class="btn" id="btnCitySave">💾 In Bibliothek speichern</button>
          <button class="btn ghost" id="btnCityCopy">📋 Als Text kopieren</button>
        </div>
      </div>
    </div>`;

  $$('[data-city]', box).forEach((b) =>
    b.addEventListener('click', () => { Generator.cityReroll[b.dataset.city](DATA, s); renderCityCard(); })
  );
  $$('[data-laden]', box).forEach((c) =>
    c.addEventListener('click', () => {
      // Laden in der Stadt als Referenz öffnen – Änderungen fließen in die Stadt zurück
      currentMerchant = s.laeden[+c.dataset.laden];
      switchView('haendler');
    })
  );
  $('#cityNotes').addEventListener('input', (ev) => { s.notizen = ev.target.value; });
  $('#btnCitySave').addEventListener('click', async () => {
    STORE = await window.api.saveEntry(JSON.parse(JSON.stringify(s)));
    toast('In Bibliothek gespeichert ✓');
  });
  $('#btnCityCopy').addEventListener('click', () => {
    const txt = s.name + ' (' + s.groesseLabel + ', ' + s.einwohner + ' Einwohner)\n' +
      'Regiert von ' + s.regierung + '. Die Siedlung ' + s.merkmal + '. Geschützt durch ' + s.verteidigung + '.\n\n' +
      'Wichtige Personen:\n' + s.npcs.map((n) => '  ' + n.amt + ': ' + n.name + ' (' + n.rasse + ') – ' + n.wesen + '\n').join('') +
      '\nLäden:\n' + s.laeden.map((l) => '  ' + l.ladenName + ' (' + l.ladenLabel + ') – ' + l.name + '\n').join('') +
      '\nTavernen:\n' + s.tavernen.map((t) => '  ' + t.name + ' – Wirt: ' + t.wirt + '\n').join('') +
      '\nGerüchte:\n' + s.geruechte.map((g) => '  – ' + g + '\n').join('') +
      (s.notizen ? '\nNotizen: ' + s.notizen : '');
    navigator.clipboard.writeText(txt);
    toast('In Zwischenablage kopiert ✓');
  });
}

// ================= NPCs =================
function renderNpcView() {
  const rassen = Object.entries(DATA.names).map(([id, r]) => `<option value="${id}">${esc(r.label)}</option>`).join('');
  const rollen = DATA.tables.npc.rollen.map((r) => `<option>${esc(r)}</option>`).join('');

  main().innerHTML = `
    <h1>NPC-Generator</h1>
    <div class="subtitle">Lebendige Nichtspielercharaktere mit Motivation, Bindung, Makel und Geheimnis – für jede Begegnung am Wegesrand.</div>
    <div class="controls">
      <div class="field"><label>Rasse</label><select id="npcRasse"><option value="">Zufällig</option>${rassen}</select></div>
      <div class="field"><label>Geschlecht</label><select id="npcGeschlecht"><option value="">Zufällig</option><option value="m">Männlich</option><option value="f">Weiblich</option></select></div>
      <div class="field"><label>Rolle</label><select id="npcRolle"><option value="">Zufällig</option>${rollen}</select></div>
      <button class="btn big" id="btnNpcGen">🎲 NPC erwürfeln</button>
    </div>
    <div id="npcResult"></div>`;

  $('#btnNpcGen').addEventListener('click', () => {
    currentNpc = Generator.generateNpc(DATA, {
      rasse: $('#npcRasse').value || undefined,
      geschlecht: $('#npcGeschlecht').value || undefined,
      rolle: $('#npcRolle').value || undefined
    });
    renderNpcCard();
  });
  if (currentNpc) renderNpcCard();
}

function renderNpcCard() {
  const n = currentNpc;
  const box = $('#npcResult');
  if (!box || !n) return;

  const row = (key, label, value, sub) => `
    <div class="persona-row">
      <div class="k">${label}</div>
      <div class="v">${esc(value)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>
      ${key ? `<button class="reroll" data-npc="${key}" title="Neu würfeln">🎲</button>` : ''}
    </div>`;

  const kiVerfuegbar = AI_PROVIDERS.some(([, , k]) => SETTINGS[k]);

  box.innerHTML = `
    <div class="merchant-card">
      <div class="merchant-head">
        <div class="icon">🧑</div>
        <div>
          <div class="shopname">${esc(n.name)} <button class="reroll" data-npc="name" title="Neu würfeln">🎲</button></div>
          <div class="meta">${esc(n.rolle)} <button class="reroll" data-npc="rolle" title="Neu würfeln">🎲</button> · ${esc(n.rasseLabel)}, ${n.geschlecht === 'f' ? 'weiblich' : 'männlich'}</div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div class="badge">${esc(n.einstellung.label)}</div>
          <div class="dim" style="margin-top:4px;max-width:180px">${esc(n.einstellung.desc)}</div>
        </div>
      </div>
      <div class="merchant-body">
        <div class="persona">
          <h2>Auftreten</h2>
          ${row('aussehen', 'Aussehen', n.aussehen)}
          ${row('wesen', 'Wesen', n.wesen)}
          ${row('eigenheit', 'Eigenheit', n.eigenheit)}
          ${row('stimme', 'Stimme', n.stimme)}
          ${row('einstellung', 'Einstellung', n.einstellung.label, n.einstellung.desc)}
        </div>
        <div class="inventory">
          <h2>Innenleben</h2>
          ${row('motivation', 'Motivation', n.motivation)}
          ${row('bindung', 'Bindung', 'Hängt an ' + n.bindung)}
          ${row('makel', 'Makel', n.makel)}
          ${row('geheimnis', 'Geheimnis', n.geheimnis)}
          ${kiVerfuegbar ? `
          <div class="ai-panel" style="margin-top:14px">
            <h2>🤖 Hintergrundgeschichte</h2>
            <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
              <div class="field"><label>Anbieter</label><select id="npcAiProvider">${AI_PROVIDERS.filter(([, , k]) => SETTINGS[k]).map(([id, label]) => `<option value="${id}" ${SETTINGS.aiProvider === id ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
              <button class="btn" id="npcAiGen">✨ Geschichte schreiben lassen</button>
            </div>
            <div id="npcAiStatus" class="dim"></div>
          </div>` : '<div class="ai-panel dim" style="margin-top:14px">🤖 Mit einem KI-Schlüssel in den <a href="#" id="npcGotoSettings">Einstellungen</a> kann hier eine Hintergrundgeschichte generiert werden.</div>'}
          ${n.hintergrund ? `<div class="npc-story"><h2>Hintergrund</h2><p style="white-space:pre-wrap">${esc(n.hintergrund)}</p></div>` : ''}
        </div>
      </div>
      <div class="merchant-foot">
        <textarea id="npcNotes" placeholder="Eigene Notizen zu diesem NPC…">${esc(n.notizen)}</textarea>
        <div class="foot-btns">
          <button class="btn" id="btnNpcSave">💾 In Bibliothek speichern</button>
          <button class="btn ghost" id="btnNpcCopy">📋 Als Text kopieren</button>
          <button class="btn ghost" id="btnNpcFoundry">🎲 Foundry-Export</button>
        </div>
      </div>
    </div>`;

  $$('[data-npc]', box).forEach((b) =>
    b.addEventListener('click', () => { Generator.npcReroll[b.dataset.npc](DATA, n); renderNpcCard(); })
  );
  $('#npcNotes').addEventListener('input', (ev) => { n.notizen = ev.target.value; });
  $('#btnNpcSave').addEventListener('click', async () => {
    STORE = await window.api.saveEntry(JSON.parse(JSON.stringify(n)));
    toast('In Bibliothek gespeichert ✓');
  });
  $('#btnNpcCopy').addEventListener('click', () => { navigator.clipboard.writeText(npcAsText(n)); toast('In Zwischenablage kopiert ✓'); });
  $('#btnNpcFoundry').addEventListener('click', async () => {
    const r = await window.api.saveText({
      defaultName: 'fvtt-' + Foundry.slug(n.name) + '.json',
      content: JSON.stringify(Foundry.npcToFoundry(n), null, 2)
    });
    if (r.ok) toast('Foundry-Export gespeichert ✓');
  });

  const goto = $('#npcGotoSettings');
  if (goto) goto.addEventListener('click', (e) => { e.preventDefault(); switchView('einstellungen'); });

  const aiBtn = $('#npcAiGen');
  if (aiBtn) aiBtn.addEventListener('click', async () => {
    const provider = $('#npcAiProvider').value;
    SETTINGS.aiProvider = provider;
    window.api.saveSettings(SETTINGS);
    aiBtn.disabled = true;
    $('#npcAiStatus').textContent = '✍️ Die KI schreibt…';
    const prompt = `Schreibe eine kurze Hintergrundgeschichte (4-8 Sätze) für diesen NPC:
Name: ${n.name}, ${n.rasseLabel}, ${n.geschlecht === 'f' ? 'weiblich' : 'männlich'}
Rolle: ${n.rolle}
Aussehen: ${n.aussehen}
Wesen: ${n.wesen}, ${n.eigenheit}
Motivation: ${n.motivation}
Hängt an: ${n.bindung}
Makel: ${n.makel}
Geheimnis: ${n.geheimnis}
Verbinde diese Elemente zu einer stimmigen Lebensgeschichte und ende mit einem konkreten Abenteuer-Aufhänger für die Spielergruppe.`;
    const r = await window.api.aiGenerate({ provider, type: 'npc', prompt });
    aiBtn.disabled = false;
    if (!r.ok) { $('#npcAiStatus').textContent = '⚠️ ' + r.error; return; }
    n.hintergrund = r.result.hintergrund || r.result.text || '';
    renderNpcCard();
    toast('Hintergrundgeschichte erstellt ✓');
  });
}

function npcAsText(n) {
  return `${n.name} – ${n.rolle} (${n.rasseLabel}, ${n.geschlecht === 'f' ? 'weiblich' : 'männlich'})
Einstellung: ${n.einstellung.label} – ${n.einstellung.desc}
Aussehen: ${n.aussehen}
Wesen: ${n.wesen} · ${n.eigenheit}
Stimme: ${n.stimme}
Motivation: ${n.motivation}
Bindung: Hängt an ${n.bindung}
Makel: ${n.makel}
Geheimnis: ${n.geheimnis}${n.hintergrund ? '\n\nHintergrund:\n' + n.hintergrund : ''}${n.notizen ? '\n\nNotizen: ' + n.notizen : ''}`;
}

// ================= Loot =================
const MUENZ_LABEL = { km: 'Kupfer', sm: 'Silber', gm: 'Gold', pm: 'Platin' };

function renderLootView() {
  const lt = DATA.tables.loot;
  main().innerHTML = `
    <h1>Loot-Generator</h1>
    <div class="subtitle">Schatzhorte nach den offiziellen Horttabellen – Münzen, Wertsachen und magische Gegenstände.</div>
    <div class="controls">
      <div class="field"><label>Herausforderung</label><select id="lootStufe">${lt.stufen.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></div>
      <div class="field"><label>Art</label><select id="lootArt">
        <option value="hort">Schatzhort (Bosse, Verstecke)</option>
        <option value="einzeln">Einzelbeute (Taschen einzelner Gegner)</option>
      </select></div>
      <button class="btn big" id="btnLootGen">🎲 Beute erwürfeln</button>
    </div>
    <div id="lootResult"></div>
    <div id="modal"></div>`;

  $('#btnLootGen').addEventListener('click', () => {
    currentLoot = Generator.generateLoot(DATA, { stufe: $('#lootStufe').value, art: $('#lootArt').value });
    renderLootCard();
  });
  if (currentLoot) renderLootCard();
}

function renderLootCard() {
  const l = currentLoot;
  const box = $('#lootResult');
  if (!box || !l) return;

  const muenzRows = Object.entries(l.muenzen).filter(([, v]) => v > 0)
    .map(([k, v]) => `<tr><td><span class="itemname">${MUENZ_LABEL[k]}münzen</span></td><td class="price">${v.toLocaleString('de-DE')} ${k.toUpperCase()}</td></tr>`).join('');
  const wertRows = l.wertsachen.map((w) =>
    `<tr><td><span class="itemname">${esc(w.name)}</span><div class="itemdesc">${esc(w.art)}</div></td><td class="price">${w.anzahl}x ${w.wert.toLocaleString('de-DE')} GM</td></tr>`).join('');
  const magieRows = l.magie.map((m, i) =>
    `<tr><td><span class="itemname magic loot-magic" data-i="${i}">${esc(m.name)}</span><div class="itemdesc">${esc(m.src)}</div></td><td><span class="badge magic">${esc(m.rarity)}</span></td></tr>`).join('');

  box.innerHTML = `
    <div class="merchant-card">
      <div class="merchant-head">
        <div class="icon">💰</div>
        <div>
          <div class="shopname">${esc(l.name)}</div>
          <div class="meta">Gesamtwert (ohne magische Items): ca. <b>${l.gesamtGold.toLocaleString('de-DE')} GM</b></div>
        </div>
      </div>
      <div class="inventory">
        <h2>Münzen</h2>
        <table><tbody>${muenzRows || '<tr><td class="dim">Keine</td></tr>'}</tbody></table>
        ${l.wertsachen.length ? `<h2 style="margin-top:14px">Wertsachen</h2><table><tbody>${wertRows}</tbody></table>` : ''}
        ${l.magie.length ? `<h2 style="margin-top:14px">Magische Gegenstände</h2><table><tbody>${magieRows}</tbody></table>` : ''}
      </div>
      <div class="merchant-foot">
        <textarea id="lootNotes" placeholder="Eigene Notizen (Fundort, Fluch, Besitzer…)">${esc(l.notizen)}</textarea>
        <div class="foot-btns">
          <button class="btn" id="btnLootSave">💾 In Bibliothek speichern</button>
          <button class="btn ghost" id="btnLootCopy">📋 Als Text kopieren</button>
          ${l.magie.length ? '<button class="btn ghost" id="btnLootFoundry">🎲 Foundry-Export (Items)</button>' : ''}
        </div>
      </div>
    </div>`;

  $$('.loot-magic', box).forEach((el) =>
    el.addEventListener('click', () => {
      const full = DATA.magicItems.find((m) => m.index === l.magie[+el.dataset.i].index);
      if (full) showItemDetail(full);
    })
  );
  $('#lootNotes').addEventListener('input', (ev) => { l.notizen = ev.target.value; });
  $('#btnLootSave').addEventListener('click', async () => {
    STORE = await window.api.saveEntry(JSON.parse(JSON.stringify(l)));
    toast('In Bibliothek gespeichert ✓');
  });
  $('#btnLootCopy').addEventListener('click', () => {
    const txt = l.name + ' (Gesamtwert ca. ' + l.gesamtGold + ' GM)\n' +
      'Münzen: ' + Object.entries(l.muenzen).filter(([, v]) => v > 0).map(([k, v]) => v + ' ' + k.toUpperCase()).join(', ') + '\n' +
      (l.wertsachen.length ? 'Wertsachen:\n' + l.wertsachen.map((w) => '  ' + w.anzahl + 'x ' + w.name + ' (je ' + w.wert + ' GM)\n').join('') : '') +
      (l.magie.length ? 'Magische Gegenstände:\n' + l.magie.map((m) => '  ' + m.name + ' (' + m.rarity + ')\n').join('') : '') +
      (l.notizen ? 'Notizen: ' + l.notizen : '');
    navigator.clipboard.writeText(txt);
    toast('In Zwischenablage kopiert ✓');
  });
  const fBtn = $('#btnLootFoundry');
  if (fBtn) fBtn.addEventListener('click', async () => {
    const files = l.magie.map((m) => {
      const full = DATA.magicItems.find((x) => x.index === m.index) || m;
      return { name: 'fvtt-' + Foundry.slug(m.name) + '.json', content: JSON.stringify(Foundry.itemToFoundry(full), null, 2) };
    });
    const r = await window.api.saveMany({ files });
    if (r.ok) toast(r.count + ' Foundry-Dateien gespeichert ✓');
  });
}

// ================= Globale Suche =================
function renderGlobalSearch(q = '') {
  const ql = q.toLowerCase().trim();
  let html = '';
  if (ql.length >= 2) {
    const mon = allMonsters().filter((m) => m.name.toLowerCase().includes(ql)).slice(0, 15);
    const items = allMagicItems().filter((i) => i.name.toLowerCase().includes(ql)).slice(0, 15);
    const spells = DATA.spells.filter((s) => s.name.toLowerCase().includes(ql)).slice(0, 15);
    const eintraege = STORE.entries.filter((e) => JSON.stringify(e).toLowerCase().includes(ql)).slice(0, 15);
    const notizen = STORE.notes.filter((n) => (n.titel + ' ' + n.text).toLowerCase().includes(ql)).slice(0, 10);

    const sect = (titel, rows) => rows.length ? `<h2 style="margin-top:16px">${titel} (${rows.length})</h2><div class="lib-grid">${rows.join('')}</div>` : '';
    html =
      sect('🐲 Monster', mon.map((m, i) => `<div class="lib-card gs-mon" data-i="${i}"><div class="t">${esc(m.name)}</div><div class="s">HG ${esc(String(m.cr))} · ${esc(m.type || '')} · ${esc(m.src)}</div></div>`)) +
      sect('✨ Magische Items', items.map((it, i) => `<div class="lib-card gs-item" data-i="${i}"><div class="t magic">${esc(it.name)}</div><div class="s">${esc([it.rarity, it.src].filter(Boolean).join(' · '))}</div></div>`)) +
      sect('📜 Zauber', spells.map((sp, i) => `<div class="lib-card gs-spell" data-i="${i}"><div class="t magic">${esc(sp.name)}</div><div class="s">${esc(GRAD_LABEL(sp.level))} · ${esc(sp.school || '')} · ${esc(sp.src)}</div></div>`)) +
      sect('📜 Bibliothek', eintraege.map((e, i) => `<div class="lib-card gs-lib" data-i="${i}"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.type)}</div></div>`)) +
      sect('✒️ Notizen', notizen.map((n) => `<div class="lib-card gs-note"><div class="t">${esc(n.titel)}</div><div class="s">${esc(n.text.slice(0, 80))}</div></div>`));
    if (!html) html = '<div class="empty">Nichts gefunden.</div>';

    // Nach dem Rendern Handler setzen (unten)
    renderGlobalSearch._mon = mon; renderGlobalSearch._items = items; renderGlobalSearch._lib = eintraege; renderGlobalSearch._spells = spells;
  }

  main().innerHTML = `
    <h1>Globale Suche</h1>
    <div class="subtitle">Durchsucht Monster, magische Items, deine Bibliothek und Notizen.</div>
    <div class="controls"><div class="field" style="flex:1"><label>Suchbegriff</label>
      <input type="text" id="gsInput" value="${esc(q)}" placeholder="🔍 Mindestens 2 Zeichen…" /></div></div>
    <div id="gsResults">${html}</div>
    <div id="modal"></div>`;

  const inp = $('#gsInput');
  inp.addEventListener('input', () => renderGlobalSearch(inp.value));
  inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);

  $$('.gs-mon').forEach((c) => c.addEventListener('click', () => showStatblock(renderGlobalSearch._mon[+c.dataset.i])));
  $$('.gs-item').forEach((c) => c.addEventListener('click', () => showItemDetail(renderGlobalSearch._items[+c.dataset.i])));
  $$('.gs-spell').forEach((c) => c.addEventListener('click', () => showSpellDetail(renderGlobalSearch._spells[+c.dataset.i])));
  $$('.gs-lib').forEach((c) => c.addEventListener('click', () => {
    const e = renderGlobalSearch._lib[+c.dataset.i];
    if (e.type === 'encounter') { currentEncounter = JSON.parse(JSON.stringify(e)); switchView('encounter'); }
    else if (e.type === 'stadt') { currentCity = JSON.parse(JSON.stringify(e)); switchView('stadt'); }
    else if (e.type === 'loot') { currentLoot = JSON.parse(JSON.stringify(e)); switchView('loot'); }
    else if (e.type === 'npc') { currentNpc = JSON.parse(JSON.stringify(e)); switchView('npc'); }
    else { currentMerchant = JSON.parse(JSON.stringify(e)); switchView('haendler'); }
  }));
  $$('.gs-note').forEach((c) => c.addEventListener('click', () => switchView('notizen')));
}

// ================= Bibliothek =================
let libCampaignFilter = '';

function renderLibrary(filterText = '') {
  const entries = STORE.entries.filter((e) => {
    if (libCampaignFilter === 'keine' && e.kampagne) return false;
    if (libCampaignFilter && libCampaignFilter !== 'keine' && e.kampagne !== libCampaignFilter) return false;
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
    } else if (e.type === 'stadt') {
      icon = '🏰'; title = e.name;
      sub = e.groesseLabel + ' · ' + e.einwohner.toLocaleString('de-DE') + ' EW · ' + e.laeden.length + ' Läden, ' + e.tavernen.length + ' Tavernen';
    } else if (e.type === 'loot') {
      icon = '💰'; title = e.name;
      sub = 'ca. ' + e.gesamtGold.toLocaleString('de-DE') + ' GM' + (e.magie.length ? ' + ' + e.magie.length + ' magische Items' : '');
    } else if (e.type === 'npc') {
      icon = '🧑'; title = e.name;
      sub = e.rolle + ' · ' + e.rasseLabel + ' · ' + e.einstellung.label;
    } else {
      icon = e.ladenIcon || '📦'; title = e.ladenName || e.name;
      sub = [e.name, e.rasseLabel, e.ladenLabel || e.type].filter(Boolean).join(' · ');
    }
    const campSelect = `<select class="camp-assign" data-id="${e.id}" title="Kampagne zuordnen">
      <option value="">— keine Kampagne —</option>
      ${STORE.campaigns.map((c) => `<option value="${c.id}" ${e.kampagne === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>`;
    return `
    <div class="lib-card" data-id="${e.id}">
      <button class="del" data-id="${e.id}" title="Löschen">🗑</button>
      <div class="t">${icon} ${esc(title)}</div>
      <div class="s">${esc(sub)}</div>
      ${e.notizen ? `<div class="s">📝 ${esc(e.notizen.slice(0, 60))}${e.notizen.length > 60 ? '…' : ''}</div>` : ''}
      <div class="d">Erstellt: ${fmtDate(e.createdAt)} · ${campSelect}</div>
    </div>`;
  }).join('');

  main().innerHTML = `
    <h1>Bibliothek</h1>
    <div class="subtitle">Alle gespeicherten Kreationen – anklicken zum Öffnen und Weiterbearbeiten.</div>
    <div class="lib-controls">
      <input type="text" id="libSearch" placeholder="🔍 Suchen nach Name, Laden…" value="${esc(filterText)}" />
      <select id="libCampaign">
        <option value="">Alle Kampagnen</option>
        <option value="keine" ${libCampaignFilter === 'keine' ? 'selected' : ''}>Ohne Kampagne</option>
        ${STORE.campaigns.map((c) => `<option value="${c.id}" ${libCampaignFilter === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
      <button class="btn ghost" id="btnNewCampaign">+ Kampagne</button>
      ${libCampaignFilter && libCampaignFilter !== 'keine' ? '<button class="btn danger" id="btnDelCampaign" title="Kampagne löschen (Einträge bleiben)">🗑 Kampagne</button>' : ''}
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
      } else if (entry.type === 'stadt') {
        currentCity = JSON.parse(JSON.stringify(entry));
        switchView('stadt');
      } else if (entry.type === 'loot') {
        currentLoot = JSON.parse(JSON.stringify(entry));
        switchView('loot');
      } else if (entry.type === 'npc') {
        currentNpc = JSON.parse(JSON.stringify(entry));
        switchView('npc');
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

  // Kampagnen
  $('#libCampaign').addEventListener('change', (e) => { libCampaignFilter = e.target.value; renderLibrary($('#libSearch').value); });
  $('#btnNewCampaign').addEventListener('click', async () => {
    const name = prompt('Name der neuen Kampagne:');
    if (!name || !name.trim()) return;
    const c = { id: 'c_' + Date.now(), name: name.trim() };
    STORE = await window.api.saveCampaign(c);
    renderLibrary($('#libSearch').value);
    toast('Kampagne „' + c.name + '" angelegt – ordne jetzt Einträge über das Auswahlfeld an jeder Karte zu');
  });
  const delCamp = $('#btnDelCampaign');
  if (delCamp) delCamp.addEventListener('click', async () => {
    STORE = await window.api.deleteCampaign(libCampaignFilter);
    libCampaignFilter = '';
    renderLibrary($('#libSearch').value);
    toast('Kampagne gelöscht (Einträge bleiben erhalten)');
  });
  $$('.camp-assign').forEach((sel) => {
    sel.addEventListener('click', (ev) => ev.stopPropagation());
    sel.addEventListener('change', async (ev) => {
      ev.stopPropagation();
      const entry = STORE.entries.find((e) => e.id === sel.dataset.id);
      if (!entry) return;
      entry.kampagne = sel.value || null;
      STORE = await window.api.saveEntry(entry);
      toast('Zugeordnet ✓');
    });
  });
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

const GRAD_LABEL = (l) => (l === 0 ? 'Zaubertrick' : 'Grad ' + l);

function renderCompendium() {
  const tab = compState.tab;
  const isMon = tab === 'monster';
  const isSpell = tab === 'spells';
  const list = isMon ? allMonsters() : isSpell ? DATA.spells : allMagicItems();
  const sources = [...new Set(list.map((x) => x.src))];

  const q = compState.q.toLowerCase();
  let hits = list.filter(
    (x) =>
      (!q || x.name.toLowerCase().includes(q) || (isMon && (x.type || '').toLowerCase().includes(q))) &&
      (!compState.src || x.src === compState.src) &&
      (!isSpell || compState.grad === '' || compState.grad === undefined || x.level === +compState.grad) &&
      (!isSpell || !compState.schule || x.school === compState.schule)
  );
  const total = hits.length;
  hits = hits.slice(0, 200);

  const rows = hits.map((x, i) => isMon
    ? `<tr class="comp-row" data-i="${i}"><td><span class="itemname">${esc(x.name)}</span></td><td>${esc(x.cr ?? '')}</td><td>${esc(x.type || '')}</td><td>${esc(x.size || '')}</td><td class="dim">${esc(x.src)}</td></tr>`
    : isSpell
      ? `<tr class="comp-row" data-i="${i}"><td><span class="itemname magic">${esc(x.name)}</span>${x.conc ? ' <span class="badge">K</span>' : ''}${x.ritual ? ' <span class="badge">R</span>' : ''}</td><td>${esc(GRAD_LABEL(x.level))}</td><td>${esc(x.school || '')}</td><td class="dim">${esc(x.src)}</td></tr>`
      : `<tr class="comp-row" data-i="${i}"><td><span class="itemname magic">${esc(x.name)}</span></td><td>${esc(x.rarity || '')}</td><td>${esc(x.cat || '')}</td><td class="dim">${esc(x.src)}</td></tr>`
  ).join('');

  const schulen = isSpell ? [...new Set(DATA.spells.map((s) => s.school).filter(Boolean))].sort() : [];

  main().innerHTML = `
    <h1>Kompendium</h1>
    <div class="subtitle">${allMonsters().length.toLocaleString('de-DE')} Monster, ${allMagicItems().length.toLocaleString('de-DE')} magische Gegenstände und ${DATA.spells.length.toLocaleString('de-DE')} Zauber – komplett offline.</div>
    <div class="controls">
      <div class="tabs">
        <button class="btn ${isMon ? '' : 'ghost'}" id="tabMon">🐲 Monster</button>
        <button class="btn ${tab === 'items' ? '' : 'ghost'}" id="tabItems">✨ Items</button>
        <button class="btn ${isSpell ? '' : 'ghost'}" id="tabSpells">📜 Zauber</button>
      </div>
      <div class="field" style="flex:1"><label>Suche</label><input type="text" id="compSearch" value="${esc(compState.q)}" placeholder="🔍 Name${isMon ? ' oder Typ' : ''}…" /></div>
      ${isSpell ? `
      <div class="field"><label>Grad</label><select id="compGrad"><option value="">Alle</option>${[0,1,2,3,4,5,6,7,8,9].map((g) => `<option value="${g}" ${compState.grad === String(g) ? 'selected' : ''}>${GRAD_LABEL(g)}</option>`).join('')}</select></div>
      <div class="field"><label>Schule</label><select id="compSchule"><option value="">Alle</option>${schulen.map((s) => `<option ${s === compState.schule ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label>Quelle</label><select id="compSrc"><option value="">Alle</option>${sources.map((s) => `<option ${s === compState.src ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
    </div>
    <div class="comp-count">${total.toLocaleString('de-DE')} Treffer${total > 200 ? ' (erste 200 angezeigt – Suche verfeinern)' : ''}</div>
    <table class="comp-table">
      <thead>${isMon ? '<tr><th>Name</th><th>HG</th><th>Typ</th><th>Größe</th><th>Quelle</th></tr>' : isSpell ? '<tr><th>Name</th><th>Grad</th><th>Schule</th><th>Quelle</th></tr>' : '<tr><th>Name</th><th>Seltenheit</th><th>Kategorie</th><th>Quelle</th></tr>'}</thead>
      <tbody>${rows || '<tr><td colspan="5" class="empty">Keine Treffer.</td></tr>'}</tbody>
    </table>
    <div id="modal"></div>`;

  $('#tabMon').addEventListener('click', () => { compState = { tab: 'monster', q: '', src: '' }; renderCompendium(); });
  $('#tabItems').addEventListener('click', () => { compState = { tab: 'items', q: '', src: '' }; renderCompendium(); });
  $('#tabSpells').addEventListener('click', () => { compState = { tab: 'spells', q: '', src: '', grad: '', schule: '' }; renderCompendium(); });
  const s = $('#compSearch');
  s.addEventListener('input', () => { compState.q = s.value; renderCompendium(); });
  s.focus(); s.setSelectionRange(s.value.length, s.value.length);
  $('#compSrc').addEventListener('change', (e) => { compState.src = e.target.value; renderCompendium(); });
  if (isSpell) {
    $('#compGrad').addEventListener('change', (e) => { compState.grad = e.target.value; renderCompendium(); });
    $('#compSchule').addEventListener('change', (e) => { compState.schule = e.target.value; renderCompendium(); });
  }
  $$('.comp-row').forEach((r) =>
    r.addEventListener('click', () => (isMon ? showStatblock(hits[+r.dataset.i]) : isSpell ? showSpellDetail(hits[+r.dataset.i]) : showItemDetail(hits[+r.dataset.i])))
  );
}

function showSpellDetail(sp) {
  $('#modal').innerHTML = `
    <div class="modal-bg">
      <div class="statblock">
        <button class="modal-close">✕</button>
        <h2 class="magic">${esc(sp.name)}</h2>
        <div class="sb-meta">${esc(GRAD_LABEL(sp.level))} · ${esc(sp.school || '')}${sp.ritual ? ' (Ritual)' : ''} · <span class="dim">${esc(sp.src)}</span></div>
        <hr />
        <div class="sb-line"><b>Zeitaufwand</b> ${esc(sp.castTime || '–')}</div>
        <div class="sb-line"><b>Reichweite</b> ${esc(sp.range || '–')}</div>
        <div class="sb-line"><b>Komponenten</b> ${esc(sp.components || '–')}</div>
        <div class="sb-line"><b>Dauer</b> ${esc((sp.conc ? 'Konzentration, ' : '') + (sp.duration || '–'))}</div>
        ${sp.classes ? `<div class="sb-line"><b>Klassen</b> ${esc(sp.classes)}</div>` : ''}
        <div class="sb-sect"><p style="white-space:pre-wrap">${esc(sp.desc)}</p></div>
      </div>
    </div>`;
  $('.modal-close').addEventListener('click', () => ($('#modal').innerHTML = ''));
  $('.modal-bg').addEventListener('click', (e) => { if (e.target.classList.contains('modal-bg')) $('#modal').innerHTML = ''; });
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
        <hr />
        <button class="btn ghost small" id="sbFoundry">🎲 Für Foundry VTT exportieren</button>
      </div>
    </div>`;
  $('.modal-close').addEventListener('click', () => ($('#modal').innerHTML = ''));
  $('.modal-bg').addEventListener('click', (e) => { if (e.target.classList.contains('modal-bg')) $('#modal').innerHTML = ''; });
  $('#sbFoundry').addEventListener('click', async () => {
    const r = await window.api.saveText({
      defaultName: 'fvtt-' + Foundry.slug(m.name) + '.json',
      content: JSON.stringify(Foundry.monsterToFoundry(m), null, 2)
    });
    if (r.ok) toast('Foundry-Export gespeichert ✓ (In Foundry: Akteur anlegen → Import Data)');
  });
}

function showItemDetail(it) {
  $('#modal').innerHTML = `
    <div class="modal-bg">
      <div class="statblock">
        <button class="modal-close">✕</button>
        <h2 class="magic">${esc(it.name)}</h2>
        <div class="sb-meta">${esc([it.itemTyp, it.rarity, it.cat !== 'wondrous-items' ? it.cat : null].filter(Boolean).join(' · '))}${it.attune ? ' · Einstimmung erforderlich' : ''} · <span class="dim">${esc(it.src)}</span>${it.preis ? ' · ' + esc(it.preis) : ''}</div>
        <hr />
        ${it.schaden ? `<div class="sb-line"><b>Schaden</b> ${esc(it.schaden)}${it.bonus ? ' (' + esc(it.bonus) + ' auf Angriff und Schaden)' : ''}</div>` : ''}
        ${!it.schaden && it.bonus ? `<div class="sb-line"><b>Bonus</b> ${esc(it.bonus)}</div>` : ''}
        ${it.rk ? `<div class="sb-line"><b>Rüstungsklasse</b> ${esc(it.rk)}</div>` : ''}
        ${it.eigenschaften ? `<div class="sb-sect"><p><b><i>Eigenschaften.</i></b> ${esc(it.eigenschaften)}</p></div>` : ''}
        <div class="sb-sect"><p style="white-space:pre-wrap">${esc(it.desc || 'Keine Beschreibung.')}</p></div>
        <hr />
        <button class="btn ghost small" id="itFoundry">🎲 Für Foundry VTT exportieren</button>
      </div>
    </div>`;
  $('.modal-close').addEventListener('click', () => ($('#modal').innerHTML = ''));
  $('.modal-bg').addEventListener('click', (e) => { if (e.target.classList.contains('modal-bg')) $('#modal').innerHTML = ''; });
  $('#itFoundry').addEventListener('click', async () => {
    const r = await window.api.saveText({
      defaultName: 'fvtt-' + Foundry.slug(it.name) + '.json',
      content: JSON.stringify(Foundry.itemToFoundry(it), null, 2)
    });
    if (r.ok) toast('Foundry-Export gespeichert ✓ (In Foundry: Item anlegen → Import Data)');
  });
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

  const ITEM_TYPEN = ['Wundersamer Gegenstand', 'Waffe', 'Rüstung', 'Schild', 'Trank', 'Schriftrolle', 'Ring', 'Stab', 'Zauberstab', 'Munition'];
  const itemForm = `
    <div class="field"><label>Name *</label><input type="text" id="hbName" value="${esc(editing?.name || '')}" /></div>
    <div class="field"><label>Typ</label><select id="hbItemTyp">${ITEM_TYPEN.map((t) => `<option ${editing?.itemTyp === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="field"><label>Seltenheit</label><select id="hbRarity">${['', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'].map((r) => `<option ${editing?.rarity === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="field"><label>Preis</label><input type="text" id="hbPreis" value="${esc(editing?.preis || '')}" placeholder="z. B. 150 gp" /></div>
    <div class="field"><label>Schaden</label><input type="text" id="hbSchaden" value="${esc(editing?.schaden || '')}" placeholder="z. B. 1d8 Hieb + 1d6 Feuer" /></div>
    <div class="field"><label>Bonus</label><input type="text" id="hbBonus" value="${esc(editing?.bonus || '')}" placeholder="z. B. +1" style="max-width:90px" /></div>
    <div class="field"><label>RK (Rüstung)</label><input type="text" id="hbRk" value="${esc(editing?.rk || '')}" placeholder="z. B. 14" style="max-width:90px" /></div>
    <div class="field"><label>Erscheint bei Händlern</label><select id="hbLaden">
      <option value="">Nie (nur Kompendium)</option>
      <option value="alle" ${editing?.laden === 'alle' ? 'selected' : ''}>Jeder Ladentyp</option>
      ${laeden.map((l) => `<option value="${l.id}" ${editing?.laden === l.id ? 'selected' : ''}>${l.icon} ${esc(l.label)}</option>`).join('')}
    </select></div>
    <div class="field" style="flex-basis:100%"><label>Besondere Eigenschaften (Regeln)</label><textarea id="hbEigen" style="min-height:50px">${esc(editing?.eigenschaften || '')}</textarea></div>
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
        itemTyp: $('#hbItemTyp').value,
        schaden: $('#hbSchaden').value.trim() || null,
        bonus: $('#hbBonus').value.trim() || null,
        rk: $('#hbRk').value.trim() || null,
        eigenschaften: $('#hbEigen').value.trim() || null,
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
      const typen = [...$('#hbItemTyp').options].map((o) => o.value);
      if (g.itemTyp && typen.includes(g.itemTyp)) $('#hbItemTyp').value = g.itemTyp;
      $('#hbSchaden').value = g.schaden || '';
      $('#hbBonus').value = g.bonus || '';
      $('#hbRk').value = g.rk || '';
      $('#hbEigen').value = g.eigenschaften || '';
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
      <h2>💾 Backup</h2>
      <div class="settings-hint">Sichert Bibliothek, Kampagnen, Homebrew und Einstellungen in einer Datei – z. B. für einen PC-Wechsel oder zur Sicherheit.</div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost" id="btnBackup">📤 Backup erstellen</button>
        <button class="btn ghost" id="btnRestore">📥 Backup wiederherstellen</button>
      </div>
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

  $('#btnBackup').addEventListener('click', async () => {
    const r = await window.api.createBackup();
    if (r.ok) toast('Backup gespeichert ✓');
  });
  $('#btnRestore').addEventListener('click', async () => {
    const r = await window.api.restoreBackup();
    if (r.ok) {
      STORE = await window.api.getAll();
      DATA.homebrew = await window.api.getHomebrew();
      SETTINGS = await window.api.getSettings();
      toast('Backup wiederhergestellt ✓');
      renderSettings();
    } else if (r.error) toast(r.error);
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
