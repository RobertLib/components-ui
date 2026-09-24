import { useState, useSyncExternalStore } from "react";
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

const subscribeToNothing = () => () => {};

export interface DrawerProviderProps {
  /** The `Drawer`, the `Navbar` and the page - `useDrawer()` works inside. */
  children: React.ReactNode;
  /**
   * `localStorage` key the collapsed state is remembered under - give each
   * drawer of a page its own. `null` turns remembering off.
   */
  storageKey?: string | null;
}

/**
 * Holds the open / collapsed state shared by `Drawer` and `Navbar`. The
 * collapsed state is remembered in `localStorage`. `AppShell` renders it.
 */
export default function DrawerProvider({
  children,
  storageKey = "drawer-collapsed",
}: Readonly<DrawerProviderProps>) {
  const isMobile = useIsMobile();
  // False on the server and while a server-rendered page hydrates - the
  // drawer starts as the server rendered it, and the remembered state is
  // read right after. Rendered on the client only, it is read at once.
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const [isCollapsed, setIsCollapsed] = useState(
    () => isHydrated && !isMobile && readCollapsed(storageKey),
  );

  const [isOpen, setIsOpen] = useState(() => !isMobile);

  // The device type changed - also right after hydrating on a phone, as the
  // server renders the desktop layout. The state follows in the same render,
  // so the drawer never renders slid in on a phone, not even for one commit
  // that would lock the page and take the focus.
  const [synced, setSynced] = useState({ isHydrated, isMobile, storageKey });

  if (
    synced.isHydrated !== isHydrated ||
    synced.isMobile !== isMobile ||
    synced.storageKey !== storageKey
  ) {
    setSynced({ isHydrated, isMobile, storageKey });
    setIsCollapsed(isHydrated && !isMobile && readCollapsed(storageKey));
    if (synced.isMobile !== isMobile) setIsOpen(!isMobile);
  }

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
