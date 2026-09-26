import { ChevronRight } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import cn from "../utils/cn";
import Overlay from "./overlay";
import {
  getActiveFocusReturnTargets,
  getNextTabStop,
  isEscapeKey,
  isTopmostOverlay,
  lockPageScroll,
  OverlayContext,
  returnFocus,
  useFocusTrap,
  useOverlayLayer,
} from "./overlay-stack";
import Popover from "./popover";
import { getTabbableElements } from "../utils/tabbable";
import useIsMobile from "../hooks/use-is-mobile";
import { findActiveLink } from "../providers/active-path";
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
   * Groups only: whether the group starts expanded - by default when it
   * contains the current page. A group also expands when the current page
   * moves into it; one the user expanded stays expanded.
   */
  defaultExpanded?: boolean;
  /**
   * Link target - the item is active on this path and below it, unless a
   * more specific item matches: `/users/new` rather than `/users`, and of
   * links to one path the one whose query parameters the page has
   * (`/tasks?filter=mine` rather than `/tasks?filter=all`).
   */
  href?: string;
  /**
   * Icon before the label - the only thing shown while collapsed (without
   * one, the first letter of the label is).
   */
  icon?: React.ReactNode;
  /**
   * Tells the item apart from the others of its level, so that a group
   * keeps its state (expanded) while entries before it come and go - by
   * default its `href`, else its `label`.
   */
  id?: string;
  /** Text of the item - its name, also while the drawer is collapsed. */
  label: string;
}

