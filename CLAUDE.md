# Projektnotizen für Claude

## Arbeitsweise mit Nic

- **Bei Konsolenbefehlen IMMER den Ordnerwechsel voranstellen.** Nics Eingabeaufforderung startet in `C:\Windows\System32`. Jeder Befehlsblock muss mit `cd /d C:\Users\nic\Desktop\DnDtoolkit` beginnen — niemals nur die nackten Git-Befehle angeben.
- Antworten auf Deutsch, knapp und direkt.

## Projekt

DnD Toolkit – Electron-App für Dungeon Master, Windows.
Repo: https://github.com/klopsnic-cyber/DnDToolkit (öffentlich)

### Release-Ablauf

```
cd /d C:\Users\nic\Desktop\DnDtoolkit
git add .
git commit -m "Version X.Y.Z - Beschreibung"
git push
git tag vX.Y.Z
git push origin vX.Y.Z
```

Version vorher in `package.json` erhöhen. GitHub Actions baut den Installer automatisch, Auto-Update greift danach.

### Tests

UI-Tests laufen mit jsdom gegen `renderer/`. Vor jedem Release ausführen und alle Views prüfen.
