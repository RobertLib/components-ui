import { Check, ChevronRight } from "lucide-react";
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import cn from "../../utils/cn";
import Kbd from "../kbd";
import MenuPopup from "./menu-popup";
import {
  getDirection,
  isEscapeKey,
  isTopmostOverlay,
  OverlayContext,
  useOverlayLayer,
} from "../overlay-stack";
import { getGracePolygon, isPointInPolygon, type Point } from "./position";
import { getTabbableElements } from "../../utils/tabbable";
import { toAriaKeyShortcuts } from "../../utils/shortcut";
import useIsApplePlatform from "../../hooks/use-is-apple-platform";
import { foldSearchText } from "../../utils/remove-diacritics";
import { useRouter } from "../../providers/ui-context";
import {
  buildMenuModel,
  isRowDisabled,
  isSkippedEntry,
  rowLabel,
  rowSubmenu,
  type DropdownEntry,
} from "./types";

// Hover time before the submenu of an item opens
const SUBMENU_OPEN_DELAY = 150;

// Time the pointer has to cross other items on its way to an open submenu
const SUBMENU_GRACE_TIME = 300;

// Letters typed within this time are one search, as in `Autocomplete`
const TYPE_AHEAD_TIMEOUT = 500;

/** What the owner of a menu - Dropdown, ContextMenu - can do with it. */
export interface MenuListHandle {
  /** Highlights the first or the last item and gives the menu the focus. */
  focusItem: (which: "first" | "last") => void;
  /**
   * Handles a key pressed on the trigger of the open menu - the arrow keys
   * move through the menu, Enter and Space pick the highlighted item.
   */
  handleTriggerKeyDown: (event: React.KeyboardEvent) => void;
}

interface MenuListProps {
  "aria-label"?: string;
  "aria-labelledby"?: string;
  entries: DropdownEntry[];
  /** Id of the menu element - the ids of its items derive from it. */
  id: string;
  /**
   * What the menu does once in the page: highlight its first or last item
   * and take the focus (opened from the keyboard), take the focus only, or
   * nothing (the focus stays on the trigger).
   */
  initialFocus?: "first" | "last" | "menu" | null;
  /** Depth of a submenu - 0 is the menu itself. */
  level?: number;
  /** Closes the whole menu - after a pick. */
  onClose: () => void;
  /**
   * Submenus: closes this submenu (ArrowLeft, ArrowRight right to left) -
   * the focus goes back to its item.
   */
  onCloseSubmenu?: () => void;
  ref?: React.Ref<MenuListHandle>;
  /** Id of the menu the submenu belongs to. */
  treeId?: string;
}

// Keeps the focus where it is (on the menu or the trigger) when an item is
// clicked, so it is not lost with the closing menu
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

const normalizeText = foldSearchText;

/**
 * The list of a menu - its items, groups and separators, and all its keys:
 * the arrow keys, Home / End, typed letters, Enter and Space, ArrowRight /
 * ArrowLeft into and out of submenus (the other way round right to left).
 * The focus stays on the list, which announces its highlighted item
 * (`aria-activedescendant`); custom content with a control takes the focus
 * itself.
 */
