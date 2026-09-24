import { createContext, use } from "react";

export type LocaleName = "en" | "cs";

/** The color scheme is the library's own - see `useColorScheme`. */
export interface DocsSettings {
  /** Language of the components in the examples (the docs text stays English). */
  localeName: LocaleName;
  setLocaleName: (localeName: LocaleName) => void;
}

export const SettingsContext = createContext<DocsSettings>({
  localeName: "en",
  setLocaleName: () => {},
});

export const useDocsSettings = () => use(SettingsContext);
