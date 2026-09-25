/**
 * Recursively optional version of `T` - used for overriding a few texts or
 * formats of a locale without restating the rest.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

/**
 * A text with plural forms keyed by `Intl.PluralRules` category - `other` is
 * always required, the rest only where the language distinguishes them
 * (e.g. Czech `one` / `few` / `other`, and `many` for decimals: "1,5 dne").
 * `{count}` is replaced by the number.
 */
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string;
};

/** Day of the week as returned by `Date#getDay()`: 0 = Sunday … 6 = Saturday. */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A token of the patterns of `DateFormats`. */
export type DatePatternToken =
  | "A"
  | "D"
  | "DD"
  | "H"
  | "HH"
  | "M"
  | "MM"
  | "W"
  | "WW"
  | "YYYY"
  | "h"
  | "hh"
  | "mm";

/**
 * Display patterns of the date and time pickers - they are also what the
 * user types into them. Tokens: `YYYY` year, `MM` / `M` month, `DD` / `D`
 * day, `HH` / `H` hours, `hh` / `h` hours of the 12-hour clock with `A` for
 * AM / PM, `mm` minutes, `WW` / `W` ISO week. Text in square brackets is
 * printed as is, e.g. `[W]WW YYYY`.
 */
export interface DateFormats {
  /** `type="date"`, e.g. `DD.MM.YYYY` */
  date: string;
  /** `type="datetime-local"`, e.g. `DD.MM.YYYY HH:mm` or `MM/DD/YYYY h:mm A` */
  dateTime: string;
  /** `type="month"`, e.g. `MM.YYYY` */
  month: string;
  /** `type="time"`, e.g. `HH:mm` or `h:mm A` */
  time: string;
  /** `type="week"`, e.g. `[W]WW.YYYY` */
  week: string;
}

/**
 * Every text the components render. Placeholders in curly braces (`{label}`,
 * `{count}`, …) are filled in by the component.
 */
