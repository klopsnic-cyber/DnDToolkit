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

  root.Generator = { generateMerchant, reroll, fmtPrice, toCopper, pickInventory };
})(typeof window !== 'undefined' ? window : module.exports);
