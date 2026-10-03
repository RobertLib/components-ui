import { useId, useRef, useState } from "react";
import {
  PHONE_COUNTRIES,
  normalizePhone,
  detectPhoneCountry,
  isInternationalPhone,
  type PhoneCountry,
} from "./phone-input/number";
export { PHONE_COUNTRIES, type PhoneCountry } from "./phone-input/number";
import {
  attachRef,
  isAriaInvalid,
  useFieldsetDisabled,
  useFormReset,
} from "../../hooks/use-form-control";
import useCustomValidity from "../../hooks/use-custom-validity";
import { toIntlLocale } from "../../i18n/format";
import { useLocale } from "../../providers/ui-context";
import cn from "../../utils/cn";
import Input, { type InputProps } from "./input";
import Select from "./select";

/** Information accompanying an international phone value, including incomplete input. */
export interface PhoneInputValue {
  /** Selected or detected ISO country code. */
  country: string;
  /** Whether the number has 7–15 international digits. */
  isPossible: boolean;
  /** Whether the number fits the E.164 structure and selected calling prefix; no numbering-plan validation. */
  isValid: boolean;
}

export interface PhoneInputProps extends Omit<
  InputProps,
  | "type"
  | "value"
  | "defaultValue"
  | "onChange"
  | "prefix"
  | "suffix"
  | "mask"
  | "pattern"
  | "maskTokens"
  | "onMaskChange"
  | "unmask"
  | "passwordStrength"
> {
  /** Classes of the country/number group. */
  className?: string;
  /** International value, including the leading +; empty is an empty string. */
  value?: string;
  /** Initial number; followed until the user edits and restored by form reset. */
  defaultValue?: string;
  /** International number after an edit; incomplete numbers are reported too. */
  onChange?: (value: string, details: PhoneInputValue) => void;
  /** Controlled selected country. */
  country?: string;
  /** Initial ISO country code for national numbers. Defaults to US. */
  defaultCountry?: string;
  /** Country selection requested by the user or detected from an international number. */
  onCountryChange?: (country: string) => void;
  /** Restrict the country picker; by default PHONE_COUNTRIES are offered; supply custom entries for other regions. */
  countries?: readonly PhoneCountry[];
  /** Accessible name of the country picker; localized by default. */
  countryLabel?: string;
  /** Validate the E.164 structure on native submit. Defaults to true. National trunk prefixes are not removed automatically. */
  validate?: boolean;
}

