# Brand-Assets — Wakir Labs (Phase 1)

Stand: 2026-05-03 · Verantwortlich: Comms · Zweck:
Substack-Profilbild + Cover, später Plattform-Header.
Spezifikation: `projects/comms/substack-setup.md` §4.

---

## Phase-1-Asset-Inhalt

Phase 1 = typografisches Wortmark **"Wakir Labs"**, Tufte-Stil
(Off-White-Hintergrund, schwarze Serif, kein Effekt, keine
Bildmarke). Bildmarke (Logo) frühestens Phase 2 — separate
ADR-Vorlage.

| Datei | Größe | Verwendung |
|---|---|---|
| `avatar-wakir-512-light.svg` | 512 × 512 | Substack Profilbild, Plattform Favicon-Quelle |
| `cover-wakir-labs-1500x500-light.svg` | 1500 × 500 | Substack Header-Cover |
| `avatar-wakir-512-light.png` | 512 × 512 | Build-Output (PNG, vom Engineering erzeugt) |
| `cover-wakir-labs-1500x500-light.png` | 1500 × 500 | Build-Output (PNG, vom Engineering erzeugt) |

**Aktueller Stand:** SVG-Quellen liegen vor, PNGs fehlen. Comms
hat lokal keine SVG-zu-PNG-Pipeline (kein `rsvg-convert`, kein
`inkscape`, kein `convert` im Workspace). Engineering erzeugt
die PNGs im nächsten Repo-Sprint und committet sie in dieses
Verzeichnis.

**Schrift-Provisioning (vendored, OFL):** Die SVGs erwarten
`Source Serif 4`. Im claude-dev Toolbox-Container ist die Schrift
nicht installiert und sudo-Install ist gesperrt. Lösung: wir
vendoren die OTFs in `fonts/source-serif-4/` (siehe
`fonts/README.md`). Damit ist der Render-Pfad hermetisch — kein
System-Font-State, kein Online-Service, identisches Output auf
jedem Host. Editorial-Freigabe für die einmalige Asset-Aufnahme
ist pending; bis dahin laufen die Renderer auf System-Fonts oder
Liberation-Serif-Fallback (mit `[brand-render] EXIT 2 — wrong
font` Marker, damit kein versehentlicher Commit passiert).

---

## Konvertierungs-Befehle

Beide Befehlsvarianten sind getestete Standards — Auswahl je nach
verfügbarem Build-Image. **Empfohlen:** `rsvg-convert`, weil es
minimal-deterministisch rendert und keine Headless-X11-Session
braucht.

### Variante A — `rsvg-convert` (Fedora/Debian: Paket `librsvg2-tools`)

```bash
cd public/brand

# Avatar: 512 × 512
rsvg-convert \
  --width=512 --height=512 \
  --background-color='#FAF7F0' \
  --output=avatar-wakir-512-light.png \
  avatar-wakir-512-light.svg

# Cover: 1500 × 500
rsvg-convert \
  --width=1500 --height=500 \
  --background-color='#FAF7F0' \
  --output=cover-wakir-labs-1500x500-light.png \
  cover-wakir-labs-1500x500-light.svg
```

### Variante B — `inkscape` (CLI, Inkscape ≥ 1.0)

```bash
cd public/brand

inkscape avatar-wakir-512-light.svg \
  --export-type=png \
  --export-filename=avatar-wakir-512-light.png \
  --export-width=512 --export-height=512

inkscape cover-wakir-labs-1500x500-light.svg \
  --export-type=png \
  --export-filename=cover-wakir-labs-1500x500-light.png \
  --export-width=1500 --export-height=500
```

### Variante C — `@resvg/resvg-js` (Node, kein System-Cairo nötig)

Fallback für Build-Hosts ohne `librsvg2-tools` und ohne Inkscape.
resvg-js ist eine Rust-Bindings-Bibliothek, statisch verlinkt,
keine System-Cairo-Abhängigkeit. Verwendet, wenn die anderen
Varianten am Host nicht installierbar sind (z. B. Sandbox ohne
sudo, ohne Flatpak-Zugriff).

```bash
# Einmalig, im Repo-Root oder einem Tooling-Verzeichnis:
npm install @resvg/resvg-js

# Skript zur Konvertierung (siehe scripts/render-brand-pngs.mjs
# in diesem Repo — siehe public/brand/render-pngs.sh).
node scripts/render-brand-pngs.mjs
```

Das mitgelieferte Wrapper-Skript erwartet
`adobe-source-serif-pro-fonts` (oder das frischere
`source-serif-4` Adobe-Release) als System-Schrift. Falls die
Schrift fehlt, fällt der Renderer auf Liberation Serif zurück —
lesbar, aber **nicht brand-konform**, also: nicht committen.

### Schrift-Voraussetzung

Beide SVGs referenzieren *Source Serif 4* mit Fallback auf
*Source Serif Pro* und *Georgia*. Damit das PNG das gewünschte
Schriftbild zeigt:

- Build-Maschine sollte `source-serif-4` (oder `source-serif-pro`)
  installiert haben. Auf Fedora: `dnf install adobe-source-serif-pro-fonts`.
- Andernfalls fällt der Renderer auf `Georgia` zurück — lesbar,
  aber nicht final-brand-konform. In dem Fall PNG nicht committen,
  Schrift nachinstallieren, neu rendern.

### Verifikation nach Konvertierung

- Avatar: 512 × 512, ≤ 50 KB, RGB, kein Alpha-Kanal nötig
  (Substack rendert vor Off-White ohnehin korrekt).
- Cover: 1500 × 500, ≤ 200 KB.
- Kein Anti-Aliasing-Problem an den Buchstaben-Kanten
  (rsvg-convert default reicht).

---

## Phase-2-Notiz

Sobald Bildmarke (Logo) in Phase 2 entwickelt wird, ersetzt sie
den Wortmark-Avatar. Cover bleibt typografisch, ergänzt
gegebenenfalls dezent das Logo-Element. Asset-Wechsel
vorlagepflichtig (Brand-Konsistenz, editorial review).

— Comms
