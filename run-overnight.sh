#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# WERKPILOT — COMPLETE OVERNIGHT BUILD SYSTEM
# ══════════════════════════════════════════════════════════════════
#
# Dieses Script baut ALLES über Nacht:
#   Phase 1: Website (werkpilot.ch)
#   Phase 2: Conversion & Sales Optimization
#   Phase 3: Alle 42 AI Agents + Orchestrator
#   Phase 4: Management Dashboard + CRM mit Google Scraping
#
# USAGE:
#   chmod +x run-overnight.sh
#   ./run-overnight.sh
#
# VORAUSSETZUNGEN:
#   - Claude Code installiert: npm install -g @anthropic-ai/claude-code
#   - Anthropic API Key in ANTHROPIC_API_KEY env variable
#   - Node.js 18+ installiert
#   - Git installiert
#
# GESCHÄTZTE DAUER: 6-12 Stunden
# GESCHÄTZTE KOSTEN: CHF 30-80 (Claude API)
# ══════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

WORKDIR="$HOME/Downloads/werkpilot"
LOGDIR="$WORKDIR/logs"
PROMPTDIR="$WORKDIR/prompts"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

echo ""
echo -e "${PURPLE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}   WERKPILOT — OVERNIGHT BUILD SYSTEM                       ${NC}"
echo -e "${PURPLE}   Started: $(date '+%Y-%m-%d %H:%M:%S')                    ${NC}"
echo -e "${PURPLE}══════════════════════════════════════════════════════════════${NC}"
echo ""

# ── Setup directories ──
mkdir -p "$WORKDIR" "$LOGDIR" "$PROMPTDIR"
cd "$WORKDIR"

# ── Initialize Git ──
if [ ! -d ".git" ]; then
    git init
    echo "node_modules/\n.next/\n*.db\n.env" > .gitignore
    git add .gitignore
    git commit -m "Initial commit — Werkpilot project setup"
fi

# Create overnight branch
git checkout -b "night-shift/$TIMESTAMP" 2>/dev/null || git checkout "night-shift/$TIMESTAMP"

echo -e "${GREEN}✓ Project directory ready: $WORKDIR${NC}"
echo -e "${GREEN}✓ Git branch: night-shift/$TIMESTAMP${NC}"
echo ""

# ══════════════════════════════════════════════════════════════
# PHASE 1: WEBSITE BUILD
# ══════════════════════════════════════════════════════════════
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  PHASE 1/4: Website Build (Lighthouse 100/100)             ${NC}"
echo -e "${CYAN}  Estimated: 2-4 hours                                      ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PHASE1_START=$(date +%s)

cd "$WORKDIR"
claude --dangerously-skip-permissions -p "$(cat $PROMPTDIR/01-WEBSITE-BUILD.md)" \
    2>&1 | tee "$LOGDIR/phase1-website-$TIMESTAMP.log"

# Commit Phase 1
cd "$WORKDIR"
git add -A
git commit -m "Phase 1 complete: Werkpilot.ch website built" || true

PHASE1_END=$(date +%s)
PHASE1_DURATION=$(( (PHASE1_END - PHASE1_START) / 60 ))
echo ""
echo -e "${GREEN}✓ Phase 1 complete in ${PHASE1_DURATION} minutes${NC}"
echo ""

# ══════════════════════════════════════════════════════════════
# PHASE 2: CONVERSION OPTIMIZATION
# ══════════════════════════════════════════════════════════════
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  PHASE 2/4: Sales & Conversion Optimization               ${NC}"
echo -e "${YELLOW}  Estimated: 1-2 hours                                      ${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PHASE2_START=$(date +%s)

cd "$WORKDIR"
claude --dangerously-skip-permissions -p "$(cat $PROMPTDIR/02-CONVERSION-OPTIMIZATION.md)" \
    2>&1 | tee "$LOGDIR/phase2-conversion-$TIMESTAMP.log"

cd "$WORKDIR"
git add -A
git commit -m "Phase 2 complete: Conversion & sales psychology optimized" || true

PHASE2_END=$(date +%s)
PHASE2_DURATION=$(( (PHASE2_END - PHASE2_START) / 60 ))
echo ""
echo -e "${GREEN}✓ Phase 2 complete in ${PHASE2_DURATION} minutes${NC}"
echo ""

# ══════════════════════════════════════════════════════════════
# PHASE 3: ALL 42 AI AGENTS
# ══════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${PURPLE}  PHASE 3/4: Building 42 AI Agents + Orchestrator          ${NC}"
echo -e "${PURPLE}  Estimated: 3-5 hours                                      ${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PHASE3_START=$(date +%s)

cd "$WORKDIR"
claude --dangerously-skip-permissions -p "$(cat $PROMPTDIR/03-ALL-42-AGENT-PROMPTS.md)" \
    2>&1 | tee "$LOGDIR/phase3-agents-$TIMESTAMP.log"

