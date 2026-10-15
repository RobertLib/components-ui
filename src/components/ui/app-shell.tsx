import cn from "../../utils/cn";
import DrawerProvider from "../../providers/drawer-provider";

export interface AppShellProps extends React.ComponentProps<"main"> {
  /**
   * Messages across the whole app above the `navbar` - usually
   * `SystemBanner`s, which stack one under another. They take the width of
   * the page beside the drawer and scroll away with the page, the navbar
   * stays.
   */
  banner?: React.ReactNode;
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

/** Whether a node renders anything - `false`, `null` and `""` do not. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

/**
 * The page frame of an app: a `Drawer` at the start edge (the left one, the
 * right one right to left), banners and a `Navbar` on top and the page
 * content in `<main>`, which make room for the drawer as it opens and
 * collapses. Provides the drawer state (`DrawerProvider`) itself. Printed,
 * only the content is - full width. `ref` and the other props go to the
 * `<main>`.
 */
export default function AppShell({
  banner,
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
      {/* The layout CSS positions the banners, the navbar and main as
          siblings of the drawer */}
      {drawer}
      {hasContent(banner) && <div className="cui-banners">{banner}</div>}
      {navbar}
      <main {...props} className={cn("min-w-0", className)}>
        {children}
      </main>
    </DrawerProvider>
  );
}
