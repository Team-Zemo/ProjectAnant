#include "http/Router.h"
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <shared_mutex>
#include <mutex>
#include <memory>

namespace aegon::http {

struct CachedStaticFile {
    time_t mtime{0};
    long mtime_nsec{0};
    std::string content;
    std::string content_type;
    std::string content_encoding;
};

Router& Router::static_files(std::string_view prefix, std::string_view directory, StaticFilesOptions options) {
    std::string base_dir(directory);
    while (base_dir.size() > 1 && base_dir.back() == '/') {
        base_dir.pop_back();
    }

    std::string clean_prefix(prefix);
    if (!clean_prefix.empty() && !clean_prefix.starts_with('/')) {
        clean_prefix = "/" + clean_prefix;
    }
    while (clean_prefix.size() > 1 && clean_prefix.back() == '/') {
        clean_prefix.pop_back();
    }
    if (clean_prefix == "/") clean_prefix = "";

    auto cache = std::make_shared<std::unordered_map<std::string, CachedStaticFile>>();
    auto mtx = std::make_shared<std::shared_mutex>();

    auto handler = [base_dir, options, cache, mtx](Context& ctx) {
        std::string_view rel;
        if (auto p = ctx.req().param("filepath")) {
            rel = *p;
        }
        while (!rel.empty() && rel.front() == '/') {
            rel.remove_prefix(1);
        }
        if (rel.empty()) {
            if (!options.index_file.empty()) {
                rel = options.index_file;
            } else {
                ctx.res().status(StatusCode::NotFound).text("Not Found");
                return;
            }
        }

        // Path traversal guard
        if (rel.find("..") != std::string_view::npos || 
            rel.find('\\') != std::string_view::npos ||
            rel.find('\0') != std::string_view::npos) {
            ctx.res().status(StatusCode::NotFound).text("Not Found");
            return;
        }

        std::string full_path = base_dir + "/" + std::string(rel);
        std::string_view content_type = Response::infer_mime_type(full_path);

        auto accept_enc = ctx.req().header("accept-encoding");
        bool accept_br = options.precompressed && accept_enc && accept_enc->find("br") != std::string_view::npos;
        bool accept_gz = options.precompressed && accept_enc && (accept_enc->find("gzip") != std::string_view::npos || accept_enc->find("deflate") != std::string_view::npos);

        auto try_serve = [&](const std::string& path, std::string_view encoding) -> bool {
            struct stat st{};
            if (::stat(path.c_str(), &st) != 0 || !S_ISREG(st.st_mode)) {
                return false;
            }

#if defined(__linux__)
            long current_nsec = st.st_mtim.tv_nsec;
#elif defined(__APPLE__)
            long current_nsec = st.st_mtimespec.tv_nsec;
#else
            long current_nsec = 0;
#endif

            if (options.cache_in_memory) {
                std::shared_lock lock(*mtx);
                auto it = cache->find(path);
                if (it != cache->end()) {
                    const auto& entry = it->second;
                    if (entry.mtime == st.st_mtime && entry.mtime_nsec == current_nsec) {
                        ctx.res().header("Content-Type", entry.content_type);
                        if (!entry.content_encoding.empty()) {
                            ctx.res().header("Content-Encoding", entry.content_encoding);
                        }
                        ctx.res().body(entry.content);
                        return true;
                    }
                }
            }

            int fd = ::open(path.c_str(), O_RDONLY | O_CLOEXEC);
            if (fd < 0) return false;

            std::string data;
            data.resize(static_cast<size_t>(st.st_size));
            size_t total_read = 0;
            while (total_read < data.size()) {
                ssize_t n = ::read(fd, data.data() + total_read, data.size() - total_read);
                if (n <= 0) break;
                total_read += static_cast<size_t>(n);
            }
            ::close(fd);

            if (total_read != data.size()) return false;

            if (options.cache_in_memory) {
                std::unique_lock lock(*mtx);
                (*cache)[path] = CachedStaticFile{
                    .mtime = st.st_mtime,
                    .mtime_nsec = current_nsec,
                    .content = data,
                    .content_type = std::string(content_type),
                    .content_encoding = std::string(encoding)
                };
            }

            ctx.res().header("Content-Type", content_type);
            if (!encoding.empty()) {
                ctx.res().header("Content-Encoding", encoding);
            }
            ctx.res().body(std::move(data));
            return true;
        };

        if (accept_br && try_serve(full_path + ".br", "br")) return;
        if (accept_gz && try_serve(full_path + ".gz", "gzip")) return;
        if (try_serve(full_path, "")) return;

        // SPA fallback: for client-side routing (e.g. /investigation/..., /mules, /overview),
        // fallback to index_file if the path isn't an API or asset request.
        if (options.spa_fallback && !options.index_file.empty()) {
            bool is_asset = rel.ends_with(".js") || rel.ends_with(".css") ||
                            rel.ends_with(".png") || rel.ends_with(".jpg") ||
                            rel.ends_with(".jpeg") || rel.ends_with(".svg") ||
                            rel.ends_with(".woff2") || rel.ends_with(".woff") ||
                            rel.ends_with(".ttf") || rel.ends_with(".ico") ||
                            rel.ends_with(".json") || rel.ends_with(".map");
            if (!rel.starts_with("api/") && !is_asset) {
                std::string fallback_file = !options.fallback_file.empty() ? options.fallback_file : options.index_file;
                std::string fallback_path = base_dir + "/" + fallback_file;
                if (try_serve(fallback_path, "")) return;
            }
        }

        ctx.res().status(StatusCode::NotFound).text("Not Found");
    };

    std::string wildcard_pattern = clean_prefix + "/*filepath";
    add_route(Method::GET, wildcard_pattern, handler);
    add_route(Method::HEAD, wildcard_pattern, handler);

    if (!clean_prefix.empty()) {
        add_route(Method::GET, clean_prefix, handler);
        add_route(Method::HEAD, clean_prefix, handler);
        add_route(Method::GET, clean_prefix + "/", handler);
        add_route(Method::HEAD, clean_prefix + "/", handler);
    } else {
        add_route(Method::GET, "/", handler);
        add_route(Method::HEAD, "/", handler);
    }

    return *this;
}

} // namespace aegon::http
