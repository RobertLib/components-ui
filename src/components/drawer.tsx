import { ChevronRight } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import cn from "../utils/cn";
import Overlay from "./overlay";
import {
  isTopmostOverlay,
  lockPageScroll,
  OverlayContext,
  useFocusTrap,
  useOverlayLayer,
} from "./overlay-stack";
import Popover from "./popover";
import { getNextTabbable, getTabbableElements } from "../utils/tabbable";
import useIsMobile from "../hooks/use-is-mobile";
import { isActivePath } from "../providers/router";
import { useDrawer } from "../providers/drawer-context";
import { useMessages, useRouter } from "../providers/ui-context";

/** A menu entry - `false`, `null` and `undefined` are skipped. */
export type DrawerEntry = DrawerItem | false | null | undefined;

export interface DrawerItem {
  /**
   * Nested items - the item becomes an expandable group. A group without
   * any visible children is hidden.
   */
  children?: DrawerEntry[];
  /**
   * Groups only: whether the group starts expanded. By default a group is
   * expanded while it contains the current page.
   */
  defaultExpanded?: boolean;
  /**
   * Link target - the item is active on this path and below it, unless a
   * more specific item matches (`/users/new` rather than `/users`).
   */
  href?: string;
  /** Icon before the label - the only thing shown while collapsed. */
  icon?: React.ReactNode;
  label: string;
}

export interface DrawerProps extends React.ComponentProps<"aside"> {
  /** Shown at the top while the drawer is expanded, e.g. the app logo. */
  header?: React.ReactNode;
  /** Shows placeholder items, e.g. while the user's permissions load. */
  isLoading?: boolean;
  /**
   * The menu. Falsy entries are skipped, so items the user may not see can
   * be written as `canEdit && { … }`; groups left without children are hidden.
   */
  items: DrawerEntry[];
}

/** The entries to render - falsy ones and empty groups left out. */
const visibleItems = (entries: DrawerEntry[] = []): DrawerItem[] =>
  entries.filter(
    (entry): entry is DrawerItem =>
      !!entry && (!entry.children || visibleItems(entry.children).length > 0),
  );

const pathOf = (href: string) => href.split(/[?#]/)[0];

/**
 * The `href` of the active item - of several matching ones the most
 * specific: `/users/new` over `/users` on `/users/new`.
 */
function findActiveHref(items: DrawerItem[], pathname: string) {
  let activeHref: string | undefined;

  const visit = (entries: DrawerItem[]) => {
    for (const item of entries) {
      if (
        item.href &&
        isActivePath(pathname, item.href) &&
        (!activeHref || pathOf(item.href).length > pathOf(activeHref).length)
      ) {
        activeHref = item.href;
      }
      visit(visibleItems(item.children));
    }
  };

  visit(items);
  return activeHref;
}

/**
 * The side navigation of an app. Collapses to icons on desktop and slides in
 * over the page on phones - the state lives in `DrawerProvider`, `Navbar`
 * toggles it. See `AppShell` for the page layout around it.
 */
export default function Drawer({
  className,
  header,
  isLoading,
  items,
  ...props
}: DrawerProps) {
  const { isCollapsed, isOpen, toggleOpen } = useDrawer();
  const messages = useMessages();
  const { pathname } = useRouter();

  const menuItems = visibleItems(items);
  const activeHref = findActiveHref(menuItems, pathname);

  const isMobile = useIsMobile();
  const isOverlaid = isOpen && isMobile;
  const asideRef = useRef<HTMLElement>(null);

  // Slid in over the page, the drawer is modal - in the overlay stack shared
  // with dialogs and popovers, so Escape closes only the topmost of them
  const { childContext, id: layerId } = useOverlayLayer(isOverlaid, {
    getElements: () => [asideRef.current],
    modal: true,
  });

  // The slid-in drawer closes on Escape, wherever the focus is - unless a
  // Dialog or popover above it takes this Escape
  useEffect(() => {
    if (!isOverlaid) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        isTopmostOverlay(layerId)
      ) {
        event.preventDefault();
        toggleOpen();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOverlaid, layerId, toggleOpen]);

  // Slid in: the focus moves in and the page stops scrolling. Slid out, the
  // focus goes back to what had it (the toggle of the Navbar) instead of
  // being lost in the now inert drawer. In the layout phase: React puts the
  // focus back where it was after the mutations of a commit.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;

    if (isOverlaid) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      if (!aside.contains(document.activeElement)) {
        (getTabbableElements(aside)[0] ?? aside).focus();
      }
      return lockPageScroll();
    }

    const returnFocus = returnFocusRef.current;
    returnFocusRef.current = null;
    const active = document.activeElement;
    // Unless the focus has moved somewhere else meanwhile
    if (!active || active === document.body || aside.contains(active)) {
      returnFocus?.focus?.();
    }
  }, [isOverlaid]);

  // Tab stays in the slid-in drawer
  useFocusTrap(isOverlaid, layerId, asideRef);

  return (
    <>
      {isOverlaid && (
        <Overlay
          aria-label={messages.common.close}
          onClick={toggleOpen}
          role="button"
        />
      )}
      <aside
        {...props}
        aria-hidden={!isOpen}
        aria-label={messages.drawer.label}
        className={cn(
          "drawer fixed inset-y-0 left-0 z-40 flex flex-col border-r border-neutral-100 bg-surface shadow-lg transition-all duration-300 focus:outline-none dark:border-neutral-900 dark:bg-surface-dark",
          isCollapsed ? "drawer-collapsed" : "",
          isOpen
            ? "drawer-open translate-x-0"
            : "drawer-closed -translate-x-full",
          className,
        )}
        inert={!isOpen}
        ref={asideRef}
        // Takes the focus when it slides in without any link in it
        tabIndex={isOverlaid ? -1 : undefined}
      >
        {!isCollapsed && header && (
          <div className="shrink-0 p-4 pb-1">{header}</div>
        )}

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            <OverlayContext value={childContext}>
              {isLoading ? (
                <DrawerSkeleton isCollapsed={isCollapsed} />
              ) : (
                menuItems.map((item, index) => (
                  <DrawerMenuItem
                    activeHref={activeHref}
                    item={item}
                    key={index}
                    isCollapsed={isCollapsed}
                  />
                ))
              )}
            </OverlayContext>
          </ul>
        </nav>
      </aside>
    </>
  );
}

