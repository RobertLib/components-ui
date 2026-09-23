import { useEffect, useState } from "react";
import {
  SettingsContext,
  type LocaleName,
  type Theme,
} from "./settings-context";

const LOCALE_KEY = "docs-locale";
const THEME_KEY = "docs-theme";

const read = <T extends string>(key: string, allowed: T[], fallback: T): T => {
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered - fine for the docs
  }
};

/** Component language and color theme of the docs, remembered in localStorage. */
export default function SettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [localeName, setLocaleName] = useState<LocaleName>(() =>
    read(LOCALE_KEY, ["en", "cs"], "en"),
  );
  const [theme, setTheme] = useState<Theme>(() =>
    read(THEME_KEY, ["light", "dark", "system"], "system"),
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && query.matches);
      document.documentElement.classList.toggle("dark", dark);
    };

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [theme]);

  return (
    <SettingsContext
      value={{
        localeName,
        setLocaleName: (value) => {
          write(LOCALE_KEY, value);
          setLocaleName(value);
        },
        setTheme: (value) => {
          write(THEME_KEY, value);
          setTheme(value);
        },
        theme,
      }}
    >
      {children}
    </SettingsContext>
  );
}
