import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState } from "react";
import {
  placeAtAnchor,
  placeSubmenu,
  type AnchorRect,
  type MenuPosition,
} from "./position";
import { ButtonGroupContext } from "../button-group-context";

interface MenuPopupProps {
  children: React.ReactNode;
  /**
   * The writing direction of what the menu belongs to - a portal in the
   * body does not inherit it from there. Right to left, a submenu opens to
   * the left and a context menu from the right edge of its anchor.
   */
  dir?: "ltr" | "rtl";
  /** Space between the anchor and a menu placed at it. */
  gap?: number;
  /**
   * The box the menu is placed at - read when it opens, and again when the
   * page scrolls or resizes (a submenu follows its item).
   */
  getAnchor: () => AnchorRect | null | undefined;
  /** Id of the panel. */
  id?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onPointerEnter?: React.PointerEventHandler<HTMLDivElement>;
  /** Ref to the panel. */
  panelRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * `anchor` - below the anchor (a context menu at the pointer), `submenu` -
   * beside it (a submenu next to its item).
   */
  placement: "anchor" | "submenu";
}

const isSamePosition = (a: MenuPosition, b: MenuPosition) =>
  a.left === b.left && a.top === b.top && a.maxHeight === b.maxHeight;

/**
 * The floating panel of a submenu or a context menu - rendered in a portal,
 * so no `overflow` container clips it, and kept inside the viewport.
 */
export default function MenuPopup({
  children,
  dir,
  gap = 0,
  getAnchor,
  id,
  onKeyDown,
  onPointerEnter,
  panelRef,
  placement,
}: MenuPopupProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = panelRef ?? internalRef;
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const getAnchorRef = useRef(getAnchor);

  useLayoutEffect(() => {
    getAnchorRef.current = getAnchor;
  });

  // Placed once rendered, as it is measured - before it is painted, so it
  // never shows where it was put to be measured. Again when the page
  // scrolls or resizes, or the menu changes its size.
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;

    const place = () => {
      const anchor = getAnchorRef.current();
      if (!anchor) return;

      // As tall as its content, also while held to the viewport
      const borders = panel.offsetHeight - panel.clientHeight;
      const size = {
        height: panel.scrollHeight + borders,
        width: panel.offsetWidth,
      };
      const viewport = { height: window.innerHeight, width: window.innerWidth };
      const rtl = dir === "rtl";
      const next =
        placement === "submenu"
          ? placeSubmenu(anchor, size, viewport, rtl)
          : placeAtAnchor(anchor, size, viewport, gap, rtl);

      setPosition((current) =>
        current && isSamePosition(current, next) ? current : next,
      );
    };

    place();

    // Not in every environment (jsdom) - the menu is placed once then
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    // The content too - it may grow while the menu is held to the viewport
    for (const element of [panel, ...panel.children]) {
      observer?.observe(element);
    }
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [dir, gap, placement, ref]);

  return createPortal(
    <ButtonGroupContext value={null}>
      <div
        className="fixed z-50 max-w-[calc(100vw-1rem)] animate-fade-in overflow-y-auto rounded-md border border-neutral-100 bg-surface shadow-md dark:border-neutral-900 dark:bg-surface-dark"
        dir={dir}
        id={id}
        // A click in the menu stays in it - through the portal it would reach
        // the parents of the menu, e.g. a clickable row around a context menu
        onClick={(event) => event.stopPropagation()}
        // No menu of the browser over this one, nor a context menu around
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={onKeyDown}
        onPointerEnter={onPointerEnter}
        ref={ref}
        style={
          position
            ? {
                left: position.left,
                maxHeight: position.maxHeight,
                top: position.top,
              }
            : // Measured first - placed before the browser paints it
              { left: 0, top: 0 }
        }
      >
        {children}
      </div>
    </ButtonGroupContext>,
    document.body,
  );
}
