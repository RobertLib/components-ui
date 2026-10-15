import { ListPlus, Plus, X } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { attachRef, useFormReset } from "../../../hooks/use-form-control";
import { formatMessage } from "../../../i18n/ui/format";
import { useMessages } from "../../../providers/ui-context";
import cn from "../../../utils/cn";
import Button from "../button";
import { ReadOnlyContext, useReadOnly } from "../form-scope";
import IconButton from "../icon-button";
import SegmentedControl from "../segmented-control";
import Select, { type SelectOption, type SelectOptionGroup } from "../select";
import {
  compactFilter,
  convertValue,
  getFieldOperators,
  isFilterGroup,
} from "./operators";
import type {
  FilterCombinator,
  FilterCondition,
  FilterField,
  FilterGroup,
  FilterNode,
} from "./types";
import ValueEditor from "./value-editor";

type Dim = "xs" | "sm" | "md" | "lg";

export interface FilterBuilderProps<T = unknown> extends Omit<
  React.ComponentProps<"fieldset">,
  "children" | "defaultValue" | "onChange"
> {
  /**
   * The filter of an uncontrolled builder at first - and after a reset of
   * its form. An empty group by default.
   */
  defaultValue?: FilterGroup;
  /**
   * Size of the fields and buttons.
   * @default "md"
   */
  dim?: Dim;
  /**
   * Disables the builder - like a disabled native field, it is then not
   * submitted. A disabled `<fieldset>` around it disables it too.
   */
  disabled?: boolean;
  /** The fields the conditions can compare - see `FilterField`. */
  fields: readonly FilterField<T>[];
  /**
   * Id of the `<form>` the hidden input of `name` belongs to, when the
   * builder is not inside it. A reset of that form resets the builder too.
   */
  form?: string;
  /**
   * The `<legend>` above the builder - also its accessible name. Without
   * one the builder is named "Filter" of the locale (or by `aria-label`).
   */
  label?: React.ReactNode;
  /**
   * How deep groups nest, the top group included - 1 offers no groups.
   * @default 3
   */
  maxDepth?: number;
  /**
   * Submits the filter as JSON (`compactFilter` - without the conditions
   * that are not complete) in a hidden input of this name, so the builder
   * works in a plain `<form>` / `FormData`.
   */
  name?: string;
  /**
   * Shows the filter without a way to change it: its fields are read-only
   * and the buttons adding and removing conditions and groups are left
   * out. Still submitted under `name`. By default read-only inside a
   * read-only `FormSection` / `FormGrid`.
   */
  readOnly?: boolean;
  /**
   * Called with the new filter at every change - each of its conditions and
   * groups has an `id` then. Conditions that are not complete yet (no value)
   * are in it: `matchesFilter` and `compactFilter` leave them out.
   */
  onChange?: (value: FilterGroup) => void;
  /** The filter of a controlled builder - see `FilterGroup`. */
  value?: FilterGroup;
}

const EMPTY_FILTER: FilterGroup = { combinator: "and", conditions: [] };

