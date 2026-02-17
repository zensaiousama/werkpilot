#!/usr/bin/env bash
# ==============================================================================
# Werkpilot Master Orchestrator Startup Script
#
# One-command boot for the entire 42-agent Werkpilot AI system.
#
# Usage:
#   ./startup.sh            # Start in foreground
#   ./startup.sh --daemon   # Start in background (daemon mode)
#   ./startup.sh --stop     # Stop running orchestrator
#   ./startup.sh --status   # Check if orchestrator is running
#   ./startup.sh --logs     # Tail orchestrator logs
# ==============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_FILE="$SCRIPT_DIR/.orchestrator.pid"
LOG_DIR="$SCRIPT_DIR/logs/orchestrator"
NODE_MIN_VERSION="18"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${CYAN}[STEP]${NC}  $1"; }

print_banner() {
  echo -e "${BOLD}${BLUE}"
  echo "  ╔══════════════════════════════════════════════════╗"
  echo "  ║         WERKPILOT AI ORCHESTRATOR v1.0.0         ║"
  echo "  ║            42 Agents. One Command.               ║"
  echo "  ╚══════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------
check_node() {
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js >= $NODE_MIN_VERSION"
    exit 1
  fi

  local node_version
  node_version=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$node_version" -lt "$NODE_MIN_VERSION" ]; then
    log_error "Node.js version $node_version is too old. Minimum required: $NODE_MIN_VERSION"
    exit 1
  fi
  log_info "Node.js $(node -v) detected"
}

check_dependencies() {
  if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    log_warn "node_modules not found. Installing dependencies..."
    cd "$SCRIPT_DIR"
    npm install
    log_info "Dependencies installed"
  else
    log_info "Dependencies present"
  fi
}

check_env() {
  local env_file="$SCRIPT_DIR/.env"
  if [ ! -f "$env_file" ]; then
    env_file="$PROJECT_ROOT/.env"
  fi

  if [ ! -f "$env_file" ]; then
    log_warn "No .env file found at $SCRIPT_DIR/.env or $PROJECT_ROOT/.env"
    log_warn "Some agents may not function without API keys."
  else
    log_info "Environment file found: $env_file"
  fi
}

check_files() {
  local required_files=(
    "orchestrator.js"
    "agent-registry.json"
    "dependency-graph.json"
    "health-dashboard.js"
    "shared/utils/logger.js"
    "shared/utils/config.js"
  )

  for file in "${required_files[@]}"; do
    if [ ! -f "$SCRIPT_DIR/$file" ]; then
      log_error "Required file missing: $file"
      exit 1
    fi
  done
  log_info "All required files present"
}

is_running() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    else
      rm -f "$PID_FILE"
    fi
  fi
  return 1
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
cmd_start_foreground() {
  if is_running; then
    local pid
    pid=$(cat "$PID_FILE")
    log_error "Orchestrator is already running (PID: $pid)"
    log_info "Use './startup.sh --stop' to stop it first."
    exit 1
  fi

  print_banner
  log_step "Pre-flight checks..."
  check_node
  check_dependencies
  check_env
  check_files

  # Create log directory
  mkdir -p "$LOG_DIR"

  log_step "Starting Master Orchestrator in foreground..."
  echo ""

  cd "$SCRIPT_DIR"

  # Store PID and start
  exec node orchestrator.js &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  # Wait for the process
  wait "$pid" 2>/dev/null
  local exit_code=$?
  rm -f "$PID_FILE"

  if [ $exit_code -ne 0 ]; then
    log_error "Orchestrator exited with code $exit_code"
    exit $exit_code
  fi
}

cmd_start_daemon() {
  if is_running; then
    local pid
    pid=$(cat "$PID_FILE")
    log_error "Orchestrator is already running (PID: $pid)"
    exit 1
  fi

  print_banner
  log_step "Pre-flight checks..."
  check_node
  check_dependencies
  check_env
  check_files

  mkdir -p "$LOG_DIR"

  log_step "Starting Master Orchestrator in daemon mode..."

  cd "$SCRIPT_DIR"
  nohup node orchestrator.js >> "$LOG_DIR/stdout.log" 2>> "$LOG_DIR/stderr.log" &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  # Give it a moment to start
  sleep 2

  if kill -0 "$pid" 2>/dev/null; then
    log_info "Orchestrator started successfully (PID: $pid)"
    log_info "Dashboard: http://localhost:3001/health"
    log_info "Logs: $LOG_DIR"
    log_info "Stop with: ./startup.sh --stop"
  else
    log_error "Orchestrator failed to start. Check logs at $LOG_DIR/stderr.log"
    rm -f "$PID_FILE"
    exit 1
  fi
}

cmd_stop() {
  if ! is_running; then
    log_info "Orchestrator is not running"
    return 0
  fi

  local pid
  pid=$(cat "$PID_FILE")
  log_step "Stopping orchestrator (PID: $pid)..."

  # Send SIGTERM for graceful shutdown
  kill -TERM "$pid" 2>/dev/null

  # Wait up to 30 seconds for graceful shutdown
  local timeout=30
  local count=0
  while kill -0 "$pid" 2>/dev/null && [ $count -lt $timeout ]; do
    sleep 1
    count=$((count + 1))
    if [ $((count % 5)) -eq 0 ]; then
      log_info "Waiting for graceful shutdown... (${count}s/${timeout}s)"
    fi
  done

  if kill -0 "$pid" 2>/dev/null; then
    log_warn "Graceful shutdown timed out. Sending SIGKILL..."
    kill -9 "$pid" 2>/dev/null
    sleep 1
  fi

  rm -f "$PID_FILE"
  log_info "Orchestrator stopped"
}

cmd_status() {
  if is_running; then
    local pid
    pid=$(cat "$PID_FILE")
    log_info "Orchestrator is ${GREEN}running${NC} (PID: $pid)"

    # Try to get health status from dashboard
    if command -v curl &> /dev/null; then
      echo ""
      log_step "Querying health dashboard..."
      local health
      health=$(curl -s --max-time 5 http://localhost:3001/health 2>/dev/null || echo "")
      if [ -n "$health" ]; then
        echo "$health" | python3 -m json.tool 2>/dev/null || echo "$health"
      else
        log_warn "Dashboard not responding"
      fi
    fi
  else
    log_info "Orchestrator is ${RED}not running${NC}"
    exit 1
  fi
}

cmd_logs() {
  local log_file="$LOG_DIR/combined.log"
  if [ ! -f "$log_file" ]; then
    log_file="$LOG_DIR/stdout.log"
  fi

  if [ -f "$log_file" ]; then
    log_info "Tailing: $log_file (Ctrl+C to stop)"
    tail -f "$log_file"
  else
    log_error "No log files found at $LOG_DIR"
    exit 1
  fi
}

cmd_help() {
  print_banner
  echo "Usage: ./startup.sh [OPTION]"
  echo ""
  echo "Options:"
  echo "  (none)       Start orchestrator in foreground"
  echo "  --daemon     Start orchestrator in background"
  echo "  --stop       Stop running orchestrator"
  echo "  --status     Check orchestrator status"
  echo "  --logs       Tail orchestrator logs"
  echo "  --help       Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./startup.sh                 # Start in foreground"
  echo "  ./startup.sh --daemon        # Start as background service"
  echo "  ./startup.sh --status        # Check health"
  echo "  curl localhost:3001/health   # Query health API"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
case "${1:-}" in
  --daemon|-d)
    cmd_start_daemon
    ;;
  --stop|-s)
    cmd_stop
    ;;
  --status)
    cmd_status
    ;;
  --logs|-l)
    cmd_logs
    ;;
  --help|-h)
    cmd_help
    ;;
  "")
    cmd_start_foreground
    ;;
  *)
    log_error "Unknown option: $1"
    cmd_help
    exit 1
    ;;
esac
