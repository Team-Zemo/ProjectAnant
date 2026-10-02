cmake_minimum_required(VERSION 3.20)
project(anant-engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 26)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ── Compiler flags ─────────────────────────────────────────────────────────────
add_compile_options(
    -O3
    -march=native
    -Wall -Wextra
    -Wno-missing-field-initializers
)

# ── Search paths (local installs) ─────────────────────────────────────────────
list(APPEND CMAKE_PREFIX_PATH
    "$ENV{HOME}/.local"
    "${CMAKE_SOURCE_DIR}/../Aegon"   # Aegon framework sibling
)

include_directories(
    "$ENV{HOME}/.local/include"
    "$ENV{HOME}/.local/include/duckdb"
    "${CMAKE_SOURCE_DIR}/../Aegon/src"   # Aegon headers
    "${CMAKE_SOURCE_DIR}/src"
)

link_directories(
    "$ENV{HOME}/.local/lib"
)

# ── Threads ───────────────────────────────────────────────────────────────────
find_package(Threads REQUIRED)

# ── Aegon (build as sibling if not installed system-wide) ─────────────────────
# Try find_package first, fall back to add_subdirectory
find_package(Aegon QUIET)
if(NOT Aegon_FOUND)
    message(STATUS "Aegon not found via find_package — using sibling source dir")
    add_subdirectory(${CMAKE_SOURCE_DIR}/../Aegon ${CMAKE_BINARY_DIR}/Aegon EXCLUDE_FROM_ALL)
endif()

# ── Sources ───────────────────────────────────────────────────────────────────
set(ANANT_SOURCES
    src/main.cpp
    src/ingest/DuckLoader.cpp
    src/graph/GraphEngine.cpp
    src/graph/MuleScorer.cpp
    src/graph/SyndicateDetector.cpp
)

add_executable(anant-engine ${ANANT_SOURCES})

# ── Link libraries ─────────────────────────────────────────────────────────────
target_link_libraries(anant-engine PRIVATE
    # Aegon modules
    Aegon::http
    Aegon::core
    Aegon::config
    Aegon::log

    # DuckDB (shared library from ~/.local/lib)
    $ENV{HOME}/.local/lib/libduckdb.so

    # Memgraph C Bolt client
    mgclient

    # System
    Threads::Threads
    uring
    dl
)

# Fix rpath so the binary finds ~/.local/lib/libduckdb.so at runtime
set_target_properties(anant-engine PROPERTIES
    BUILD_RPATH "$ENV{HOME}/.local/lib"
    INSTALL_RPATH "$ENV{HOME}/.local/lib"
)

# ── Install ───────────────────────────────────────────────────────────────────
install(TARGETS anant-engine DESTINATION bin)

message(STATUS "")
message(STATUS "anant-engine configured:")
message(STATUS "  DuckDB:    $ENV{HOME}/.local/lib/libduckdb.so")
message(STATUS "  mgclient:  $ENV{HOME}/.local/lib/libmgclient.so")
message(STATUS "  Aegon:     ${CMAKE_SOURCE_DIR}/../Aegon")
message(STATUS "")
