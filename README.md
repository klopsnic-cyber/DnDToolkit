# 🐉 DnD Toolkit

Ein umfassendes, standalone D&D-5e-Toolkit für Dungeon Master unter Windows.
Dunkles Fantasy-Design, alle Daten offline mit dabei, aktualisiert sich selbst über GitHub Releases.

## Funktionen (Version 1)

- **⚒️ Händler-Generator** – erwürfelt komplette Händler mit Name, Rasse, Geschlecht, Ladenname, Persönlichkeit, Eigenheit, Stimme, Feilsch-Verhalten, Geheimnis und vollem Inventar mit Preisen. 12 Ladentypen (Schmiede, Alchemist, Juwelier, Kuriositätenladen …), 4 Qualitätsstufen mit magischen Items je nach Seltenheit. Jedes Detail einzeln neu würfelbar, Items lassen sich entfernen oder eigene hinzufügen.
- **📜 Bibliothek** – jede Kreation lässt sich speichern, durchsuchen, wieder öffnen und weiterbearbeiten.
- **✒️ Notizen** – freie Kampagnen-Notizen, plus eigene Notizen direkt an jedem Händler.
- **Offline-Daten** – komplettes SRD 5.1 (Ausrüstung, magische Gegenstände, Monster) ist mitgeliefert, keine Internetverbindung nötig.

### Roadmap

- **V2: ⚔️ Encounter-Generator** – ausbalancierte Begegnungen nach Party-Level und XP-Budget (Monsterdaten sind bereits an Bord)
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