// Ids of the conditions and groups added - unique, and short in the JSON
let lastId = 0;
const createId = () =>
  `f${(++lastId).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// The ids given to the nodes of a filter that came without them - the
// same node keeps its id, also once `onChange` has written it into the
// node: its fields are not rendered anew
const givenIds = new WeakMap<FilterNode, string>();

/** The id of a node - its own, or the one given to it. */
function idOf(node: FilterNode) {
  if (node.id) return node.id;
  let id = givenIds.get(node);
  if (!id) {
    id = createId();
    givenIds.set(node, id);
  }
  return id;
}

/** The group with an id on each node - the same group when all have one. */
function withIds(group: FilterGroup): FilterGroup {
  let changed = !group.id;
  const conditions = group.conditions.map((node) => {
    const next = isFilterGroup(node)
      ? withIds(node)
      : node.id
        ? node
        : { ...node, id: idOf(node) };
    if (next !== node) changed = true;
    return next;
  });
  return changed ? { ...group, conditions, id: idOf(group) } : group;
}

/** A new condition - of the first field, with its first operator. */
function createCondition(
  fields: readonly FilterField<never>[],
): FilterCondition | null {
  const [field] = fields;
  if (!field) return null;
  return {
    field: field.key,
    id: createId(),
    operator: getFieldOperators(field)[0],
  };
}

/** The place of a node as its name tells it - "2", "3.1". */
const pathText = (path: number[]) => path.map((index) => index + 1).join(".");

/** What `data-filter-path` marks - the top group is `root`. */
const pathKey = (path: number[]) => (path.length ? path.join(".") : "root");

/** The field select: the fields under the headings of their `group`. */
function fieldSelectOptions(
  fields: readonly FilterField<never>[],
  current: string,
) {
  const result: (SelectOption | SelectOptionGroup)[] = [];
  const headings = new Map<string, SelectOptionGroup>();

  for (const field of fields) {
    const option = { label: field.label, value: field.key };
    if (!field.group) {
      result.push(option);
      continue;
    }
    let heading = headings.get(field.group);
    if (!heading) {
      heading = { label: field.group, options: [] };
      headings.set(field.group, heading);
      result.push(heading);
    }
    heading.options.push(option);
  }

  // A field gone from `fields` (an old saved filter) - shown as it is
  if (!fields.some((field) => field.key === current)) {
    result.unshift({ label: current, value: current });
  }
  return result;
}

interface NodeContext {
  dim: Dim;
  disabled: boolean;
  fields: readonly FilterField<never>[];
  /** Asks to focus the node at `path` after the change - or the add button. */
  focusAfter: (path: number[], target: "node" | "add") => void;
  maxDepth: number;
  /** Nothing to add or remove - the fields are read-only by the context. */
  readOnly: boolean;
}

interface ConditionRowProps {
  condition: FilterCondition;
  context: NodeContext;
  onChange: (condition: FilterCondition) => void;
  onRemove: () => void;
  path: number[];
}

/** One condition - its field, operator and value, and its remove button. */
function ConditionRow({
  condition,
  context,
  onChange,
  onRemove,
  path,
}: ConditionRowProps) {
  const messages = useMessages().ui.filterBuilder;
  const { dim, disabled, fields, readOnly } = context;
  const field: FilterField<never> = fields.find(
    (candidate) => candidate.key === condition.field,
  ) ?? { key: condition.field, label: condition.field, type: "text" };
  const operators = getFieldOperators(field);
  const index = pathText(path);

  const changeField = (key: string) => {
    const next = fields.find((candidate) => candidate.key === key);
    if (!next || key === condition.field) return;
    const nextOperators = getFieldOperators(next);
    // A value of the same kind stays - of options of another field not
    const keepsValue =
      next.type === field.type &&
      next.type !== "select" &&
      next.type !== "multiSelect" &&
      next.type !== "custom" &&
      nextOperators.includes(condition.operator);
    onChange({
      field: key,
      id: condition.id,
      operator: keepsValue ? condition.operator : nextOperators[0],
      ...(keepsValue && condition.value !== undefined
        ? { value: condition.value }
        : {}),
    });
  };

  const changeOperator = (operator: FilterCondition["operator"]) => {
    const value = convertValue(
      condition.value,
      condition.operator,
      operator,
      field.type,
    );
    onChange({
      field: condition.field,
      id: condition.id,
      operator,
      ...(value !== undefined ? { value } : {}),
    });
  };

  return (
    <div
      aria-label={formatMessage(messages.condition, { index })}
      className="flex flex-wrap items-start gap-2"
      data-filter-path={pathKey(path)}
      role="group"
    >
      <div className="w-full sm:w-48">
        <Select
          aria-label={messages.field}
          dim={dim}
          disabled={disabled}
          onChange={(event) => changeField(event.target.value)}
          options={fieldSelectOptions(fields, condition.field)}
          value={condition.field}
        />
      </div>
      <div className="w-full sm:w-44">
        <Select
          aria-label={messages.operator}
          dim={dim}
          disabled={disabled}
          onChange={(event) =>
            changeOperator(event.target.value as FilterCondition["operator"])
          }
          options={(operators.includes(condition.operator)
            ? operators
            : [condition.operator, ...operators]
          ).map((operator) => ({
            label: messages.operators[operator] ?? operator,
            value: operator,
          }))}
          value={condition.operator}
        />
      </div>
      <div className="min-w-48 flex-1">
        <ValueEditor
          condition={condition}
          dim={dim}
          disabled={disabled}
          field={field}
          onChange={(value) => {
            const { value: _previous, ...rest } = condition;
            onChange(value === undefined ? rest : { ...rest, value });
          }}
        />
      </div>
      {!readOnly && (
        <IconButton
          aria-label={formatMessage(messages.removeCondition, { index })}
          className="shrink-0"
          disabled={disabled}
          onClick={onRemove}
          size={
            dim === "xs" || dim === "sm" ? "sm" : dim === "lg" ? "lg" : "md"
          }
          tooltip
        >
          <X />
        </IconButton>
      )}
    </div>
  );
}

interface GroupViewProps {
  context: NodeContext;
  group: FilterGroup;
  onChange: (group: FilterGroup) => void;
  /** Removes a nested group - none for the top one. */
  onRemove?: () => void;
  path: number[];
}

/** A group - the switch of its combinator, its nodes and the add buttons. */
function GroupView({
  context,
  group,
  onChange,
  onRemove,
  path,
}: GroupViewProps) {
  const messages = useMessages().ui.filterBuilder;
  const { dim, disabled, fields, focusAfter, maxDepth, readOnly } = context;
  const depth = path.length + 1;
  const isNested = path.length > 0;
  const index = pathText(path);
  const buttonSize = dim === "lg" ? "lg" : dim === "md" ? "md" : "sm";

  const replace = (position: number, node: FilterNode | null) => {
    const conditions = [...group.conditions];
    if (node) {
      // The changed node is the same node - with the same id
      conditions[position] = node.id
        ? node
        : { ...node, id: idOf(group.conditions[position]) };
    } else {
      conditions.splice(position, 1);
    }
    onChange({ ...group, conditions, id: idOf(group) });
  };

  const remove = (position: number) => {
    replace(position, null);
    const remaining = group.conditions.length - 1;
    if (remaining === 0) focusAfter(path, "add");
    else focusAfter([...path, Math.min(position, remaining - 1)], "node");
  };

  const add = (node: FilterNode | null) => {
    if (!node) return;
    onChange({ ...group, conditions: [...group.conditions, node] });
    focusAfter([...path, group.conditions.length], "node");
  };

  const combinatorLabel = (combinator: FilterCombinator) =>
    combinator === "or" ? messages.or : messages.and;

  const content = (
    <>
      {(isNested || group.conditions.length > 1) && (
        <div className="flex items-center justify-between gap-2">
          {group.conditions.length > 1 ? (
            <SegmentedControl
              aria-label={messages.combinator}
              dim={dim === "lg" ? "md" : "sm"}
              disabled={disabled}
              onChange={(combinator) => onChange({ ...group, combinator })}
              options={(["and", "or"] as const).map((combinator) => ({
                label: combinatorLabel(combinator),
                value: combinator,
              }))}
              value={group.combinator === "or" ? "or" : "and"}
            />
          ) : (
            <span />
          )}
          {onRemove && !readOnly && (
            <IconButton
              aria-label={formatMessage(messages.removeGroup, { index })}
              disabled={disabled}
              onClick={onRemove}
              size={buttonSize}
              tooltip
            >
              <X />
            </IconButton>
          )}
        </div>
      )}
      {group.conditions.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {messages.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {group.conditions.map((node, position) => {
            const nodePath = [...path, position];
            return (
              <div className="flex flex-col gap-2" key={idOf(node)}>
                {position > 0 && (
                  // The combinator between the nodes - the switch says it
                  <div
                    aria-hidden="true"
                    className="ps-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
                  >
                    {combinatorLabel(group.combinator)}
                  </div>
                )}
                {isFilterGroup(node) ? (
                  <GroupView
                    context={context}
                    group={node}
                    onChange={(next) => replace(position, next)}
                    onRemove={() => remove(position)}
                    path={nodePath}
                  />
                ) : (
                  <ConditionRow
                    condition={node}
                    context={context}
                    onChange={(next) => replace(position, next)}
                    onRemove={() => remove(position)}
                    path={nodePath}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            data-filter-add={pathKey(path)}
            disabled={disabled || fields.length === 0}
            onClick={() => add(createCondition(fields))}
            size={
              buttonSize === "lg" ? "lg" : buttonSize === "md" ? "md" : "sm"
            }
            startIcon={<Plus size={16} />}
            variant="ghost"
          >
            {messages.addCondition}
          </Button>
          {depth < maxDepth && (
            <Button
              disabled={disabled || fields.length === 0}
              onClick={() => {
                const condition = createCondition(fields);
                add(
                  condition && {
                    combinator: "and",
                    conditions: [condition],
                    id: createId(),
                  },
                );
              }}
              size={
                buttonSize === "lg" ? "lg" : buttonSize === "md" ? "md" : "sm"
              }
              startIcon={<ListPlus size={16} />}
              variant="ghost"
            >
              {messages.addGroup}
            </Button>
          )}
        </div>
      )}
    </>
  );

  if (!isNested) return content;

  return (
    <fieldset
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3 dark:border-neutral-700 dark:bg-neutral-900/40"
      data-filter-path={pathKey(path)}
    >
      <legend className="sr-only">
        {formatMessage(messages.group, { index })}
      </legend>
      {content}
    </fieldset>
  );
}

// What takes the focus in a node - its first field select (of its first
// condition, in a group), else its first field or button
const FOCUSABLE = [
  "select:not(:disabled)",
  "input:not([type=hidden]):not(:disabled), button:not(:disabled)",
];

/**
 * An advanced search: conditions - a field, an operator and a value - in
 * groups joined by AND or OR, which nest up to `maxDepth`. The value is a
 * JSON-serializable `FilterGroup`: send it to a server, match records in
 * the browser with `matchesFilter`, or write it as a sentence with
 * `describeFilter`. The values are entered in the fields of the library -
 * text, numbers, dates, options (also loaded from an API), Yes / No - or a
 * field of the app (`render`). Controlled (`value` + `onChange`) or
 * uncontrolled (`defaultValue`); with a `name` it submits the filter as
 * JSON with its form. A `<fieldset>` - the groups are fieldsets and the
 * conditions named groups for screen readers; the `ref` and the other
 * attributes go to it.
 */
export default function FilterBuilder<T = unknown>({
  className,
  defaultValue = EMPTY_FILTER,
  dim = "md",
  disabled = false,
  fields: givenFields,
  form,
  label,
  maxDepth = 3,
  name,
  onChange,
  readOnly: ownReadOnly,
  ref,
  value,
  ...props
}: FilterBuilderProps<T>) {
  const readOnly = useReadOnly(ownReadOnly);
  const messages = useMessages().ui.filterBuilder;
  const fields = givenFields as readonly FilterField<never>[];
  const [ownValue, setOwnValue] = useState(defaultValue);
  const filter = value ?? ownValue;
  const rootRef = useRef<HTMLFieldSetElement | null>(null);
  // Where the focus goes once a change is rendered
  const focusRef = useRef<{ path: number[]; target: "node" | "add" } | null>(
    null,
  );

  const resetRef = useFormReset(() => setOwnValue(defaultValue), form);

  const change = (next: FilterGroup) => {
    const withAllIds = withIds(next);
    if (value === undefined) setOwnValue(withAllIds);
    onChange?.(withAllIds);
  };

  useLayoutEffect(() => {
    const request = focusRef.current;
    const root = rootRef.current;
    if (!request || !root) return;
    focusRef.current = null;

    if (request.target === "add") {
      root
        .querySelector<HTMLElement>(
          `[data-filter-add="${pathKey(request.path)}"]`,
        )
        ?.focus();
      return;
    }
    const node = root.querySelector(
      `[data-filter-path="${pathKey(request.path)}"]`,
    );
    for (const selector of FOCUSABLE) {
      const target = node?.querySelector<HTMLElement>(selector);
      if (target) {
        target.focus();
        return;
      }
    }
  });

  const fieldsetRef = useCallback(
    (element: HTMLFieldSetElement | null) => {
      rootRef.current = element;
      const detachReset = resetRef(element);
      const detach = attachRef(ref, element);
      return () => {
        detachReset?.();
        detach();
        if (rootRef.current === element) rootRef.current = null;
      };
    },
    [ref, resetRef],
  );

  const hasName = !!props["aria-label"] || !!props["aria-labelledby"];

  return (
    <fieldset
      {...props}
      className={cn("flex min-w-0 flex-col gap-3", className)}
      disabled={disabled}
      ref={fieldsetRef}
    >
      {label !== undefined && label !== null && label !== false ? (
        <legend className="mb-1 text-sm font-medium">{label}</legend>
      ) : (
        !hasName && <legend className="sr-only">{messages.label}</legend>
      )}
      {/* Its fields are read-only with it - and editable in a read-only
          section with `readOnly={false}` */}
      <ReadOnlyContext value={readOnly}>
        <GroupView
          context={{
            dim,
            disabled,
            fields,
            focusAfter: (path, target) => {
              focusRef.current = { path, target };
            },
            maxDepth: Math.max(1, Math.floor(maxDepth) || 1),
            readOnly,
          }}
          group={filter}
          onChange={change}
          path={[]}
        />
      </ReadOnlyContext>
      {name !== undefined && (
        <input
          form={form}
          name={name}
          type="hidden"
          value={JSON.stringify(compactFilter(filter, givenFields))}
        />
      )}
    </fieldset>
  );
}
