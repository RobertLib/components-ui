import { createContext, use } from "react";

export interface DrawerState {
  /** Desktop: the drawer shows icons only. */
  isCollapsed: boolean;
  /** Mobile: the drawer is slid in over the page. Always true on desktop. */
  isOpen: boolean;
  /** The keyboard shortcut that toggles the drawer, if any. */
  shortcut?: string;
  /** Collapses or expands the drawer (desktop). */
  toggleCollapsed: () => void;
  /** Slides the drawer in or out (mobile). */
  toggleOpen: () => void;
}

export const DrawerContext = /* @__PURE__ */ createContext<DrawerState>({
  isCollapsed: false,
  isOpen: false,
  toggleCollapsed: () => {},
  toggleOpen: () => {},
});

/** State of the app drawer - see `DrawerProvider`. */
export function useDrawer() {
  return use(DrawerContext);
}