interface DrawerMenuItemProps {
  /** The `href` of the one active item of the whole menu. */
  activeHref?: string;
  isCollapsed?: boolean;
  item: DrawerItem;
  level?: number;
}

function DrawerMenuItem({
  activeHref,
  isCollapsed,
  item,
  level = 0,
}: DrawerMenuItemProps) {
  const { Link } = useRouter();
  const isMobile = useIsMobile();
  const { toggleOpen } = useDrawer();
  const submenuId = useId();

  const children = visibleItems(item.children);
  const hasChildren = children.length > 0;

  const containsActive = (entries: DrawerItem[]): boolean =>
    entries.some(
      (child) =>
        (!!child.href && child.href === activeHref) ||
        containsActive(visibleItems(child.children)),
    );

  const [isExpanded, setIsExpanded] = useState(
    () => hasChildren && (item.defaultExpanded ?? containsActive(children)),
  );
  const [showPopover, setShowPopover] = useState(false);
  const groupButtonRef = useRef<HTMLButtonElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  // The popover was opened from the keyboard - its first link takes the focus
  const focusPopoverRef = useRef(false);

  const isActive = !!item.href && item.href === activeHref;

  const handleToggle = (event: React.MouseEvent) => {
    if (!hasChildren) return;

    if (!isCollapsed) {
      setIsExpanded((prev) => !prev);
      return;
    }

    // Collapsed, the children are in a popover. The pointer opens it by
    // hovering; a key press (a click with no `detail`) toggles it.
    if (event.detail !== 0) return;
    focusPopoverRef.current = !showPopover;
    setShowPopover(!showPopover);
  };

  const handlePopoverOpenChange = (open: boolean) => {
    // The focus in a closing popover goes back to its group (Escape)
    if (!open && popoverContentRef.current?.contains(document.activeElement)) {
      groupButtonRef.current?.focus();
    }
    setShowPopover(open);
  };

  // Tab leaves the popover - a portal at the end of the page - as if its
  // links followed the group: back to it, or on to the next item
  const handlePopoverKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const group = groupButtonRef.current;
    if (event.key !== "Tab" || !group) return;

    const links = getTabbableElements(event.currentTarget);
    const edge = event.shiftKey ? links[0] : links.at(-1);
    if (event.target !== edge) return;

    event.preventDefault();
    setShowPopover(false);
    (event.shiftKey
      ? group
      : (getNextTabbable(group, popoverContentRef.current) ?? group)
    ).focus();
  };

  const handleLinkClick = () => {
    if (isMobile) {
      toggleOpen();
    }
  };

  return (
    <li
      className="relative"
      onMouseOver={() => isCollapsed && setShowPopover(true)}
      onMouseOut={() => isCollapsed && setShowPopover(false)}
    >
      {item.href && !hasChildren ? (
        <Link
          aria-current={isActive ? "page" : undefined}
          aria-label={isCollapsed && level === 0 ? item.label : undefined}
          className={cn(
            "flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors hover:bg-neutral-100 focus:ring-2 focus:ring-primary-300 focus:outline-none dark:hover:bg-neutral-800",
            isActive &&
              "bg-neutral-100 font-medium text-primary-600 dark:bg-neutral-800 dark:text-primary-400",
            level > 0 && "pl-7",
            isCollapsed && level === 0 && "justify-center",
          )}
          href={item.href}
          onClick={handleLinkClick}
          title={isCollapsed && level === 0 ? item.label : undefined}
        >
          {item.icon && (
            <span
              aria-hidden="true"
              className={cn(!(isCollapsed && level === 0) && "mr-3")}
            >
              {item.icon}
            </span>
          )}
          {(!isCollapsed || level > 0) && item.label}
        </Link>
      ) : (
        <button
          aria-controls={hasChildren ? submenuId : undefined}
          aria-expanded={
            hasChildren ? (isCollapsed ? showPopover : isExpanded) : undefined
          }
          aria-label={isCollapsed && level === 0 ? item.label : undefined}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800",
            isActive &&
              "bg-neutral-100 font-medium text-primary-600 dark:bg-neutral-800 dark:text-primary-400",
            level > 0 && "pl-7",
            isCollapsed && level === 0 && "justify-center",
          )}
          onClick={handleToggle}
          ref={groupButtonRef}
          type="button"
        >
          <span className="flex items-center">
            {item.icon && (
              <span
                aria-hidden="true"
                className={cn(!(isCollapsed && level === 0) && "mr-3")}
              >
                {item.icon}
              </span>
            )}
            {(!isCollapsed || level > 0) && item.label}
          </span>
          {hasChildren && !isCollapsed && (
            <span className="ml-auto">
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isExpanded && "rotate-90",
                )}
              />
            </span>
          )}
        </button>
      )}

      {hasChildren && isExpanded && !isCollapsed && (
        <ul className="mt-1 animate-slide-down space-y-1" id={submenuId}>
          {children.map((child, index) => (
            <DrawerMenuItem
              activeHref={activeHref}
              isCollapsed={isCollapsed}
              item={child}
              key={index}
              level={level + 1}
            />
          ))}
        </ul>
      )}

      {isCollapsed && hasChildren && level === 0 && showPopover && (
        <Popover
          contentClassName="p-2"
          contentLabel={item.label}
          contentRef={popoverContentRef}
          onOpenChange={handlePopoverOpenChange}
          open={showPopover}
          position="bottom"
        >
          <div className="px-3 py-1 font-medium">{item.label}</div>
          <ul
            className="mt-1 space-y-1"
            id={submenuId}
            onKeyDown={handlePopoverKeyDown}
            ref={(list) => {
              if (list && focusPopoverRef.current) {
                focusPopoverRef.current = false;
                getTabbableElements(list)[0]?.focus();
              }
            }}
          >
            {children.map((child, index) => (
              <DrawerMenuItem
                activeHref={activeHref}
                isCollapsed={false}
                item={child}
                key={index}
              />
            ))}
          </ul>
        </Popover>
      )}
    </li>
  );
}

interface DrawerSkeletonProps {
  isCollapsed?: boolean;
}

function DrawerSkeleton({ isCollapsed }: DrawerSkeletonProps) {
  const skeletonItems = Array.from({ length: 5 }, (_, index) => index);

  return (
    <>
      {skeletonItems.map((index) => (
        <li key={index} className="animate-pulse">
          <div
            className={cn(
              "flex w-full items-center rounded-lg px-3 py-2",
              isCollapsed ? "justify-center" : "justify-start",
            )}
          >
            {/* Icon skeleton */}
            <div className="h-5 w-5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            {/* Label skeleton */}
            {!isCollapsed && (
              <div className="ml-3 h-4 max-w-24 flex-1 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            )}
          </div>
        </li>
      ))}
    </>
  );
}
