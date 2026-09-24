import { isValidElement, useId, useRef, useState } from "react";
import MenuList, { type MenuListHandle } from "./menu/menu-list";
import Popover from "./popover";
import { getNextTabbable, getTabbableElements } from "../utils/tabbable";
import type { DropdownEntry } from "./menu/types";

export type {
  DropdownEntry,
  DropdownGroup,
  DropdownItem,
  DropdownRadioGroup,
  DropdownRadioOption,
  DropdownSeparator,
} from "./menu/types";

export interface DropdownProps extends React.ComponentProps<"div"> {
  /**
   * `trigger` is a button itself - a `Button`, an `IconButton`: it becomes
   * the menu button (`aria-expanded`, the focus, the `aria-*` props given
   * to the dropdown) instead of a button wrapped around it.
   */
  buttonTrigger?: boolean;
  /**
   * Menu entries - `DropdownItem`s (commands, links, checkboxes, submenus),
   * `{ type: "group" }` items under a heading, `{ type: "radio" }` options,
   * `{ type: "separator" }` lines, or any element for custom content. The
   * arrow keys also stop at custom content with a control (a switch, a
   * button) and give that control the focus. `null` / `false` entries are
   * skipped, so `cond && item` works.
   */
  items: DropdownEntry[];
  /** Called when the menu opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** The element that opens the menu on click. */
  trigger: React.ReactNode;
}

/**
 * A menu opened by clicking its trigger, navigable with the arrow keys,
 * Home / End and typed letters; Enter or Space picks an item. Opened from
 * the keyboard (ArrowDown, Enter, Space - ArrowUp for the last item), it
 * highlights its first item. Items can have icons, shortcuts and
 * descriptions, be checkboxes or radio options, and open submenus.
 */
export default function Dropdown({
  buttonTrigger = false,
  id,
  items,
  onKeyDown,
  onOpenChange,
  trigger,
  ...props
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  // Opened from the keyboard, the menu highlights its first (or last) item
  // once it is in the page - opened with the mouse, none
  const [highlight, setHighlight] = useState<"first" | "last" | null>(null);
  const menuRef = useRef<MenuListHandle>(null);

  const generatedId = useId();
  const menuId = `dropdown-menu-${generatedId}`;
  const triggerId = id ?? `dropdown-trigger-${generatedId}`;
  // The menu is named by its button - a button given as the trigger keeps
  // an id of its own
  const buttonId =
    buttonTrigger && isValidElement<{ id?: string }>(trigger)
      ? trigger.props.id
      : undefined;

  // The popover gives the focus in the closing menu back to the trigger
  const changeOpen = (
    next: boolean,
    highlightOnOpen: "first" | "last" | null,
  ) => {
    setOpen(next);
    setHighlight(highlightOnOpen);
    if (next !== open) onOpenChange?.(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // The consumer's handler first - it may prevent the menu's own
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (!open) {
      // Opened from the keyboard, the menu highlights its first item - its
      // last one with ArrowUp - once it is in the page
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        changeOpen(true, event.key === "ArrowUp" ? "last" : "first");
      }
      // Other keys are left to the page - Escape closes a Dialog around
      return;
    }

    // The keys of the menu (a portal outside the trigger) reach here too,
    // also those of its submenus
    const onTrigger = event.currentTarget.contains(event.target as Node);

    if (event.key === "Tab") {
      // The focus moves on from the trigger, not from the menu at the end
      // of the page
      const wrapper = event.currentTarget;
      const triggerElement = buttonTrigger
        ? getTabbableElements(wrapper)[0]
        : wrapper;
      changeOpen(false, null);

      if (!event.shiftKey) {
        // Past the menu to what follows the trigger - handled here, so the
        // popover does not move the focus into the closing menu
        event.preventDefault();
        (
          getNextTabbable(wrapper, document.getElementById(menuId)) ??
          triggerElement
        )?.focus();
      } else if (!onTrigger) {
        // From the menu back to the trigger - not to the end of the page,
        // where the menu is
        event.preventDefault();
        triggerElement?.focus();
      }
      return;
    }

    // Escape is left to the popover: it closes the topmost overlay only and
    // gives the focus in the menu back to the trigger. The keys pressed on
    // the trigger move through the menu - Enter and Space keep the open
    // menu open and pick the highlighted item, if any.
    if (onTrigger) {
      if (event.key === "Enter" || event.key === " ") event.preventDefault();
      menuRef.current?.handleTriggerKeyDown(event);
    }
  };

  return (
    <Popover
      align="right"
      aria-controls={open ? menuId : undefined}
      buttonTrigger={buttonTrigger}
      // Up to 24rem before it scrolls - held to the room on its side
      contentClassName="mt-2.5 max-h-96"
      id={triggerId}
      onOpenChange={(next) => changeOpen(next, null)}
      open={open}
      // The menu itself is the popup - no unnamed dialog around it
      popupRole="menu"
      position="bottom"
      trigger={
        buttonTrigger ? (
          trigger
        ) : (
          <div className="rounded-md p-1 leading-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
            {trigger}
          </div>
        )
      }
      triggerType="click"
      width="auto"
      {...props}
      onKeyDown={handleKeyDown}
    >
      <MenuList
        aria-labelledby={buttonId ?? triggerId}
        entries={items}
        id={menuId}
        initialFocus={highlight}
        onClose={() => changeOpen(false, null)}
        ref={menuRef}
      />
    </Popover>
  );
}
