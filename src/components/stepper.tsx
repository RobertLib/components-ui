import { cn } from "../utils/cn";
import { Fragment, useId, useLayoutEffect, useRef } from "react";
import CollapsibleContent from "./collapsible-content";
import useIsMobile from "../hooks/use-is-mobile";
import { useMessages } from "../providers/ui-context";

export interface StepperStep {
  /**
   * Shown while the step is the current one - e.g. the form of a wizard
   * step. Under the row of steps, or right under the step in the vertical
   * layout. Only the content of the current step is rendered.
   */
  content?: React.ReactNode;
  /**
   * A line about the step, e.g. "Choose a carrier" - shown under its title
   * in the vertical layout, in its tooltip in the horizontal one.
   */
  description?: string;
  /** Unique id of the step. */
  id: string | number;
  /** Marks the step as failed (red) - screen readers hear "Error". */
  hasError?: boolean;
  /**
   * Icon component of the step, e.g. a `lucide-react` icon. The step number
   * is shown when left out.
   */
  icon?: React.ComponentType<{ className?: string }>;
  /** Set to false to disable navigating to the step (with `onStepClick`). */
  isClickable?: boolean;
  /**
   * Defaults to "every step before the current one" - screen readers hear
   * "Completed".
   */
  isCompleted?: boolean;
  /**
   * Name of the step - shown next to it in the vertical layout, as its
   * tooltip in the horizontal one.
   */
  title: string;
}

export interface StepperProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /** Classes of the wrapper - it has a bottom margin (`mb-6`). */
  className?: string;
  /** Id of the active step. */
  currentStepId: string | number;
  /**
   * Called with the id of a clicked step - leave out for a read-only
   * stepper, whose steps are no buttons.
   */
  onStepClick?: (stepId: string | number) => void;
  /**
   * `horizontal` - a compact row of the steps, their titles in tooltips.
   * `vertical` - a column with the titles and descriptions, and the
   * `content` of the current step under it. `responsive` - vertical on
   * phones (below the `md` breakpoint), horizontal from it.
   */
  orientation?: "horizontal" | "vertical" | "responsive";
  /** The steps in order. */
  steps: StepperStep[];
}

/** The ids of the elements of a step - `prefix` is unique to the stepper. */
const getStepIds = (prefix: string, index: number) => ({
  buttonId: `${prefix}-${index}-button`,
  contentId: `${prefix}-${index}-content`,
  descriptionId: `${prefix}-${index}-description`,
  stateId: `${prefix}-${index}-state`,
});

/** An `aria-describedby` of the ids given - `undefined` for none. */
const joinIds = (...ids: (string | undefined)[]) =>
  ids.filter(Boolean).join(" ") || undefined;

/** Whether a step has content to show - `false` and `null` are none. */
const hasContent = (content: React.ReactNode) =>
  content !== undefined && content !== null && typeof content !== "boolean";

/**
 * Moves the focus to the content of the new current step, or to its button
 * when it has none. Called when the current step changed while the focus
 * was in the content of another one - content that is going away.
 */
function focusStep(contentId: string, buttonId: string) {
  const content = document.getElementById(contentId);
  if (content?.contains(document.activeElement)) return;

  (content ?? document.getElementById(buttonId))?.focus();
}

interface StepState {
  hasError: boolean;
  isActive: boolean;
  isCompleted: boolean;
}

/** The circle of a step - its color tells the state. */
const circleClassName = ({ hasError, isActive, isCompleted }: StepState) =>
  cn(
    "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300 motion-reduce:transition-none",
    {
      "scale-110 border-primary-600 bg-primary-600 text-white shadow-lg":
        isActive && !hasError,
      "scale-110 border-danger-500 bg-danger-500 text-white shadow-lg":
        isActive && hasError,
      "border-primary-600 bg-primary-600 text-white":
        isCompleted && !isActive && !hasError,
      "border-danger-500 bg-danger-500 text-white": hasError && !isActive,
      "border-neutral-300 bg-surface text-neutral-400 dark:border-neutral-600 dark:bg-neutral-800":
        !isActive && !isCompleted && !hasError,
    },
  );

/** The dashed line from a step to the next one - colored once completed. */
const connectorClassName = ({ hasError, isCompleted }: StepState) =>
  cn(
    "border-dashed opacity-80 transition-all duration-300 motion-reduce:transition-none",
    {
      "border-primary-500": isCompleted && !hasError,
      "border-danger-500": hasError,
      "border-neutral-300 dark:border-neutral-700": !isCompleted && !hasError,
    },
  );

