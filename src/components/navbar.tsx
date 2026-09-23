import { Loader, Menu, PanelLeft, PanelLeftClose } from "lucide-react";
import Avatar from "./avatar";
import cn from "../utils/cn";
import Dropdown, { type DropdownItem } from "./dropdown";
import IconButton from "./icon-button";
import useIsMobile from "../hooks/use-is-mobile";
import { useDrawer } from "../providers/drawer-context";
import { useMessages } from "../providers/ui-context";

export interface NavbarUser {
  /** Picture URL for the avatar; the initials of `name` are shown without it. */
  avatarUrl?: string;
  /** Second line under the name, e.g. the role. */
  description?: React.ReactNode;
  /** Items of the menu opened by clicking the user, e.g. "Log out". */
  menuItems?: (DropdownItem | React.ReactNode)[];
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
  user,
  ...props
}: NavbarProps) {
  const { isCollapsed, toggleCollapsed, toggleOpen } = useDrawer();
  const isMobile = useIsMobile();
  const messages = useMessages();

  const userInfo = user && (
    <div className="flex items-center gap-2.5">
      <Avatar name={user.name} size="md" src={user.avatarUrl} />
      <div className="-my-1 text-left">
        {user.name}
        {user.description && (
          <>
            <br />
            <span className="text-sm text-primary-500">{user.description}</span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <header className="navbar sticky top-0 z-20 bg-surface dark:bg-surface-dark">
      <nav
        {...props}
        className={cn(
          "flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-3 dark:border-neutral-900",
          className,
        )}
      >
        <div className="flex min-w-0 items-center gap-4">
          {!noDrawerToggle && (
            <IconButton
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
            className="animate-spin text-neutral-500"
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
      </nav>
    </header>
  );
}
