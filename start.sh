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

# ── 3. Start C++ Engine ───────────────────────────────────────────────────────
info "Starting Aegon C++ API server on :8080..."
LD_LIBRARY_PATH="$HOME/.local/lib:$LD_LIBRARY_PATH" \
  ./anant-engine/build/anant-engine --port 8080 --threads 8 &
ENGINE_PID=$!
echo $ENGINE_PID > /tmp/anant-engine.pid

sleep 2
if kill -0 $ENGINE_PID 2>/dev/null; then
    ok "anant-engine running (PID $ENGINE_PID)"
else
    error "anant-engine failed to start — check build output"
    exit 1
fi

# ── 4. Build React Dashboard ─────────────────────────────────────────────────
info "Building React dashboard..."
cd anant-dashboard
bun run build 2>&1 | tail -5
cp -r dist/* ../anant-bun/static/ 2>/dev/null || mkdir -p ../anant-bun/static && cp -r dist/* ../anant-bun/static/
ok "Dashboard built and copied to anant-bun/static/"
cd ..

# ── 5. Start Bun.js Orchestrator ─────────────────────────────────────────────
info "Starting Bun.js orchestrator on :3000..."
cd anant-bun
AEGON_URL=http://127.0.0.1:8080 \
LLAMA_URL=http://127.0.0.1:8090 \
  bun server.ts &
BUN_PID=$!
echo $BUN_PID > /tmp/anant-bun.pid
cd ..

sleep 1
if kill -0 $BUN_PID 2>/dev/null; then
    ok "Bun.js server running (PID $BUN_PID)"
else
    error "Bun.js server failed to start"
fi

# ── 6. Start llama-server (optional if ollama already running) ────────────────
if command -v /usr/lib/ollama/llama-server &>/dev/null; then
    info "Starting llama-server with GBNF grammar support on :8090..."
    MODEL_PATH="$HOME/.ollama/models/blobs"
    # Try to find a suitable GGUF model
    GGUF=$(find ~/.ollama/models -name "*.gguf" 2>/dev/null | head -1)
    if [ -n "$GGUF" ]; then
        /usr/lib/ollama/llama-server \
            -m "$GGUF" \
            --port 8090 \
            --threads 8 \
            --ctx-size 4096 \
            --log-disable \
            > /tmp/anant-llama.log 2>&1 &
        LLAMA_PID=$!
        echo $LLAMA_PID > /tmp/anant-llama.pid
        sleep 2
        if kill -0 $LLAMA_PID 2>/dev/null; then
            ok "llama-server running (PID $LLAMA_PID) — model: $(basename $GGUF)"
        else
            warn "llama-server failed — check /tmp/anant-llama.log"
            info "Falling back to Ollama REST API"
        fi
    else
        warn "No GGUF model found. Pull one: ollama pull deepseek-coder:6.7b"
    fi
else
    warn "llama-server not found. AI features will use Ollama fallback."
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    Anant is Ready!                      ║"
echo "║                                                         ║"
echo "║  Dashboard:     http://localhost:3000                   ║"
echo "║  API (Aegon):   http://localhost:8080                   ║"
echo "║  Memgraph:      bolt://localhost:7687                   ║"
echo "║                                                         ║"
echo "║  Load dataset:  curl -X POST localhost:8080/api/ingest  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Trap SIGINT to cleanup ────────────────────────────────────────────────────
cleanup() {
    echo ""
    info "Shutting down..."
    kill $ENGINE_PID $BUN_PID $LLAMA_PID 2>/dev/null || true
    docker compose stop memgraph 2>/dev/null || true
    info "Done."
}
trap cleanup INT TERM

# Keep script alive
wait
