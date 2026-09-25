import { ChevronDown, ChevronUp } from "lucide-react";
import { isValidElement, use, useEffect, useId, useState } from "react";
import { AccordionGroupContext } from "./accordion-group-context";
import cn from "../utils/cn";
import CollapsibleContent from "./collapsible-content";
import IconButton from "./icon-button";
import logger from "../utils/logger";
import Panel from "./panel";
import { useMessages } from "../providers/ui-context";

// Clicks on these inside the header do their own thing - they do not toggle
const interactiveSelector = [
  "a[href]",
  "button",
  "input",
  "label",
  "select",
  "summary",
  "textarea",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='button']",
  "[role='checkbox']",
  "[role='link']",
  "[role='menuitem']",
  "[role='switch']",
  "[role='tab']",
].join(",");

export interface AccordionProps extends React.ComponentProps<"div"> {
  /**
   * Whether an uncontrolled accordion starts expanded. In an
   * `AccordionGroup` the group decides.
   */
  defaultOpen?: boolean;
  /**
   * Always visible part - clicking it toggles the content, except on links,
   * buttons and fields inside it. It is a heading for assistive technology
   * (see `headingLevel`) - unless it is a heading element itself
   * (`<h3>…</h3>`).
   */
  header?: React.ReactNode;
  /**
   * Level of the heading the header is for screen readers, who move between
   * the sections by their headings - the level of the headings around.
   * @default 3
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Called with the requested state when the header is clicked. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Controls whether the content is expanded - use with `onOpenChange`.
   * Leave out for an accordion that keeps its own state (`defaultOpen`). In
   * an `AccordionGroup` the group decides.
   */
  open?: boolean;
  /**
   * Names the section in an `AccordionGroup` - the `value` and
   * `defaultValue` of the group list the open sections by it. A generated
   * one when left out.
   */
  value?: string;
}

/** Whether a header is a heading element of its own - `<h3>…</h3>`. */
const isHeadingElement = (node: React.ReactNode) =>
  isValidElement(node) &&
  typeof node.type === "string" &&
  /^h[1-6]$/.test(node.type);

/**
 * A `Panel` whose content collapses under a clickable header. From the
 * keyboard, the toggle button at the end of the header opens and closes it.
 * In an `AccordionGroup` the group opens and closes it.
 */
export default function Accordion({
  defaultOpen = true,
  header,
  headingLevel = 3,
  children,
  onOpenChange,
  open,
  value,
  ...props
}: AccordionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const messages = useMessages();
  const headerId = useId();
  const contentId = useId();
  const group = use(AccordionGroupContext);
  const isGrouped = group !== null;
  const itemValue = value ?? contentId;

  const hasOpenProp = open !== undefined;
  const isControlled = !isGrouped && hasOpenProp;
  const isOpen = group
    ? group.openValues.includes(itemValue)
    : isControlled
      ? open
      : internalOpen;
  // The open section of a single group that is not collapsible stays open -
  // its toggle says it cannot be used (APG)
  const isLocked =
    !!group && group.type === "single" && !group.collapsible && isOpen;

  // `open` used to be the initial state
  useEffect(() => {
    if (!hasOpenProp) return;

    if (isGrouped) {
      logger.warn(
        "Accordion: `open` has no effect in an AccordionGroup - open the sections with the `value` or `defaultValue` of the group.",
      );
    } else if (!onOpenChange) {
      logger.warn(
        "Accordion: `open` without `onOpenChange` cannot be toggled - use `defaultOpen` for the initial state.",
      );
    }
  }, [hasOpenProp, isGrouped, onOpenChange]);

  const Icon = isOpen ? ChevronUp : ChevronDown;
  // The header is the heading of the section - or brings its own
  const isHeading = !!header && !isHeadingElement(header);

  const handleToggle = () => {
    if (isLocked) return;

    if (group) {
      group.toggle(itemValue);
    } else if (!isControlled) {
      setInternalOpen(!isOpen);
    }
    onOpenChange?.(!isOpen);
  };

  return (
    <Panel {...props}>
      {/* The whole header toggles on click - a convenience for the pointer,
          the button below is the control */}
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          isLocked ? "cursor-default" : "cursor-pointer",
        )}
        onClick={(e) => {
          const target = e.target as Element;
          const interactive = target.closest(interactiveSelector);
          if (interactive && e.currentTarget.contains(interactive)) return;
          handleToggle();
        }}
      >
        {/* A heading - the toggle after it is named by it (APG) */}
        <div
          aria-level={isHeading ? headingLevel : undefined}
          className="flex-1"
          id={headerId}
          role={isHeading ? "heading" : undefined}
        >
          {header}
        </div>
        <IconButton
          // Closed, the content is not there to point at
          aria-controls={isOpen ? contentId : undefined}
          aria-disabled={isLocked || undefined}
          aria-expanded={isOpen}
          aria-label={header ? undefined : messages.accordion.toggle}
          aria-labelledby={header ? headerId : undefined}
          className={
            isLocked
              ? "cursor-default! hover:bg-transparent! dark:hover:bg-transparent!"
              : undefined
          }
          data-accordion-toggle={group?.groupId}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
        >
          <Icon aria-hidden="true" size={18} />
        </IconButton>
      </div>
      <CollapsibleContent id={contentId} isOpen={isOpen}>
        {/* An accordion nested in the content is no section of the group */}
        <AccordionGroupContext value={null}>{children}</AccordionGroupContext>
      </CollapsibleContent>
    </Panel>
  );
}
