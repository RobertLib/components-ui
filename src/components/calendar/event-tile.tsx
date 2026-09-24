import { clickableTileProps } from "./utils";
import cn from "../../utils/cn";
import EventActions from "./event-actions";

export interface EventTileProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "onClick"
> {
  /** Controls of the event (`renderEventActions`), in the top-right corner. */
  actions?: React.ReactNode;
  /** Classes of the controls, e.g. to place them elsewhere on the tile. */
  actionsClassName?: string;
  /** What the tile shows - the icon and the title. */
  children: React.ReactNode;
  /** A button opens the event - otherwise the tile is plain text. */
  clickable: boolean;
  /** Classes of the element holding `children`. */
  contentClassName?: string;
  /** Resize handles - placed on the tile, over its button. */
  handles?: React.ReactNode;
  /** The title and time of the event - the accessible name of the tile. */
  label: string;
  /** Opens the event - a click, or Enter or Space on the button. */
  onOpen: () => void;
}

/**
 * An event tile. The button opening the event is a layer over the whole
 * tile, named by `label`; the actions and the links of an `htmlTitle` are
 * next to it, not in it - the content of a button is only its name, so
 * they would not be controls of their own there. A tile that opens nothing
 * reads `label` to screen readers as text.
 */
export default function EventTile({
  actions,
  actionsClassName,
  "aria-describedby": describedBy,
  children,
  className,
  clickable,
  contentClassName,
  handles,
  label,
  onOpen,
  ...props
}: EventTileProps) {
  return (
    <div
      {...props}
      className={cn("group/event", className)}
      onClick={(event) => {
        // Not a click on the day or the slot under the tile as well
        event.stopPropagation();

        // A link of the title goes where it leads
        const link =
          event.target instanceof Element
            ? event.target.closest("a[href]")
            : null;
        if (link && event.currentTarget.contains(link)) return;

        if (clickable) onOpen();
      }}
    >
      {clickable ? (
        <div
          aria-describedby={describedBy}
          aria-label={label}
          className="absolute inset-0 rounded-[inherit] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
          {...clickableTileProps(onOpen)}
        />
      ) : (
        <span className="sr-only">{label}</span>
      )}

      {/* Over the button, but the clicks go through - to the links only */}
      <div
        className={cn(
          "pointer-events-none relative [&_a]:pointer-events-auto",
          contentClassName,
        )}
      >
        {children}
      </div>

      {actions ? (
        <EventActions className={actionsClassName}>{actions}</EventActions>
      ) : null}
      {handles}
    </div>
  );
}
