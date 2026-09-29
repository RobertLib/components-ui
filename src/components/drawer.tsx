import { ChevronRight } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import cn from "../utils/cn";
import CollapsibleContent from "./collapsible-content";
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
import Tooltip from "./tooltip";
import { getTabbableElements } from "../utils/tabbable";
import useIsMobile from "../hooks/use-is-mobile";
import { findActiveLink } from "../providers/active-path";
import { useDrawer } from "../providers/drawer-context";
import { useMessages, useRouter } from "../providers/ui-context";

/** A menu entry - `false`, `null` and `undefined` are skipped. */
export type DrawerEntry = DrawerItem | false | null | undefined;

export interface DrawerItem {
  /**
   * A count or a short status at the end of the item, e.g. `12` or "New" -
   * a dot on the icon while the drawer is collapsed. Screen readers read it
   * after the label.
   */
  badge?: React.ReactNode;
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
  /**
   * Called when the item is clicked. An item without `href` becomes a
   * button that does only this - e.g. opens a search or a dialog. On phones
   * the drawer slides out first. Not called for a group.
   */
  onClick?: () => void;
}

/**
 * Items under a heading, e.g. "Administration" - a line while the drawer is
 * collapsed. A section without visible items is hidden.
 */
export interface DrawerSection {
  /** The items of the section - falsy ones are skipped, as in `items`. */
  items: DrawerEntry[];
  /** Heading above the items - also the accessible name of their list. */
  label?: string;
  type: "section";
}

/**
 * A line between entries. None is shown at the start or the end of the
 * menu, nor two in a row - the entries between them may be hidden.
 */
export interface DrawerSeparator {
  type: "separator";
}

/**
 * An entry of the top level of the menu - an item, a section or a
 * separator. `false`, `null` and `undefined` are skipped.
 */
export type DrawerMenuEntry = DrawerEntry | DrawerSection | DrawerSeparator;

/** State of the drawer passed to a `header` or `footer` function. */
export interface DrawerSlotState {
  /** The drawer shows icons only. */
  isCollapsed: boolean;
}

/**
 * Content of the header or footer - hidden while the drawer is collapsed.
 * A function renders in both states, e.g. a logo mark while collapsed.
 */
export type DrawerSlot =
  React.ReactNode | ((state: DrawerSlotState) => React.ReactNode);

export interface DrawerProps extends React.ComponentProps<"nav"> {
  /**
   * Shown at the bottom, below the scrolling menu - e.g. the account, a
   * link to help or the version. See `header` for the collapsed drawer.
   */
  footer?: DrawerSlot;
  /**
   * Shown at the top while the drawer is expanded, e.g. the app logo. A
   * function also renders while it is collapsed:
   * `({ isCollapsed }) => (isCollapsed ? <LogoMark /> : <Logo />)`.
   */
  header?: DrawerSlot;
  /** Shows placeholder items, e.g. while the user's permissions load. */
  isLoading?: boolean;
  /**
   * The menu - items, `{ type: "section" }` items under a heading and
   * `{ type: "separator" }` lines. Falsy entries are skipped, so items the
   * user may not see can be written as `canEdit && { … }`; groups and
   * sections left without items are hidden.
   */
  items: DrawerMenuEntry[];
}

/** Whether an entry is an item - not a section or a separator. */
const isItem = (
  entry: DrawerItem | DrawerSection | DrawerSeparator,
): entry is DrawerItem => !("type" in entry);

/** The entries to render - falsy ones and empty groups left out. */
const visibleItems = (entries: DrawerEntry[] = []): DrawerItem[] =>
  entries.filter(
    (entry): entry is DrawerItem =>
      !!entry && (!entry.children || visibleItems(entry.children).length > 0),
  );

/** The items and all their descendants, in the order of the menu. */
const flattenItems = (items: DrawerItem[]): DrawerItem[] =>
  items.flatMap((item) => [item, ...flattenItems(visibleItems(item.children))]);

/** What the top level of the menu renders, in order. */
type MenuNode =
  | { item: DrawerItem; kind: "item" }
  | { items: DrawerItem[]; kind: "section"; label?: string }
  | { kind: "separator" };

/**
 * The top level of the menu - falsy entries, empty groups and sections and
 * the separators they leave at an end or next to each other left out.
 */
