import cn from "../utils/cn";
import ModalDialog from "./modal-dialog";

/** The edge of the screen a `Sheet` slides in from. */
export type SheetSide = "right" | "left" | "top" | "bottom";

/**
 * The width of a `left` / `right` `Sheet`, the maximum height of a `top` /
 * `bottom` one.
 */
export type SheetSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export interface SheetProps extends Omit<
  React.ComponentProps<"div">,
  "role" | "title"
> {
  /**
   * Keeps the sheet open - Escape and a click on the backdrop do nothing and
   * the close button is disabled, e.g. while its form is being saved.
   */
  closeDisabled?: boolean;
  /**
   * A click on the backdrop closes the sheet. Off by default, like in a
   * `Dialog`: a stray click does not throw away a form being filled in.
   */
  closeOnBackdropClick?: boolean;
  /**
   * Called when the user closes the sheet (close button, Escape, the
   * backdrop with `closeOnBackdropClick`). In uncontrolled mode it is called
   * after the sheet has slid out - e.g. `() => navigate(-1)` for a sheet
   * that is a route of its own.
   */
  onClose?: () => void;
  /**
   * Controls the sheet - it slides in when this turns `true` and out when
   * it turns `false`. Leave it out for an uncontrolled sheet that opens when
   * mounted and closes itself.
   */
  open?: boolean;
  /**
   * The edge of the screen the sheet slides in from - `right`, `left`,
   * `top` or `bottom`.
   */
  side?: SheetSide;
  /**
   * `sm` (24rem) - `2xl` (42rem) or `full`: from the `sm` breakpoint up, the
   * width of a `left` / `right` sheet (on phones it takes the whole width);
   * the maximum height of a `top` / `bottom` one, which is as tall as its
   * content.
   */
  size?: SheetSize;
  /** Heading - also the accessible name of the sheet. */
  title?: React.ReactNode;
}

// Where the sheet is, and where it slides out to - users who prefer reduced
// motion see it fade instead
const sideClasses: Record<SheetSide, { closed: string; panel: string }> = {
  right: {
    closed:
      "translate-x-full motion-reduce:translate-x-0 motion-reduce:opacity-0",
    // No border at the edge of a phone screen, which it fills
    panel: "inset-y-0 right-0 w-full sm:border-l",
  },
  left: {
    closed:
      "-translate-x-full motion-reduce:translate-x-0 motion-reduce:opacity-0",
    panel: "inset-y-0 left-0 w-full sm:border-r",
  },
  top: {
    closed:
      "-translate-y-full motion-reduce:translate-y-0 motion-reduce:opacity-0",
    panel: "inset-x-0 top-0 rounded-b-lg border-b",
  },
  bottom: {
    closed:
      "translate-y-full motion-reduce:translate-y-0 motion-reduce:opacity-0",
    panel: "inset-x-0 bottom-0 rounded-t-lg border-t",
  },
};

const widthClasses: Record<SheetSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  full: "",
};

// Never taller than the screen - the header stays in view
const heightClasses: Record<SheetSize, string> = {
  sm: "max-h-[min(24rem,100dvh)]",
  md: "max-h-[min(28rem,100dvh)]",
  lg: "max-h-[min(32rem,100dvh)]",
  xl: "max-h-[min(36rem,100dvh)]",
  "2xl": "max-h-[min(42rem,100dvh)]",
  full: "h-dvh",
};

// Also in the classes of the panel and the backdrop (`duration-300`)
const SLIDE_DURATION = 300;

/**
 * A panel sliding in from an edge of the screen - for the details of a
 * record or its edit form next to a list. Its header and a `DialogFooter`
 * stay in place while the content scrolls. It is a modal dialog like
 * `Dialog`: it traps the focus and gives it back, closes on Escape and
 * locks the page scroll while open.
 */
export default function Sheet({
  closeDisabled = false,
  closeOnBackdropClick = false,
  side = "right",
  size = "md",
  ...props
}: SheetProps) {
  const isVertical = side === "top" || side === "bottom";

  return (
    <ModalDialog
      {...props}
      animateControlled
      backdropClassName="duration-300"
      bodyClassName="overscroll-contain"
      closeDisabled={closeDisabled}
      closedClassName={sideClasses[side].closed}
      closeOnBackdropClick={closeOnBackdropClick}
      duration={SLIDE_DURATION}
      fitFooter
      panelClassName={cn(
        "fixed z-50 flex flex-col overflow-hidden border-neutral-200 bg-background shadow-xl transition-[translate,opacity] duration-300 ease-out focus:outline-none motion-reduce:transition-opacity dark:border-neutral-800 dark:bg-background-dark",
        sideClasses[side].panel,
        isVertical ? heightClasses[size] : widthClasses[size],
      )}
      role="dialog"
    />
  );
}
