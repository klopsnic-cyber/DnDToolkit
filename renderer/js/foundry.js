// ============================================================
// Foundry-VTT-Export (dnd5e-System) – reine Logik, testbar
// Import in Foundry: Akteur/Item anlegen → Rechtsklick → "Import Data"
// ============================================================
(function (root) {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const p = (s) => (s ? '<p>' + esc(s) + '</p>' : '');

  const SIZE_MAP = { Tiny: 'tiny', Small: 'sm', Medium: 'med', Large: 'lg', Huge: 'huge', Gargantuan: 'grg' };
  const RARITY_MAP = { Common: 'common', Uncommon: 'uncommon', Rare: 'rare', 'Very Rare': 'veryRare', Legendary: 'legendary', Artifact: 'artifact' };

  function crToNumber(cr) {
    const s = String(cr || '0').trim();
    if (s.includes('/')) { const [a, b] = s.split('/'); return parseFloat(a) / parseFloat(b); }
    return parseFloat(s) || 0;
  }

  function parseSpeed(str) {
    const out = { units: 'ft' };
    if (!str) return { walk: 30, units: 'ft' };
    const re = /(walk|fly|swim|climb|burrow|hover)\s*(\d+)?/gi;
    let m, found = false;
    while ((m = re.exec(str))) {
      const art = m[1].toLowerCase();
      if (art === 'hover') { out.hover = true; continue; }
      if (m[2]) { out[art] = parseInt(m[2]); found = true; }
    }
    // Falls nur eine nackte Zahl drinsteht ("30 ft.")
    if (!found) { const n = str.match(/(\d+)/); if (n) out.walk = parseInt(n[1]); }
    return out;
  }

  function abilityBlock(m) {
    const val = (v) => ({ value: parseInt(v) || 10 });
    return {
      str: val(m.str), dex: val(m.dex), con: val(m.con),
      int: val(m.int), wis: val(m.wis), cha: val(m.cha)
    };
  }

  function actionsAsItems(m) {
    const items = [];
    const add = (arr, prefix) => (arr || []).forEach((a) => {
      if (!a || !a.name) return;
      items.push({
        name: (prefix ? prefix + ': ' : '') + a.name,
        type: 'feat',
        img: 'icons/svg/combat.svg',
        system: { description: { value: p(a.desc) } }
      });
    });
    add(m.traits, '');
    add(m.actions, '');
    add(m.legendary, 'Legendär');
    return items;
  }

  function statblockHtml(m) {
    let h = '';
    if (m.senses) h += p('Sinne: ' + m.senses);
    if (m.langs) h += p('Sprachen: ' + m.langs);
    if (m.imm) h += p('Schadensimmunitäten: ' + m.imm);
    if (m.res) h += p('Resistenzen: ' + m.res);
    if (m.vul) h += p('Verwundbarkeiten: ' + m.vul);
    if (m.condImm) h += p('Zustandsimmunitäten: ' + m.condImm);
    if (m.text) h += p(m.text);
    h += p('Quelle: ' + (m.src || 'DnD Toolkit'));
    return h;
  }

  function monsterToFoundry(m) {
    return {
      name: m.name,
      type: 'npc',
      img: 'icons/svg/mystery-man.svg',
      system: {
        abilities: abilityBlock(m),
        attributes: {
          ac: { flat: parseInt(m.ac) || 10, calc: 'flat' },
          hp: { value: parseInt(m.hp) || 1, max: parseInt(m.hp) || 1, formula: m.hd || '' },
          movement: parseSpeed(m.speed)
        },
        details: {
          type: { value: 'custom', custom: m.type || '' },
          cr: crToNumber(m.cr),
          xp: { value: m.xp || 0 },
          alignment: m.align || '',
          biography: { value: statblockHtml(m) }
        },
        traits: { size: SIZE_MAP[m.size] || 'med' }
      },
      items: actionsAsItems(m),
      prototypeToken: { name: m.name }
    };
  }

  function priceGp(it) {
    if (it.preisKupfer) return Math.round(it.preisKupfer / 100 * 100) / 100;
    const m = String(it.preis || '').match(/([\d.,]+)\s*(gp|GM)?/i);
    return m ? parseFloat(m[1].replace(',', '.')) : 0;
  }

  function itemDescription(it) {
    let h = '';
    if (it.itemTyp) h += p('Typ: ' + it.itemTyp);
    if (it.schaden) h += p('Schaden: ' + it.schaden + (it.bonus ? ' (' + it.bonus + ' auf Angriff und Schaden)' : ''));
    else if (it.bonus) h += p('Bonus: ' + it.bonus);
    if (it.rk) h += p('Rüstungsklasse: ' + it.rk);
    if (it.eigenschaften) h += p('Eigenschaften: ' + it.eigenschaften);
    if (it.attune) h += p('Erfordert Einstimmung.');
    if (it.desc) h += p(it.desc);
    if (it.raritaet || it.rarity) h += p('Seltenheit: ' + (it.raritaet || it.rarity));
    return h;
  }

  function itemToFoundry(it) {
    const isWeapon = !!it.schaden || it.itemTyp === 'Waffe';
    const isConsumable = ['Trank', 'Schriftrolle', 'Munition'].includes(it.itemTyp) || it.cat === 'potion' || it.cat === 'scroll';
    const type = isWeapon ? 'weapon' : isConsumable ? 'consumable' : 'loot';

    const sys = {
      description: { value: itemDescription(it) },
      quantity: it.anzahl || 1,
      rarity: RARITY_MAP[it.rarity || it.raritaet] || '',
      price: { value: priceGp(it), denomination: 'gp' }
    };

    if (isWeapon) {
      const dice = String(it.schaden || '').match(/\d+[dw]\d+(\s*[+-]\s*\d+)?/i);
      sys.damage = { parts: dice ? [[dice[0].replace(/w/i, 'd'), '']] : [] };
      if (it.bonus) {
        const b = parseInt(String(it.bonus).replace('+', ''));
        if (b) sys.magicalBonus = b;
      }
      sys.properties = ['mgc'];
    }
    if (isConsumable) sys.type = { value: it.itemTyp === 'Schriftrolle' ? 'scroll' : 'potion' };

    return {
      name: it.name,
      type,
      img: isWeapon ? 'icons/svg/sword.svg' : isConsumable ? 'icons/svg/tankard.svg' : 'icons/svg/item-bag.svg',
      system: sys
    };
  }

  function merchantToFoundry(m) {
    let bio = '';
    bio += p('„' + m.ladenName + '" – ' + m.ladenLabel + ' (' + m.qualitaetLabel + ')');
    bio += p('Inhaber: ' + m.name + ' (' + m.rasseLabel + ', ' + (m.geschlecht === 'f' ? 'weiblich' : 'männlich') + ')');
    bio += p('Wesen: ' + m.persoenlichkeit);
    bio += p('Eigenheit: ' + m.eigenheit);
    bio += p('Stimme: ' + m.stimme);
    bio += p('Feilschen: ' + m.feilschen.label + ' (' + m.feilschen.mod + ')');
    bio += p('Geheimnis: ' + m.geheimnis);
    if (m.notizen) bio += p('Notizen: ' + m.notizen);

    return {
      name: m.name + ' (' + m.ladenLabel + ')',
      type: 'npc',
      img: 'icons/svg/mystery-man.svg',
      system: {
        abilities: abilityBlock({}),
        attributes: { ac: { flat: 10, calc: 'flat' }, hp: { value: 4, max: 4, formula: '1d8' }, movement: { walk: 30, units: 'ft' } },
        details: {
          type: { value: 'custom', custom: 'Humanoider (' + m.rasseLabel + ')' },
          cr: 0,
          alignment: '',
          biography: { value: bio }
        },
        traits: { size: 'med' }
      },
      items: m.inventar.map((it) => itemToFoundry(it)),
      prototypeToken: { name: m.name }
    };
  }

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '');

  root.Foundry = { monsterToFoundry, itemToFoundry, merchantToFoundry, slug, crToNumber, parseSpeed };
})(typeof window !== 'undefined' ? window : module.exports);
