import { useId, useLayoutEffect, useRef, useState } from "react";
import cn from "../../utils/cn";
import { foldSearchText } from "../../utils/remove-diacritics";
import Dropdown, { type DropdownEntry } from "./dropdown";
import Button from "./button";
import { attachRef } from "../../hooks/use-form-control";

export interface MenubarMenu {
  /** Stable unique menu id. */
  id: string;
  /** Visible and accessible menu name, also used for typeahead. */
  label: string;
  /** Dropdown commands, links, checkboxes, radios and nested submenus. */
  items: DropdownEntry[];
  /** The menu cannot be opened. */
  disabled?: boolean;
}

export interface MenubarProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  menus: readonly MenubarMenu[];
  /** Controlled open menu id, or null. */
  openMenu?: string | null;
  /** Initial open menu; closed by default. */
  defaultOpenMenu?: string | null;
  /** Open menu requested by a trigger, navigation, an action or dismissal. */
  onOpenMenuChange?: (id: string | null) => void;
  /** Size of the menu triggers. Defaults to md. */
  size?: "sm" | "md" | "lg";
}

/** A horizontal application menu: one Tab stop, arrow navigation, typeahead and nested menus. */
export default function Menubar({
  className,
  defaultOpenMenu = null,
  menus,
  onKeyDown,
  onOpenMenuChange,
  openMenu,
  ref,
  size = "md",
  ...props
}: MenubarProps) {
  const id = useId();
  const [internalOpen, setInternalOpen] = useState<string | null>(
    defaultOpenMenu,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const typeahead = useRef({ text: "", time: 0 });
  const enabled = menus.filter((menu) => !menu.disabled);
  const requested = openMenu === undefined ? internalOpen : openMenu;
  const openId = menus.some((menu) => menu.id === requested && !menu.disabled)
    ? requested
    : null;
  const tabStop =
    enabled.find((menu) => menu.id === activeId)?.id ?? enabled[0]?.id;
  const change = (next: string | null) => {
    if (openMenu === undefined) setInternalOpen(next);
    onOpenMenuChange?.(next);
  };
  const previousMenus = useRef(menus);
  useLayoutEffect(() => {
    if (previousMenus.current === menus) return;
    previousMenus.current = menus;
    const active = rootRef.current?.ownerDocument.activeElement;
    if (active && active !== rootRef.current?.ownerDocument.body) return;
    if (activeId !== null && !enabled.some((menu) => menu.id === activeId))
      buttons.current.get(tabStop ?? "")?.focus();
  }, [activeId, enabled, menus, tabStop]);
  return (
    <div
      {...props}
      aria-orientation="horizontal"
      className={cn(
        "flex flex-wrap items-center gap-1 rounded border border-neutral-200 bg-surface p-1 dark:border-neutral-700 dark:bg-surface-dark",
        className,
      )}
      data-orientation="horizontal"
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          event.defaultPrevented ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.nativeEvent.isComposing
        )
          return;
        const target = event.target as Element;
        const onTrigger = !!rootRef.current?.contains(target);
        // The open menu itself - not a submenu, nor a control in its custom
        // content, which keeps its arrow keys (the caret of a field)
        const onMenu =
          !!openId &&
          !!target.id &&
          buttons.current.get(openId)?.getAttribute("aria-controls") ===
            target.id;
        if (!onTrigger && !onMenu) return;
        const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
        const current = enabled.findIndex(
          (entry) => entry.id === (openId ?? tabStop),
        );
        let index: number | null = null;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight")
          index =
            (Math.max(0, current) +
              ((event.key === "ArrowRight") !== rtl ? 1 : -1) +
              enabled.length) %
            enabled.length;
        else if (onTrigger && event.key === "Home") index = 0;
        else if (onTrigger && event.key === "End") index = enabled.length - 1;
        else if (onTrigger && event.key.length === 1 && event.key !== " ") {
          const text =
            event.timeStamp - typeahead.current.time > 700
              ? event.key
              : typeahead.current.text + event.key;
          typeahead.current = { text, time: event.timeStamp };
          const search = [...text].every((character) => character === text[0])
            ? text[0]
            : text;
          const ordered = [
            ...enabled.slice(current + 1),
            ...enabled.slice(0, current + 1),
          ];
          const match = ordered.find((entry) =>
            foldSearchText(entry.label).startsWith(foldSearchText(search)),
          );
          if (match) index = enabled.indexOf(match);
        }
        if (index === null || !enabled[index]) return;
        event.preventDefault();
        const next = enabled[index].id;
        setActiveId(next);
        buttons.current.get(next)?.focus();
        if (openId) change(next);
      }}
      ref={(element) => {
        rootRef.current = element;
        const detach = attachRef(ref, element);
        return () => {
          rootRef.current = null;
          detach();
        };
      }}
      role="menubar"
    >
      {menus.map((menu, index) => (
        <Dropdown
          align="start"
          buttonTrigger
          items={menu.items}
          initialFocus="first"
          key={menu.id}
          offset={4}
          onMouseEnter={() => {
            if (openId && !menu.disabled && openId !== menu.id) {
              setActiveId(menu.id);
              change(menu.id);
            }
          }}
          onOpenChange={(next) => {
            if (!menu.disabled && (next || openId === menu.id)) {
              setActiveId(menu.id);
              change(next ? menu.id : null);
            }
          }}
          open={openId === menu.id}
          trigger={
            <Button
              aria-disabled={menu.disabled || undefined}
              disabled={menu.disabled}
              id={`${id}-${index}`}
              onFocus={() => setActiveId(menu.id)}
              ref={(element) => {
                if (element) buttons.current.set(menu.id, element);
                return () => {
                  buttons.current.delete(menu.id);
                };
              }}
              role="menuitem"
              size={size}
              tabIndex={menu.id === tabStop ? 0 : -1}
              variant="ghost"
            >
              {menu.label}
            </Button>
          }
        />
      ))}
    </div>
  );
}
