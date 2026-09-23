import { useEffect, useState } from "react";
import { DrawerContext } from "./drawer-context";
import useIsMobile from "../hooks/use-is-mobile";

const readCollapsed = (storageKey: string | null) => {
  if (!storageKey) return false;

  try {
    return localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
};

const saveCollapsed = (storageKey: string | null, collapsed: boolean) => {
  if (!storageKey) return;

  try {
    localStorage.setItem(storageKey, String(collapsed));
  } catch {
    // Storage may be unavailable (private mode, blocked cookies) - the state
    // just is not remembered then.
  }
};

/**
 * Holds the open / collapsed state shared by `Drawer` and `Navbar`. The
 * collapsed state is remembered in `localStorage`.
 */
export interface DrawerProviderProps {
  children: React.ReactNode;
  /**
   * `localStorage` key the collapsed state is remembered under - give each
   * drawer of a page its own. `null` turns remembering off.
   */
  storageKey?: string | null;
}

export default function DrawerProvider({
  children,
  storageKey = "drawer-collapsed",
}: Readonly<DrawerProviderProps>) {
  const isMobile = useIsMobile();

  const [isCollapsed, setIsCollapsed] = useState(() =>
    isMobile ? false : readCollapsed(storageKey),
  );

  const [isOpen, setIsOpen] = useState(() => !isMobile);

  useEffect(() => {
    // Synchronizes the drawer when the device type changes. queueMicrotask
    // keeps the React Compiler from flagging a cascading render.
    queueMicrotask(() => {
      if (isMobile) {
        setIsCollapsed(false);
        setIsOpen(false);
      } else {
        setIsCollapsed(readCollapsed(storageKey));
        setIsOpen(true);
      }
    });
  }, [isMobile, storageKey]);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      saveCollapsed(storageKey, !prev);
      return !prev;
    });
  };

  const toggleOpen = () => setIsOpen((prev) => !prev);

  return (
    <DrawerContext value={{ isCollapsed, isOpen, toggleCollapsed, toggleOpen }}>
      {children}
    </DrawerContext>
  );
}
