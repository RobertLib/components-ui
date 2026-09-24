import { useState } from "react";
import { SettingsContext, type LocaleName } from "./settings-context";

const LOCALE_KEY = "docs-locale";

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

/**
 * Component language of the docs, remembered in localStorage. The color
 * scheme is switched with the library's `useColorScheme` (see the navbar).
 */
export default function SettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [localeName, setLocaleName] = useState<LocaleName>(() =>
    read(LOCALE_KEY, ["en", "cs"], "en"),
  );

  return (
    <SettingsContext
      value={{
        localeName,
        setLocaleName: (value) => {
          write(LOCALE_KEY, value);
          setLocaleName(value);
        },
      }}
    >
      {children}
    </SettingsContext>
  );
}
