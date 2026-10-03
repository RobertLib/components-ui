import { isValidElement, useId, useRef, useState } from "react";
import MenuList, { type MenuListHandle } from "./menu/menu-list";
import Popover, { type PopoverPosition } from "./popover";
import { getNextTabStop } from "./overlay-stack";
import { getTabbableElements } from "../utils/tabbable";
import type { DropdownEntry } from "./menu/types";

export type {
  DropdownEntry,
  DropdownGroup,
  DropdownItem,
  DropdownRadioGroup,
  DropdownRadioOption,
  DropdownSeparator,
} from "./menu/types";

// What the menu does once it opens - see `MenuList.initialFocus`
type InitialFocus = "first" | "last" | "menu";

export interface DropdownProps extends React.ComponentProps<"div"> {
  /**
   * How the menu lines up with its trigger: `end` - from the end edge of
   * the trigger (its right edge, right to left its left one), `start` - from
   * the other one, `center` - centered on it. Beside the trigger (`position`
   * `start` / `end`), from its top, its middle or its bottom. `end` by
   * default above or below the trigger, `start` beside it.
   */
  align?: "start" | "center" | "end";
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
  /** Focus when opened by the parent or pointer. Keyboard openings choose first/last. Defaults to menu. */
  initialFocus?: InitialFocus;
  /** Space between the trigger and the menu, in pixels. */
  offset?: number;
  /** Called when the menu opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Opens the menu while `true` - leave it out to let the trigger open it.
   * Opened by the parent, the menu takes the focus as when it is clicked
   * open; a pick, Escape or a click outside call `onOpenChange(false)`.
   */
  open?: boolean;
  /**
   * The side of the trigger the menu opens on - `bottom` by default; `start`
   * / `end` beside it, `end` being the right side (the left one right to
   * left). It opens on the other side when it has no room there.
   */
  position?: PopoverPosition;
  /** The element that opens the menu on click. */
  trigger: React.ReactNode;
}

/**
 * A menu opened by clicking its trigger, navigable with the arrow keys,
 * Home / End and typed letters; Enter or Space picks an item. Opened from
 * the keyboard (ArrowDown, Enter, Space - ArrowUp for the last item), it
 * highlights its first item. Items can have icons, shortcuts and
 * descriptions, be checkboxes or radio options, and open submenus. `ref`
 * and the other props go to the wrapper around the trigger, as in
 * `Popover`; the menu and its items have the data attributes of the menus
 * (`data-highlighted`, `data-state`, `data-disabled` - see the page).
 */
export default function Dropdown({
  align,
  buttonTrigger = false,
  id,
  items,
  initialFocus = "menu",
  offset = 10,
  onKeyDown,
  onOpenChange,
  open: controlledOpen,
  position = "bottom",
  trigger,
  ...props
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  // Opened from the keyboard, the menu highlights its first (or last) item
  // once it is in the page - opened with the mouse, by a screen reader
  // clicking the trigger, or by the parent, it takes the focus with none
  // highlighted, so the arrow keys and a screen reader go on in it
  const [highlight, setHighlight] = useState<InitialFocus>(initialFocus);
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
  const changeOpen = (next: boolean, highlightOnOpen: InitialFocus) => {
    if (!isControlled) setInternalOpen(next);
    // Closed, the next opening by the parent takes the focus as a click
    setHighlight(next ? highlightOnOpen : initialFocus);
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
    // A dialog or another panel in custom content is a portal too. Its
    // keys belong to that overlay, not to the menu it was opened from.
    const sourceMenu = (event.target as Element).closest("[data-menu-tree]");
    if (!onTrigger && sourceMenu?.getAttribute("data-menu-tree") !== menuId) {
      return;
    }

    if (event.key === "Tab") {
      // The focus moves on from the trigger, not from the menu at the end
      // of the page
      const wrapper = event.currentTarget;
      const triggerElement = buttonTrigger
        ? getTabbableElements(wrapper)[0]
        : wrapper;
      changeOpen(false, "menu");

      if (!event.shiftKey) {
        // Past the menu to what follows the trigger - handled here, so the
        // popover does not move the focus into the closing menu
        event.preventDefault();
        (
          getNextTabStop(wrapper, document.getElementById(menuId)) ??
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
      // From the end edge below or above the trigger, from its top beside it
      align={
        align ?? (position === "top" || position === "bottom" ? "end" : "start")
      }
      aria-controls={open ? menuId : undefined}
      buttonTrigger={buttonTrigger}
      // Up to 24rem before it scrolls - held to the room on its side
      contentClassName="max-h-96"
      id={triggerId}
      offset={offset}
      onOpenChange={(next) => changeOpen(next, initialFocus)}
      open={open}
      // The menu itself is the popup - no unnamed dialog around it
      popupRole="menu"
      position={position}
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
        onClose={() => changeOpen(false, "menu")}
        ref={menuRef}
      />
    </Popover>
  );
}
