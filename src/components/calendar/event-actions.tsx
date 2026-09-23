import cn from "../../utils/cn";

interface EventActionsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper for the per-event controls a view renders through
 * `renderEventActions`. It sits in the top-right corner of the tile and only
 * appears while the tile is hovered - a tile is small and the controls would
 * otherwise cover the text. Pointers with no hover (touch) get them permanently.
 *
 * Both the click and the mousedown are swallowed here: the tile underneath
 * opens the event on click and starts a drag on mousedown, and neither may
 * happen when an action inside is used.
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
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
