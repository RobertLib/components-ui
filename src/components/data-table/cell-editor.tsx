import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Checkbox from "../checkbox";
import DateTimePicker from "../datetime-picker";
import Input from "../input";
import Select from "../select";
import { getTabbableElements } from "../../utils/tabbable";
import {
  fromDraft,
  getEditorKind,
  getEditorOptions,
  isEmpty,
  isSameValue,
  toDraft,
  type CellChange,
} from "./editing";
import { useMessages } from "../../providers/ui-context";
import type { CellEditorProps, Column } from "./types";

/**
 * A key of an input method (IME) - pressed while it composes a text, or
 * the one ending the composition, which Safari sends after it (key code
 * 229). Enter confirming a word must not save the cell.
 */
const isCompositionKey = (event: KeyboardEvent) =>
  event.isComposing || event.keyCode === 229;

interface CustomEditorProps<T> extends CellEditorProps<T> {
  /** The column's `renderEditor`. */
  render: (props: CellEditorProps<T>) => React.ReactNode;
}

/** The field a column builds itself with `renderEditor`. */
function CustomEditor<T>({ render, ...props }: CustomEditorProps<T>) {
  return render(props);
}

interface CellEditorFieldProps<T> {
  /** The edited column. */
  column: Column<T>;
  /** Name of the column - the accessible name of the field. */
  columnName: string;
  /**
   * The value of the cell - the editing starts from it. A refetch may
   * change it while the field is open.
   */
  initialValue: unknown;
  /** Ends the editing without a change. */
  onCancel: () => void;
  /**
   * Ends the editing with a valid value to save - `null` for a field left
   * as it was; `move` asks for editing the next (`1`) or the previous (`-1`)
   * editable cell. Returns whether another cell is edited now - otherwise
   * the cell gets the focus back.
   */
  onCommit: (change: CellChange, move: -1 | 0 | 1) => boolean;
  /** The edited row. */
  row: T;
  /**
   * A value of the column from another row - it picks the field of an
   * empty cell (a number field for numbers, not a text field).
   */
  sampleValue?: unknown;
}

/**
 * The field of a cell being edited - the column's `renderEditor`, or a
 * built-in one. Enter saves, Escape cancels, Tab saves and moves on, and so
 * does the focus leaving the field (its popups count as part of it); a
 * value `validate` rejects stays in the field with the message. A field
 * left as it was saves nothing.
 */