function getMenuNodes(entries: DrawerMenuEntry[]): MenuNode[] {
  const nodes: MenuNode[] = [];

  for (const entry of entries) {
    if (!entry) continue;

    if (isItem(entry)) {
      if (visibleItems([entry]).length > 0) {
        nodes.push({ item: entry, kind: "item" });
      }
    } else if (entry.type === "section") {
      const items = visibleItems(entry.items);
      if (items.length > 0) {
        nodes.push({ items, kind: "section", label: entry.label });
      }
    } else if (nodes.length > 0 && nodes.at(-1)!.kind !== "separator") {
      nodes.push({ kind: "separator" });
    }
  }

  if (nodes.at(-1)?.kind === "separator") nodes.pop();
  return nodes;
}

/** The items of the menu nodes - of the sections too. */
const itemsOf = (nodes: MenuNode[]) =>
  nodes.flatMap((node) =>
    node.kind === "item"
      ? [node.item]
      : node.kind === "section"
        ? node.items
        : [],
  );

/** The name an item is told apart by - see `DrawerItem.id`. */
const itemKey = (item: DrawerItem) => item.id ?? item.href ?? item.label;

/**
 * Keys of the entries of one list - by the item's `id`, `href` or `label`,
 * so that the state of a group stays with it when the entries before it
 * change. A key two entries share is told apart by a number.
 */
function uniqueKeys(names: string[]) {
  const counts = new Map<string, number>();

  return names.map((name) => {
    const count = counts.get(name) ?? 0;
    counts.set(name, count + 1);
    return count === 0 ? name : `${name}#${count}`;
  });
}

/** Keys of a list of items - see `uniqueKeys`. */
const getItemKeys = (items: DrawerItem[]) => uniqueKeys(items.map(itemKey));

/** Keys of the top level - sections by their label, separators in turn. */
const getNodeKeys = (nodes: MenuNode[]) =>
  uniqueKeys(
    nodes.map((node) =>
      node.kind === "item"
        ? itemKey(node.item)
        : node.kind === "section"
          ? `section:${node.label ?? ""}`
          : "separator",
    ),
  );

/** The content of a header or footer in the current state, if any. */
const renderSlot = (slot: DrawerSlot, isCollapsed: boolean) =>
  typeof slot === "function"
    ? slot({ isCollapsed })
    : isCollapsed
      ? null
      : slot;

const hasContent = (node: React.ReactNode) =>
  node != null && node !== false && node !== "";

// The hover time before the name of an item shows while the drawer is
// collapsed - short, it is the only place the name is written
const TOOLTIP_DELAY = 200;

/**
 * The side navigation of an app. Collapses to icons on desktop and slides in
 * over the page on phones - the state lives in `DrawerProvider`, `Navbar`
 * toggles it. See `AppShell` for the page layout around it.
 */
export default function Drawer({
  className,
  footer,
  header,
  isLoading,
  items,
  ...props
}: DrawerProps) {
  const { isCollapsed, isOpen, toggleOpen } = useDrawer();
  const messages = useMessages();
  const { pathname, search } = useRouter();

  const menuNodes = getMenuNodes(items);
  const nodeKeys = getNodeKeys(menuNodes);
  // Of several matching items the most specific - `/users/new` over
  // `/users` on `/users/new`
  const activeItem = findActiveLink(
    flattenItems(itemsOf(menuNodes)),
    (item) => item.href,
    pathname,
    search,
  );

  const headerContent = renderSlot(header, isCollapsed);
  const footerContent = renderSlot(footer, isCollapsed);

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

  // The current page out of sight in a long menu - on a page opened by its
  // address, or reached from a search - is scrolled to the middle of the
  // menu. Only the menu scrolls, not the page; nothing moves while the page
  // stays the same, so the menu keeps where the user scrolled it.
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeHref = activeItem?.href;

  useEffect(() => {
    const list = scrollRef.current;
    const link = list?.querySelector<HTMLElement>("[aria-current=page]");
    if (!list || !link) return;

    const listRect = list.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (linkRect.top >= listRect.top && linkRect.bottom <= listRect.bottom) {
      return;
    }
    list.scrollTop +=
      linkRect.top - listRect.top - (list.clientHeight - linkRect.height) / 2;
  }, [activeHref, isLoading]);

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
            {hasContent(headerContent) && (
              <div
                className={cn(
                  "shrink-0 p-4 pb-1",
                  isCollapsed && "flex justify-center px-2",
                )}
              >
                {headerContent}
              </div>
            )}

            {/* Collapsed, the items reach the edge of the drawer - the
                popovers and tooltips next to them start right past it */}
            <div
              className={cn(
                "flex-1 overflow-y-auto",
                isCollapsed ? "p-2 py-4" : "p-4",
              )}
              ref={scrollRef}
            >
              <ul className="space-y-1">
                {isLoading ? (
                  <DrawerSkeleton isCollapsed={isCollapsed} />
                ) : (
                  menuNodes.map((node, index) =>
                    node.kind === "item" ? (
                      <DrawerMenuItem
                        activeItem={activeItem}
                        item={node.item}
                        key={nodeKeys[index]}
                        isCollapsed={isCollapsed}
                      />
                    ) : node.kind === "section" ? (
                      <DrawerMenuSection
                        activeItem={activeItem}
                        isCollapsed={isCollapsed}
                        isFirst={index === 0}
                        items={node.items}
                        key={nodeKeys[index]}
                        label={node.label}
                      />
                    ) : (
                      // Only a line for the eye - the lists of the sections
                      // are named, a separator would only be read out
                      <li
                        aria-hidden="true"
                        className="mx-3 my-3 border-t border-neutral-200 dark:border-neutral-800"
                        key={nodeKeys[index]}
                      />
                    ),
                  )
                )}
              </ul>
            </div>

            {hasContent(footerContent) && (
              <div
                className={cn(
                  "shrink-0 border-t border-neutral-100 p-4 dark:border-neutral-900",
                  isCollapsed && "flex justify-center px-2",
                )}
              >
                {footerContent}
              </div>
            )}
          </OverlayContext>
        </div>
      </nav>
    </>
  );
}

