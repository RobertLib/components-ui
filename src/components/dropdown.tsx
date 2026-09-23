import { isValidElement, useId, useRef, useState } from "react";
import cn from "../utils/cn";
import Popover from "./popover";
import { getNextTabbable, getTabbableElements } from "../utils/tabbable";
import { useRouter } from "../providers/ui-context";

export interface DropdownItem {
  /** Renders the item as a link. */
  href?: string;
  label: string;
  /** Called when the item is picked. */
  onClick?: () => void;
}

export interface DropdownProps extends React.ComponentProps<"div"> {
  /**
   * Menu entries - `DropdownItem`s, or any element for custom content. The
   * arrow keys also stop at custom content with a control (a switch, a
   * button) and give that control the focus. `null` / `false` entries are
   * skipped, so `cond && item` works.
   */
  items: (DropdownItem | React.ReactNode)[];
  /** The element that opens the menu on click. */
  trigger: React.ReactNode;
}

const isDropdownItem = (item: unknown): item is DropdownItem =>
  !isValidElement(item) &&
  typeof item === "object" &&
  item !== null &&
  "label" in item;

// Keeps the focus where it is (on the menu or the trigger) when an item is
// clicked, so it is not lost with the closing menu
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

/** A menu opened by clicking its trigger, navigable with the arrow keys. */
export default function Dropdown({
  items,
  onKeyDown,
  trigger,
  ...props
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { Link, navigate } = useRouter();
  const menuRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const itemStyles =
    "block w-full text-sm text-left px-4 py-1.25 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:bg-neutral-100 dark:focus:bg-neutral-800 transition-colors";

  const id = useId();
  const menuId = `dropdown-menu-${id}`;
  const itemId = (index: number) => `${menuId}-item-${index}`;

  const validItems = items.filter(
    (item) => item !== null && item !== undefined && item !== false,
  );

  // The first control of custom content, e.g. a switch
  const controlOf = (index: number) =>
    getTabbableElements(menuRef.current?.children[index])[0];

  // The arrow keys move between the items and the custom content with a
  // control, past plain content like headings
  const navigableIndexes = () =>
    validItems.flatMap((item, index) =>
      isDropdownItem(item) || controlOf(index) ? [index] : [],
    );

  const changeOpen = (next: boolean) => {
    // The menu has the focus once the arrow keys moved into it - give it
    // back to the trigger (the popover's wrapper) before the menu goes
    if (!next && menuRef.current?.contains(document.activeElement)) {
      triggerRef.current?.parentElement?.focus();
    }
    setOpen(next);
    // Every opening starts without a highlighted item
    setActiveIndex(-1);
  };

  const moveTo = (index: number | undefined) => {
    if (index === undefined) return;
    setActiveIndex(index);

    if (isDropdownItem(validItems[index])) {
      // The focused menu announces its active item (aria-activedescendant)
      menuRef.current?.focus({ preventScroll: true });
    } else {
      // Custom content takes the focus itself and handles its own keys
      controlOf(index)?.focus();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // The consumer's handler first - it may prevent the menu's own
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        changeOpen(true);
      }
      // Other keys are left to the page - Escape closes a Dialog around
      return;
    }

    // Enter and Space on the trigger keep the open menu open - Enter picks
    // the highlighted item, if any. Custom content in the menu (a portal
    // outside the trigger) handles its keys itself.
    const onTrigger = event.currentTarget.contains(event.target as Node);
    if (onTrigger && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        changeOpen(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveTo(navigableIndexes().find((index) => index > activeIndex));
        break;
      case "ArrowUp":
        event.preventDefault();
        moveTo(navigableIndexes().findLast((index) => index < activeIndex));
        break;
      case "Enter": {
        // A control in custom content handles its Enter itself
        const selectedItem = validItems[activeIndex];

        if (isDropdownItem(selectedItem)) {
          event.preventDefault();
          selectedItem.onClick?.();
          if (selectedItem.href) navigate(selectedItem.href);
          changeOpen(false);
        }
        break;
      }
      case "Tab": {
        // The focus moves on from the trigger, not from the menu at the end
        // of the page
        const wrapper = event.currentTarget;
        const menu = menuRef.current;
        changeOpen(false);
        // Past the menu to what follows the trigger - handled here, so the
        // popover does not move the focus into the closing menu
        if (!event.shiftKey) {
          event.preventDefault();
          (getNextTabbable(wrapper, menu) ?? wrapper).focus();
        }
        break;
      }
      default:
        break;
    }
  };

  const activeItem = validItems[activeIndex];

  const dropdownMenu = (
    <ul
      aria-activedescendant={
        isDropdownItem(activeItem) ? itemId(activeIndex) : undefined
      }
      aria-orientation="vertical"
      className="min-w-48 focus:outline-none"
      id={menuId}
      ref={menuRef}
      role="menu"
      tabIndex={-1}
    >
      {validItems.map((item, index) => {
        const isActive = index === activeIndex;

        return (
          <li
            className="m-1"
            key={index}
            onMouseEnter={() => setActiveIndex(index)}
            role={isDropdownItem(item) ? "none" : undefined}
          >
            {isDropdownItem(item) ? (
              item.href ? (
                <Link
                  className={cn(
                    itemStyles,
                    isActive && "bg-neutral-100 dark:bg-neutral-800",
                  )}
                  href={item.href}
                  id={itemId(index)}
                  onClick={() => {
                    item.onClick?.();
                    changeOpen(false);
                  }}
                  onMouseDown={keepFocus}
                  role="menuitem"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  className={cn(
                    itemStyles,
                    isActive && "bg-neutral-100 dark:bg-neutral-800",
                  )}
                  id={itemId(index)}
                  onClick={() => {
                    item.onClick?.();
                    changeOpen(false);
                  }}
                  onMouseDown={keepFocus}
                  role="menuitem"
                  type="button"
                >
                  {item.label}
                </button>
              )
            ) : (
              (item as React.ReactNode)
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <Popover
      align="right"
      aria-controls={open ? menuId : undefined}
      contentClassName="mt-2.5"
      onOpenChange={changeOpen}
      open={open}
      // The menu itself is the popup - no unnamed dialog around it
      popupRole="menu"
      position="bottom"
      trigger={
        <div
          className="rounded-md p-1 leading-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
          ref={triggerRef}
        >
          {trigger}
        </div>
      }
      triggerType="click"
      width="auto"
      {...props}
      onKeyDown={handleKeyDown}
    >
      {dropdownMenu}
    </Popover>
  );
}