/** A country picker and telephone field submitting an international number. */
export default function PhoneInput({
  className,
  countries,
  country,
  countryLabel,
  defaultCountry = "US",
  defaultValue = "",
  description,
  dim = "md",
  disabled: disabledProp,
  error,
  form,
  id: providedId,
  label,
  name,
  onBlur,
  onChange,
  onCountryChange,
  readOnly = false,
  ref,
  required,
  validate = true,
  value,
  ...props
}: PhoneInputProps) {
  const locale = useLocale();
  const messages = locale.messages.phoneInput;
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = !!disabledProp || fieldsetDisabled;
  const [edited, setEdited] = useState<string>();
  const [pickedCountry, setPickedCountry] = useState<string>();
  const [draft, setDraft] = useState<{ value: string; text: string } | null>(
    null,
  );
  const [validationShown, setValidationShown] = useState(false);
  const current = value ?? edited ?? defaultValue;
  const allowed = (countries ?? PHONE_COUNTRIES).filter(
    (entry, index, entries) =>
      /^[A-Z]{2}$/.test(entry.code) &&
      /^[1-9]\d{0,3}$/.test(entry.callingCode) &&
      entries.findIndex((candidate) => candidate.code === entry.code) === index,
  );
  // An accepted international value takes precedence over a previous pick.
  // The pick still disambiguates countries sharing a calling prefix.
  const requestedCountry =
    country ??
    detectPhoneCountry(current, allowed, pickedCountry ?? defaultCountry);
  const selected =
    allowed.find((entry) => entry.code === requestedCountry) ??
    allowed.find((entry) => entry.code === defaultCountry) ??
    allowed[0];
  const selectedCountry = selected?.code ?? "";
  const normalized = selected ? normalizePhone(current, selected) : current;
  const valid = !!selected && isInternationalPhone(normalized, selected);
  const displayed = draft?.value === current ? draft.text : normalized;
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Native required checks the visible draft, which can contain text but
  // normalize to an empty submitted number even with validate=false.
  const message =
    !disabled &&
    !readOnly &&
    displayed &&
    ((validate && !valid) || (required && !normalized))
      ? messages.invalid
      : "";
  useCustomValidity(inputRef, message);
  const resetRef = useFormReset(() => {
    setEdited(undefined);
    setPickedCountry(undefined);
    setDraft(null);
    setValidationShown(false);
  }, form);
  const names = new Intl.DisplayNames([toIntlLocale(locale.code)], {
    type: "region",
  });
  const options = allowed
    .map((entry) => ({
      value: entry.code,
      label: `${names.of(entry.code) ?? entry.code} (+${entry.callingCode})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, toIntlLocale(locale.code)));
  const report = (text: string, nextCountry: string) => {
    const entry = allowed.find((candidate) => candidate.code === nextCountry);
    if (!entry) return;
    const nextValue = normalizePhone(text, entry);
    const detected = detectPhoneCountry(nextValue, allowed, nextCountry);
    if (detected !== nextCountry) {
      if (country === undefined) setPickedCountry(detected);
      onCountryChange?.(detected);
    }
    if (value === undefined) setEdited(nextValue);
    setDraft({ value: nextValue, text });
    const detectedEntry =
      allowed.find((candidate) => candidate.code === detected) ?? entry;
    onChange?.(nextValue, {
      country: detected,
      isPossible: /^\+[1-9]\d{6,14}$/.test(nextValue),
      isValid: isInternationalPhone(nextValue, detectedEntry),
    });
  };
  return (
    <div
      className={cn("flex items-start gap-2", className)}
      data-disabled={disabled ? "" : undefined}
      data-readonly={readOnly ? "" : undefined}
      data-invalid={
        error ||
        (validationShown && message) ||
        isAriaInvalid(props["aria-invalid"])
          ? ""
          : undefined
      }
      ref={(element) => {
        const detachDisabled = fieldsetRef(element);
        const detachReset = resetRef(element);
        return () => {
          detachDisabled?.();
          detachReset?.();
        };
      }}
    >
      <div className="w-2/5 min-w-0">
        <Select
          aria-label={countryLabel ?? messages.country}
          className="w-full"
          dim={dim}
          disabled={disabled || !selected}
          form={form}
          label={
            label && !props.floating
              ? (countryLabel ?? messages.country)
              : undefined
          }
          onChange={(event) => {
            if (readOnly) return;
            const nextCountry = event.target.value;
            if (country === undefined) setPickedCountry(nextCountry);
            onCountryChange?.(nextCountry);
            report(
              selected && normalized.startsWith(`+${selected.callingCode}`)
                ? normalized.slice(selected.callingCode.length + 1)
                : normalized.replace(/\D/g, ""),
              nextCountry,
            );
          }}
          options={options}
          readOnly={readOnly}
          value={selectedCountry}
        />
      </div>
      <div className="min-w-0 flex-1">
        <Input
          {...props}
          autoComplete={props.autoComplete ?? "tel"}
          className="w-full"
          description={description}
          dim={dim}
          disabled={disabled}
          error={error || (validationShown ? message : undefined)}
          form={form}
          id={id}
          inputMode="tel"
          label={label}
          onBlur={(event) => {
            setDraft(null);
            onBlur?.(event);
          }}
          onChange={(event) => report(event.target.value, selectedCountry)}
          onInvalid={(event) => {
            setValidationShown(true);
            props.onInvalid?.(event);
          }}
          readOnly={readOnly}
          ref={(element) => {
            inputRef.current = element;
            const detach = attachRef(ref, element);
            return () => {
              inputRef.current = null;
              detach();
            };
          }}
          required={required}
          type="tel"
          value={displayed}
        />
      </div>
      {name && (
        <input
          disabled={disabled}
          form={form}
          name={name}
          type="hidden"
          value={normalized}
        />
      )}
    </div>
  );
}
