#!/usr/bin/env bash
# Werkpilot Dashboard - Run 10K Swiss Lead Seed Script
# Usage: bash prisma/run-seed.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Running 10K Swiss lead seed script..."
echo "Working directory: $(pwd)"
echo ""

npx tsx prisma/seed-10k.ts
