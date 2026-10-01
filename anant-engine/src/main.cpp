#include <http/Server.h>
#include <http/middleware/Cors.h>
#include <http/middleware/SecurityHeaders.h>
#include "api/Routes.h"
#include <iostream>
#include <csignal>

int main(int argc, char* argv[]) {
    std::string memgraph_host = "127.0.0.1";
    uint16_t    memgraph_port = 7687;
    uint16_t    listen_port   = 8080;
    int         worker_threads = 8;

    // Simple arg parsing
    for (int i = 1; i < argc - 1; i++) {
        std::string arg(argv[i]);
        if (arg == "--memgraph-host") memgraph_host = argv[++i];
        if (arg == "--memgraph-port") memgraph_port = static_cast<uint16_t>(std::stoi(argv[++i]));
        if (arg == "--port")          listen_port   = static_cast<uint16_t>(std::stoi(argv[++i]));
        if (arg == "--threads")       worker_threads = std::stoi(argv[++i]);
    }

    std::cout << "╔══════════════════════════════════════════╗\n"
              << "║  Project Anant — AML Analytics Engine   ║\n"
              << "║  VoidHacks 8.0 · Abhedya-Chakra          ║\n"
              << "╚══════════════════════════════════════════╝\n\n"
              << "  Aegon HTTP/2 server on :" << listen_port << "\n"
              << "  Memgraph at "             << memgraph_host << ":" << memgraph_port << "\n"
              << "  Worker threads: "         << worker_threads << "\n\n";

    // Initialize shared application state
    anant::api::AppState state(memgraph_host, memgraph_port);

    if (!state.graph->is_connected()) {
        std::cerr << "[WARN] Memgraph not reachable — graph queries will fail.\n"
                  << "       Start Memgraph: docker run -p 7687:7687 memgraph/memgraph-mage\n";
    } else {
        std::cout << "[OK] Connected to Memgraph\n";
    }

    // Build Aegon server
    aegon::http::Server server;

    // CORS & Security Headers — using Aegon's native zero-copy middleware
    server.router().use(aegon::http::middleware::cors());
    server.router().use(aegon::http::middleware::security_headers(aegon::http::middleware::SecurityHeadersConfig::defaults()));

    // Serve React Dashboard directly via Aegon static files server
    server.router().static_files("/", "/home/surendra/IdeaProjects/ProjectAnant/anant-bun/static", aegon::http::StaticFilesOptions{
        .precompressed = false,
        .cache_in_memory = true,
        .index_file = "index.html"
    });

    // Register all routes
    anant::api::register_routes(server, state);

    // Graceful shutdown
    std::signal(SIGINT, [](int) {
        std::cout << "\n[Anant] Shutting down...\n";
        std::exit(0);
    });

    std::cout << "[Anant] Ready. POST /api/ingest to start the pipeline.\n"
              << "[Anant] Dashboard: http://localhost:3000\n\n";

    server.listen(listen_port).run(worker_threads);
    return 0;
}
