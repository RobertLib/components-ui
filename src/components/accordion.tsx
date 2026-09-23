import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useState } from "react";
import CollapsibleContent from "./collapsible-content";
import IconButton from "./icon-button";
import logger from "../utils/logger";
import Panel from "./panel";
import { useMessages } from "../providers/ui-context";

export interface AccordionProps extends React.ComponentProps<"div"> {
  /** Whether an uncontrolled accordion starts expanded. */
  defaultOpen?: boolean;
  /** Always visible part - clicking it toggles the content. */
  header?: React.ReactNode;
  /** Called with the requested state when the header is clicked. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Controls whether the content is expanded - use with `onOpenChange`.
   * Leave out for an accordion that keeps its own state (`defaultOpen`).
   */
  open?: boolean;
}

/**
 * A `Panel` whose content collapses under a clickable header. From the
 * keyboard, the toggle button at the end of the header opens and closes it.
 */
export default function Accordion({
  defaultOpen = true,
  header,
  children,
  onOpenChange,
  open,
  ...props
}: AccordionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const messages = useMessages();
  const headerId = useId();

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  // `open` used to be the initial state
  useEffect(() => {
    if (isControlled && !onOpenChange) {
      logger.warn(
        "Accordion: `open` without `onOpenChange` cannot be toggled - use `defaultOpen` for the initial state.",
      );
    }
  }, [isControlled, onOpenChange]);

  const Icon = isOpen ? ChevronUp : ChevronDown;

  const handleToggle = () => {
    if (!isControlled) setInternalOpen(!isOpen);
    onOpenChange?.(!isOpen);
  };

  return (
    <Panel {...props}>
      {/* The whole header toggles on click - a convenience for the pointer,
          the button below is the control */}
      <div
        className="flex cursor-pointer items-center justify-between gap-3"
        onClick={handleToggle}
      >
        <div className="flex-1" id={headerId}>
          {header}
        </div>
        <IconButton
          aria-expanded={isOpen}
          aria-label={header ? undefined : messages.accordion.toggle}
          aria-labelledby={header ? headerId : undefined}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
        >
          <Icon aria-hidden="true" size={18} />
        </IconButton>
      </div>
      <CollapsibleContent isOpen={isOpen}>{children}</CollapsibleContent>
    </Panel>
  );
}
