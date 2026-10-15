import { toNumber } from "../data-table/query";
import { useMessages } from "../../../providers/ui-context";
import Autocomplete from "../autocomplete";
import DateTimePicker from "../datetime-picker";
import Input from "../input";
import NumberInput from "../number-input";
import SegmentedControl from "../segmented-control";
import Select from "../select";
import TagsInput from "../tags-input";
import { getOperatorArity, hasValue } from "./operators";
import type {
  FilterCondition,
  FilterField,
  FilterRange,
  FilterValue,
} from "./types";

type Dim = "xs" | "sm" | "md" | "lg";

interface EditorProps {
  condition: FilterCondition;
  dim: Dim;
  disabled: boolean;
  field: FilterField<never>;
  onChange: (value: FilterValue | undefined) => void;
}

interface SingleEditorProps extends EditorProps {
  label: string;
  value: string | number | boolean | undefined;
  onValueChange: (value: string | number | boolean | undefined) => void;
}

/** The option of `field` whose value is written `text`. */
const findOption = (field: FilterField<never>, text: string) =>
  field.options?.find((option) => String(option.value) === text);

/** A single value as the text of a field. */
const asText = (value: unknown) =>
  value === undefined || value === null || typeof value === "boolean"
    ? ""
    : String(value);

/** The field of one value - of a single value, or an end of a range. */
function SingleEditor({
  condition,
  dim,
  disabled,
  field,
  label,
  onValueChange,
  value,
}: SingleEditorProps) {
  const messages = useMessages().ui;

  if (field.render) {
    return field.render({
      "aria-label": label,
      condition,
      dim,
      disabled,
      field,
      onChange: (next) =>
        onValueChange(
          next === null || Array.isArray(next) || typeof next === "object"
            ? undefined
            : next,
        ),
      operator: condition.operator,
      value,
    });
  }

  switch (field.type) {
    case "number":
      return (
        <NumberInput
          aria-label={label}
          dim={dim}
          disabled={disabled}
          onChange={(number) => onValueChange(number ?? undefined)}
          placeholder={field.placeholder}
          value={typeof value === "number" ? value : toNumber(value)}
        />
      );
    case "date":
    case "datetime": {
      // `on` takes a day, also of a field of moments
      const type =
        field.type === "date" || condition.operator === "on"
          ? "date"
          : "datetime-local";
      return (
        <DateTimePicker
          aria-label={label}
          dim={dim}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value || undefined)}
          placeholder={field.placeholder}
          type={type}
          value={asText(value)}
        />
      );
    }
    case "boolean":
      return (
        <SegmentedControl
          aria-label={label}
          dim={dim}
          disabled={disabled}
          onChange={(picked) => onValueChange(picked === "true")}
          options={[
            { label: messages.common.yes, value: "true" },
            { label: messages.common.no, value: "false" },
          ]}
          value={
            value === true ? "true" : value === false ? "false" : undefined
          }
        />
      );
    case "select":
    case "multiSelect":
      if (field.loadOptions) {
        return (
          <Autocomplete
            aria-label={label}
            dim={dim}
            disabled={disabled}
            loadOptions={field.loadOptions}
            loadSelectedOptions={field.loadSelectedOptions}
            onChange={(picked) => onValueChange(picked ?? undefined)}
            placeholder={field.placeholder}
            value={
              typeof value === "string" || typeof value === "number"
                ? value
                : null
            }
          />
        );
      }
      return (
        <Select
          aria-label={label}
          dim={dim}
          disabled={disabled}
          hasEmpty
          onChange={(event) =>
            onValueChange(
              findOption(field, event.target.value)?.value ??
                (event.target.value || undefined),
            )
          }
          options={(field.options ?? []).map((option) => ({
            disabled: option.disabled,
            label: option.label,
            value: String(option.value),
          }))}
          value={asText(value)}
        />
      );
    default:
      return (
        <Input
          aria-label={label}
          dim={dim}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={field.placeholder}
          value={asText(value)}
        />
      );
  }
}

/** The field of a list of values - `in`, `hasAny`, … */
function ListEditor({
  condition,
  dim,
  disabled,
  field,
  onChange,
}: EditorProps) {
  const messages = useMessages().ui.filterBuilder;
  const values = Array.isArray(condition.value) ? condition.value : [];
  const change = (next: (string | number)[]) =>
    onChange(next.length ? next : undefined);

  if (field.render) {
    return field.render({
      "aria-label": messages.value,
      condition,
      dim,
      disabled,
      field,
      onChange,
      operator: condition.operator,
      value: condition.value,
    });
  }

  if (field.type === "select" || field.type === "multiSelect") {
    const common = {
      "aria-label": messages.value,
      dim,
      disabled,
      multiple: true as const,
      onChange: (picked: (string | number)[]) => change(picked),
      placeholder: field.placeholder,
      value: values,
    };
    return field.loadOptions ? (
      <Autocomplete
        {...common}
        loadOptions={field.loadOptions}
        loadSelectedOptions={field.loadSelectedOptions}
      />
    ) : (
      <Autocomplete
        {...common}
        options={(field.options ?? []).map((option) => ({
          disabled: option.disabled,
          label: option.label,
          value: option.value,
        }))}
      />
    );
  }

  // Typed values - numbers stay numbers
  return (
    <TagsInput
      addOnBlur
      aria-label={messages.value}
      dim={dim}
      disabled={disabled}
      onChange={(tags) =>
        change(
          field.type === "number"
            ? tags.map((tag) => toNumber(tag.replace(",", ".")) ?? tag)
            : tags,
        )
      }
      placeholder={field.placeholder}
      value={values.map(String)}
    />
  );
}

/**
 * The value field of a condition - by the type of its field and what its
 * operator takes: none, one value, a list or a range.
 */
export default function ValueEditor(props: EditorProps) {
  const { condition, onChange } = props;
  const messages = useMessages().ui.filterBuilder;
  const { value } = condition;

  switch (getOperatorArity(condition.operator)) {
    case "none":
      return null;
    case "list":
      return <ListEditor {...props} />;
    case "range": {
      const range: FilterRange =
        typeof value === "object" && value !== null && !Array.isArray(value)
          ? value
          : {};
      const setEnd = (
        end: "from" | "to",
        next: string | number | boolean | undefined,
      ) => {
        const changed = {
          ...range,
          [end]: typeof next === "boolean" ? undefined : next,
        };
        onChange(
          hasValue(changed.from) || hasValue(changed.to) ? changed : undefined,
        );
      };
      return (
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-32 flex-1">
            <SingleEditor
              {...props}
              label={messages.from}
              onValueChange={(next) => setEnd("from", next)}
              value={range.from ?? undefined}
            />
          </div>
          <span aria-hidden="true" className="text-neutral-500">
            –
          </span>
          <div className="min-w-32 flex-1">
            <SingleEditor
              {...props}
              label={messages.to}
              onValueChange={(next) => setEnd("to", next)}
              value={range.to ?? undefined}
            />
          </div>
        </div>
      );
    }
    default:
      return (
        <SingleEditor
          {...props}
          label={messages.value}
          onValueChange={(next) => onChange(next)}
          value={
            Array.isArray(value) || (typeof value === "object" && value)
              ? undefined
              : (value ?? undefined)
          }
        />
      );
  }
}