export interface Messages {
  common: {
    cancel: string;
    close: string;
    confirm: string;
    delete: string;
    /** Accessible text of `Spinner`. */
    loading: string;
    /** A `false` value, e.g. in a `DataTable` cell. */
    no: string;
    /** A `true` value, e.g. in a `DataTable` cell. */
    yes: string;
  };
  accordion: {
    toggle: string;
  };
  autocomplete: {
    clear: string;
    /** Accessible name of the blank option `hasEmpty` adds. */
    emptyOption: string;
    /** Accessible name of the option list, `{label}` is the field label. */
    listLabel: string;
    /** Shown in the list when loading the options failed. */
    loadError: string;
    loading: string;
    loadingSelected: string;
    /** Shown in the list once `maxSelections` options are selected. */
    maxSelections: PluralMessage;
    noResults: string;
    /** Announced to screen readers - the number of options the open list shows. */
    resultCount: PluralMessage;
  };
  /** `Avatar` and `AvatarGroup`. */
  avatar: {
    /**
     * The "+N" of an `AvatarGroup` - the avatars it stands for. Also the
     * visible text, as a number with a plus: "+3".
     */
    more: PluralMessage;
    /** What the `status` dot says. */
    status: {
      away: string;
      busy: string;
      offline: string;
      online: string;
    };
    /**
     * Accessible name of an avatar with a `status` - `{name}` of the person
     * and the `{status}` text, e.g. "Jana Nováková, Online".
     */
    statusLabel: string;
  };
  breadcrumbs: {
    home: string;
    label: string;
  };
  calendar: {
    /** The agenda view in the view switcher. */
    agenda: string;
    allDay: string;
    day: string;
    /**
     * Marks each day of an event over several days in the agenda - `{day}`
     * of `{count}` days, e.g. "Day 2/3".
     */
    dayOf: string;
    /**
     * Opens the events of the week and day views that end before the first
     * hour shown (`dayStartHour`) - "+2 earlier".
     */
    earlier: PluralMessage;
    /**
     * Accessible name of an event tile - `{title}` of the event and `{time}`,
     * when it takes place.
     */
    eventLabel: string;
    /** The first day of an event over several days in the agenda, `{time}` its start. */
    from: string;
    goToDate: string;
    /**
     * Opens the events of the week and day views that start at the end hour
     * (`dayEndHour`) or after it - "+1 later".
     */
    later: PluralMessage;
    month: string;
    /** Opens the events a crowded day of the month view has no room for. */
    more: PluralMessage;
    /**
     * Accessible name of "+N more", "+N earlier" and "+N later" - `{more}`
     * is their text, `{day}` the day (and resource) they belong to.
     */
    moreLabel: string;
    next: string;
    /** The agenda of a period without events. */
    noEvents: string;
    previous: string;
    /**
     * Announces the time slots selected with Shift + arrow keys, `{range}` is
     * their day and times.
     */
    rangeSelected: string;
    /**
     * A time slot or an event in the column of a resource, for screen
     * readers - `{resource}` is its title, `{time}` the day and time.
     */
    resourceTime: string;
    /** The button going to today, and the mark of today in the agenda. */
    today: string;
    /** The last day of an event over several days in the agenda, `{time}` its end. */
    until: string;
    week: string;
  };
  checkboxGroup: {
    /**
     * Shown once `max` options are picked (the others are disabled) - also
     * the validity message of more options than that.
     */
    max: PluralMessage;
    /**
     * Validity message of fewer options than `min` - 1 for a `required`
     * group.
     */
    min: PluralMessage;
    /** Label of the checkbox `selectAll` adds. */
    selectAll: string;
  };
  chip: {
    /**
     * Accessible name of the remove button of a chip - followed by the text
     * of the chip: "Remove Paid".
     */
    remove: string;
  };
  /** The choices of `ColorSchemeToggle`. */
  colorScheme: {
    dark: string;
    /** Accessible name of the group of choices. */
    label: string;
    light: string;
    /** Follow the setting of the operating system. */
    system: string;
  };
  commandPalette: {
    /** Key hint in the footer - after the Esc key. */
    close: string;
    /** Shown instead of the results when `loadItems` failed. */
    loadError: string;
    /** Key hint in the footer - after the arrow keys. */
    navigate: string;
    noResults: string;
    /** Placeholder and accessible name of the search field. */
    placeholder: string;
    /** Announced to screen readers once the results of a search are shown. */
    resultCount: PluralMessage;
    /** Accessible name of the list of results. */
    results: string;
    /** Key hint in the footer - after the Enter key. */
    select: string;
    /** Heading and accessible name of the dialog. */
    title: string;
  };
  /** Name and tooltip of `CopyButton` in its states. */
  copyButton: {
    copied: string;
    copy: string;
    error: string;
  };
  dataTable: {
    actions: string;
    clearFilters: string;
    closeSearch: string;
    collapseRow: string;
    /** Screen reader text of a column's resize handle - its width in pixels. */
    columnWidth: PluralMessage;
    columns: string;
    /** The row density control of the toolbar and its choices. */
    density: {
      comfortable: string;
      compact: string;
      label: string;
      normal: string;
    };
    dragColumn: string;
    /** Describes an editable cell to screen readers. */
    editCell: string;
    /** Shown in a cell whose change `onCellEdit` rejected without a message. */
    editFailed: string;
    expandRow: string;
    /** The CSV export button of the toolbar. */
    exportCsv: string;
    filterColumn: string;
    /** A number field of an edited cell holds text that is no number. */
    invalidNumber: string;
    /** The handle in the column settings that moves a column by the arrow keys. */
    moveColumn: string;
    noData: string;
    openSearch: string;
    pinLeft: string;
    pinRight: string;
    region: string;
    resetColumns: string;
    /** The handle on the edge of a column header that resizes the column. */
    resizeColumn: string;
    rowsPerPage: string;
    /** A cell whose change is being saved. */
    saving: string;
    search: string;
    searchColumn: string;
    selectAllRows: string;
    selectRow: string;
    selectedCount: PluralMessage;
    /** Texts of the "select all rows matching the filter" bar. */
    selection: {
      all: PluralMessage;
      allExcept: PluralMessage;
      clear: string;
      page: PluralMessage;
      selectAll: PluralMessage;
    };
    sortBy: string;
    /** Labels of the aggregates of the summary row. */
    summary: {
      avg: string;
      count: string;
      max: string;
      min: string;
      sum: string;
    };
    toggleFullScreen: string;
  };
  dateRangePicker: {
    /** The length of the range, under the calendar - e.g. "7 days". */
    days: PluralMessage;
    /** Texts of the built-in `presets`. */
    presets: {
      last30Days: string;
      last7Days: string;
      lastMonth: string;
      lastWeek: string;
      lastYear: string;
      thisMonth: string;
      thisWeek: string;
      thisYear: string;
      today: string;
      yesterday: string;
    };
    /** Accessible name of the group of presets. */
    presetsLabel: string;
    /** Under the calendar once the first day is picked. */
    selectEnd: string;
    /** The popup - also the name of a field without a label. */
    selectRange: string;
    /** Under the calendar until the first day is picked. */
    selectStart: string;
  };
  dateTimePicker: {
    clear: string;
    /** Heading and name of the hour list. */
    hours: string;
    /**
     * Under a field whose typed text is no date or time - `{text}` is the
     * text, `{format}` the format to type it in (see `placeholderTokens`).
     * The field shows its value again.
     */
    invalidText: string;
    /** Heading and name of the minute list. */
    minutes: string;
    /** The month select of the date popup. */
    month: string;
    nextMonth: string;
    nextYear: string;
    /** Name of a date or date-time field without a label. */
    openCalendar: string;
    /**
     * Under a field whose typed date or time is out of `min` / `max` (for a
     * range also of `minDays` / `maxDays`) - `{text}` is the text.
     */
    outOfRangeText: string;
    /**
     * How the tokens of `DateFormats` are written in the placeholders of
     * the fields - e.g. `{ YYYY: "RRRR" }` makes `DD.MM.YYYY` the Czech
     * `DD.MM.RRRR`. The tokens left out stay as they are; the bracketed
     * text of a pattern is left out.
     */
    placeholderTokens: Partial<Record<DatePatternToken, string>>;
    previousMonth: string;
    previousYear: string;
    /** The date popup, and its day grid in the date-time popup. */
    selectDate: string;
    /** The date-time popup. */
    selectDateTime: string;
    /** The month popup - also the name of a month field without a label. */
    selectMonth: string;
    /**
     * The time popup and its time lists in the date-time popup - also the
     * name of a time field without a label.
     */
    selectTime: string;
    /** The week popup - also the name of a week field without a label. */
    selectWeek: string;
    /** Accessible name of a week button, e.g. "Week 39, 2026". */
    week: string;
    /** The year select of the date popup. */
    year: string;
  };
  descriptionList: {
    /** Accessible name of the "i" button that shows a `termInfo`. */
    moreInfo: string;
  };
  dialog: {
    close: string;
  };
  drawer: {
    label: string;
  };
  errorBoundary: {
    retry: string;
    title: string;
  };
  fileUpload: {
    /** Next to the upload button - files can also be dropped on the field. */
    dropHint: string;
    /** A dropped file of a type the field does not `accept`. */
    fileTypeNotAccepted: string;
    maxFileSizeExceeded: string;
    /** A file refused because `maxFiles` files are in the list. */
    maxFiles: PluralMessage;
    remove: string;
    upload: string;
    uploadFailed: string;
    uploading: string;
  };
  /** Shared by the form fields. */
  form: {
    /**
     * Follows a field label and a `DescriptionList` term - `":"` in English,
     * `" :"` in French, or `""` for none.
     */
    labelSuffix: string;
  };
  header: {
    back: string;
  };
  input: {
    /** Accessible name of the clear button of a `clearable` field. */
    clear: string;
    /**
     * Accessible name of the password visibility toggle - it stays the same,
     * the pressed state tells whether the password is shown.
     */
    showPassword: string;
  };
  link: {
    /** Read by screen readers after the text of an `external` link. */
    opensInNewTab: string;
  };
  navbar: {
    toggleMenu: string;
    toggleSidebar: string;
  };
  numberInput: {
    /** Accessible name of the button that lowers the value by a step. */
    decrement: string;
    /** Accessible name of the button that raises the value by a step. */
    increment: string;
    /**
     * Validity message of a value above `max` - `{max}` is the bound in the
     * format of the field.
     */
    rangeOverflow: string;
    /**
     * Validity message of a value below `min` - `{min}` is the bound in the
     * format of the field.
     */
    rangeUnderflow: string;
  };
  pagination: {
    first: string;
    label: string;
    last: string;
    next: string;
    previous: string;
    range: string;
  };
  pinInput: {
    /**
     * Accessible name of a cell of an alphanumeric code - `{index}` of
     * `{length}`.
     */
    character: string;
    /** Accessible name of a cell of a numeric code - `{index}` of `{length}`. */
    digit: string;
  };
  /**
   * The tools of `RichTextEditor` - their names are also the keys of the
   * tools (`heading2`, `bulletList`, …) - and the texts of its forms.
   */
  richTextEditor: {
    addColumnLeft: string;
    addColumnRight: string;
    addRowAbove: string;
    addRowBelow: string;
    blockquote: string;
    bold: string;
    bulletList: string;
    clearFormatting: string;
    /** Inline code. */
    code: string;
    /** The number field of the table form. */
    columns: string;
    deleteColumn: string;
    deleteRow: string;
    deleteTable: string;
    /** The checkbox of the table form and the toggle of the table tools. */
    headerRow: string;
    heading2: string;
    heading3: string;
    horizontalRule: string;
    indent: string;
    /** The confirm button and the name of the table form. */
    insertTable: string;
    italic: string;
    /**
     * Names of the modifier keys in the shortcuts of the tools ("Ctrl+B") -
     * Apple devices show ⌘, ⌥ and ⇧ instead.
     */
    keys: {
      alt: string;
      ctrl: string;
      shift: string;
    };
    link: string;
    linkPrompt: string;
    numberedList: string;
    outdent: string;
    paragraph: string;
    redo: string;
    /** The button of the link form that removes the link at the selection. */
    removeLink: string;
    /** The number field of the table form. */
    rows: string;
    strikethrough: string;
    /** The table tool, and the name of the tools of the table at the caret. */
    table: string;
    underline: string;
    undo: string;
  };
  select: {
    /** Accessible name of the blank option `hasEmpty` adds. */
    emptyOption: string;
  };
  slider: {
    /**
     * Names the thumb of the end of a range - read after the name of the
     * slider, e.g. "Price maximum".
     */
    rangeEnd: string;
    /** Names the thumb of the start of a range, e.g. "Price minimum". */
    rangeStart: string;
    /** The value of a range next to the label (`showValue`). */
    rangeValue: string;
  };
  splitButton: {
    /** Accessible name of the button that opens the menu of a `SplitButton`. */
    moreOptions: string;
  };
  splitter: {
    /**
     * Name of a handle of a `Splitter` without `paneLabels` - `{number}` is
     * the pane before it, whose size the handle sets.
     */
    resizePane: string;
  };
  /** The state of a step, read by screen readers after its name. */
  stepper: {
    completed: string;
    error: string;
  };
  tagsInput: {
    /** A value that is in the list already - `{tag}` is the value. */
    duplicate: string;
    /** A value refused because `maxTags` values are in the list. */
    maxTags: PluralMessage;
    /** Accessible name of the × button of a value - `{tag}` is the value. */
    remove: string;
    /** Validity message of a `required` field without a value. */
    required: string;
    /** Accessible name of the list of `suggestions`. */
    suggestions: string;
  };
  textarea: {
    /**
     * The counter of `showCount` with a `maxLength`, e.g. "123 / 500" -
     * `{count}` characters of `{max}`.
     */
    characterCount: string;
    /** Told to screen readers near the `maxLength` of a `showCount` field. */
    charactersLeft: PluralMessage;
    /** Told to screen readers when a value is longer than `maxLength`. */
    charactersOver: PluralMessage;
  };
  timeline: {
    /** Read by screen readers after the title of a `pending` item. */
    pending: string;
  };
  toast: {
    close: string;
  };
  treeView: {
    /** Shown in place of the children `loadChildren` failed to load. */
    loadError: string;
    /** Shown instead of a tree without items. */
    noItems: string;
    /** Shown instead of a tree when `filter` matches no item. */
    noMatches: string;
    /** Loads the children again after `loadError`. */
    retry: string;
  };
}

/**
 * Everything language- and region-specific in one object: the texts, the
 * date formats and the first day of the week. Pass it to `UIProvider`.
 */
export interface Locale {
  /** BCP 47 language tag used for `Intl` formatting, e.g. `"cs-CZ"`. */
  code: string;
  /** Display patterns of the date and time pickers. */
  formats: DateFormats;
  /** Texts of the components. */
  messages: Messages;
  /** First day of the week in the calendar and the pickers. */
  weekStartsOn: WeekDay;
}
