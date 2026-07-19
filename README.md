# 🐉 DnD Toolkit

Ein umfassendes, standalone D&D-5e-Toolkit für Dungeon Master unter Windows.
Dunkles Fantasy-Design, alle Daten offline mit dabei, aktualisiert sich selbst über GitHub Releases.

## Funktionen (Version 1)

- **⚒️ Händler-Generator** – erwürfelt komplette Händler mit Name, Rasse, Geschlecht, Ladenname, Persönlichkeit, Eigenheit, Stimme, Feilsch-Verhalten, Geheimnis und vollem Inventar mit Preisen. 12 Ladentypen (Schmiede, Alchemist, Juwelier, Kuriositätenladen …), 4 Qualitätsstufen mit magischen Items je nach Seltenheit. Jedes Detail einzeln neu würfelbar, Items lassen sich entfernen oder eigene hinzufügen.
- **📜 Bibliothek** – jede Kreation lässt sich speichern, durchsuchen, wieder öffnen und weiterbearbeiten.
- **✒️ Notizen** – freie Kampagnen-Notizen, plus eigene Notizen direkt an jedem Händler.
- **📖 Kompendium** *(neu in 1.1)* – 2.824 Monster und 1.742 magische Gegenstände durchsuchbar, mit vollständigen Statblöcken. Quellen: SRD 5.1, Tome of Beasts 1–3, Creature Codex, Monstrous Menagerie, Black Flag, Vault of Magic, Level Up (A5E), Tome of Heroes – alles frei lizenziert (Details in `data/LICENSE-SRD.md`).
- **🧪 Homebrew-Editor** *(neu in 1.1)* – eigene Monster und Items anlegen, im- und exportieren. Homebrew-Items können Händler-Inventaren zugeordnet werden. Alles bleibt lokal auf deinem PC (`%APPDATA%/dnd-toolkit/homebrew.json`) und landet nicht im Repo.
- **🤖 KI-Assistent** *(neu in 1.2)* – generiert Homebrew-Items und -Monster aus einer kurzen Beschreibung. Unterstützt Google Gemini (kostenloses Kontingent), OpenAI und Anthropic Claude. API-Schlüssel werden in den Einstellungen hinterlegt und bleiben lokal.
- **Offline-Daten** – alle Spieldaten sind mitgeliefert, nur der optionale KI-Assistent braucht Internet.

- **⚔️ Encounter-Generator** *(neu in 1.3)* – ausbalancierte Begegnungen nach dem offiziellen XP-Budget-System: Gruppengröße, Stufe und Schwierigkeit wählen, fertig. Verschiedene Zusammensetzungen (Einzelgegner, Gruppen, Boss mit Begleitern), Filter nach Monstertyp und Quelle, jedes Monster austauschbar, Anzahl anpassbar, Statblock per Klick, speicherbar mit Notizen.

### Roadmap

- **V3: 🏰 Städte-Generator** – Städte mit Läden, Tavernen, NPCs und Gerüchten
- Danach: NPC-Generator, Loot-Generator, Tavernen-Generator

---

## Einmalige Einrichtung auf GitHub

Du hast schon einen GitHub-Account – dann geht es so:

1. **Repo erstellen:** Auf github.com → oben rechts **+** → *New repository* → Name: `dnd-toolkit` → *Public* → **Create repository** (keine Haken bei README etc. setzen).

2. **GitHub-Namen eintragen:** In `package.json` unten bei `"publish"` den Platzhalter `DEIN_GITHUB_NAME` durch deinen GitHub-Benutzernamen ersetzen. Das braucht das Auto-Update, um deine Releases zu finden.

3. **Hochladen:** [Git für Windows](https://git-scm.com/download/win) installieren, dann in diesem Ordner eine Eingabeaufforderung öffnen (im Explorer in die Adresszeile `cmd` tippen) und:

   ```
   git init
   git add .
   git commit -m "DnD Toolkit v1.0.0"
   git branch -M main
   git remote add origin https://github.com/DEIN_GITHUB_NAME/dnd-toolkit.git
   git push -u origin main
   ```

## Ein Release veröffentlichen (baut den Windows-Installer automatisch)

Der Installer wird **nicht auf deinem PC gebaut**, sondern von GitHub Actions. Du musst nur einen Versions-Tag pushen:

```
git tag v1.0.0
git push origin v1.0.0
```

GitHub baut dann (dauert ~5 Min., sichtbar im Repo unter *Actions*) und legt unter *Releases* automatisch die Installer-Datei `DnD Toolkit Setup 1.0.0.exe` ab. Die lädst du herunter und installierst sie – fertig.

## Updates veröffentlichen

1. Änderungen machen (oder machen lassen 🙂)
2. In `package.json` die `"version"` erhöhen, z. B. auf `1.1.0`
3. Committen, pushen und neu taggen:

   ```
   git add .
   git commit -m "Version 1.1.0"
   git push
   git tag v1.1.0
   git push origin v1.1.0
   ```

Die installierte App prüft bei jedem Start die GitHub Releases, lädt neue Versionen im Hintergrund und installiert sie beim nächsten Beenden. **Nichts weiter nötig.**

---

## Entwicklung (App lokal starten ohne Installer)

Voraussetzung: [Node.js](https://nodejs.org) (LTS). Dann im Projektordner:

```
npm install
npm start
```

### Projektstruktur

```
main.js               Electron-Hauptprozess (Fenster, Speicher, Auto-Update)
preload.js            Sichere Brücke zwischen App-Logik und System
renderer/             Oberfläche (HTML/CSS/JS)
  js/generator.js     Händler-Generator-Logik (DOM-frei, testbar)
  js/app.js           Views: Händler, Bibliothek, Notizen
data/                 Alle Spieldaten (offline)
  equipment.json      SRD-Ausrüstung (aufbereitet)
  magic-items.json    SRD magische Gegenstände
  monsters.json       SRD-Monster (für den Encounter-Generator, V2)
  names.json          Namenstabellen pro Rasse (eigene Kreation)
  tables.json         Ladentypen, Persönlichkeiten, Eigenheiten … (eigene Kreation)
.github/workflows/    Automatischer Windows-Build bei Versions-Tags
```

Gespeicherte Händler und Notizen liegen in `%APPDATA%/dnd-toolkit/bibliothek.json` – sie überleben Updates und Neuinstallationen.

## Lizenz

Eigener Code: MIT. Spieldaten: SRD 5.1 von Wizards of the Coast, [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) – Details in `data/LICENSE-SRD.md`.