export default function MenuList({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  entries,
  id,
  initialFocus = null,
  level = 0,
  onClose,
  onCloseSubmenu,
  ref,
  treeId,
}: MenuListProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  // The open submenu - by the index of its item, whether it opened from the
  // keyboard, with the focus in it, and the writing direction of the menu
  const [submenu, setSubmenu] = useState<{
    dir: "ltr" | "rtl";
    focus: boolean;
    index: number;
  } | null>(null);
  const { Link } = useRouter();
  // Shortcuts are announced as the platform names its keys - the Windows
  // way on the server and in the first render, like `Kbd`
  const isApple = useIsApplePlatform();

  const listRef = useRef<HTMLUListElement>(null);
  const submenuRef = useRef<MenuListHandle>(null);
  const submenuPanelRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<{
    index: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const graceRef = useRef<Point[] | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The typed text - letters in quick succession are one search (`time` of
  // the last one)
  const typeAheadRef = useRef({ text: "", time: 0 });
  // What to focus once the list is in the page - taken once
  const initialFocusRef = useRef(initialFocus);

  const tree = treeId ?? id;
  const isSubmenu = onCloseSubmenu !== undefined;
  const { hasCheck, hasIcon, nodes, rows } = buildMenuModel(entries);
  const itemId = (index: number) => `${id}-item-${index}`;
  const submenuId = `${id}-submenu`;

  // The element of a row - the <li> around the item or the custom content
  const rowElement = (index: number) =>
    listRef.current?.querySelector<HTMLElement>(`[data-row="${index}"]`);

  // The first control of custom content, e.g. a switch
  const controlOf = (index: number) =>
    getTabbableElements(rowElement(index))[0];

  // The arrow keys move between the items - disabled ones too, as the ARIA
  // menu pattern asks - and custom content with a control, past plain
  // content like headings
  const navigableIndexes = () =>
    rows.flatMap((row, index) =>
      row.kind !== "custom" || controlOf(index) ? [index] : [],
    );

  const clearOpenTimer = () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current.timer);
    openTimerRef.current = null;
  };

  const clearGrace = () => {
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    graceTimerRef.current = null;
    graceRef.current = null;
  };

  // The menu the focus is in, when it is one of this menu's submenus - the
  // trigger of a Dropdown, or content outside the menu, does not count
  const focusedLevel = () => {
    const menu = document.activeElement?.closest("[data-menu-tree]");
    if (!menu || menu.getAttribute("data-menu-tree") !== tree) return null;
    return Number(menu.getAttribute("data-menu-level"));
  };

  // Closes the open submenu. The focus in it (or deeper) comes back to this
  // menu first, instead of being lost with it.
  const closeSubmenu = () => {
    clearOpenTimer();
    clearGrace();
    const focused = focusedLevel();
    if (focused !== null && focused > level) {
      listRef.current?.focus({ preventScroll: true });
    }
    setSubmenu(null);
  };

  // A pick in a submenu closes the whole menu - the focus moves to the menu
  // first, whose owner gives it back to where it was
  const closeFromSubmenu = isSubmenu
    ? onClose
    : () => {
        listRef.current?.focus({ preventScroll: true });
        onClose();
      };

  const openSubmenu = (index: number, focus: boolean) => {
    clearOpenTimer();
    const row = rows[index];
    const submenuEntries = rowSubmenu(row);
    if (
      !submenuEntries ||
      isRowDisabled(row) ||
      submenuEntries.every((entry) => isSkippedEntry(entry))
    ) {
      return;
    }

    setActiveIndex(index);
    if (submenu?.index === index) {
      // Open already (on hover) - the keyboard moves into it
      if (focus) submenuRef.current?.focusItem("first");
      return;
    }
    setSubmenu({
      dir: listRef.current ? getDirection(listRef.current) : "ltr",
      focus,
      index,
    });
  };

  const moveTo = (index: number | undefined) => {
    if (index === undefined) return;
    setActiveIndex(index);
    if (submenu && submenu.index !== index) closeSubmenu();

    if (rows[index]?.kind === "custom") {
      // Custom content takes the focus itself and handles its own keys
      controlOf(index)?.focus();
    } else {
      // The focused menu announces its active item (aria-activedescendant)
      listRef.current?.focus({ preventScroll: true });
      rowElement(index)?.scrollIntoView({ block: "nearest" });
    }
  };

  const focusItem = (which: "first" | "last") => {
    const indexes = navigableIndexes();
    moveTo(which === "first" ? indexes[0] : indexes.at(-1));
  };

  // Runs the item: a checkbox toggles, a radio option is checked, and the
  // menu closes - but for Space on a checkbox or radio, and `keepOpen`
  const select = (index: number, via: "click" | "enter" | "space") => {
    const row = rows[index];

    if (row?.kind === "item") {
      const { item } = row;
      const isCheckbox = item.checked !== undefined;
      if (isCheckbox) item.onCheckedChange?.(!item.checked);
      item.onClick?.();
      if (!item.keepOpen && !(isCheckbox && via === "space")) onClose();
    } else if (row?.kind === "option") {
      const { group, option } = row;
      if (option.value !== group.value) group.onChange?.(option.value);
      if (!group.keepOpen && via !== "space") onClose();
    }
  };

  const activateFromKeyboard = (index: number, key: "enter" | "space") => {
    const row = rows[index];
    if (!row || row.kind === "custom" || isRowDisabled(row)) return;

    if (rowSubmenu(row)) {
      openSubmenu(index, true);
    } else if (
      row.kind === "item" &&
      row.item.href &&
      row.item.checked === undefined
    ) {
      // Followed as on a click - by the router's `Link`, or by the browser
      // to another site or a `mailto:` address
      (rowElement(index)?.firstElementChild as HTMLElement | null)?.click();
    } else {
      select(index, key);
    }
  };

  const isTypingAhead = (time: number) =>
    typeAheadRef.current.text !== "" &&
    time - typeAheadRef.current.time < TYPE_AHEAD_TIMEOUT;

  // Moves to the next item starting with the typed text - disabled ones
  // too, they are focusable
  const typeAhead = (letter: string, time: number) => {
    const previous = typeAheadRef.current;
    const text =
      (time - previous.time < TYPE_AHEAD_TIMEOUT ? previous.text : "") +
      normalizeText(letter);
    typeAheadRef.current = { text, time };

    // The first item from `start` on, around the end of the menu, whose
    // label starts with `prefix`
    const count = rows.length;
    const startsWith = (prefix: string, start: number) =>
      Array.from(
        { length: count },
        (_, offset) => (start + offset) % count,
      ).find((index) => {
        const label = rowLabel(rows[index]);
        return label !== null && normalizeText(label).startsWith(prefix);
      });

    // A new search starts after the highlighted item. Letters added to it
    // search from the highlighted item on, which keeps the highlight while
    // its label still matches - "save" stays on "Save" instead of flipping
    // to "Save as…" and back. The same letter again moves on to the next
    // item starting with it.
    const after = activeIndex + 1;
    const repeated = [...text].every((char) => char === text[0]);
    const match =
      text.length === 1
        ? startsWith(text, after)
        : (startsWith(text, Math.max(activeIndex, 0)) ??
          (repeated ? startsWith(text[0], after) : undefined));

    if (match === undefined) {
      // Nothing starts so - the next letter starts a new search
      typeAheadRef.current = { text: "", time };
      return;
    }
    moveTo(match);
  };

  const handleKey = (event: React.KeyboardEvent, fromTrigger: boolean) => {
    // The keys of an input method editor (IME) composing text
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;

    // On the menu, or on the trigger of the open menu - a control in custom
    // content keeps these keys, the arrow keys aside
    const own = fromTrigger || event.target === listRef.current;
    // A submenu opens towards the end of the line - to the left right to left
    const rtl = !!listRef.current && getDirection(listRef.current) === "rtl";
    const key =
      event.key === "ArrowRight" || event.key === "ArrowLeft"
        ? (event.key === "ArrowRight") !== rtl
          ? "ArrowIn"
          : "ArrowOut"
        : event.key;

    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        moveTo(navigableIndexes().find((index) => index > activeIndex));
        break;
      case "ArrowUp":
        event.preventDefault();
        moveTo(navigableIndexes().findLast((index) => index < activeIndex));
        break;
      case "Home":
      case "End":
        if (own) {
          event.preventDefault();
          focusItem(event.key === "Home" ? "first" : "last");
        }
        break;
      case "ArrowIn":
        if (own && rowSubmenu(rows[activeIndex])) {
          event.preventDefault();
          openSubmenu(activeIndex, true);
        }
        break;
      case "ArrowOut":
        if (own && onCloseSubmenu) {
          event.preventDefault();
          onCloseSubmenu();
        }
        break;
      case "Enter":
      case " ":
        if (!own) break;
        // Space on the menu never scrolls the page
        event.preventDefault();
        if (event.key === " " && isTypingAhead(event.timeStamp)) {
          // A space inside a typed label, e.g. "save as"
          typeAhead(" ", event.timeStamp);
        } else {
          activateFromKeyboard(
            activeIndex,
            event.key === " " ? "space" : "enter",
          );
        }
        break;
      default:
        if (
          own &&
          event.key.length === 1 &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          event.preventDefault();
          typeAhead(event.key, event.timeStamp);
        }
        break;
    }
  };

  useImperativeHandle(ref, () => ({
    focusItem,
    handleTriggerKeyDown: (event: React.KeyboardEvent) =>
      handleKey(event, true),
  }));

  // Opened from the keyboard, the menu highlights its first (or last) item
  // once it is in the page with its items - once, as it opens anew each time
  const attachList = (list: HTMLUListElement | null) => {
    listRef.current = list;
    const focus = initialFocusRef.current;
    if (!list || !focus) return;

    initialFocusRef.current = null;
    if (focus === "menu") {
      list.focus({ preventScroll: true });
    } else {
      focusItem(focus);
    }
  };

  // A submenu about to open, or a grace period, must not outlive the menu
  useEffect(
    () => () => {
      clearOpenTimer();
      clearGrace();
    },
    [],
  );

  // The focus follows the pointer between the menu and its submenus, so the
  // keys go on where the pointer is - not from the trigger of a Dropdown,
  // or from content outside the menu
  const focusFollowsPointer = () => {
    const focused = focusedLevel();
    const list = listRef.current;
    if (focused !== null && list && !list.contains(document.activeElement)) {
      list.focus({ preventScroll: true });
    }
  };

  const scheduleSubmenu = (index: number) => {
    if (openTimerRef.current?.index === index) return;
    clearOpenTimer();
    openTimerRef.current = {
      index,
      timer: setTimeout(() => {
        openTimerRef.current = null;
        openSubmenu(index, false);
      }, SUBMENU_OPEN_DELAY),
    };
  };

  // Touch has no hover - a tap opens a submenu (`onClick`)
  const handleRowPointerMove = (event: React.PointerEvent, index: number) => {
    if (event.pointerType === "touch") return;

    // On its way to the open submenu, the pointer crosses other items
    // without them taking over
    const grace = graceRef.current;
    if (
      grace &&
      isPointInPolygon({ x: event.clientX, y: event.clientY }, grace)
    ) {
      return;
    }
    clearGrace();
    focusFollowsPointer();

    if (index !== activeIndex) {
      setActiveIndex(index);
      if (submenu && submenu.index !== index) closeSubmenu();
    }

    const row = rows[index];
    if (rowSubmenu(row) && !isRowDisabled(row)) {
      if (submenu?.index !== index) scheduleSubmenu(index);
    } else {
      clearOpenTimer();
    }
  };

  const handleRowPointerLeave = (event: React.PointerEvent, index: number) => {
    if (event.pointerType === "touch") return;
    // Left before its submenu opened
    if (openTimerRef.current?.index === index) clearOpenTimer();

    const panel = submenuPanelRef.current;
    if (submenu?.index === index && panel) {
      clearGrace();
      graceRef.current = getGracePolygon(
        { x: event.clientX, y: event.clientY },
        panel.getBoundingClientRect(),
      );
      graceTimerRef.current = setTimeout(clearGrace, SUBMENU_GRACE_TIME);
    }
  };

  // In the submenu - its item stays highlighted
  const handleSubmenuPointerEnter = (event: React.PointerEvent) => {
    if (event.pointerType === "touch") return;
    clearGrace();
    clearOpenTimer();
    if (submenu) setActiveIndex(submenu.index);
  };

  const handleItemClick = (event: React.MouseEvent, index: number) => {
    const row = rows[index];
    if (isRowDisabled(row)) {
      event.preventDefault();
      return;
    }
    if (rowSubmenu(row)) {
      openSubmenu(index, false);
      return;
    }
    select(index, "click");
  };

  const renderRow = (index: number) => {
    const row = rows[index];
    const rowProps = {
      "data-row": index,
      onPointerLeave: (event: React.PointerEvent) =>
        handleRowPointerLeave(event, index),
      onPointerMove: (event: React.PointerEvent) =>
        handleRowPointerMove(event, index),
      role: "none",
    };

    if (row.kind === "custom") {
      // Rendered as it is, with roles of its own (an <hr> is a separator)
      return (
        <li className="m-1" key={`row-${index}`} {...rowProps}>
          {row.node}
        </li>
      );
    }

    const fields = row.kind === "item" ? row.item : row.option;
    const submenuEntries = rowSubmenu(row);
    const isParent = submenuEntries !== undefined;
    const isCheckable =
      row.kind === "option" || (row.item.checked !== undefined && !isParent);
    const checked =
      row.kind === "option"
        ? row.option.value === row.group.value
        : !!row.item.checked;
    const danger = row.kind === "item" && !!row.item.danger;
    const disabled = !!fields.disabled;
    const href =
      row.kind === "item" && !isCheckable && !isParent
        ? row.item.href
        : undefined;
    const isActive = index === activeIndex;
    const isSubmenuOpen = submenu?.index === index;
    const descriptionId = fields.description
      ? `${itemId(index)}-description`
      : undefined;

    const itemProps = {
      "aria-checked": isCheckable ? checked : undefined,
      "aria-controls": isSubmenuOpen ? submenuId : undefined,
      "aria-describedby": descriptionId,
      "aria-disabled": disabled || undefined,
      "aria-expanded": isParent ? isSubmenuOpen : undefined,
      "aria-haspopup": isParent ? ("menu" as const) : undefined,
      "aria-keyshortcuts": fields.shortcut
        ? toAriaKeyShortcuts(fields.shortcut, isApple)
        : undefined,
      className: cn(
        "flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-start text-sm transition-colors focus:outline-none motion-reduce:transition-none pointer-coarse:py-2",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        danger && "text-danger-700 dark:text-danger-400",
        // The highlight follows the pointer and the keys alike - a tap only
        // flashes it
        isActive
          ? danger
            ? "bg-danger-50 dark:bg-danger-950/60"
            : "bg-neutral-100 dark:bg-neutral-800"
          : !disabled &&
              (danger
                ? "active:bg-danger-50 dark:active:bg-danger-950/60"
                : "active:bg-neutral-100 dark:active:bg-neutral-800"),
      ),
      id: itemId(index),
      onClick: (event: React.MouseEvent) => handleItemClick(event, index),
      onMouseDown: keepFocus,
      role:
        row.kind === "option"
          ? "menuitemradio"
          : isCheckable
            ? "menuitemcheckbox"
            : "menuitem",
      tabIndex: -1,
    };

    const content = (
      <>
        {hasCheck && (
          <span
            aria-hidden="true"
            className="flex size-4 shrink-0 items-center justify-center"
          >
            {isCheckable &&
              checked &&
              (row.kind === "option" ? (
                <span className="size-1.5 rounded-full bg-current" />
              ) : (
                <Check size={16} />
              ))}
          </span>
        )}
        {hasIcon && (
          <span
            aria-hidden="true"
            className="flex min-w-4 shrink-0 items-center justify-center"
          >
            {fields.icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          {/* On one line, the menu as wide as it needs - a description
              wraps within that width, and so does a label on a phone */}
          <span className="block sm:whitespace-nowrap">{fields.label}</span>
          {fields.description && (
            // Read as the description of the item, not as part of its name
            <span
              aria-hidden="true"
              className="block text-xs text-neutral-500 dark:text-neutral-400"
              id={descriptionId}
            >
              {fields.description}
            </span>
          )}
        </span>
        {fields.shortcut && (
          // Announced by `aria-keyshortcuts` - not read as part of the name
          <Kbd
            aria-hidden="true"
            className="ms-3 shrink-0"
            shortcut={fields.shortcut}
            size="sm"
          />
        )}
        {isParent && (
          <ChevronRight
            aria-hidden="true"
            // Towards the submenu - to the left right to left
            className="-me-1 shrink-0 text-neutral-500 rtl:rotate-180 dark:text-neutral-400"
            size={16}
          />
        )}
      </>
    );

    return (
      <li className="m-1" key={`row-${index}`} {...rowProps}>
        {href && !disabled ? (
          <Link {...itemProps} href={href}>
            {content}
          </Link>
        ) : href ? (
          // No `href` - nothing can open a disabled link, not even a middle
          // click or the context menu of the browser
          <a {...itemProps}>{content}</a>
        ) : (
          <button {...itemProps} type="button">
            {content}
          </button>
        )}
      </li>
    );
  };

  const activeRow = rows[activeIndex];
  const openEntries = submenu ? rowSubmenu(rows[submenu.index]) : undefined;

  return (
    <>
      <ul
        aria-activedescendant={
          activeRow && activeRow.kind !== "custom"
            ? itemId(activeIndex)
            : undefined
        }
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-orientation="vertical"
        className="min-w-48 focus:outline-none"
        data-menu-level={level}
        data-menu-tree={tree}
        id={id}
        onKeyDown={(event) => {
          // Not the keys of a portal in custom content (the list of an
          // Autocomplete), which reach here through the React tree
          if (listRef.current?.contains(event.target as Node)) {
            handleKey(event, false);
          }
        }}
        ref={attachList}
        role="menu"
        tabIndex={-1}
      >
        {nodes.map((node, nodeIndex) => {
          if (node.kind === "row") return renderRow(node.index);

          if (node.kind === "separator") {
            return (
              <li
                className="mx-1 my-1 border-t border-neutral-200 dark:border-neutral-800"
                key={`separator-${nodeIndex}`}
                role="separator"
              />
            );
          }

          // A group named by its heading - the heading itself is not read
          // as another line of the menu
          return (
            <li key={`group-${nodeIndex}`} role="none">
              {node.label && (
                <div
                  aria-hidden="true"
                  className="px-4 pt-2 pb-0.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400"
                >
                  {node.label}
                </div>
              )}
              <ul aria-label={node.label} role="group">
                {node.indexes.map(renderRow)}
              </ul>
            </li>
          );
        })}
      </ul>

      {submenu && openEntries && (
        <Submenu
          dir={submenu.dir}
          entries={openEntries}
          getAnchor={() => rowElement(submenu.index)?.getBoundingClientRect()}
          handleRef={submenuRef}
          id={submenuId}
          initialFocus={submenu.focus ? "first" : null}
          key={submenu.index}
          labelledBy={itemId(submenu.index)}
          level={level + 1}
          onClose={closeFromSubmenu}
          onCloseSubmenu={closeSubmenu}
          onPointerEnter={handleSubmenuPointerEnter}
          panelRef={submenuPanelRef}
          parentRef={listRef}
          treeId={tree}
        />
      )}
    </>
  );
}

interface SubmenuProps {
  dir: "ltr" | "rtl";
  entries: DropdownEntry[];
  getAnchor: () => DOMRect | undefined;
  handleRef: React.RefObject<MenuListHandle | null>;
  id: string;
  initialFocus: "first" | null;
  labelledBy: string;
  level: number;
  onClose: () => void;
  onCloseSubmenu: () => void;
  onPointerEnter: React.PointerEventHandler<HTMLDivElement>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  parentRef: React.RefObject<HTMLUListElement | null>;
  treeId: string;
}

/**
 * A submenu next to its item. It is an overlay of its own, above the menu:
 * Escape closes it first, and the focus in it counts as inside the menu.
 */
function Submenu({
  dir,
  entries,
  getAnchor,
  handleRef,
  id,
  initialFocus,
  labelledBy,
  level,
  onClose,
  onCloseSubmenu,
  onPointerEnter,
  panelRef,
  parentRef,
  treeId,
}: SubmenuProps) {
  const onCloseSubmenuRef = useRef(onCloseSubmenu);

  useLayoutEffect(() => {
    onCloseSubmenuRef.current = onCloseSubmenu;
  });

  const panelId = `${id}-panel`;

  // A Dialog opened from the submenu gives the focus back to the menu - or,
  // once that is gone too, to the trigger - when it closes
  const { childContext, id: layerId } = useOverlayLayer(true, {
    getElements: () => [
      // Opening from the keyboard, the list takes the focus before the ref
      // of the panel is set
      panelRef.current ?? document.getElementById(panelId),
    ],
    getFocusFallback: () => parentRef.current,
  });

  // Escape closes the submenu only - the topmost overlay - and the focus in
  // it goes back to its item
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !isEscapeKey(event) ||
        event.defaultPrevented ||
        !isTopmostOverlay(layerId)
      ) {
        return;
      }
      event.preventDefault();
      onCloseSubmenuRef.current();
    };

    // Bubble phase, like the other overlays - a control that uses up its
    // Escape keeps the submenu open
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [layerId]);

  return (
    <MenuPopup
      dir={dir}
      getAnchor={getAnchor}
      id={panelId}
      onPointerEnter={onPointerEnter}
      panelRef={panelRef}
      placement="submenu"
    >
      <OverlayContext value={childContext}>
        <MenuList
          aria-labelledby={labelledBy}
          entries={entries}
          id={id}
          initialFocus={initialFocus}
          level={level}
          onClose={onClose}
          onCloseSubmenu={onCloseSubmenu}
          ref={handleRef}
          treeId={treeId}
        />
      </OverlayContext>
    </MenuPopup>
  );
}
