import React, { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";

export const ThemeToggle: React.FC = () => {
  const location = useLocation();
  const isHomeRoute = location.pathname === "/" || location.pathname === "/architecture";
  const themeKey = isHomeRoute ? "home-theme" : "dashboard-theme";
  const defaultTheme = isHomeRoute ? "light" : "dark";

  const getThemeIsDark = useCallback(() => {
    const saved = localStorage.getItem(themeKey);
    if (saved) return saved === "dark";
    if (!isHomeRoute) {
      const appTheme = localStorage.getItem("app-theme");
      if (appTheme) return appTheme === "dark";
    }
    return defaultTheme === "dark";
  }, [themeKey, isHomeRoute, defaultTheme]);

  const [isDark, setIsDark] = useState<boolean>(getThemeIsDark);

  useEffect(() => {
    setIsDark(getThemeIsDark());
  }, [location.pathname, getThemeIsDark]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    const themeName = nextDark ? "dark" : "light";
    localStorage.setItem(themeKey, themeName);
    if (!isHomeRoute) {
      localStorage.setItem("app-theme", themeName);
    }
    if (nextDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl border border-border bg-card text-card-foreground hover:bg-muted transition-colors flex items-center justify-center shadow-sm cursor-pointer"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle Theme"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-warning" />
      ) : (
        <Moon className="w-4 h-4 text-foreground" />
      )}
    </button>
  );
};
