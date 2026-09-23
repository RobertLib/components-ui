import { createContext, use } from "react";

export type LocaleName = "en" | "cs";
export type Theme = "light" | "dark" | "system";

export interface DocsSettings {
  /** Language of the components in the examples (the docs text stays English). */
  localeName: LocaleName;
  setLocaleName: (localeName: LocaleName) => void;
  setTheme: (theme: Theme) => void;
  theme: Theme;
}

export const SettingsContext = createContext<DocsSettings>({
  localeName: "en",
  setLocaleName: () => {},
  setTheme: () => {},
  theme: "system",
});

export const useDocsSettings = () => use(SettingsContext);
