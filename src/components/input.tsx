import { Eye, EyeOff } from "lucide-react";
import { useFormControl } from "../hooks/use-form-control";
import { useId, useState } from "react";
import Button from "./button";
import cn from "../utils/cn";
import FormError from "./form-error";
import { useMessages } from "../providers/ui-context";

export interface InputProps extends React.ComponentProps<"input"> {
  /** Size of the field. */
  dim?: "sm" | "md" | "lg";
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /** Places the label inside the field, floating up once it has a value. */
  floating?: boolean;
  label?: string;
}

/**
 * A text field. Works controlled (`value` + `onChange`) and uncontrolled
 * (`defaultValue`); `type="password"` adds a show/hide toggle.
 */
export default function Input({
  className,
  defaultValue,
  dim = "md",
  disabled,
  error,
  floating = false,
  id,
  label,
  name,
  required,
  ...props
}: InputProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const messages = useMessages();

  const { fieldRef, handleChange, value } = useFormControl({
    ...props,
    defaultValue,
  });

  // A numeric 0 is a value too
  const isLabelFloating = isFocused || String(value) !== "";

  const inputType =
    props.type === "password"
      ? passwordVisible
        ? "text"
        : "password"
      : (props.type ?? "text");

  const dimStyles = {
    sm: "px-1 py-0 text-sm",
    md: "px-2 py-1 text-base",
    lg: "px-3 py-2 text-lg",
  };

  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && !floating && (
        <label className="block truncate text-sm font-medium" htmlFor={inputId}>
          {label}: {required && <span className="text-danger-500">*</span>}
        </label>
      )}

      <div className={cn("relative", props.type === "password" && "btn-group")}>
        {label && floating && (
          <label
            className={cn(
              "pointer-events-none absolute transition-all duration-200",
              isLabelFloating
                ? "translate-x-1 translate-y-[-0.7rem] bg-surface px-1 text-xs dark:bg-surface-dark"
                : "translate-x-2 translate-y-[0.4rem] text-neutral-500 dark:text-neutral-400",
              error && "text-danger-500",
            )}
            htmlFor={inputId}
          >
            {label} {required && <span className="text-danger-500">*</span>}
          </label>
        )}
        <input
          {...props}
          className={cn(
            "form-control px-2 py-1",
            dimStyles[dim],
            disabled && "cursor-not-allowed opacity-50",
            floating && "pt-2",
            error && "border-danger-500! focus:ring-danger-300!",
            className,
          )}
          aria-describedby={cn(errorId, props["aria-describedby"])}
          aria-invalid={error ? "true" : undefined}
          aria-required={required ? "true" : undefined}
          disabled={disabled}
          id={inputId}
          name={name}
          onBlur={(event) => {
            setIsFocused(false);
            props.onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            props.onFocus?.(event);
          }}
          onChange={handleChange}
          placeholder={floating ? "" : props.placeholder}
          ref={fieldRef}
          required={required}
          type={inputType}
          value={value}
        />
        {props.type === "password" && (
          <Button
            aria-label={
              inputType === "password"
                ? messages.input.showPassword
                : messages.input.hidePassword
            }
            aria-pressed={inputType === "text"}
            color="default"
            disabled={disabled}
            onClick={() => {
              setPasswordVisible((prev) => !prev);
            }}
          >
            {inputType === "password" ? (
              <Eye size={20} />
            ) : (
              <EyeOff size={20} />
            )}
          </Button>
        )}
      </div>

      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}