export interface DrawerProps extends React.ComponentProps<"nav"> {
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

/** The items and all their descendants, in the order of the menu. */
const flattenItems = (items: DrawerItem[]): DrawerItem[] =>
  items.flatMap((item) => [item, ...flattenItems(visibleItems(item.children))]);

/**
 * The keys of `items` - by their `id`, `href` or `label`, so that the state
 * of a group stays with it when the entries before it change. A key two
 * items share is told apart by a number.
 */
function getItemKeys(items: DrawerItem[]) {
  const counts = new Map<string, number>();

  return items.map((item) => {
    const key = item.id ?? item.href ?? item.label;
    const count = counts.get(key) ?? 0;
    counts.set(key, count + 1);
    return count === 0 ? key : `${key}#${count}`;
  });
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
  const { pathname, search } = useRouter();

  const menuItems = visibleItems(items);
  const menuKeys = getItemKeys(menuItems);
  // Of several matching items the most specific - `/users/new` over
  // `/users` on `/users/new`
  const activeItem = findActiveLink(
    flattenItems(menuItems),
    (item) => item.href,
    pathname,
    search,
  );

  const isMobile = useIsMobile();
  const isOverlaid = isOpen && isMobile;
  const rootRef = useRef<HTMLElement>(null);
  // The content of the drawer - the modal dialog while it is slid in
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Slid in over the page, the drawer is modal - in the overlay stack shared
  // with dialogs and popovers, so Escape closes only the topmost of them.
  // Its backdrop is part of it: the page behind is hidden from assistive
  // technology, the backdrop stays - on a touch screen a screen reader
  // closes the drawer with it.
  const { childContext, id: layerId } = useOverlayLayer(isOverlaid, {
    getElements: () => [rootRef.current, backdropRef.current],
    modal: true,
  });

  // The slid-in drawer closes on Escape, wherever the focus is - unless a
  // Dialog or popover above it takes this Escape
  useEffect(() => {
    if (!isOverlaid) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        isEscapeKey(event) &&
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
  // focus goes back to what had it (the toggle of the Navbar - also the one
  // Safari did not focus when it was clicked) instead of being lost in the
  // now inert drawer. In the layout phase: React puts the focus back where
  // it was after the mutations of a commit.
  const returnFocusRef = useRef<HTMLElement[]>([]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const panel = panelRef.current;
    if (!root || !panel) return;

    if (isOverlaid) {
      returnFocusRef.current = getActiveFocusReturnTargets();
      if (!root.contains(document.activeElement)) {
        (getTabbableElements(panel)[0] ?? panel).focus();
      }
      return lockPageScroll();
    }

    const targets = returnFocusRef.current;
    returnFocusRef.current = [];
    const active = document.activeElement;
    // Unless the focus has moved somewhere else meanwhile
    if (!active || active === document.body || root.contains(active)) {
      returnFocus(targets, root);
    }
  }, [isOverlaid]);

  // Tab stays in the slid-in drawer
  useFocusTrap(isOverlaid, layerId, panelRef);

  return (
    <>
      {/* In place, not in a portal: in a parent with a transform, a filter
          or a z-index (a demo frame) a backdrop in the body would paint
          over the drawer */}
      {isOverlaid && (
        <Overlay
          aria-label={messages.common.close}
          onClick={toggleOpen}
          portal={false}
          ref={backdropRef}
          role="button"
        />
      )}
      {/* The navigation landmark of the app - named, as the page may have
          more of them (breadcrumbs, pagination) */}
      <nav
        aria-label={messages.drawer.label}
        {...props}
        aria-hidden={!isOpen}
        className={cn(
          "cui-drawer fixed inset-y-0 left-0 z-40 flex flex-col border-r border-neutral-100 bg-surface shadow-lg transition-all duration-300 motion-reduce:transition-none dark:border-neutral-900 dark:bg-surface-dark",
          isCollapsed ? "cui-drawer-collapsed" : "",
          isOpen
            ? "cui-drawer-open translate-x-0"
            : "cui-drawer-closed -translate-x-full",
          // Open as on a desktop, but on a phone-sized screen: a page
          // rendered on the server, before it hydrates - out of sight until
          // the drawer knows the device
          isOpen && !isMobile && "max-md:-translate-x-full",
          className,
        )}
        inert={!isOpen}
        ref={rootRef}
      >
        {/* Slid in over the page, the drawer is a modal dialog - the nav
            itself cannot take that role */}
        <div
          aria-label={isOverlaid ? messages.drawer.label : undefined}
          aria-modal={isOverlaid ? true : undefined}
          className="flex min-h-0 flex-1 flex-col focus:outline-none"
          ref={panelRef}
          role={isOverlaid ? "dialog" : undefined}
          // Takes the focus when it slides in without any link in it
          tabIndex={isOverlaid ? -1 : undefined}
        >
          {/* The header too - a tooltip or popover in it is in the drawer,
              not in the page under it */}
          <OverlayContext value={childContext}>
            {!isCollapsed && header && (
              <div className="shrink-0 p-4 pb-1">{header}</div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-1">
                {isLoading ? (
                  <DrawerSkeleton isCollapsed={isCollapsed} />
                ) : (
                  menuItems.map((item, index) => (
                    <DrawerMenuItem
                      activeItem={activeItem}
                      item={item}
                      key={menuKeys[index]}
                      isCollapsed={isCollapsed}
                    />
                  ))
                )}
              </ul>
            </div>
          </OverlayContext>
        </div>
      </nav>
    </>
  );
}

/** The first letter of `label` - shown for an item without an icon. */
const initialOf = (label: string) =>
  Array.from(label.trim())[0]?.toLocaleUpperCase() ?? "";

interface DrawerMenuItemProps {
  /** The one active item of the whole menu. */
  activeItem?: DrawerItem;
  /**
   * The drawer shows icons only: a top-level item shows its icon, a group
   * its children in a popover.
   */
  isCollapsed?: boolean;
  /** The entry to render. */
  item: DrawerItem;
  /** Nesting depth - 0 at the top level. */
  level?: number;
}

function DrawerMenuItem({
  activeItem,
  isCollapsed,
  item,
  level = 0,
}: DrawerMenuItemProps) {
  const { Link } = useRouter();
  const isMobile = useIsMobile();
  const { toggleOpen } = useDrawer();
  const submenuId = useId();

  const children = visibleItems(item.children);
  const childKeys = getItemKeys(children);
  const hasChildren = children.length > 0;

  const hasActiveChild =
    hasChildren && !!activeItem && flattenItems(children).includes(activeItem);

  const [isExpanded, setIsExpanded] = useState(
    () => hasChildren && (item.defaultExpanded ?? hasActiveChild),
  );

  // The current page moved into the group - it expands. A group the user
  // expanded stays so when the page moves out of it.
  const [hadActiveChild, setHadActiveChild] = useState(hasActiveChild);
  if (hasActiveChild !== hadActiveChild) {
    setHadActiveChild(hasActiveChild);
    if (hasActiveChild) setIsExpanded(true);
  }

  const [showPopover, setShowPopover] = useState(false);
  const groupButtonRef = useRef<HTMLButtonElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  // The popover was opened from the keyboard - its first link takes the focus
  const focusPopoverRef = useRef(false);

  const isActive = !!item.href && item === activeItem;
  // Collapsed, a top-level item shows only its icon - and a group its
  // children in a popover
  const iconOnly = !!isCollapsed && level === 0;
  const inPopover = iconOnly && hasChildren;
  const isGroupOpen = inPopover ? showPopover : isExpanded;

  const handleToggle = (event: React.MouseEvent) => {
    if (!hasChildren) return;

    if (!isCollapsed) {
      setIsExpanded((prev) => !prev);
      return;
    }

    // Collapsed, the popover opens as the pointer or the keyboard focus
    // comes to the group; a key press (a click with no `detail`) moves the
    // focus into it
    if (event.detail !== 0) return;
    const firstLink = getTabbableElements(popoverContentRef.current)[0];
    if (showPopover && firstLink) {
      firstLink.focus();
      return;
    }
    focusPopoverRef.current = true;
    setShowPopover(true);
  };

  const handlePopoverOpenChange = (open: boolean) => {
    if (!open) focusPopoverRef.current = false;
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
      : (getNextTabStop(group, popoverContentRef.current) ?? group)
    ).focus();
  };

  const handleLinkClick = () => {
    if (isMobile) {
      toggleOpen();
    }
  };

  const icon = item.icon ? (
    <span aria-hidden="true" className={cn(!iconOnly && "mr-3")}>
      {item.icon}
    </span>
  ) : (
    iconOnly && (
      // Something to point at, where an icon would be - the name stays in
      // `aria-label` and `title`
      <span
        aria-hidden="true"
        className="flex size-4.5 items-center justify-center leading-none font-semibold"
      >
        {initialOf(item.label)}
      </span>
    )
  );

  const groupButton = (
    <button
      aria-controls={hasChildren && isGroupOpen ? submenuId : undefined}
      aria-expanded={hasChildren ? isGroupOpen : undefined}
      aria-label={iconOnly ? item.label : undefined}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800",
        isActive &&
          "bg-neutral-100 font-medium text-primary-600 dark:bg-neutral-800 dark:text-primary-400",
        level > 0 && "pl-7",
        iconOnly && "justify-center",
      )}
      onClick={handleToggle}
      ref={groupButtonRef}
      // The popover of a group shows its name
      title={iconOnly && !hasChildren ? item.label : undefined}
      type="button"
    >
      <span className="flex items-center">
        {icon}
        {!iconOnly && item.label}
      </span>
      {hasChildren && !isCollapsed && (
        <span className="ml-auto">
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform duration-200 motion-reduce:transition-none",
              isExpanded && "rotate-90",
            )}
          />
        </span>
      )}
    </button>
  );

  return (
    <li className="relative">
      {item.href && !hasChildren ? (
        <Link
          aria-current={isActive ? "page" : undefined}
          aria-label={iconOnly ? item.label : undefined}
          className={cn(
            "flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors hover:bg-neutral-100 focus:ring-2 focus:ring-primary-500 focus:outline-none dark:hover:bg-neutral-800",
            isActive &&
              "bg-neutral-100 font-medium text-primary-600 dark:bg-neutral-800 dark:text-primary-400",
            level > 0 && "pl-7",
            iconOnly && "justify-center",
          )}
          href={item.href}
          onClick={handleLinkClick}
          title={iconOnly ? item.label : undefined}
        >
          {icon}
          {!iconOnly && item.label}
        </Link>
      ) : inPopover ? (
        // The group is the trigger of the popover: one hover logic for both,
        // with the delay that lets the pointer cross over to the popover
        <Popover
          contentClassName="p-2"
          contentLabel={item.label}
          contentRef={popoverContentRef}
          onOpenChange={handlePopoverOpenChange}
          open={showPopover}
          position="bottom"
          trigger={groupButton}
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
                activeItem={activeItem}
                isCollapsed={false}
                item={child}
                key={childKeys[index]}
              />
            ))}
          </ul>
        </Popover>
      ) : (
        groupButton
      )}

      {hasChildren && isExpanded && !isCollapsed && (
        <ul className="mt-1 animate-slide-down space-y-1" id={submenuId}>
          {children.map((child, index) => (
            <DrawerMenuItem
              activeItem={activeItem}
              isCollapsed={isCollapsed}
              item={child}
              key={childKeys[index]}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface DrawerSkeletonProps {
  /** Placeholders for the icons only. */
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