/** Title of a step in the vertical layout. */
const titleClassName = ({ hasError, isActive, isCompleted }: StepState) =>
  cn("block text-sm", {
    "font-semibold text-danger-700 dark:text-danger-400": hasError,
    "font-semibold text-neutral-900 dark:text-neutral-100":
      isActive && !hasError,
    "font-medium text-neutral-700 dark:text-neutral-300":
      isCompleted && !isActive && !hasError,
    "font-medium text-neutral-500 dark:text-neutral-400":
      !isActive && !isCompleted && !hasError,
  });

/** The icon or the number of a step, and the pulse around the current one. */
function StepMarker({
  hasError,
  icon: IconComponent,
  isActive,
  number,
}: {
  hasError: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  number: number;
}) {
  return (
    <>
      {/* The label says it - "2. Documents" */}
      <span aria-hidden="true">
        {IconComponent ? <IconComponent className="h-5 w-5" /> : number}
      </span>
      {isActive && (
        <span
          className={cn(
            "absolute inset-0 animate-pulse rounded-full border-2 motion-reduce:animate-none",
            {
              "border-primary-200": !hasError,
              "border-danger-200": hasError,
            },
          )}
        />
      )}
    </>
  );
}

/**
 * Progress through a multi-step flow, e.g. a wizard form - a compact row, or
 * a column with the titles, descriptions and the content of the current
 * step. Besides its color, a step tells screen readers whether it is the
 * current one, completed or failed.
 */
