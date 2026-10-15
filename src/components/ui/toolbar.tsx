import { Ellipsis } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { attachRef } from "../../hooks/use-form-control";
import cn from "../../utils/cn";
import Button, { type ButtonProps } from "./button";
import { hasReason } from "./disabled-reason";
import Dropdown from "./dropdown";
import type { DropdownEntry } from "./menu/types";
import { getActiveElement } from "./overlay-stack";
import {
  getColumnGap,
  getContentWidth,
  getOverflowingItems,
  getShownItems,
  isSameList,
  OVERFLOW_HIDDEN_CLASSES,
} from "./overflow";
import Separator from "./separator";
import Tooltip from "./tooltip";
import { useMessages } from "../../providers/ui-context";

/** The look of the buttons of a `Toolbar`. */
export type ToolbarVariant = "solid" | "outline" | "ghost";

/** What every item of a `Toolbar` but a separator has. */
interface ToolbarItemBase {
  /** Tells the item apart from the others - unique in the toolbar. */
  id: string;
  /**
   * How long the item stays in the bar as it narrows: the items of the
   * lowest priority move into the "More" menu first - of the same priority
   * those at the end. `Infinity` keeps the item in the bar.
   * @default 0
   */
  priority?: number;
}

/** A button of a `Toolbar` - a command, or a link with `href`. */
export interface ToolbarButtonItem extends ToolbarItemBase {
  /**
   * Color of the button - the `color` of the toolbar by default. `danger`
   * marks the item in the "More" menu too.
   */
  color?: ButtonProps["color"];
  /**
   * Shows the button dimmed - it does nothing, the arrow keys skip it (but
   * not with a `disabledReason`).
   */
  disabled?: boolean;
  /**
   * Why the item is `disabled` - e.g. "Only an accountant can approve
   * invoices". The button stays a stop of the arrow keys and shows the
   * reason in its tooltip (under the label of an `iconOnly` one), the item
   * in the "More" menu under its label - see `disabledReason` of `Button`.
   * Keep it given while the item is enabled too.
   */
  disabledReason?: React.ReactNode;
  /** Renders the button as a link to this URL, through the router. */
  href?: string;
  /** An icon before the label, e.g. `<Pencil size={16} />`. */
  icon?: React.ReactNode;
  /**
   * Shows the icon alone - the label names the button and shows in a
   * tooltip. In the "More" menu the label is written out.
   */
  iconOnly?: boolean;
  /** Text of the button - also of its item in the "More" menu. */
  label: string;
  /**
   * Always in the "More" menu, never in the bar - for actions used rarely,
   * e.g. "Archive". The "More" button is then always shown.
   */
  menuOnly?: boolean;
  /** Called when the button - or its item in the menu - is pressed. */
  onClick?: () => void;
  type?: "button";
  /** Look of the button - the `variant` of the toolbar by default. */
  variant?: ToolbarVariant;
}

/**
 * A button that is on or off (`aria-pressed`), e.g. "Show archived" - a
 * checkbox item in the "More" menu.
 */
export interface ToolbarToggleItem extends ToolbarItemBase {
  /**
   * Shows the button dimmed - it does nothing, the arrow keys skip it (but
   * not with a `disabledReason`).
   */
  disabled?: boolean;
  /** Why the item is `disabled` - as `disabledReason` of a button item. */
  disabledReason?: React.ReactNode;
  /** An icon before the label. */
  icon?: React.ReactNode;
  /** Shows the icon alone - the label names it and shows in a tooltip. */
  iconOnly?: boolean;
  /** Text of the button - also of its item in the "More" menu. */
  label: string;
  /** Always in the "More" menu, never in the bar. */
  menuOnly?: boolean;
  /** Called with the other state when the button is pressed. */
  onPressedChange: (pressed: boolean) => void;
  /** Whether the button is on. */
  pressed: boolean;
  type: "toggle";
}

