import { useEffect, useRef, useState } from "react";
import cn from "../../utils/cn";
import { clampWidth, MAX_COLUMN_WIDTH } from "./cell-layout";
import { formatMessage, formatPlural } from "../../i18n/format";
import { useLocale } from "../../providers/ui-context";

// Pixels an arrow key resizes by - with Shift the bigger step
const KEY_STEP = 10;
const KEY_BIG_STEP = 50;

/** A drag of the handle in progress. */
interface Drag {
  /** Stops listening for Escape. */
  cleanup: () => void;
  /** The width shown last. */
  last: number;
  /** Whether the pointer has moved the edge - a click alone keeps the width. */
  moved: boolean;
  pointerId: number;
  /** Width of the column when the drag started. */
  startWidth: number;
  startX: number;
}

interface ColumnResizeHandleProps {
  /** Name of the column - the name of the handle tells what it resizes. */
  columnName: string;
  /**
   * The edge of the header cell the handle is on - `left` for a column
   * pinned to the right edge, which grows to the left.
   */
  edge: "left" | "right";
  /** Upper limit of the width - End jumps to it when the column has one. */
  maxWidth?: number;
  /** Lower limit of the width - Home jumps to it. */
  minWidth: number;
  /**
   * The width a drag shows while it lasts, `null` when it ends - the table
   * shows it without saving it.
   */
  onDrag: (width: number | null) => void;
  /** Saves the width - at the end of a drag, on an arrow key. */
  onResize: (width: number) => void;
  /** Brings back the width of the column's definition - double-click, Enter. */
  onReset: () => void;
  /** The current width of the column in pixels, when known. */
  width?: number;
}

/**
 * The handle on the edge of a column header that resizes the column: drag
 * it (also by touch), or focus it and use the arrow keys (Shift for bigger
 * steps), Home / End for the limits. A double-click or Enter brings back
 * the column's own width; Escape cancels a drag.
 */
export default function ColumnResizeHandle({
  columnName,
  edge,
  maxWidth,
  minWidth,
  onDrag,
  onResize,
  onReset,
  width,
}: ColumnResizeHandleProps) {
  const locale = useLocale();
  const { messages } = locale;
  const dragRef = useRef<Drag | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const max = Math.max(minWidth, maxWidth ?? MAX_COLUMN_WIDTH);
  // Moving the handle to the left narrows a column - or widens one pinned
  // to the right, whose handle is on its left edge
  const direction = edge === "left" ? -1 : 1;

  // The header cell as it is laid out - the start of a resize
  const measure = (handle: HTMLElement) =>
    width ?? handle.parentElement?.getBoundingClientRect().width ?? minWidth;

  const endDrag = (save: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;

    dragRef.current = null;
    drag.cleanup();
    setIsDragging(false);
    if (save && drag.moved) onResize(drag.last);
    onDrag(null);
  };

  // A drag must not outlive the table
  useEffect(
    () => () => {
      dragRef.current?.cleanup();
      dragRef.current = null;
    },
    [],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || dragRef.current) return;
    // No text selection, no focus - and no drag of the column
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    const startWidth = clampWidth(measure(handle), minWidth, max);

    // Escape puts the column back - before a surrounding dialog or the full
    // screen can take the key
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      endDrag(false);
    };
    document.addEventListener("keydown", handleKeyDown, true);

    dragRef.current = {
      cleanup: () =>
        document.removeEventListener("keydown", handleKeyDown, true),
      last: startWidth,
      moved: false,
      pointerId: event.pointerId,
      startWidth,
      startX: event.clientX,
    };
    // Moves outside the handle keep coming to it - also of a finger
    if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const next = clampWidth(
      drag.startWidth + (event.clientX - drag.startX) * direction,
      minWidth,
      max,
    );
    if (next === drag.last) return;

    drag.last = next;
    drag.moved = true;
    onDrag(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = clampWidth(measure(event.currentTarget), minWidth, max);
    const step = event.shiftKey ? KEY_BIG_STEP : KEY_STEP;
    let next: number | null = null;

    switch (event.key) {
      case "ArrowLeft":
        next = current - step * direction;
        break;
      case "ArrowRight":
        next = current + step * direction;
        break;
      case "Home":
        next = minWidth;
        break;
      case "End":
        if (maxWidth !== undefined) next = maxWidth;
        break;
      case "Enter":
        event.preventDefault();
        onReset();
        return;
    }

    if (next === null) return;
    event.preventDefault();
    onResize(clampWidth(next, minWidth, max));
  };

  const valueNow = clampWidth(width ?? minWidth, minWidth, max);

  return (
    <div
      aria-label={formatMessage(messages.dataTable.resizeColumn, {
        label: columnName,
      })}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={minWidth}
      aria-valuenow={valueNow}
      aria-valuetext={formatPlural(
        locale.code,
        messages.dataTable.columnWidth,
        valueNow,
      )}
      className={cn(
        "group/resize absolute inset-y-0 z-1 flex w-2 cursor-col-resize touch-none select-none focus:outline-none pointer-coarse:w-4",
        edge === "left" ? "left-0 justify-start" : "right-0 justify-end",
      )}
      data-resizing={isDragging || undefined}
      // Not a click on the header - e.g. the sort button next to it
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onReset();
      }}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={() => endDrag(true)}
      onPointerCancel={() => endDrag(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) endDrag(true);
      }}
      role="separator"
      tabIndex={0}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-full w-px bg-neutral-300 opacity-0 transition-opacity motion-reduce:transition-none dark:bg-neutral-600",
          "group-hover/resize:w-0.5 group-hover/resize:bg-primary-400 group-hover/resize:opacity-100 group-hover/th:opacity-100",
          "group-focus-visible/resize:w-0.5 group-focus-visible/resize:bg-primary-500 group-focus-visible/resize:opacity-100",
          "group-data-resizing/resize:w-0.5 group-data-resizing/resize:bg-primary-500 group-data-resizing/resize:opacity-100",
        )}
      />
    </div>
  );
}
