import { useEffect, useRef, useState } from "react";
import { hasReason } from "./disabled-reason";
import Tooltip from "./tooltip";
import { getEventTarget } from "./overlay-stack";
import { composedContains } from "../../utils/tabbable";
import type { FloatingSide } from "./menu/position";

// A press held this long on a touch screen shows the reason, as a long
// press shows the tooltip of a native app
const LONG_PRESS_DELAY = 500;

interface DisabledReasonTooltipProps {
  /**
   * The control is disabled with a reason - the reason shows and every
   * activation is refused. Otherwise the tooltip shows `label`, if any.
   */
  active: boolean;
  /** The control - a button or a link, described by `id` while `active`. */
  children: React.ReactElement;
  /** Classes of the wrapper - `w-full` for a full-width button. */
  className?: string;
  /**
   * The tooltip of the control while it is not `active` - the name of an
   * `IconButton` - and the heading above the reason while it is.
   */
  label?: React.ReactNode;
  /**
   * The `label` describes the control - it is not its name: the tooltip
   * then adds itself to its `aria-describedby` as it shows.
   */
  labelDescribes?: boolean;
  /** Keeps the `label` on one line while it shows alone. */
  nowrap?: boolean;
  /** Side of the control the tooltip appears on. */
  position?: FloatingSide;
  /** Why the control is disabled. */
  reason: React.ReactNode;
  /** Id of the hidden description the control points at while `active`. */
  reasonId: string;
}

/**
 * The tooltip of a control disabled with a reason (`disabledReason` of
 * `Button` and `IconButton`). The control stays focusable - a native
 * `disabled` would take it out of the tab order and give it no hover - and
 * this wrapper refuses its activation: a click, Enter or Space (the click
 * they make), the submit of its form and the navigation of a link. The
 * reason shows on hover, keyboard focus, a click or tap and a long press,
 * and a hidden copy describes the control (`aria-describedby`).
 */
export default function DisabledReasonTooltip({
  active,
  children,
  className,
  label,
  labelDescribes = false,
  nowrap = false,
  position = "top",
  reason,
  reasonId,
}: DisabledReasonTooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  // A finger is on the control - its long press shows no context menu
  const touchRef = useRef(false);

  // Enabled meanwhile - shown again only by a new hover, focus or press
  if (!active && open) setOpen(false);

  const clearPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
  };

  useEffect(() => clearPress, []);

  // A touch screen has no pointer that leaves the control - a press
  // anywhere else hides the reason a tap or a long press showed
  useEffect(() => {
    if (!active || !open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const wrapper = wrapperRef.current;
      const target = getEventTarget(event);
      if (wrapper && target && !composedContains(wrapper, target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [active, open]);

  // Before the control and everything around it: a disabled control does
  // nothing - no `onClick`, no submit (also the one Enter in a field of the
  // form makes with a click on its submit button), no navigation, no
  // clickable row around it. The click shows the reason instead.
  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (
      !active ||
      !(event.target instanceof Node) ||
      !event.currentTarget.contains(event.target)
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    clearPress();
    setOpen(true);
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!active || event.pointerType === "mouse") return;
    touchRef.current = true;
    clearPress();
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      setOpen(true);
    }, LONG_PRESS_DELAY);
  };

  // Lifted, moved away or taken over by a scroll - no long press
  const handlePressEnd = () => {
    touchRef.current = false;
    clearPress();
  };

  const tooltipContent = active ? (
    <span className="block max-w-64">
      {hasReason(label) && <span className="block">{label}</span>}
      <span className={hasReason(label) ? "block font-normal" : undefined}>
        {reason}
      </span>
    </span>
  ) : (
    label
  );

  return (
    <Tooltip
      className={className}
      // Keyboard focus shows it at once
      delay={500}
      nowrap={!active && nowrap}
      // Controlled while it explains - a tap and a long press show it too
      onClickCapture={handleClickCapture}
      onContextMenu={(event) => {
        if (active && touchRef.current) event.preventDefault();
      }}
      onOpenChange={active ? setOpen : undefined}
      onPointerCancel={handlePressEnd}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePressEnd}
      onPointerUp={handlePressEnd}
      open={active ? open : undefined}
      position={position}
      ref={wrapperRef}
      title={tooltipContent}
    >
      {active ? (
        // In a fragment: the control is described by the hidden copy below
        // - always, not only while the tooltip shows
        <>
          {children}
          <span hidden id={reasonId}>
            {reason}
          </span>
        </>
      ) : labelDescribes ? (
        children
      ) : (
        <>{children}</>
      )}
    </Tooltip>
  );
}