/** A line between groups of items - also in the "More" menu. */
export interface ToolbarSeparatorItem {
  /** Tells the separator apart - its place in `items` by default. */
  id?: string;
  type: "separator";
}

/**
 * What a custom item gives its control, so that it is a stop of the arrow
 * keys of the toolbar - spread them on it: `render: (props) => <Select
 * {...props} … />`.
 */
export interface ToolbarItemProps {
  "data-toolbar-item": string;
  /** 0 for the stop of Tab in the toolbar, -1 for the others. */
  tabIndex: number;
}

/** Content of your own in the bar, e.g. a search field or a select. */
export interface ToolbarCustomItem extends ToolbarItemBase {
  /**
   * The entry in the "More" menu when the bar has no room for the item -
   * a `DropdownItem`, or an element. Without it the item stays in the bar.
   */
  menuItem?: DropdownEntry;
  /**
   * Renders the item - spread the props on its control, so that the arrow
   * keys of the toolbar reach it. In a text field they move its caret, and
   * on along the toolbar at the end of its text.
   */
  render: (props: ToolbarItemProps) => React.ReactNode;
  type: "custom";
}

/** An item of a `Toolbar`. */
export type ToolbarItem =
  | ToolbarButtonItem
  | ToolbarToggleItem
  | ToolbarSeparatorItem
  | ToolbarCustomItem;

export interface ToolbarProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "color"
> {
  /**
   * Color of the buttons without one of their own.
   * @default "default"
   */
  color?: ButtonProps["color"];
  /**
   * The items, in their order - buttons, toggles (`type: "toggle"`),
   * separators and custom content. `null`, `false` and `undefined` are
   * skipped, so `cond && item` works.
   */
  items: (ToolbarItem | false | null | undefined)[];
  /** Accessible name of the "More" button - the localized "More" by default. */
  moreLabel?: string;
  /**
   * Size of the buttons - as high as a `Button` of the size.
   * @default "md"
   */
  size?: "sm" | "md" | "lg";
  /**
   * Look of the buttons without one of their own.
   * @default "ghost"
   */
  variant?: ToolbarVariant;
}

type ToolbarSize = NonNullable<ToolbarProps["size"]>;

// The key of the "More" button among the stops of the arrow keys - not an
// id an item would have
const MORE = "cui-toolbar-more";

// A square button for the icon alone - as high as a `Button` of the size,
// with an icon of any size given drawn to fit
const ICON_ONLY_CLASSES: Record<ToolbarSize, string> = {
  sm: "size-6.5 p-0 [&_svg]:size-4",
  md: "size-8.5 p-0 [&_svg]:size-4.5",
  lg: "size-10.5 p-0 [&_svg]:size-5",
};

// A toggle that is on - a system color in forced colors mode (`Button`)
const PRESSED_CLASSES =
  "aria-pressed:border-primary-200 aria-pressed:bg-primary-50 aria-pressed:text-primary-700 dark:aria-pressed:border-primary-800 dark:aria-pressed:bg-primary-950 dark:aria-pressed:text-primary-300";

const isSeparator = (item: ToolbarItem): item is ToolbarSeparatorItem =>
  item.type === "separator";

const isMenuOnly = (item: ToolbarItem) =>
  (item.type === undefined ||
    item.type === "button" ||
    item.type === "toggle") &&
  !!item.menuOnly;

const priorityOf = (item: ToolbarItem) =>
  isSeparator(item) ? 0 : (item.priority ?? 0);

/** Whether the item may move into the menu - it has an entry there. */
const canMove = (item: ToolbarItem) =>
  !isSeparator(item) &&
  priorityOf(item) !== Infinity &&
  (item.type !== "custom" || item.menuItem !== undefined);

// A disabled item with a reason stays a stop - its tooltip says why
const isSkipped = (item: ToolbarItem) =>
  (item.type === undefined ||
    item.type === "button" ||
    item.type === "toggle") &&
  !!item.disabled &&
  !hasReason(item.disabledReason);

