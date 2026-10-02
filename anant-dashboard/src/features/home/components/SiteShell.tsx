import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { ThemeToggle } from "../../../components/common/ThemeToggle";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 transition-opacity hover:opacity-90"
      aria-label="Project ANANT"
      title={compact ? "Project ANANT" : undefined}
    >
      <svg
        viewBox={compact ? "65 70 235 270" : "60 65 745 280"}
        className={compact ? "h-8 w-8 shrink-0" : "h-15 w-auto shrink-0"}
        role="img"
        aria-label="Project ANANT"
      >
        {/* Shield / cube mark */}
        <g stroke="#0b0f1a" strokeWidth="3" strokeLinejoin="round">
          <polygon points="74,117 180,77 180,198" fill="#ff5c00" />
          <polygon points="180,77 289,117 180,198" fill="#ff8010" />
          <polygon points="74,117 180,198 101,263" fill="#c94100" />
          <polygon points="289,117 270,263 180,198" fill="#ff5200" />
          <polygon points="101,263 180,198 270,263 180,331" fill="#ff8c3a" />
        </g>

        {!compact && (
          <>
            {/* PROJECT (outlined letters, no font needed) */}
            <g fill="none" stroke="#ff6a00" strokeWidth="2.2" strokeLinejoin="miter">
              <path transform="translate(367 139)" d="M0 11V0H8V5.5H0" />
              <path transform="translate(382 139)" d="M0 11V0H8V5.5H0M4 5.5L9 11" />
              <path transform="translate(398 139)" d="M0 0H9V11H0Z" />
              <path transform="translate(413 139)" d="M9 0V11H0V8" />
              <path transform="translate(428 139)" d="M9 0H0V11H9M0 5.5H7" />
              <path transform="translate(444 139)" d="M9 0H0V11H9" />
              <path transform="translate(459 139)" d="M0 0H9M4.5 0V11" />
            </g>

            {/* ANANT (themed fill to adapt between light and dark modes) */}
            <g className="fill-foreground" fillRule="evenodd">
              <path transform="translate(368 175)" d="M0 95L28 0H56L84 95H60L54 75H30L24 95ZM34 57H50L42 28Z" />
              <path transform="translate(460 175)" d="M0 0H22L54 52V0H76V95H54L22 43V95H0Z" />
              <path transform="translate(544 175)" d="M0 95L28 0H56L84 95H60L54 75H30L24 95ZM34 57H50L42 28Z" />
              <path transform="translate(636 175)" d="M0 0H22L54 52V0H76V95H54L22 43V95H0Z" />
              <path transform="translate(720 175)" d="M0 0H72V20H46V95H26V20H0Z" />
            </g>
          </>
        )}
      </svg>
    </Link>
  );
}

export function SiteHeader() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isArchitecture = location.pathname === "/architecture";

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Brand />
        <nav className="flex items-center gap-2" aria-label="Primary navigation">
          <Link
            to="/"
            className={`hidden rounded-md px-3 py-2 text-sm font-medium transition-colors sm:block ${
              isHome
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview
          </Link>
          <Link
            to="/architecture"
            className={`hidden rounded-md px-3 py-2 text-sm font-medium transition-colors sm:block ${
              isArchitecture
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Architecture
          </Link>
          <div className="mx-1">
            <ThemeToggle />
          </div>
          <Link
            to="/overview"
            className="ml-2 inline-flex items-center gap-1.5 h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <span>Open dashboard</span>
            <ArrowUpRight className="size-4" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-8 bg-card/40 transition-colors">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <Brand />
        <p className="text-xs sm:text-sm">
          Built for VoidHacks 8.0 · Local-first financial intelligence
        </p>
      </div>
    </footer>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 inline-flex items-center gap-2 font-mono text-xs font-medium uppercase text-primary">
      <span className="size-1.5 rounded-full bg-primary" />
      {children}
    </div>
  );
}
