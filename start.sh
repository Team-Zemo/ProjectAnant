#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Project Anant — Full Stack Startup Script
# VoidHacks 8.0 · Abhedya-Chakra
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; BLU='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLU}[INFO]${NC}  $*"; }
ok()    { echo -e "${GRN}[OK]${NC}    $*"; }
warn()  { echo -e "${YLW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       Project Anant — Starting All Services             ║"
echo "║       VoidHacks 8.0 · Abhedya-Chakra                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 0. Cleanup stale processes ───────────────────────────────────────────────
pkill -f "anant-engine" 2>/dev/null || true
pkill -f "bun.*server.ts" 2>/dev/null || true
sleep 1

# ── 1. Memgraph ───────────────────────────────────────────────────────────────
info "Starting Memgraph MAGE (in-memory graph DB)..."
docker compose up -d memgraph 2>/dev/null || {
    warn "docker compose failed, trying docker-compose..."
    docker-compose up -d memgraph
}

# Wait for Memgraph to be ready
for i in {1..20}; do
    if (exec 3<>/dev/tcp/127.0.0.1/7687) 2>/dev/null; then
        exec 3>&- # close connection
        ok "Memgraph ready on :7687"
        break
    fi
    sleep 1
done

# ── 2. Build C++ Engine ───────────────────────────────────────────────────────
info "Building anant-engine (C++26)..."
cd anant-engine
cmake -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_CXX_STANDARD=26 \
    2>&1 | grep -E "error:|warning:|Configuring|Generating|anant" | head -20

cmake --build build -j$(nproc) 2>&1 | tail -10
ok "anant-engine built"
cd ..

# ── 3. Build React Dashboard ─────────────────────────────────────────────────
info "Building React dashboard..."
cd anant-dashboard
bun run build 2>&1 | tail -5
ok "Dashboard built into anant-dashboard/dist"
cd ..

# ── 4. Start Aegon Engine & Server ───────────────────────────────────────────
info "Starting Aegon HTTP/2 server & AML Engine on :3000..."
LD_LIBRARY_PATH="$HOME/.local/lib:$LD_LIBRARY_PATH" \
  ./anant-engine/build/anant-engine --port 3000 --threads 8 &
ENGINE_PID=$!
echo $ENGINE_PID > /tmp/anant-engine.pid

sleep 2
if kill -0 $ENGINE_PID 2>/dev/null; then
    ok "anant-engine running (PID $ENGINE_PID) on http://localhost:3000"
else
    error "anant-engine failed to start — check build output"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    Anant is Ready!                      ║"
echo "║                                                         ║"
echo "║  Dashboard & API: http://localhost:3000                 ║"
echo "║  Memgraph:        bolt://localhost:7687                 ║"
echo "║                                                         ║"
echo "║  Load dataset:    curl -X POST localhost:3000/api/ingest║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Trap SIGINT to cleanup ────────────────────────────────────────────────────
cleanup() {
    echo ""
    info "Shutting down..."
    kill $ENGINE_PID 2>/dev/null || true
    docker compose stop memgraph 2>/dev/null || true
    info "Done."
}
trap cleanup INT TERM

# Keep script alive
wait