cd "$WORKDIR"
git add -A
git commit -m "Phase 3 complete: All 42 AI agents + orchestrator built" || true

PHASE3_END=$(date +%s)
PHASE3_DURATION=$(( (PHASE3_END - PHASE3_START) / 60 ))
echo ""
echo -e "${GREEN}✓ Phase 3 complete in ${PHASE3_DURATION} minutes${NC}"
echo ""

# ══════════════════════════════════════════════════════════════
# PHASE 4: MANAGEMENT DASHBOARD + CRM
# ══════════════════════════════════════════════════════════════
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}  PHASE 4/4: Management Dashboard + CRM + Google Scraper   ${NC}"
echo -e "${RED}  Estimated: 2-3 hours                                      ${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PHASE4_START=$(date +%s)

cd "$WORKDIR"
claude --dangerously-skip-permissions -p "$(cat $PROMPTDIR/04-MANAGEMENT-DASHBOARD.md)" \
    2>&1 | tee "$LOGDIR/phase4-dashboard-$TIMESTAMP.log"

cd "$WORKDIR"
git add -A
git commit -m "Phase 4 complete: Management dashboard + CRM + Google scraper" || true

PHASE4_END=$(date +%s)
PHASE4_DURATION=$(( (PHASE4_END - PHASE4_START) / 60 ))
echo ""
echo -e "${GREEN}✓ Phase 4 complete in ${PHASE4_DURATION} minutes${NC}"
echo ""

# ══════════════════════════════════════════════════════════════
# FINAL REPORT
# ══════════════════════════════════════════════════════════════
TOTAL_DURATION=$(( (PHASE4_END - PHASE1_START) / 60 ))

echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   WERKPILOT — OVERNIGHT BUILD COMPLETE                     ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Phase 1 (Website):       ${PHASE1_DURATION} min"
echo -e "  Phase 2 (Conversion):    ${PHASE2_DURATION} min"
echo -e "  Phase 3 (42 Agents):     ${PHASE3_DURATION} min"
echo -e "  Phase 4 (Dashboard):     ${PHASE4_DURATION} min"
echo -e "  ─────────────────────────────"
echo -e "  Total:                   ${TOTAL_DURATION} min ($(( TOTAL_DURATION / 60 ))h $(( TOTAL_DURATION % 60 ))m)"
echo ""
echo -e "  Git Branch: night-shift/$TIMESTAMP"
echo -e "  Logs: $LOGDIR/"
echo ""
echo -e "  ${CYAN}To start the website:${NC}"
echo -e "    cd $WORKDIR/werkpilot-website && npm run dev"
echo ""
echo -e "  ${CYAN}To start the dashboard:${NC}"
echo -e "    cd $WORKDIR/dashboard/werkpilot-dashboard && npm run dev"
echo ""
echo -e "  ${CYAN}To start the agents:${NC}"
echo -e "    cd $WORKDIR/agents && node orchestrator.js"
echo ""
echo -e "  ${YELLOW}NEXT STEP: Review the changes and merge to main:${NC}"
echo -e "    cd $WORKDIR && git diff main..night-shift/$TIMESTAMP --stat"
echo -e "    git checkout main && git merge night-shift/$TIMESTAMP"
echo ""

# Save report
cat > "$LOGDIR/overnight-report-$TIMESTAMP.md" << EOF
# Werkpilot Overnight Build Report
**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Branch:** night-shift/$TIMESTAMP

## Duration
- Phase 1 (Website): ${PHASE1_DURATION} min
- Phase 2 (Conversion): ${PHASE2_DURATION} min
- Phase 3 (42 Agents): ${PHASE3_DURATION} min
- Phase 4 (Dashboard): ${PHASE4_DURATION} min
- **Total: ${TOTAL_DURATION} min**

## What Was Built
- [ ] Website (werkpilot.ch) — Lighthouse 100/100
- [ ] Sales & Conversion Optimization (Cialdini, UX, Heatmaps)
- [ ] 42 AI Agents across 9 departments
- [ ] Master Orchestrator (Agent #43)
- [ ] Management Dashboard with CRM
- [ ] Google Maps Lead Scraper
- [ ] Digital Fitness Check Engine
- [ ] Night Shift Control Panel

## Review Checklist
- [ ] Website builds without errors: \`cd werkpilot-website && npm run build\`
- [ ] Dashboard starts: \`cd dashboard/werkpilot-dashboard && npm run dev\`
- [ ] CRM has sample data
- [ ] Google Scraper works
- [ ] Agent orchestrator boots: \`cd agents && node orchestrator.js\`
- [ ] Merge to main if all good

## Logs
See: $LOGDIR/
EOF

echo -e "${GREEN}Report saved: $LOGDIR/overnight-report-$TIMESTAMP.md${NC}"
echo ""
echo -e "${PURPLE}Gute Nacht! Morgen um 06:30 reviewen. ☽${NC}"
echo ""