export default function Stepper({
  className,
  currentStepId,
  onBlur,
  onFocus,
  onStepClick,
  orientation = "horizontal",
  steps,
  ...props
}: StepperProps) {
  const messages = useMessages();
  const idPrefix = useId();
  const isMobile = useIsMobile();
  const isVertical =
    orientation === "vertical" || (orientation === "responsive" && isMobile);
  const currentStepIndex = steps.findIndex((step) => step.id === currentStepId);
  const currentStepNumber = currentStepIndex + 1;
  const currentStep = steps[currentStepIndex];
  // Without `onStepClick` the steps only show the progress - no buttons
  const isNavigable = !!onStepClick;

  // Whether the focus is in the content of a step. A wizard's "Next" button
  // there goes away with the step - the focus then moves on to the new
  // current step instead of being lost.
  const focusInContentRef = useRef(false);
  const previousStepIdRef = useRef(currentStepId);

  useLayoutEffect(() => {
    const previousStepId = previousStepIdRef.current;
    previousStepIdRef.current = currentStepId;

    if (previousStepId === currentStepId || !focusInContentRef.current) {
      return;
    }

    const { buttonId, contentId } = getStepIds(idPrefix, currentStepIndex);
    focusStep(contentId, buttonId);
  }, [currentStepId, currentStepIndex, idPrefix]);

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    focusInContentRef.current = !!(event.target as Element).closest(
      "[data-step-content]",
    );
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    onBlur?.(event);
    // A focused element that is removed with its step blurs outside of
    // the page - the stepper does not hear of it
    if (!event.currentTarget.contains(event.relatedTarget)) {
      focusInContentRef.current = false;
    }
  };

  const handleStepClick = (stepId: string | number) => {
    const step = steps.find((s) => s.id === stepId);
    if (step?.isClickable !== false && onStepClick) {
      onStepClick(stepId);
    }
  };

  const describeStep = (step: StepperStep, index: number) => {
    const stepNumber = index + 1;
    const isCompleted = step.isCompleted ?? stepNumber < currentStepNumber;
    const hasError = step.hasError ?? false;
    const ids = getStepIds(idPrefix, index);
    // What the color says - the current step is `aria-current`
    const state = hasError
      ? messages.stepper.error
      : isCompleted
        ? messages.stepper.completed
        : undefined;

    return {
      ...ids,
      describedBy: joinIds(
        step.description ? ids.descriptionId : undefined,
        state ? ids.stateId : undefined,
      ),
      hasError,
      isActive: step.id === currentStepId,
      isClickable: isNavigable && step.isClickable !== false,
      isCompleted,
      isLast: index === steps.length - 1,
      label: `${stepNumber}. ${step.title}`,
      number: stepNumber,
      state,
    };
  };

  /** The content of the current step - named after it. */
  const renderContent = (
    step: StepperStep,
    index: number,
    className: string,
  ) => {
    const { contentId, label } = describeStep(step, index);

    return (
      <div
        aria-label={label}
        className={className}
        data-step-content=""
        id={contentId}
        role="group"
        // Takes the focus when the step before it goes away with it
        tabIndex={-1}
      >
        {step.content}
      </div>
    );
  };

  const horizontal = (
    <>
      {/* Step icons */}
      <ol className="mb-4 flex items-center justify-between">
        {steps.map((step, index) => {
          const info = describeStep(step, index);
          const title = step.description
            ? `${step.title}\n${step.description}`
            : step.title;
          const stepClassName = cn(circleClassName(info), {
            "cursor-pointer hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500":
              info.isClickable,
            "cursor-not-allowed": isNavigable && !info.isClickable,
          });

          const stepContent = (
            <StepMarker
              hasError={info.hasError}
              icon={step.icon}
              isActive={info.isActive}
              number={info.number}
            />
          );

          return (
            <Fragment key={step.id}>
              <li className="flex flex-col items-center">
                {isNavigable ? (
                  <button
                    aria-current={info.isActive ? "step" : undefined}
                    aria-describedby={info.describedBy}
                    aria-label={info.label}
                    className={stepClassName}
                    disabled={!info.isClickable}
                    id={info.buttonId}
                    onClick={() => handleStepClick(step.id)}
                    title={title}
                    type="button"
                  >
                    {stepContent}
                    {step.description && (
                      <span className="sr-only" id={info.descriptionId}>
                        {step.description}
                      </span>
                    )}
                    {info.state && (
                      <span className="sr-only" id={info.stateId}>
                        {info.state}
                      </span>
                    )}
                  </button>
                ) : (
                  <div
                    aria-current={info.isActive ? "step" : undefined}
                    className={stepClassName}
                    title={title}
                  >
                    {stepContent}
                    <span className="sr-only">{info.label}</span>
                    {info.state && (
                      <span className="sr-only">, {info.state}</span>
                    )}
                    {step.description && (
                      <span className="sr-only">, {step.description}</span>
                    )}
                  </div>
                )}
              </li>

              {/* Connecting line - narrower gaps on phones, so that more
                  steps fit */}
              {!info.isLast && (
                <li aria-hidden="true" className="mx-1 flex-1 sm:mx-4">
                  <div
                    className={cn(
                      "h-0.5 w-full border-t-2",
                      connectorClassName(info),
                    )}
                  />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>

      {/* A new step brings new content - nothing carried over from the last */}
      {currentStep && hasContent(currentStep.content) && (
        <Fragment key={currentStep.id}>
          {renderContent(currentStep, currentStepIndex, "focus:outline-none")}
        </Fragment>
      )}
    </>
  );

  const vertical = (
    <ol>
      {steps.map((step, index) => {
        const info = describeStep(step, index);

        const circle = (
          <span
            className={cn(
              circleClassName(info),
              info.isClickable && "group-hover:scale-105",
            )}
          >
            <StepMarker
              hasError={info.hasError}
              icon={step.icon}
              isActive={info.isActive}
              number={info.number}
            />
          </span>
        );

        const description = step.description && (
          <span
            className="mt-0.5 block text-sm text-neutral-500 dark:text-neutral-400"
            id={isNavigable ? info.descriptionId : undefined}
          >
            {step.description}
          </span>
        );

        return (
          <li className={cn("relative", !info.isLast && "pb-6")} key={step.id}>
            {/* Connecting line - down to the next step, past the content */}
            {!info.isLast && (
              <div
                aria-hidden="true"
                className={cn(
                  "absolute top-11 bottom-2 left-[17px] border-l-2",
                  connectorClassName(info),
                )}
              />
            )}

            {isNavigable ? (
              <button
                aria-current={info.isActive ? "step" : undefined}
                aria-describedby={info.describedBy}
                aria-label={info.label}
                className={cn(
                  "group -m-1 flex items-start gap-3 rounded-lg p-1 pr-2 text-left",
                  info.isClickable
                    ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    : "cursor-not-allowed",
                )}
                disabled={!info.isClickable}
                id={info.buttonId}
                onClick={() => handleStepClick(step.id)}
                type="button"
              >
                {circle}
                <span className="min-w-0 flex-1 pt-2">
                  <span className={titleClassName(info)}>{step.title}</span>
                  {description}
                </span>
                {info.state && (
                  <span className="sr-only" id={info.stateId}>
                    {info.state}
                  </span>
                )}
              </button>
            ) : (
              <div
                aria-current={info.isActive ? "step" : undefined}
                className="flex items-start gap-3"
              >
                {circle}
                <span className="min-w-0 flex-1 pt-2">
                  <span className={titleClassName(info)}>
                    <span className="sr-only">{info.number}. </span>
                    {step.title}
                    {info.state && (
                      <span className="sr-only">, {info.state}</span>
                    )}
                  </span>
                  {description}
                </span>
              </div>
            )}

            {hasContent(step.content) && (
              <CollapsibleContent isOpen={info.isActive}>
                {renderContent(step, index, "pt-3 pl-12 focus:outline-none")}
              </CollapsibleContent>
            )}
          </li>
        );
      })}
    </ol>
  );

  return (
    <div
      {...props}
      className={cn("mb-6", className)}
      onBlur={handleBlur}
      onFocus={handleFocus}
    >
      {isVertical ? vertical : horizontal}
    </div>
  );
}