/** The entry of an item in the "More" menu. */
function toMenuEntry(
  item: ToolbarButtonItem | ToolbarToggleItem | ToolbarCustomItem,
): DropdownEntry {
  if (item.type === "custom") return item.menuItem;
  if (item.type === "toggle") {
    return {
      checked: item.pressed,
      disabled: item.disabled,
      disabledReason: item.disabledReason,
      icon: item.icon,
      label: item.label,
      onCheckedChange: item.onPressedChange,
    };
  }
  return {
    danger: item.color === "danger",
    disabled: item.disabled,
    disabledReason: item.disabledReason,
    href: item.href,
    icon: item.icon,
    label: item.label,
    onClick: item.onClick,
  };
}

/**
 * The items of a toolbar with their keys - all of them, those of the bar
 * (not `menuOnly`) and which of those are separators.
 */
function getEntries(items: ToolbarProps["items"]) {
  const entries = items
    .filter((item): item is ToolbarItem => !!item)
    .map((item, index) => ({
      item,
      key: isSeparator(item) ? (item.id ?? `separator-${index}`) : item.id,
    }));
  const barEntries = entries.filter(({ item }) => !isMenuOnly(item));
  const separators = new Set(
    barEntries.flatMap(({ item }, index) => (isSeparator(item) ? [index] : [])),
  );
  return { barEntries, entries, separators };
}

/**
 * Whether the key stays with the element it was pressed on - it moves the
 * caret of a text field (but at its end in the direction of the key, where
 * it moves on along the toolbar), or the value of a slider.
 */
function isKeyOwner(element: Element, key: string, forward: boolean) {
  const isText =
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement &&
      !["button", "checkbox", "image", "radio", "reset", "submit"].includes(
        element.type,
      ));

  if (!isText) {
    return element instanceof HTMLElement && element.isContentEditable;
  }
  // Home and End move the caret
  if (key !== "ArrowLeft" && key !== "ArrowRight") return true;

  // Fields without a caret to read (a number, a date, a slider) keep them
  const { selectionEnd, selectionStart, value } = element;
  if (selectionStart === null || selectionEnd === null) return true;
  if (selectionStart !== selectionEnd) return true;
  return forward ? selectionEnd < value.length : selectionStart > 0;
}

/**
 * The actions of a view in a row - `role="toolbar"`, one stop of Tab: the
 * arrow keys (and Home / End) move between its items, the left one to the
 * next right to left. The items that do not fit the row move into a "More"
 * menu at its end - those of the lowest `priority` first, then from the
 * end - and back as it widens; a button with the icon alone shows its
 * label in a tooltip. Left out when printed. `ref` and the other props go
 * to the toolbar; name it with `aria-label`.
 */