/** The first letter of `label` - shown for an item without an icon. */
const initialOf = (label: string) =>
  Array.from(label.trim())[0]?.toLocaleUpperCase() ?? "";

// A row of the menu - a link, a group, an action
const rowClasses =
  "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none dark:hover:bg-neutral-800";

// The current page - and the icon of a collapsed group with it
const activeClasses =
  "bg-primary-50 font-medium text-primary-700 hover:bg-primary-100 dark:bg-primary-900/40 dark:text-primary-300 dark:hover:bg-primary-900/60";

interface DrawerMenuSectionProps {
  /** The one active item of the whole menu. */
  activeItem?: DrawerItem;
  /** The first entry of the menu - no line above it while collapsed. */
  isFirst?: boolean;
  /** The drawer shows icons only - a line in place of the heading. */
  isCollapsed?: boolean;
  /** The visible items of the section. */
  items: DrawerItem[];
  /** The heading. */
  label?: string;
}

/**
 * A section of the menu - its items in a list named by the heading above
 * them. Collapsed, a line takes the place of the heading, which screen
 * readers still read.
 */
function DrawerMenuSection({
  activeItem,
  isCollapsed,
  isFirst,
  items,
  label,
}: DrawerMenuSectionProps) {
  const labelId = useId();
  const keys = getItemKeys(items);

  return (
    <li className={cn(!isFirst && (isCollapsed ? "pt-2" : "pt-4"))}>
      {isCollapsed && !isFirst && (
        <div
          aria-hidden="true"
          className="mx-2 mb-2 border-t border-neutral-200 dark:border-neutral-800"
        />
      )}
      {label && (
        <div
          className={cn(
            "px-3 pb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400",
            isCollapsed && "sr-only",
          )}
          id={labelId}
        >
          {label}
        </div>
      )}
      <ul aria-labelledby={label ? labelId : undefined} className="space-y-1">
        {items.map((item, index) => (
          <DrawerMenuItem
            activeItem={activeItem}
            isCollapsed={isCollapsed}
            item={item}
            key={keys[index]}
          />
        ))}
      </ul>
    </li>
  );
}

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
  // The group holds the current page, but does not show it - closed, or
  // collapsed to its icon: the group is marked in its place
  const hidesActiveChild = hasActiveChild && (iconOnly || !isExpanded);
  const hasBadge = hasContent(item.badge);

  const handleToggle = (event: React.MouseEvent) => {
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

  // A link or an action - on phones the drawer slides out first. For an
  // action at once: the drawer gives the focus back to its toggle, so that
  // a dialog the action opens returns the focus there - not into the
  // drawer, which is inert then.
  const handleClick = () => {
    if (isMobile) {
      if (item.href) toggleOpen();
      else flushSync(toggleOpen);
    }
    item.onClick?.();
  };

  const icon = item.icon ? (
    <span aria-hidden="true" className="flex shrink-0">
      {item.icon}
    </span>
  ) : (
    iconOnly && (
      // Something to point at, where an icon would be - the name is still
      // read, and shown next to it
      <span
        aria-hidden="true"
        className="flex size-4.5 items-center justify-center leading-none font-semibold"
      >
        {initialOf(item.label)}
      </span>
    )
  );

  const content = (
    <>
      {icon}
      {/* Collapsed, the name is only read - a tooltip or the popover of the
          group shows it */}
      <span className={iconOnly ? "sr-only" : "min-w-0 flex-1 break-words"}>
        {item.label}
      </span>
      {hasBadge && (
        <>
          {/* Read after the label - "Inbox 12", not "Inbox12" */}{" "}
          {iconOnly ? (
            <>
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-3 size-2 rounded-full bg-primary-600 ring-2 ring-surface dark:bg-primary-400 dark:ring-surface-dark"
              />
              <span className="sr-only">{item.badge}</span>
            </>
          ) : (
            <span className="shrink-0 rounded-full bg-neutral-200 px-1.5 text-xs leading-5 font-medium text-neutral-700 tabular-nums dark:bg-neutral-700 dark:text-neutral-200">
              {item.badge}
            </span>
          )}
        </>
      )}
      {hasChildren && !isCollapsed && (
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-neutral-500 transition-transform duration-200 motion-reduce:transition-none dark:text-neutral-400",
            isExpanded && "rotate-90",
          )}
        />
      )}
    </>
  );

  const rowClassName = cn(
    rowClasses,
    (isActive || (iconOnly && hidesActiveChild)) && activeClasses,
    // A closed group with the current page - in its color
    !iconOnly &&
      hidesActiveChild &&
      "font-medium text-primary-700 dark:text-primary-300",
    // Of a nested item, the part of the guide line beside it
    isActive &&
      level > 0 &&
      "before:absolute before:inset-y-1.5 before:-left-2.5 before:w-0.5 before:rounded-full before:bg-primary-600 dark:before:bg-primary-400",
    iconOnly && "justify-center",
  );

  const groupButton = (
    <button
      aria-controls={hasChildren && isGroupOpen ? submenuId : undefined}
      aria-expanded={isGroupOpen}
      className={rowClassName}
      onClick={handleToggle}
      ref={groupButtonRef}
      type="button"
    >
      {content}
    </button>
  );

  const leaf = item.href ? (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={rowClassName}
      href={item.href}
      onClick={handleClick}
    >
      {content}
    </Link>
  ) : (
    <button
      className={rowClassName}
      onClick={item.onClick ? handleClick : undefined}
      type="button"
    >
      {content}
    </button>
  );

  return (
    <li className="relative">
      {!hasChildren ? (
        iconOnly ? (
          <Tooltip
            className="flex w-full"
            delay={TOOLTIP_DELAY}
            nowrap
            position="right"
            title={
              <span className="flex items-center gap-2">
                {item.label}
                {hasBadge && (
                  <span className="rounded bg-neutral-700 px-1 text-xs tabular-nums">
                    {item.badge}
                  </span>
                )}
              </span>
            }
          >
            {/* In a fragment: the item is named by its label already - the
                tooltip shows the name, it does not describe the item with
                it once more */}
            <>{leaf}</>
          </Tooltip>
        ) : (
          leaf
        )
      ) : inPopover ? (
        // The group is the trigger of the popover: one hover logic for both,
        // with the delay that lets the pointer cross over to the popover.
        // Beside the drawer, not over the items below the group.
        <Popover
          contentClassName="p-2"
          contentLabel={item.label}
          contentRef={popoverContentRef}
          onOpenChange={handlePopoverOpenChange}
          open={showPopover}
          position="right"
          trigger={groupButton}
          width="12rem"
        >
          <div className="px-3 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {item.label}
          </div>
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

      {/* The items of the group slide open and closed - beside a guide line
          under the icon of the group */}
      {hasChildren && !isCollapsed && (
        <CollapsibleContent duration={200} id={submenuId} isOpen={isExpanded}>
          <ul
            className={cn(
              "mt-1 space-y-1 border-l border-neutral-200 pl-2 dark:border-neutral-800",
              item.icon ? "ml-5" : "ml-3",
            )}
          >
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
        </CollapsibleContent>
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
