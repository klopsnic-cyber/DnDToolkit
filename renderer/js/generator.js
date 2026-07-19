// ============================================================
// Händler-Generator – reine Logik, kein DOM
// Wird auch von den Node-Tests verwendet.
// ============================================================
(function (root) {
  'use strict';

  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rndInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const chance = (p) => Math.random() < p;

  // Preis-String ("50 gp") oder cost-Objekt {q, unit} → Kupferwert
  function toCopper(cost) {
    if (!cost) return 0;
    if (typeof cost === 'string') {
      const m = cost.match(/([\d.]+)\s*(cp|sp|gp|pp)/i);
      if (!m) return 0;
      cost = { q: parseFloat(m[1]), unit: m[2].toLowerCase() };
    }
    const mult = { cp: 1, sp: 10, gp: 100, pp: 1000 }[cost.unit] || 100;
    return cost.q * mult;
  }

  // Kupferwert → hübscher Preis-String
  function fmtPrice(copper) {
    if (copper <= 0) return '—';
    if (copper >= 100 && copper % 100 === 0) return (copper / 100) + ' GM';
    if (copper >= 100) return (copper / 100).toFixed(1).replace('.', ',') + ' GM';
    if (copper >= 10) return Math.round(copper / 10) + ' SM';
    return Math.round(copper) + ' KM';
  }

  // Preisrichtwerte für magische Items nach Seltenheit (DMG-Richtwerte)
  const RARITY_PRICE = {
    'Common': [50, 100],
    'Uncommon': [101, 500],
    'Rare': [501, 5000],
    'Very Rare': [5001, 50000],
    'Legendary': [50001, 200000]
  };

  function magicPrice(rarity) {
    const range = RARITY_PRICE[rarity] || [50, 100];
    // auf "schöne" Werte runden
    const gp = rndInt(range[0], range[1]);
    const step = gp > 1000 ? 100 : gp > 100 ? 25 : 5;
    return Math.round(gp / step) * step * 100; // in Kupfer
  }

  function filterEquipment(equipment, filter) {
    if (!filter) return [];
    return equipment.filter((e) => {
      if (filter.cat && filter.cat.includes(e.cat)) return true;
      if (filter.gearCat && filter.gearCat.includes(e.gearCat)) return true;
      if (filter.toolCat && filter.toolCat.includes(e.toolCat)) return true;
      return false;
    });
  }

  function pickInventory(data, laden, qualitaet) {
    const items = [];
    const seen = new Set();
    const [minN, maxN] = laden.anzahl;
    const n = rndInt(minN, maxN);

    // Basis-Pool: SRD-Equipment oder eigene Item-Liste
    let pool = [];
    if (laden.custom) {
      pool = (data.tables.customItems[laden.custom] || []).map((c) => ({
        name: c.name, desc: c.desc, basisKupfer: toCopper(c.preis), typ: 'custom'
      }));
    }
    if (laden.filter) {
      pool = pool.concat(filterEquipment(data.equipment, laden.filter).map((e) => ({
        name: e.name,
        desc: e.desc || (e.dmg ? 'Schaden: ' + e.dmg : null),
        basisKupfer: toCopper(e.cost),
        typ: 'srd'
      })));
    }
    pool = pool.filter((p) => p.basisKupfer > 0);

    while (items.length < n && seen.size < pool.length) {
      const it = rnd(pool);
      if (seen.has(it.name)) continue;
      seen.add(it.name);
      const preis = Math.max(1, Math.round(it.basisKupfer * qualitaet.preisFaktor * (0.9 + Math.random() * 0.25)));
      items.push({
        name: it.name, desc: it.desc, typ: it.typ,
        preisKupfer: preis, preis: fmtPrice(preis),
        anzahl: it.basisKupfer < 500 ? rndInt(1, 5) : 1
      });
    }

    // Homebrew-Items, die diesem Ladentyp zugeordnet sind
    const hbPool = ((data.homebrew && data.homebrew.items) || []).filter(
      (h) => h.laden === laden.id || h.laden === 'alle'
    );
    const hbN = Math.min(hbPool.length, rndInt(0, 2));
    for (let i = 0; i < hbN; i++) {
      const h = rnd(hbPool);
      if (seen.has(h.name)) continue;
      seen.add(h.name);
      const preis = toCopper(h.preis || '0 gp');
      items.push({
        name: h.name, desc: h.desc || null, typ: 'homebrew',
        raritaet: h.rarity || null,
        preisKupfer: preis, preis: fmtPrice(preis), anzahl: 1
      });
    }

    // Magische Items je nach Qualität & Ladentyp
    const magieAnzahl = laden.extraMagie
      ? rndInt(1, laden.extraMagie)
      : (chance(qualitaet.magieChance) ? rndInt(1, 2) : 0);

    if (magieAnzahl > 0 && qualitaet.raritaeten.length) {
      let mPool = data.magicItems.filter((m) => qualitaet.raritaeten.includes(m.rarity));
      if (laden.extraMagieKat) mPool = mPool.filter((m) => m.cat === laden.extraMagieKat);
      if (laden.id === 'magie') mPool = mPool.filter((m) => ['scroll', 'wand', 'rod', 'staff', 'wondrous-items', 'ring', 'potion'].includes(m.cat));
      for (let i = 0; i < magieAnzahl && mPool.length; i++) {
        const m = rnd(mPool);
        if (seen.has(m.name)) continue;
        seen.add(m.name);
        const preis = magicPrice(m.rarity);
        items.push({
          name: m.name, desc: m.desc ? m.desc.split('\n').slice(0, 3).join(' ') : null,
          typ: 'magie', raritaet: m.rarity,
          preisKupfer: preis, preis: fmtPrice(preis), anzahl: 1
        });
      }
    }

    items.sort((a, b) => (a.typ === 'magie' ? 1 : 0) - (b.typ === 'magie' ? 1 : 0) || a.preisKupfer - b.preisKupfer);
    return items;
  }

  function genName(names, rasseId, geschlecht) {
    const r = names[rasseId];
    const vor = rnd(geschlecht === 'f' ? r.f : r.m);
    const nach = rnd(r.nach);
    return vor + ' ' + nach;
  }

  function genLadenName(t) {
    const fem = chance(0.5);
    const suffix = rnd(fem ? t.ladenName.suffixF : t.ladenName.suffixM);
    let praefix = rnd(t.ladenName.praefix);
    // Grammatik: "Zum" + maskulin, "Zur" + feminin
    if (fem && praefix.startsWith('Zum ')) praefix = praefix.replace(/^Zum /, 'Zur ').replace(/en$/, 'e');
    if (!fem && praefix.startsWith('Zur ')) praefix = praefix.replace(/^Zur /, 'Zum ').replace(/e$/, 'en');
    return praefix + ' ' + suffix;
  }

  // opts: { rasse, geschlecht, ladenTyp, qualitaet } – alles optional (sonst zufällig)
  function generateMerchant(data, opts = {}) {
    const t = data.tables;
    const rasseId = opts.rasse || rnd(Object.keys(data.names));
    const geschlecht = opts.geschlecht || (chance(0.5) ? 'm' : 'f');
    const laden = opts.ladenTyp
      ? t.laeden.find((l) => l.id === opts.ladenTyp)
      : rnd(t.laeden);
    const qualitaet = opts.qualitaet
      ? t.qualitaet.find((q) => q.id === opts.qualitaet)
      : rnd(t.qualitaet);

    return {
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      type: 'haendler',
      createdAt: new Date().toISOString(),
      name: genName(data.names, rasseId, geschlecht),
      rasse: rasseId,
      rasseLabel: data.names[rasseId].label,
      geschlecht,
      ladenTyp: laden.id,
      ladenLabel: laden.label,
      ladenIcon: laden.icon,
      ladenName: genLadenName(t),
      qualitaet: qualitaet.id,
      qualitaetLabel: qualitaet.label,
      persoenlichkeit: rnd(t.persoenlichkeit),
      eigenheit: rnd(t.eigenheit),
      stimme: rnd(t.stimme),
      feilschen: rnd(t.feilschen),
      geheimnis: rnd(t.geheimnis),
      inventar: pickInventory(data, laden, qualitaet),
      notizen: ''
    };
  }

  // Einzelne Aspekte neu würfeln
  const reroll = {
    name: (data, m) => { m.name = genName(data.names, m.rasse, m.geschlecht); return m; },
    ladenName: (data, m) => { m.ladenName = genLadenName(data.tables); return m; },
    persoenlichkeit: (data, m) => { m.persoenlichkeit = rnd(data.tables.persoenlichkeit); return m; },
    eigenheit: (data, m) => { m.eigenheit = rnd(data.tables.eigenheit); return m; },
    stimme: (data, m) => { m.stimme = rnd(data.tables.stimme); return m; },
    feilschen: (data, m) => { m.feilschen = rnd(data.tables.feilschen); return m; },
    geheimnis: (data, m) => { m.geheimnis = rnd(data.tables.geheimnis); return m; },
    inventar: (data, m) => {
      const laden = data.tables.laeden.find((l) => l.id === m.ladenTyp);
      const q = data.tables.qualitaet.find((x) => x.id === m.qualitaet);
      m.inventar = pickInventory(data, laden, q);
      return m;
    }
  };

  // ============================================================
  // Encounter-Generator (DMG-XP-Budget-System)
  // ============================================================

  // XP-Schwellen pro Charakter und Stufe: [leicht, mittel, schwer, tödlich]
  const THRESHOLDS = {
    1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500],
    5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100],
    9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
    13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400], 16: [1600, 3200, 4800, 7200],
    17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500], 19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700]
  };
  const DIFF_INDEX = { leicht: 0, mittel: 1, schwer: 2, toedlich: 3 };
  const DIFF_LABEL = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer', toedlich: 'Tödlich' };

  const XP_BY_CR = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000 };

  function monsterXp(m) {
    return m.xp || XP_BY_CR[String(m.cr || '').trim()] || 0;
  }

  // Multiplikator nach Monsteranzahl, angepasst an Gruppengröße (DMG)
  const MULT_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 4];
  function encMultiplier(count, partySize) {
    let idx = count >= 15 ? 6 : count >= 11 ? 5 : count >= 7 ? 4 : count >= 3 ? 3 : count === 2 ? 2 : 1;
    if (partySize < 3) idx = Math.min(6, idx + 1);
    if (partySize >= 6) idx = Math.max(0, idx - 1);
    return MULT_STEPS[idx];
  }

  function encounterPool(data, opts) {
    let pool = data.monsters.slice();
    if (data.homebrew && data.homebrew.monsters) {
      pool = pool.concat(data.homebrew.monsters.map((h) => ({ ...h, src: 'Homebrew', index: h.id })));
    }
    pool = pool.filter((m) => monsterXp(m) > 0);
    if (opts.typ) pool = pool.filter((m) => (m.type || '').toLowerCase().includes(opts.typ.toLowerCase()));
    if (opts.quelle) pool = pool.filter((m) => m.src === opts.quelle);
    return pool;
  }

  function summarize(groups, partySize, budget) {
    const totalXP = groups.reduce((s, g) => s + g.xp * g.count, 0);
    const totalCount = groups.reduce((s, g) => s + g.count, 0);
    const adjXP = Math.round(totalXP * encMultiplier(totalCount, partySize));
    return { totalXP, totalCount, adjXP, abweichung: Math.abs(adjXP - budget) / budget };
  }

  function verdict(adjXP, level, partySize) {
    const t = THRESHOLDS[level];
    if (adjXP >= t[3] * partySize) return 'Tödlich';
    if (adjXP >= t[2] * partySize) return 'Schwer';
    if (adjXP >= t[1] * partySize) return 'Mittel';
    if (adjXP >= t[0] * partySize) return 'Leicht';
    return 'Trivial';
  }

  // opts: { stufe, gruppe, schwierigkeit ('leicht'|'mittel'|'schwer'|'toedlich'), typ?, quelle? }
  function generateEncounter(data, opts) {
    const stufe = Math.min(20, Math.max(1, opts.stufe || 3));
    const gruppe = Math.min(10, Math.max(1, opts.gruppe || 4));
    const diff = opts.schwierigkeit || 'mittel';
    const budget = THRESHOLDS[stufe][DIFF_INDEX[diff]] * gruppe;
    const pool = encounterPool(data, opts);
    if (!pool.length) return null;

    const strategies = ['solo', 'paar', 'gruppe', 'horde', 'boss'];
    let best = null;

    for (let attempt = 0; attempt < 80; attempt++) {
      const strat = strategies[Math.floor(Math.random() * strategies.length)];
      let groups = [];

      if (strat === 'solo') {
        const target = budget / encMultiplier(1, gruppe);
        const c = pool.filter((m) => { const x = monsterXp(m); return x >= target * 0.65 && x <= target * 1.15; });
        if (!c.length) continue;
        groups = [{ m: rnd(c), count: 1 }];
      } else if (strat === 'paar') {
        const target = budget / encMultiplier(2, gruppe) / 2;
        const c = pool.filter((m) => { const x = monsterXp(m); return x >= target * 0.6 && x <= target * 1.2; });
        if (!c.length) continue;
        groups = [{ m: rnd(c), count: 2 }];
      } else if (strat === 'gruppe' || strat === 'horde') {
        const n = strat === 'gruppe' ? rndInt(3, 6) : rndInt(7, 12);
        const target = budget / encMultiplier(n, gruppe) / n;
        const c = pool.filter((m) => { const x = monsterXp(m); return x >= target * 0.55 && x <= target * 1.3; });
        if (!c.length) continue;
        groups = [{ m: rnd(c), count: n }];
      } else {
        // Boss + Begleiter
        const nAdds = rndInt(2, 5);
        const mult = encMultiplier(1 + nAdds, gruppe);
        const bossTarget = (budget / mult) * (0.55 + Math.random() * 0.2);
        const bc = pool.filter((m) => { const x = monsterXp(m); return x >= bossTarget * 0.7 && x <= bossTarget * 1.2; });
        if (!bc.length) continue;
        const boss = rnd(bc);
        const rest = Math.max(0, budget / mult - monsterXp(boss));
        const addTarget = rest / nAdds;
        const ac2 = pool.filter((m) => { const x = monsterXp(m); return x >= addTarget * 0.4 && x <= addTarget * 1.3 && m.index !== boss.index; });
        if (!ac2.length) continue;
        groups = [{ m: boss, count: 1 }, { m: rnd(ac2), count: nAdds }];
      }

      const gs = groups.map((g) => ({
        index: g.m.index, name: g.m.name, cr: g.m.cr, xp: monsterXp(g.m),
        type: g.m.type, src: g.m.src, count: g.count
      }));
      const sum = summarize(gs, gruppe, budget);
      if (!best || sum.abweichung < best.sum.abweichung) best = { gs, sum };
      if (sum.abweichung <= 0.12) break;
    }
    if (!best) return null;

    return {
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      type: 'encounter',
      createdAt: new Date().toISOString(),
      name: 'Stufe ' + stufe + ' · ' + DIFF_LABEL[diff] + ' · ' + best.sum.totalCount + ' Monster',
      stufe, gruppe, schwierigkeit: diff,
      budget,
      monster: best.gs,
      totalXP: best.sum.totalXP,
      adjXP: best.sum.adjXP,
      urteil: verdict(best.sum.adjXP, stufe, gruppe),
      notizen: ''
    };
  }

  // Encounter nach Änderung (Anzahl/entfernen/ersetzen) neu durchrechnen
  function recalcEncounter(enc) {
    const sum = summarize(enc.monster, enc.gruppe, enc.budget);
    enc.totalXP = sum.totalXP;
    enc.adjXP = sum.adjXP;
    enc.urteil = verdict(sum.adjXP, enc.stufe, enc.gruppe);
    enc.name = 'Stufe ' + enc.stufe + ' · ' + DIFF_LABEL[enc.schwierigkeit] + ' · ' + sum.totalCount + ' Monster';
    return enc;
  }

  // Eine Monstergruppe durch ein ähnlich starkes Monster ersetzen
  function swapMonster(data, enc, gi, opts) {
    const g = enc.monster[gi];
    if (!g) return enc;
    const pool = encounterPool(data, opts || {}).filter(
      (m) => m.index !== g.index && monsterXp(m) >= g.xp * 0.6 && monsterXp(m) <= g.xp * 1.4
    );
    if (!pool.length) return enc;
    const m = rnd(pool);
    enc.monster[gi] = { index: m.index, name: m.name, cr: m.cr, xp: monsterXp(m), type: m.type, src: m.src, count: g.count };
    return recalcEncounter(enc);
  }

  // ============================================================
  // Städte-Generator
  // ============================================================
  function genPersonName(names) {
    const rasseId = rnd(Object.keys(names));
    const geschlecht = chance(0.5) ? 'm' : 'f';
    return { name: genName(names, rasseId, geschlecht), rasse: names[rasseId].label, geschlecht };
  }

  function genTaverne(data) {
    const st = data.tables.stadt;
    const fem = chance(0.5);
    let praefix = rnd(st.tavernenName.praefix);
    if (fem && praefix.startsWith('Zum ')) praefix = praefix.replace(/^Zum /, 'Zur ').replace(/en$/, 'e');
    if (!fem && praefix.startsWith('Zur ')) praefix = praefix.replace(/^Zur /, 'Zum ').replace(/e$/, 'en');
    const wirt = genPersonName(data.names);
    return {
      name: praefix + ' ' + rnd(fem ? st.tavernenName.suffixF : st.tavernenName.suffixM),
      wirt: wirt.name + ' (' + wirt.rasse + ')',
      gericht: rnd(st.tavernenGericht),
      besonderheit: rnd(st.tavernenBesonderheit),
      geruecht: rnd(st.geruechte)
    };
  }

  function genCityName(st) {
    for (let i = 0; i < 10; i++) {
      const p = rnd(st.namePraefix), s = rnd(st.nameSuffix);
      if (!p.toLowerCase().includes(s) && !s.includes(p.toLowerCase())) return p + s;
    }
    return rnd(st.namePraefix) + rnd(st.nameSuffix);
  }

  // opts: { groesse? }
  function generateCity(data, opts = {}) {
    const st = data.tables.stadt;
    const groesse = opts.groesse
      ? st.groessen.find((g) => g.id === opts.groesse)
      : rnd(st.groessen);

    const nLaeden = rndInt(groesse.laeden[0], groesse.laeden[1]);
    // Ladentypen möglichst nicht doppelt
    const typen = data.tables.laeden.slice().sort(() => Math.random() - 0.5);
    const laeden = [];
    for (let i = 0; i < nLaeden; i++) {
      const typ = typen[i % typen.length];
      laeden.push(generateMerchant(data, { ladenTyp: typ.id }));
    }

    const tavernen = Array.from({ length: groesse.tavernen }, () => genTaverne(data));

    const aemter = st.aemter.slice().sort(() => Math.random() - 0.5).slice(0, groesse.npcs);
    const npcs = aemter.map((amt) => {
      const p = genPersonName(data.names);
      return { amt, name: p.name, rasse: p.rasse, wesen: rnd(data.tables.persoenlichkeit), eigenheit: rnd(data.tables.eigenheit) };
    });

    const geruechte = st.geruechte.slice().sort(() => Math.random() - 0.5).slice(0, 3);

    return {
      id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      type: 'stadt',
      createdAt: new Date().toISOString(),
      name: genCityName(st),
      groesse: groesse.id,
      groesseLabel: groesse.label,
      einwohner: rndInt(groesse.einwohner[0], groesse.einwohner[1]),
      regierung: rnd(st.regierung),
      merkmal: rnd(st.merkmal),
      verteidigung: rnd(st.verteidigung),
      laeden, tavernen, npcs, geruechte,
      notizen: ''
    };
  }

  const cityReroll = {
    name: (data, s) => { s.name = genCityName(data.tables.stadt); return s; },
    regierung: (data, s) => { s.regierung = rnd(data.tables.stadt.regierung); return s; },
    merkmal: (data, s) => { s.merkmal = rnd(data.tables.stadt.merkmal); return s; },
    verteidigung: (data, s) => { s.verteidigung = rnd(data.tables.stadt.verteidigung); return s; },
    geruechte: (data, s) => { s.geruechte = data.tables.stadt.geruechte.slice().sort(() => Math.random() - 0.5).slice(0, 3); return s; }
  };

  root.Generator = {
    generateMerchant, reroll, fmtPrice, toCopper, pickInventory,
    generateEncounter, recalcEncounter, swapMonster, monsterXp,
    generateCity, cityReroll, genTaverne,
    THRESHOLDS, DIFF_LABEL
  };
})(typeof window !== 'undefined' ? window : module.exports);
