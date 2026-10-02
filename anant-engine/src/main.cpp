#include <http/Server.h>
#include <http/middleware/Cors.h>
#include <http/middleware/SecurityHeaders.h>
#include "api/Routes.h"
#include <iostream>
#include <fstream>
#include <csignal>
#include <filesystem>

int main(int argc, char* argv[]) {
    std::string memgraph_host = "127.0.0.1";
    uint16_t    memgraph_port = 7687;
    uint16_t    listen_port   = 3000;
    int         worker_threads = 8;
    std::string static_dir    = "anant-dashboard/dist";

    // Simple arg parsing
    for (int i = 1; i < argc - 1; i++) {
        std::string arg(argv[i]);
        if (arg == "--memgraph-host") memgraph_host = argv[++i];
        if (arg == "--memgraph-port") memgraph_port = static_cast<uint16_t>(std::stoi(argv[++i]));
        if (arg == "--port")          listen_port   = static_cast<uint16_t>(std::stoi(argv[++i]));
        if (arg == "--threads")       worker_threads = std::stoi(argv[++i]);
        if (arg == "--static-dir")    static_dir    = argv[++i];
    }

    // Resolve static dashboard directory if relative
    if (!std::filesystem::exists(static_dir)) {
        if (std::filesystem::exists("../anant-dashboard/dist")) {
            static_dir = "../anant-dashboard/dist";
        } else if (std::filesystem::exists("/home/surendra/IdeaProjects/ProjectAnant/anant-dashboard/dist")) {
            static_dir = "/home/surendra/IdeaProjects/ProjectAnant/anant-dashboard/dist";
        }
    }

    std::cout << "╔══════════════════════════════════════════╗\n"
              << "║  Project Anant — AML Analytics Engine   ║\n"
              << "║  VoidHacks 8.0 · Abhedya-Chakra          ║\n"
              << "╚══════════════════════════════════════════╝\n\n"
              << "  Aegon HTTP/2 server on :" << listen_port << "\n"
              << "  Graph Engine:             In-Memory C++ SIMD Vector Core\n"
              << "  Worker threads:           " << worker_threads << "\n";

    if (std::filesystem::exists(static_dir)) {
        std::cout << "  Serving dashboard from:   " << static_dir << "\n\n";
    } else {
        std::cerr << "  [WARN] Dashboard dist directory not found at " << static_dir << "\n\n";
    }

    // Initialize shared application state
    anant::api::AppState state(memgraph_host, memgraph_port);
    std::cout << "[OK] In-Memory C++ SIMD Graph Core Initialized\n";

    // Build Aegon server with 1 GB body size limit for large CSV datasets
    aegon::http::Server server;
    server.max_body_size(1024ULL * 1024 * 1024);

    // CORS & Security Headers — using Aegon's native zero-copy middleware
    server.router().use(aegon::http::middleware::cors());
    server.router().use(aegon::http::middleware::security_headers(aegon::http::middleware::SecurityHeadersConfig::defaults()));

    // Serve React Dashboard directly via Aegon static files server
    if (std::filesystem::exists(static_dir)) {
        server.router().static_files("/", static_dir, aegon::http::StaticFilesOptions{
            .precompressed = false,
            .cache_in_memory = true,
            .index_file = "index.html",
            .spa_fallback = true,
            .fallback_file = "index.html"
        });

        // Explicit SPA routes for direct browser refresh / deep links
        std::string index_file = static_dir + "/index.html";
        if (std::filesystem::exists(index_file)) {
            auto spa_handler = [index_file](aegon::http::Context& ctx) {
                std::ifstream f(index_file, std::ios::binary);
                if (f) {
                    std::string html((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
                    ctx.res().header("Content-Type", "text/html; charset=utf-8").body(std::move(html));
                } else {
                    ctx.res().status(aegon::http::StatusCode::NotFound).text("Not Found");
                }
            };

            server.router().get("/overview", spa_handler);
            server.router().get("/investigation", spa_handler);
            server.router().get("/investigation/:accountId", spa_handler);
            server.router().get("/syndicates", spa_handler);
            server.router().get("/syndicates/:syndicateId", spa_handler);
            server.router().get("/mules", spa_handler);
            server.router().get("/system", spa_handler);
        }
    }

    // Register all routes
    anant::api::register_routes(server, state);

    // Graceful shutdown
    std::signal(SIGINT, [](int) {
        std::cout << "\n[Anant] Shutting down...\n";
        std::exit(0);
    });

    std::cout << "[Anant] Ready. POST /api/ingest to start the pipeline.\n"
              << "[Anant] Dashboard & API: http://localhost:" << listen_port << "\n\n";

    server.listen(listen_port).run(worker_threads);
    return 0;
}
