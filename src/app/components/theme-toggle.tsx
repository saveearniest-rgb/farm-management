"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import type { Locale } from "@/lib/i18n";

const STORAGE_KEY = "shamba-theme";

const themeListeners = new Set<() => void>();

function subscribe(listener: () => void) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

function getThemeSnapshot() {
  return document.documentElement.dataset.theme === "dark";
}

function getServerThemeSnapshot() {
  return false;
}

export function ThemeToggle({ locale }: { locale: Locale }) {
  const dark = useSyncExternalStore(subscribe, getThemeSnapshot, getServerThemeSnapshot);

  function toggleTheme() {
    const nextTheme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(STORAGE_KEY, nextTheme);
    themeListeners.forEach((listener) => listener());
  }

  const label = dark
    ? locale === "sw" ? "Washa mwanga" : "Switch to light mode"
    : locale === "sw" ? "Washa hali ya giza" : "Switch to dark mode";

  return (
    <button
      aria-label={label}
      className="theme-toggle"
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
