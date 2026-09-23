import { cn } from "../utils/cn";
import { Fragment } from "react";

export interface StepperStep {
  /** Unique id of the step. */
  id: string | number;
  /** Marks the step as failed (red). */
  hasError?: boolean;
  /**
   * Icon component of the step, e.g. a `lucide-react` icon. The step number
   * is shown when left out.
   */
  icon?: React.ComponentType<{ className?: string }>;
  /** Set to false to disable navigating to the step (with `onStepClick`). */
  isClickable?: boolean;
  /** Defaults to "every step before the current one". */
  isCompleted?: boolean;
  /** Shown as the tooltip of the step. */
  title: string;
}

export interface StepperProps {
  className?: string;
  /** Id of the active step. */
  currentStepId: string | number;
  /**
   * Called with the id of a clicked step - leave out for a read-only
   * stepper, whose steps are no buttons.
   */
  onStepClick?: (stepId: string | number) => void;
  /** The steps in order. */
  steps: StepperStep[];
}

/** Progress through a multi-step flow, e.g. a wizard form. */
export default function Stepper({
  className,
  currentStepId,
  onStepClick,
  steps,
}: StepperProps) {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStepId);
  const currentStepNumber = currentStepIndex + 1;
  // Without `onStepClick` the steps only show the progress - no buttons
  const isNavigable = !!onStepClick;

  const handleStepClick = (stepId: string | number) => {
    const step = steps.find((s) => s.id === stepId);
    if (step?.isClickable !== false && onStepClick) {
      onStepClick(stepId);
    }
  };

  return (
    <div className={cn("mb-6", className)}>
      {/* Step icons */}
      <ol className="mb-4 flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = step.id === currentStepId;
          const isCompleted =
            step.isCompleted ?? stepNumber < currentStepNumber;
          const hasError = step.hasError ?? false;
          const isClickable = isNavigable && step.isClickable !== false;
          const IconComponent = step.icon;
          const isLast = index === steps.length - 1;
          const stepLabel = `${stepNumber}. ${step.title}`;

          const stepClassName = cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300",
            {
              "scale-110 border-primary-500 bg-primary-500 text-white shadow-lg":
                isActive && !hasError,
              "scale-110 border-danger-500 bg-danger-500 text-white shadow-lg":
                isActive && hasError,
              "border-primary-500 bg-primary-500 text-white":
                isCompleted && !isActive && !hasError,
              "border-danger-500 bg-danger-500 text-white":
                hasError && !isActive,
              "border-neutral-300 bg-surface text-neutral-400 dark:border-neutral-600 dark:bg-neutral-800":
                !isActive && !isCompleted && !hasError,
              "cursor-pointer hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300":
                isClickable,
              "cursor-not-allowed": isNavigable && !isClickable,
            },
          );

          const stepContent = (
            <>
              {/* The label says it - "2. Documents" */}
              <span aria-hidden="true">
                {IconComponent ? (
                  <IconComponent className="h-5 w-5" />
                ) : (
                  stepNumber
                )}
              </span>
              {isActive && (
                <div
                  className={cn(
                    "absolute inset-0 animate-pulse rounded-full border-2",
                    {
                      "border-primary-200": !hasError,
                      "border-danger-200": hasError,
                    },
                  )}
                />
              )}
            </>
          );

          return (
            <Fragment key={step.id}>
              <li className="flex flex-col items-center">
                {isNavigable ? (
                  <button
                    aria-current={isActive ? "step" : undefined}
                    aria-label={stepLabel}
                    className={stepClassName}
                    disabled={!isClickable}
                    onClick={() => handleStepClick(step.id)}
                    title={step.title}
                    type="button"
                  >
                    {stepContent}
                  </button>
                ) : (
                  <div
                    aria-current={isActive ? "step" : undefined}
                    className={stepClassName}
                    title={step.title}
                  >
                    {stepContent}
                    <span className="sr-only">{stepLabel}</span>
                  </div>
                )}
              </li>

              {/* Connecting line */}
              {!isLast && (
                <li aria-hidden="true" className="mx-4 flex-1">
                  <div
                    className={cn(
                      "h-0.5 w-full border-t-2 border-dashed opacity-80 transition-all duration-300",
                      {
                        "border-primary-500": isCompleted && !hasError,
                        "border-danger-500": hasError,
                        "border-neutral-300 dark:border-neutral-700":
                          !isCompleted && !hasError,
                      },
                    )}
                  />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}
