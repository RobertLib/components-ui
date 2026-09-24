import { Loader, Menu, PanelLeft, PanelLeftClose } from "lucide-react";
import Avatar from "./avatar";
import cn from "../utils/cn";
import Dropdown, { type DropdownEntry } from "./dropdown";
import IconButton from "./icon-button";
import useIsMobile from "../hooks/use-is-mobile";
import { useDrawer } from "../providers/drawer-context";
import { useMessages } from "../providers/ui-context";

export interface NavbarUser {
  /** Picture URL for the avatar; the initials of `name` are shown without it. */
  avatarUrl?: string;
  /** Second line under the name, e.g. the role. */
  description?: React.ReactNode;
  /**
   * Entries of the menu opened by clicking the user, e.g. "Log out" - the
   * items of `Dropdown`, also separators, groups and submenus.
   */
  menuItems?: DropdownEntry[];
  /** Name of the user, next to the avatar. */
  name: string;
}

export interface NavbarProps extends React.ComponentProps<"nav"> {
  /** Content on the right side, before the user menu. */
  actions?: React.ReactNode;
  /** Content next to the drawer toggle, e.g. breadcrumbs or a search field. */
  children?: React.ReactNode;
  /** Shows a spinner instead of the right side, e.g. while the session loads. */
  loading?: boolean;
  /** Hides the button that toggles the `Drawer`. */
  noDrawerToggle?: boolean;
  /** The signed-in user, shown on the right with a dropdown menu. */
  user?: NavbarUser | null;
}

/**
 * The top bar of an app. Toggles the `Drawer` (collapse on desktop, slide in
 * on phones) and shows the signed-in user with a menu.
 */
export default function Navbar({
  actions,
  children,
  className,
  loading = false,
  noDrawerToggle = false,
  ref,
  user,
  ...props
}: NavbarProps) {
  const { isCollapsed, isOpen, toggleCollapsed, toggleOpen } = useDrawer();
  const isMobile = useIsMobile();
  const messages = useMessages();

  // The name is written out next to the avatar - the avatar (its picture's
  // alt text, its title) would name the user a second time
  const userInfo = user && (
    <div className="flex items-center gap-2.5">
      <Avatar
        aria-hidden="true"
        name={user.name}
        size="md"
        src={user.avatarUrl}
      />
      <div className="-my-1 text-left">
        <div>{user.name}</div>
        {user.description && (
          <div className="text-sm text-primary-600 dark:text-primary-400">
            {user.description}
          </div>
        )}
      </div>
    </div>
  );

  return (
    // The header is the landmark - the bar holds a toggle, a user menu and
    // the content of the app, not a navigation of its own (the Drawer and
    // the Breadcrumbs in it are named ones)
    <header className="navbar sticky top-0 z-20 bg-surface dark:bg-surface-dark">
      <div
        {...props}
        className={cn(
          "flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-3 dark:border-neutral-900",
          className,
        )}
        // The props are typed for any `HTMLElement` - a div is one
        ref={ref as React.Ref<HTMLDivElement>}
      >
        <div className="flex min-w-0 items-center gap-4">
          {!noDrawerToggle && (
            <IconButton
              // Slid in on phones, not collapsed to icons on desktop
              aria-expanded={isMobile ? isOpen : !isCollapsed}
              aria-label={
                isMobile
                  ? messages.navbar.toggleMenu
                  : messages.navbar.toggleSidebar
              }
              onClick={isMobile ? toggleOpen : toggleCollapsed}
            >
              {isMobile ? (
                <Menu size={20} />
              ) : isCollapsed ? (
                <PanelLeft size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </IconButton>
          )}
          {children}
        </div>
        {loading ? (
          <Loader
            aria-hidden="true"
            className="animate-spin text-neutral-500 dark:text-neutral-400"
            size={20}
          />
        ) : (
          <div className="flex items-center gap-2.5">
            {actions}
            {user &&
              (user.menuItems?.length ? (
                <Dropdown items={user.menuItems} trigger={userInfo} />
              ) : (
                userInfo
              ))}
          </div>
        )}
      </div>
    </header>
  );
}