export default function CellEditor<T>({
  column,
  columnName,
  initialValue,
  onCancel,
  onCommit,
  row,
  sampleValue,
}: CellEditorFieldProps<T>) {
  const messages = useMessages();
  // The value the editing started from, and its field - a refetch that
  // changes the cell meanwhile changes neither
  const [startValue] = useState(initialValue);
  const [kind] = useState(() =>
    getEditorKind(column, isEmpty(initialValue) ? sampleValue : initialValue),
  );
  const isCustom = !!column.renderEditor;
  const [startDraft] = useState(() =>
    isCustom ? initialValue : toDraft(kind, initialValue),
  );
  const [draft, setDraft] = useState(startDraft);
  const [error, setError] = useState<string>();
  // Read by the key and focus handlers, which may run before a re-render
  const draftRef = useRef(draft);
  const isDoneRef = useRef(false);
  // The save of a field the focus left - it waits for the focus coming
  // back from a popup of the field
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // The field takes the focus - also a custom one without `autoFocus` - with
  // its text selected, so typing replaces it
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || wrapper.contains(document.activeElement)) return;

    const field = getTabbableElements(wrapper)[0];
    field?.focus();
    if (field instanceof HTMLInputElement && field.type === "text") {
      field.select();
    }
  }, []);

  const toValue = (value: unknown) =>
    isCustom ? value : fromDraft(kind, value, initialValue, column);

  // A number field with text it cannot read ("1-2", "5e") reports no value
  // - an empty cell would be saved
  const hasBadInput = () =>
    !isCustom &&
    kind === "number" &&
    !!wrapperRef.current?.querySelector("input")?.validity.badInput;

  const validate = (value: unknown) =>
    (hasBadInput()
      ? messages.dataTable.invalidNumber
      : column.validate?.(toValue(value), row)) || undefined;

  const change = (value: unknown) => {
    draftRef.current = value;
    setDraft(value);
    // A shown message follows the value
    if (error !== undefined) setError(validate(value));
  };

  /** Gives the focus back to the cell - before the field goes away with it. */
  const focusCell = () => wrapperRef.current?.closest("td")?.focus();

  const commit = (value: unknown, move: -1 | 0 | 1, refocus: boolean) => {
    if (isDoneRef.current) return;

    // A field left as it was saves nothing - not even the value the cell
    // had, which a refetch may have changed meanwhile (another user's edit
    // must not be overwritten with the old value)
    const isChanged =
      hasBadInput() ||
      (isCustom ? !isSameValue(value, startValue) : value !== startDraft);
    const message = isChanged ? validate(value) : undefined;
    if (message) {
      setError(message);
      return;
    }

    isDoneRef.current = true;
    const hasMoved = onCommit(
      isChanged ? { value: toValue(value) } : null,
      move,
    );
    if (refocus && !hasMoved) focusCell();
  };

  const cancel = () => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    focusCell();
    onCancel();
  };

  // The latest commit, for the field going away
  const commitRef = useRef(commit);

  useLayoutEffect(() => {
    commitRef.current = commit;
  });

  // A field the focus left is saved also when it goes away before its save
  // runs - a click on a control that ends the editing, the table leaving
  useEffect(
    () => () => {
      if (blurTimerRef.current === null) return;
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
      commitRef.current(draftRef.current, 0, false);
    },
    [],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // The field used the key itself - e.g. to close its own popup - or the
    // key comes from a popup of the field, a portal handling its own keys
    if (
      event.defaultPrevented ||
      isCompositionKey(event.nativeEvent) ||
      !event.currentTarget.contains(event.target as Node)
    ) {
      return;
    }
    const isExpanded =
      (event.target as Element).getAttribute("aria-expanded") === "true";

    switch (event.key) {
      case "Escape":
        if (isExpanded) return;
        event.preventDefault();
        cancel();
        break;
      case "Enter":
        if (isExpanded) return;
        event.preventDefault();
        commit(draftRef.current, 0, true);
        break;
      case "Tab":
        event.preventDefault();
        commit(draftRef.current, event.shiftKey ? -1 : 1, true);
        break;
    }
  };

  // Enter in a date field without its popup saves - the picker would open
  // the popup - and Tab saves and moves on. The field takes a typed date
  // only when it loses the focus, so it loses it first.
  const handleDateKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const isOpen = event.currentTarget.getAttribute("aria-expanded") === "true";
    if (isCompositionKey(event.nativeEvent)) return;
    if (event.key !== "Tab" && (event.key !== "Enter" || isOpen)) return;

    event.preventDefault();
    event.currentTarget.blur();
    commit(
      draftRef.current,
      event.key === "Tab" ? (event.shiftKey ? -1 : 1) : 0,
      true,
    );
  };

  let field: React.ReactNode;

  if (column.renderEditor) {
    field = (
      <CustomEditor
        cancel={cancel}
        column={column}
        commit={(value) =>
          commit(value === undefined ? draftRef.current : value, 0, true)
        }
        error={error}
        label={columnName}
        onChange={change}
        render={column.renderEditor}
        row={row}
        value={draft}
      />
    );
  } else if (kind === "checkbox") {
    // A click or Space saves at once
    field = (
      <Checkbox
        aria-label={columnName}
        checked={Boolean(draft)}
        error={error}
        onChange={({ target }) => {
          change(target.checked);
          commit(target.checked, 0, true);
        }}
      />
    );
  } else if (kind === "select") {
    field = (
      <Select
        aria-label={columnName}
        dim="xs"
        error={error}
        // Empty only for a cell that was empty
        hasEmpty={draft === "" || toDraft(kind, initialValue) === ""}
        onChange={({ target }) => change(target.value)}
        options={getEditorOptions(column)}
        value={String(draft)}
      />
    );
  } else if (kind === "date") {
    field = (
      <DateTimePicker
        aria-label={columnName}
        dim="sm"
        error={error}
        onChange={({ target }) => change(target.value)}
        onKeyDown={handleDateKeyDown}
        type="date"
        value={String(draft)}
      />
    );
  } else {
    field = (
      <Input
        aria-label={columnName}
        dim="xs"
        error={error}
        onChange={({ target }) => change(target.value)}
        type={kind === "number" ? "number" : "text"}
        value={String(draft)}
      />
    );
  }

  return (
    <div
      // Room for the text of a date and the buttons of its picker
      className={kind === "date" && !isCustom ? "min-w-40" : "min-w-24"}
      onBlur={() => {
        // The focus may be moving into a popup of the field, a portal
        // elsewhere in the page, whose focus comes here right after
        if (blurTimerRef.current !== null) clearTimeout(blurTimerRef.current);
        blurTimerRef.current = setTimeout(() => {
          blurTimerRef.current = null;
          commit(draftRef.current, 0, false);
        }, 0);
      }}
      onFocus={() => {
        if (blurTimerRef.current === null) return;
        clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }}
      onKeyDown={handleKeyDown}
      ref={wrapperRef}
    >
      {field}
    </div>
  );
}
