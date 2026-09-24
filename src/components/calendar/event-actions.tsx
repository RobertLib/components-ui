import cn from "../../utils/cn";

interface EventActionsProps {
  /** The controls `renderEventActions` returned for the event. */
  children: React.ReactNode;
  /** Classes of the wrapper, e.g. to place it elsewhere on the tile. */
  className?: string;
}

/**
 * Wrapper for the per-event controls a view renders through
 * `renderEventActions`. It sits in the top-right corner of the tile and only
 * appears while the tile is hovered - a tile is small and the controls would
 * otherwise cover the text. Pointers with no hover (touch) get them permanently.
 *
 * The press, the mousedown and the click are swallowed here: the tile
 * underneath starts a drag on a press and opens the event on a click, and
 * neither may happen when an action inside is used. A drag would also
 * capture the pointer, so the click would go to the tile, not the action.
 */
export default function EventActions({
  children,
  className,
}: EventActionsProps) {
  // A view calls `renderEventActions` for every tile, and most of them have no
  // action to offer - without this they would each get an empty box appearing
  // under the pointer.
  if (!children) return null;

  return (
    <div
      className={cn(
        "absolute top-0.5 right-0.5 z-20 flex items-center gap-0.5 rounded bg-surface/85 opacity-0 transition-opacity group-hover/event:opacity-100 focus-within:opacity-100 dark:bg-surface-dark/85 [@media(hover:none)]:opacity-100",
        className,
      )}
      data-event-actions=""
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
