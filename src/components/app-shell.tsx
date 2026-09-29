import cn from "../utils/cn";
import DrawerProvider from "../providers/drawer-provider";

export interface AppShellProps extends React.ComponentProps<"main"> {
  /** Usually a `Drawer`. */
  drawer?: React.ReactNode;
  /**
   * A keyboard shortcut that toggles the drawer, e.g. `"mod+b"` - see
   * `DrawerProvider`.
   */
  drawerShortcut?: string;
  /**
   * `localStorage` key of the collapsed state of the drawer, `null` to not
   * remember it. Default `"drawer-collapsed"`.
   */
  drawerStorageKey?: string | null;
  /** Usually a `Navbar`. */
  navbar?: React.ReactNode;
}

/**
 * The page frame of an app: a `Drawer` at the start edge (the left one, the
 * right one right to left), a `Navbar` on top and the page content in
 * `<main>`, which make room for the drawer as it opens and collapses.
 * Provides the drawer state (`DrawerProvider`) itself. `ref` and the other
 * props go to the `<main>`.
 */
export default function AppShell({
  children,
  className,
  drawer,
  drawerShortcut,
  drawerStorageKey,
  navbar,
  ...props
}: AppShellProps) {
  return (
    <DrawerProvider shortcut={drawerShortcut} storageKey={drawerStorageKey}>
      {/* The layout CSS positions the navbar and main as siblings of the drawer */}
      {drawer}
      {navbar}
      <main {...props} className={cn("min-w-0", className)}>
        {children}
      </main>
    </DrawerProvider>
  );
}