export default function Toolbar({
  className,
  color = "default",
  items,
  moreLabel,
  onFocus,
  onKeyDown,
  ref,
  size = "md",
  variant = "ghost",
  ...props
}: ToolbarProps) {
  const messages = useMessages().ui;
  const containerRef = useRef<HTMLDivElement>(null);
  // The slot of the "More" button - measured also while it is out of sight
  const moreRef = useRef<HTMLDivElement>(null);
  // The ids of the items in the menu - with no room in the bar
  const [movedIds, setMovedIds] = useState<string[]>([]);
  // The item Tab stops at - the one the focus was on last
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // The items of the bar - the others are always in the menu
  const { barEntries, entries, separators } = getEntries(items);
  const moved = new Set(
    barEntries.flatMap(({ item, key }, index) =>
      canMove(item) && movedIds.includes(key) ? [index] : [],
    ),
  );
  const shown = getShownItems(barEntries.length, moved, separators);

  // The menu: the items moved out of the bar and those always in it, in
  // their order, a separator between their groups
  const menuEntries: DropdownEntry[] = [];
  let pendingSeparator = false;
  for (const { item, key } of entries) {
    if (isSeparator(item)) {
      pendingSeparator = menuEntries.length > 0;
    } else if (isMenuOnly(item) || (canMove(item) && movedIds.includes(key))) {
      if (pendingSeparator) menuEntries.push({ type: "separator" });
      pendingSeparator = false;
      menuEntries.push(toMenuEntry(item));
    }
  }
  const hasMenu = menuEntries.length > 0;

  // The stops of the arrow keys - and of Tab, the one the focus was on last
  const stopKeys = [
    ...barEntries.flatMap(({ item, key }, index) =>
      shown[index] && !isSeparator(item) && !isSkipped(item) ? [key] : [],
    ),
    ...(hasMenu ? [MORE] : []),
  ];
  const tabStopKey =
    activeKey !== null && stopKeys.includes(activeKey)
      ? activeKey
      : (stopKeys[0] ?? null);
  const stopProps = (key: string): ToolbarItemProps => ({
    "data-toolbar-item": key,
    tabIndex: key === tabStopKey ? 0 : -1,
  });

  // The items that do not fit move into the menu - by priority, then from
  // the end. They stay in the page out of sight, so the bar knows their
  // widths once it has room again. Not on the server: all items are in the
  // bar until the page is laid out.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const more = moreRef.current;
    if (!container || !more) return;

    const slots = Array.from(container.children).filter((child) =>
      child.hasAttribute("data-toolbar-slot"),
    );
    const { barEntries, entries, separators } = getEntries(items);

    const update = () => {
      const gap = getColumnGap(container);
      const hidden = getOverflowingItems({
        available: getContentWidth(container),
        forceMore: entries.some(({ item }) => isMenuOnly(item)),
        gap,
        moreWidth: more.getBoundingClientRect().width + gap,
        order: barEntries
          .map((entry, index) => ({ ...entry, index }))
          .filter(({ item }) => canMove(item))
          .sort(
            (a, b) =>
              priorityOf(a.item) - priorityOf(b.item) || b.index - a.index,
          )
          .map(({ index }) => index),
        separators,
        widths: slots.map((slot) => slot.getBoundingClientRect().width),
      });
      const next = hidden.map((index) => barEntries[index].key);
      setMovedIds((prev) => (isSameList(prev, next) ? prev : next));
    };

    update();
    if (typeof ResizeObserver === "undefined") return;

    // The bar narrows or widens, a label changes, a web font loads
    const observer = new ResizeObserver(update);
    observer.observe(container);
    slots.forEach((slot) => observer.observe(slot));
    observer.observe(more);
    return () => observer.disconnect();
  }, [items]);

  // An item with the focus that moves into the menu leaves it to the
  // "More" button
  const movedKey = movedIds.join();
  useLayoutEffect(() => {
    const container = containerRef.current;
    const focused = getActiveElement(container?.ownerDocument);
    const slot = focused?.closest("[data-toolbar-slot]");

    if (slot && container?.contains(slot) && slot.hasAttribute("inert")) {
      moreRef.current
        ?.querySelector<HTMLElement>(`[data-toolbar-item="${MORE}"]`)
        ?.focus();
    }
  }, [movedKey]);

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    const stop = (event.target as Element).closest("[data-toolbar-item]");
    if (stop && event.currentTarget.contains(stop)) {
      setActiveKey(stop.getAttribute("data-toolbar-item"));
    }
  };

  // The arrow keys move along the items in the bar, around the ends - past
  // the disabled ones. A text field keeps them until its caret is at its end.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const target = event.target as Element;
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      // The keys of the menu reach here through its portal
      !event.currentTarget.contains(target)
    ) {
      return;
    }

    // Right is the next item - left right to left
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = (event.key === "ArrowRight") !== rtl;
    if (isKeyOwner(target, event.key, forward)) return;

    const elements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[data-toolbar-item]"),
    );
    const stops = stopKeys.flatMap((key) => {
      const element = elements.find(
        (candidate) => candidate.getAttribute("data-toolbar-item") === key,
      );
      return element ? [element] : [];
    });
    const current = stops.findIndex((stop) => stop.contains(target));
    if (current === -1 || stops.length === 0) return;

    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = stops.length - 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      next = (current + (forward ? 1 : -1) + stops.length) % stops.length;
    } else return;

    event.preventDefault();
    stops[next].focus();
  };

  const renderItem = (item: ToolbarItem, key: string) => {
    if (isSeparator(item)) {
      return <Separator className="mx-1 my-1.5" orientation="vertical" />;
    }
    if (item.type === "custom") return item.render(stopProps(key));

    const isIconOnly = !!item.iconOnly && !!item.icon;
    const isToggle = item.type === "toggle";
    const isExplained = !!item.disabled && hasReason(item.disabledReason);
    // The tooltip of an icon alone shows its label above the reason - not
    // in the description, the label names the button already
    const reason =
      isIconOnly && hasReason(item.disabledReason) ? (
        <>
          <span aria-hidden="true" className="block">
            {item.label}
          </span>
          <span className="block font-normal">{item.disabledReason}</span>
        </>
      ) : (
        item.disabledReason
      );
    const control = (
      <Button
        {...stopProps(key)}
        aria-label={isIconOnly ? item.label : undefined}
        aria-pressed={isToggle ? item.pressed : undefined}
        className={cn(
          "whitespace-nowrap",
          isIconOnly && ICON_ONLY_CLASSES[size],
          isToggle && PRESSED_CLASSES,
        )}
        color={(!isToggle && item.color) || color}
        disabled={item.disabled}
        disabledReason={reason}
        link={isToggle ? undefined : item.href}
        onClick={
          isToggle ? () => item.onPressedChange(!item.pressed) : item.onClick
        }
        size={size}
        startIcon={isIconOnly ? undefined : item.icon}
        variant={(!isToggle && item.variant) || variant}
      >
        {isIconOnly ? (
          <span aria-hidden="true" className="flex">
            {item.icon}
          </span>
        ) : (
          item.label
        )}
      </Button>
    );

    if (!isIconOnly) return control;

    return (
      // In a fragment: the tooltip shows the name of the button, it does
      // not describe the button with it once more. The tooltip of the
      // reason shows it while the button is disabled with one.
      <Tooltip
        delay={500}
        nowrap
        position="top"
        title={isExplained ? undefined : item.label}
      >
        <>{control}</>
      </Tooltip>
    );
  };

  return (
    <div
      role="toolbar"
      {...props}
      className={cn(
        // The items in the menu are laid out at the end, out of sight
        "relative flex min-w-0 items-center gap-1 print:hidden",
        className,
      )}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      ref={(element) => {
        containerRef.current = element;
        const detachRef = attachRef(ref, element);
        return () => {
          containerRef.current = null;
          detachRef();
        };
      }}
    >
      {barEntries.map(({ item, key }, index) => {
        const isHidden = !shown[index];
        return (
          <div
            aria-hidden={isHidden || undefined}
            className={cn(
              "flex shrink-0 items-center self-stretch",
              isHidden && OVERFLOW_HIDDEN_CLASSES,
            )}
            data-toolbar-slot=""
            inert={isHidden || undefined}
            key={key}
          >
            {renderItem(item, key)}
          </div>
        );
      })}
      <div
        aria-hidden={!hasMenu || undefined}
        className={cn("flex shrink-0", !hasMenu && OVERFLOW_HIDDEN_CLASSES)}
        inert={!hasMenu || undefined}
        ref={moreRef}
      >
        <Dropdown
          buttonTrigger
          items={menuEntries}
          offset={4}
          onOpenChange={setIsMenuOpen}
          // Closed with nothing left in it - the bar has room again
          open={isMenuOpen && hasMenu}
          trigger={
            <Button
              {...stopProps(MORE)}
              aria-label={moreLabel ?? messages.toolbar.more}
              className={ICON_ONLY_CLASSES[size]}
              color={color}
              size={size}
              variant={variant}
            >
              <Ellipsis aria-hidden="true" />
            </Button>
          }
        />
      </div>
    </div>
  );
}
