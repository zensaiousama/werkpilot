# 🌙 WERKPILOT — Complete Overnight Build Package

## Was ist das?
Ein einziger Befehl baut über Nacht dein **komplettes Business-System**:
- ✅ Website (werkpilot.ch) — Lighthouse 100/100
- ✅ Sales & Conversion Optimierung (Cialdini, A/B-Tests, Heatmaps)
- ✅ 42 AI Agents + 1 Orchestrator (9 Departments)
- ✅ Management Dashboard + CRM mit echtem Google Maps Scraping

---

## 🚀 Quick Start (3 Schritte)

### Schritt 1: Vorbereitung (einmalig, 5 Min)
```bash
# Claude Code installieren
npm install -g @anthropic-ai/claude-code

# API Key setzen
export ANTHROPIC_API_KEY="dein-key-hier"
```

### Schritt 2: Dateien platzieren
```bash
# Erstelle den Werkpilot-Ordner
mkdir -p ~/Downloads/werkpilot/prompts

# Kopiere ALLE Dateien aus diesem Paket nach ~/Downloads/werkpilot/
# - run-overnight.sh → ~/Downloads/werkpilot/run-overnight.sh
# - prompts/*.md     → ~/Downloads/werkpilot/prompts/
```

### Schritt 3: Starten und schlafen gehen 🌙
```bash
cd ~/Downloads/werkpilot
chmod +x run-overnight.sh
./run-overnight.sh
```

**Das war's. Geh schlafen.** Morgen früh hast du alles.

---

## 📁 Dateistruktur

```
werkpilot/
├── run-overnight.sh                    ← DAS startest du
├── prompts/
│   ├── 01-WEBSITE-BUILD.md             ← Phase 1: Komplette Website
│   ├── 02-CONVERSION-OPTIMIZATION.md   ← Phase 2: Sales-Psychologie
│   ├── 03-ALL-42-AGENT-PROMPTS.md      ← Phase 3: 42 AI Agents
│   └── 04-MANAGEMENT-DASHBOARD.md      ← Phase 4: Dashboard + CRM
└── README.md                           ← Diese Datei
```

## ⏱️ Was passiert über Nacht?

| Phase | Was wird gebaut | Dauer | 
|-------|----------------|-------|
| 1 | Werkpilot.ch Website (Next.js, 4-sprachig, SEO 100/100) | ~2-4h |
| 2 | Conversion-Optimierung (Cialdini, Exit Intent, Social Proof) | ~1-2h |
| 3 | 42 AI Agents (Sales, Marketing, Ops, Finance, Strategy, HR, IT) | ~3-5h |
| 4 | Management Dashboard + CRM + Google Maps Scraper | ~2-3h |
| **Total** | **Komplettes Business-System** | **~8-14h** |

## 🌅 Morgens — Was du findest

Wenn du aufwachst:

```bash
# Website starten
cd ~/Downloads/werkpilot/werkpilot-website && npm run dev
# → localhost:3000 = deine fertige Website

# Dashboard starten  
cd ~/Downloads/werkpilot/dashboard/werkpilot-dashboard && npm run dev
# → localhost:3000 = CRM + Dashboard + Google Scraper

# Agents starten
cd ~/Downloads/werkpilot/agents && node orchestrator.js
# → Alle 43 Agents laufen

# Overnight Report lesen
cat ~/Downloads/werkpilot/logs/overnight-report-*.md
```

## 💰 Kosten

| Posten | Kosten |
|--------|--------|
| Claude API (Overnight Build) | ~CHF 30-80 einmalig |
| Claude Max Plan (empfohlen) | CHF 200/Mo (unlimitiert) |
| Domain (werkpilot.ch) | CHF 12/Jahr |
| **Total zum Starten** | **~CHF 45-95** |

## ⚠️ Voraussetzungen

- [x] Node.js 18+ installiert
- [x] Git installiert
- [x] Claude Code installiert (`npm install -g @anthropic-ai/claude-code`)
- [x] Anthropic API Key (`export ANTHROPIC_API_KEY="sk-..."`)
- [x] ~15 GB freier Speicherplatz
- [x] Stabile Internetverbindung über Nacht

## 🔒 Sicherheit

- Alles läuft lokal auf deinem Rechner
- Kein Produktions-Deploy automatisch
- Separater Git-Branch pro Nachtschicht
- Du reviewst morgens alles bevor es live geht
- Logs für jede Phase in `~/Downloads/werkpilot/logs/`

## 📞 Falls etwas schief geht

1. Check die Logs: `ls ~/Downloads/werkpilot/logs/`
2. Die häufigsten Probleme:
   - **API Key nicht gesetzt** → `export ANTHROPIC_API_KEY="..."`
   - **Node.js zu alt** → `node --version` (braucht 18+)
   - **Claude Code nicht installiert** → `npm install -g @anthropic-ai/claude-code`
   - **Speicherplatz voll** → `df -h`
3. Einzelne Phase nochmal laufen:
   ```bash
   cd ~/Downloads/werkpilot
   claude --dangerously-skip-permissions -p "$(cat prompts/01-WEBSITE-BUILD.md)"
   ```

---

**Viel Erfolg mit Werkpilot! 🇨🇭**
