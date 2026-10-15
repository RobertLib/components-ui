import type appMessages from "../en";

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

/** Application texts: strings, plural messages and nested groups. */
export interface MessageCatalog {
  [key: string]: string | PluralMessage | MessageCatalog;
}

/**
 * The keys of a default catalog, with strings widened and plural categories
 * chosen independently by each language. A plural message is one text.
 */
export type MessageShape<T> = T extends string
  ? string
  : T extends PluralMessage
    ? keyof T extends Intl.LDMLPluralRule
      ? PluralMessage
      : { [K in keyof T]: MessageShape<T[K]> }
    : { [K in keyof T]: MessageShape<T[K]> };

/** Inferred from i18n/en.ts - add app texts there, without editing types. */
export type AppMessages = MessageShape<typeof appMessages>;

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
  | "Q"
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
 * AM / PM, `mm` minutes, `WW` / `W` ISO week, `Q` quarter. Text in square
 * brackets is printed as is, e.g. `[W]WW YYYY`.
 */
export interface DateFormats {
  /** `type="date"`, e.g. `DD.MM.YYYY` */
  date: string;
  /** `type="datetime-local"`, e.g. `DD.MM.YYYY HH:mm` or `MM/DD/YYYY h:mm A` */
  dateTime: string;
  /** `type="month"`, e.g. `MM.YYYY` */
  month: string;
  /**
   * `type="quarter"`, e.g. `Q. [čtvrtletí] YYYY` (3. čtvrtletí 2026) -
   * `[Q]Q YYYY` (Q3 2026) when left out
   */
  quarter?: string;
  /** `type="time"`, e.g. `HH:mm` or `h:mm A` */
  time: string;
  /** `type="week"`, e.g. `[W]WW.YYYY` */
  week: string;
  /** `type="year"` - `YYYY` when left out */
  year?: string;
}

/**
 * Every text the components render. Placeholders in curly braces (`{label}`,
 * `{count}`, …) are filled in by the component.
 */
export interface UIMessages {
  phoneInput: { country: string; invalid: string };
  repeatableField: {
    add: string;
    remove: string;
    moveUp: string;
    moveDown: string;
    minimum: PluralMessage;
    maximum: PluralMessage;
  };
  chart: {
    category: string;
    legend: string;
    noData: string;
    noValue: string;
    showData: string;
  };
  imageViewer: {
    image: string;
    images: string;
    loading: string;
    loadError: string;
    next: string;
    noImages: string;
    position: string;
    previous: string;
    resetZoom: string;
    title: string;
    zoom: string;
    zoomIn: string;
    zoomOut: string;
  };
  transferList: {
    addAll: string;
    addSelected: string;
    available: string;
    maximum: PluralMessage;
    minimum: PluralMessage;
    noItems: string;
    removeAll: string;
    removeSelected: string;
    searchAvailable: string;
    searchSelected: string;
    selected: string;
    selectVisible: string;
  };

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
  alert: {
    /** Accessible name of the close button of an `Alert` with `onClose`. */
    close: string;
  };
  autocomplete: {
    clear: string;
    /**
     * The option `onCreate` adds while no option is named by the typed
     * term - `{value}` is the term.
     */
    create: string;
    /** Announced once `onCreate` added an option - `{value}` is its label. */
    created: string;
    /** Shown when `onCreate` failed without a message - `{value}` is the term. */
    createError: string;
    /**
     * Announced of an open list that offers to add the term - `{results}` is
     * `resultCount` (or `noResults`), `{value}` the term.
     */
    createHint: string;
    /** The option `onCreate` adds while it runs - `{value}` is the term. */
    creating: string;
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
    /**
     * The chip that stands for the selected values past `maxVisibleChips` -
     * "+3 more".
     */
    moreSelected: PluralMessage;
    noResults: string;
    /** Announced to screen readers - the number of options the open list shows. */
    resultCount: PluralMessage;
    /** The option `selectAll` adds to a multiple list. */
    selectAll: string;
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
  badge: {
    /** A count above `max` - `{max}` is the limit, e.g. "99+". */
    overflow: string;
  };
  breadcrumbs: {
    home: string;
    label: string;
    /** Accessible name of the "…" of collapsed crumbs (`maxItems`). */
    showAll: string;
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
    /**
     * Announces the event the keys put back where it was (Escape) - its
     * `{title}`.
     */
    moveCancelled: string;
    /**
     * Announces the event the keys put down - its `{title}` and the `{time}`
     * it moved to.
     */
    moved: string;
    /**
     * Announces the event Ctrl / ⌘ + X picked up - its `{title}` - and how to
     * move it with the keys.
     */
    moveStart: string;
    /**
     * Announces the event the keys resized (Shift + arrow keys) - its
     * `{title}` and its new `{time}`.
     */
    resized: string;
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
    /** The day timeline view (`timelineDay`) in the view switcher. */
    timelineDay: string;
    /** The week timeline view (`timelineWeek`) in the view switcher. */
    timelineWeek: string;
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
  /** `ColorInput` and its picker. */
  colorInput: {
    /** Accessible name of the slider of the opacity. */
    alpha: string;
    /**
     * Accessible name of the area picking the saturation and the
     * brightness - one control for both.
     */
    area: string;
    /** Role description of that area, e.g. "2D slider". */
    areaRole: string;
    /**
     * Value of the area - `{saturation}` and `{brightness}` in percent,
     * e.g. "Saturation 80 %, brightness 60 %".
     */
    areaValue: string;
    /** The button taking a color from the screen (the EyeDropper API). */
    eyeDropper: string;
    /** Accessible name of the slider of the hue. */
    hue: string;
    /** Value of the hue slider - `{degrees}` of the color wheel. */
    hueValue: string;
    /**
     * Said under the field when a typed text is no color - `{text}`, and an
     * `{example}` of a color in the format of the field.
     */
    invalid: string;
    /** Accessible name of the swatch that opens the picker. */
    openPicker: string;
    /** Accessible name of the picker. */
    picker: string;
    /** Accessible name of the preset colors of `swatches`. */
    swatches: string;
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
  /** `ConfirmDialog` and the questions of `useConfirm()` / `useAlert()`. */
  confirmDialog: {
    /** The only button of an `alert` - it acknowledges the message. */
    ok: string;
    /**
     * Label of the field of `confirmationText` - `{text}` is the text the
     * user has to type, shown in bold.
     */
    typeToConfirm: string;
  };
  /** Name and tooltip of `CopyButton` in its states. */
  copyButton: {
    copied: string;
    copy: string;
    error: string;
  };
  /**
   * Validity messages of `useCzValidators` - the field holds no valid
   * identifier of its kind.
   */
  czValidators: {
    /** A bank account number - `19-2000145399/0800`. */
    bankAccount: string;
    /** Rodné číslo - the birth number. */
    birthNumber: string;
    /** DIČ - the tax identification number. */
    dic: string;
    iban: string;
    /** IČO - the identification number of a company or a trader. */
    ico: string;
    /** PSČ - the postal code. */
    postalCode: string;
  };
  dataTable: {
    actions: string;
    /** The bar of the chips of the active filters (`filterChips`). */
    activeFilters: {
      /** A chip - `{label}` is the column, `{value}` its filter. */
      chip: string;
      /** The button removing all the filters and the search. */
      clearAll: string;
      /** A range with a lower bound only - `{value}` is the bound. */
      from: string;
      /** Accessible name of the bar. */
      label: string;
      /** A range with both bounds - `{from}` and `{to}`. */
      range: string;
      /** The chip of the global search - `{value}` is the term. */
      search: string;
      /** A range with an upper bound only - `{value}` is the bound. */
      to: string;
    };
    clearFilters: string;
    closeSearch: string;
    collapseRow: string;
    /** Screen reader text of a column's resize handle - its width in pixels. */
    columnWidth: PluralMessage;
    columns: string;
    /** Announced once Ctrl + C copied rows or a cell of the table. */
    copied: {
      /** A focused cell was copied. */
      cell: string;
      /** The clipboard refused the text. */
      failed: string;
      /** Rows were copied - the selected ones, or the focused one. */
      rows: PluralMessage;
    };
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
    /** Shown when CSV export fails. */
    exportFailed: string;
    /** The choice of a `boolean` filter that filters nothing out. */
    filterAny: string;
    filterColumn: string;
    /** The first field of a range filter - `{label}` is the column. */
    filterFrom: string;
    /** The second field of a range filter - `{label}` is the column. */
    filterTo: string;
    /**
     * The header of a group of rows (`groupBy`) - `{label}` is the column,
     * `{value}` the value of the group.
     */
    groupLabel: string;
    /** The number of rows of a group (`groupBy`). */
    groupRowCount: PluralMessage;
    /** A number field of an edited cell holds text that is no number. */
    invalidNumber: string;
    /** Shown in place of the rows for `error={true}`. */
    loadFailed: string;
    /** The handle in the column settings that moves a column by the arrow keys. */
    moveColumn: string;
    /** The tooltip of a sort button of a table sorting by several columns. */
    multiSortHint: string;
    noData: string;
    /** A group of rows (`groupBy`) whose value is empty. */
    noValue: string;
    openSearch: string;
    /** The pagination of a table with a name (`aria-label`) - `{label}` is the name. */
    paginationLabel: string;
    pinLeft: string;
    pinRight: string;
    region: string;
    resetColumns: string;
    /** The handle on the edge of a column header that resizes the column. */
    resizeColumn: string;
    /** The button under a load `error` that calls `onRetry`. */
    retry: string;
    /** Accessible name of the context menu of a row (`getRowContextMenu`). */
    rowMenu: string;
    rowsPerPage: string;
    /** A cell whose change is being saved. */
    saving: string;
    search: string;
    searchColumn: string;
    selectAllRows: string;
    /** Header of the column of the checkboxes of `selectionMode="single"`. */
    selectColumn: string;
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
    /** The directions of a sorted column, read in `sortPriority`. */
    sortOrder: {
      asc: string;
      desc: string;
    };
    /**
     * Read with a sort button while the table sorts by several columns -
     * `{priority}` is the place of the column, `{count}` the number of
     * sorted columns and `{order}` its `sortOrder`.
     */
    sortPriority: string;
    /** Labels of the aggregates of the summary row. */
    summary: {
      avg: string;
      count: string;
      max: string;
      min: string;
      sum: string;
    };
    toggleFullScreen: string;
    /** Texts of tree data - rows with sub rows (`getSubRows`, `loadSubRows`). */
    tree: {
      /** The header button of the tree column collapsing every row. */
      collapseAll: string;
      /** Announced once every row was collapsed. */
      collapsedAll: string;
      /** The header button of the tree column expanding every row. */
      expandAll: string;
      /** Announced once every row was expanded. */
      expandedAll: string;
      /** Header of the column of the CSV export with the level of each row. */
      level: string;
      /** Shown under a row whose sub rows `loadSubRows` failed to load. */
      loadFailed: string;
      /** Announced when the sub rows the user expanded have arrived. */
      loaded: PluralMessage;
      /** Loads the sub rows again after `loadFailed`. */
      retry: string;
      /**
       * Name of the button showing and hiding the sub rows of a row, read
       * with the row and whether it is expanded.
       */
      toggle: string;
    };
    /** The saved views (`enableViews`) - their menu and dialogs. */
    views: {
      /** Accessible name of the menu button while a view is applied. */
      active: string;
      /** The same with the settings changed since the view was applied. */
      activeModified: string;
      /** The menu item deleting the applied view. */
      delete: string;
      /** The question before a view is deleted - `{name}` is the view. */
      deleteMessage: string;
      /** Title of the question before a view is deleted. */
      deleteTitle: string;
      /** The menu button with no view applied, and the list of the views. */
      label: string;
      /** The field of the name of a view. */
      name: string;
      /** Validation message of an empty name. */
      nameRequired: string;
      /** The menu item renaming the applied view. */
      rename: string;
      /** Title of the dialog renaming a view. */
      renameTitle: string;
      /** The confirming button of the name dialog. */
      save: string;
      /** The menu item saving the settings as a new view. */
      saveAsNew: string;
      /** Title of the dialog saving a new view. */
      saveTitle: string;
      /** The menu item saving the settings into the applied view - `{name}`. */
      update: string;
    };
  };
  dateCalendar: {
    /**
     * Under a `DateCalendar` with `multiple` - how many days are selected,
     * e.g. "3 days selected".
     */
    selectedDays: PluralMessage;
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
    /**
     * Validity message of a range over a day of `isDateDisabled` - `{date}`
     * is the first such day as the field shows days. The form cannot be
     * submitted with it.
     */
    unavailableInRange: string;
  };
  dateTimePicker: {
    clear: string;
    /** The button of the date popup that clears the value. */
    clearButton: string;
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
    /** The button of the year popup that shows the next twelve years. */
    nextYears: string;
    /** Name of a date or date-time field without a label. */
    openCalendar: string;
    /**
     * Under a field whose typed date or time is out of `min` / `max` (for a
     * range also of `minDays` / `maxDays`) - `{text}` is the text. Also the
     * form validity message of a range outside its allowed day counts.
     */
    outOfRangeText: string;
    /**
     * How the tokens of `DateFormats` are written in the placeholders of
     * the fields - e.g. `{ YYYY: "RRRR" }` makes `DD.MM.YYYY` the Czech
     * `DD.MM.RRRR`. The tokens left out stay as they are; the bracketed
     * text of a pattern is left out.
     */
    placeholderTokens: Partial<Record<DatePatternToken, string>>;
    /** Accessible name of the group of `presets` in the date popup. */
    presetsLabel: string;
    previousMonth: string;
    previousYear: string;
    /** The button of the year popup that shows the previous twelve years. */
    previousYears: string;
    /**
     * Validity message of a value after `max` - `{max}` is the limit as the
     * field shows values. The form cannot be submitted with it, as with a
     * native input.
     */
    rangeOverflow: string;
    /**
     * Validity message of a value before `min` - `{min}` is the limit as the
     * field shows values. Also of a time out of a range over midnight
     * (22:00 - 06:00).
     */
    rangeUnderflow: string;
    /** The date popup, and its day grid in the date-time popup. */
    selectDate: string;
    /** The date-time popup. */
    selectDateTime: string;
    /** The month popup - also the name of a month field without a label. */
    selectMonth: string;
    /**
     * The quarter popup - also the name of a quarter field without a
     * label.
     */
    selectQuarter: string;
    /**
     * The time popup and its time lists in the date-time popup - also the
     * name of a time field without a label.
     */
    selectTime: string;
    /** The week popup - also the name of a week field without a label. */
    selectWeek: string;
    /** The year popup - also the name of a year field without a label. */
    selectYear: string;
    /** The button of the date popup that picks today. */
    today: string;
    /**
     * Validity message of a value `isDateDisabled` disables - a day, or a
     * month, week, quarter or year with no day left - `{value}` is the
     * value as the field shows it. The form cannot be submitted with it.
     */
    unavailable: string;
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
  durationInput: {
    /**
     * Under a field whose typed text is no duration - `{text}` is the text,
     * `{clock}` and `{units}` are an hour and a half as the field writes it
     * in each `display` ("1:30", "1 h 30 min"). The field shows its value
     * again; while typing it is the validity message.
     */
    invalidText: string;
    /**
     * Under a field whose typed duration is negative - `{text}` is the text.
     * The field shows its value again; while typing it is the validity
     * message.
     */
    negativeText: string;
    /**
     * Validity message of a value above `max` - `{max}` is the limit as the
     * field shows values.
     */
    rangeOverflow: string;
    /**
     * Validity message of a value below `min` - `{min}` is the limit as the
     * field shows values.
     */
    rangeUnderflow: string;
  };
  errorBoundary: {
    retry: string;
    title: string;
  };
  fileUpload: {
    folderReadFailed: string;
    /**
     * Announced to screen readers when files are added to a field without
     * `upload` - "3 files added."
     */
    addedCount: PluralMessage;
    /** Accessible name of the button cancelling the upload of `{name}`. */
    cancelUpload: string;
    /** Next to the upload button - files can also be dropped on the field. */
    dropHint: string;
    /**
     * Announced to screen readers once the uploads are over - the ones that
     * failed, after `uploadedCount`.
     */
    failedCount: PluralMessage;
    /** A dropped file of a type the field does not `accept`. */
    fileTypeNotAccepted: string;
    maxFileSizeExceeded: string;
    /** A file refused because `maxFiles` files are in the list. */
    maxFiles: PluralMessage;
    /**
     * Ends the names of many refused files - "a.pdf, b.pdf, c.pdf and 4
     * more".
     */
    moreFiles: PluralMessage;
    /** A read-only field without attachments. */
    noFiles: string;
    /** A file waiting until the uploads before it make room (`concurrency`). */
    queued: string;
    /**
     * A line under the field - the names of the refused `{files}` and the
     * `{message}` why, e.g. "notes.txt: Files of this type cannot be
     * uploaded here."
     */
    refused: string;
    remove: string;
    /** An attachment could not be removed. */
    removeFailed: string;
    waitForRemoval: string;
    /** The button of a failed upload that tries it again. */
    retry: string;
    /**
     * Accessible name of the retry button of `{name}` - it starts with the
     * text of `retry`, which the button shows.
     */
    retryUpload: string;
    upload: string;
    /** Announced to screen readers once the uploads are over. */
    uploadedCount: PluralMessage;
    uploadFailed: string;
    uploading: string;
    /** Announced to screen readers when files start uploading. */
    uploadingCount: PluralMessage;
    /** A file the `validate` of the field failed on (it threw). */
    validationFailed: string;
    /** Form validation while files upload or wait for their upload. */
    waitForUpload: string;
    /** Form validation while picked files are checked asynchronously. */
    waitForValidation: string;
  };
  /** Shared by the form fields. */
  form: {
    /**
     * Follows a field label and a `DescriptionList` term - `":"` in English,
     * `" :"` in French, or `""` for none.
     */
    labelSuffix: string;
  };
  /** The status of `FormActions` with `dirty`. */
  formActions: {
    unsavedChanges: string;
  };
  /** The question of a `FormDialog` with unsaved changes before it closes. */
  formDialog: {
    discard: string;
    discardMessage: string;
    discardTitle: string;
    keepEditing: string;
  };
  header: {
    back: string;
  };
  input: {
    /** Accessible name of the clear button of a `clearable` field. */
    clear: string;
    /**
     * Validity message of a field with a `mask` filled in only in part -
     * the browser refuses to submit it.
     */
    maskIncomplete: string;
    /**
     * The strength of the password under a `passwordStrength` field, also
     * told to screen readers - `{strength}` is one of `passwordStrengths`.
     */
    passwordStrength: string;
    /** The strengths of a password, from very weak (0) to strong (4). */
    passwordStrengths: [string, string, string, string, string];
    /**
     * Accessible name of the password visibility toggle - it stays the same,
     * the pressed state tells whether the password is shown.
     */
    showPassword: string;
  };
  /** `KeyboardShortcutsDialog` - the shortcuts of the page. */
  keyboardShortcuts: {
    /** Shown in place of the list while no shortcut is registered. */
    empty: string;
    /** Heading of the shortcuts registered without a `group`. */
    general: string;
    /**
     * Between the shortcuts of one action, e.g. "Ctrl+K or /" - a word with
     * the spaces around it.
     */
    or: string;
    /** What the shortcut that opens the dialog does - listed with the others. */
    show: string;
    /** Heading and accessible name of the dialog. */
    title: string;
  };
  link: {
    /** Read by screen readers after the text of an `external` link. */
    opensInNewTab: string;
  };
  navbar: {
    toggleMenu: string;
    toggleSidebar: string;
  };
  /** `NotificationCenter` - the bell and its panel. */
  notificationCenter: {
    /** Shown in place of the list without notifications. */
    empty: string;
    /** Shown in place of the list when the Unread filter leaves none. */
    emptyUnread: string;
    /** Shown when loading the notifications failed (`error`). */
    error: string;
    /** Accessible name of the All / Unread filter. */
    filter: string;
    /** The filter option that shows every notification. */
    filterAll: string;
    /** The filter option that shows the unread notifications only. */
    filterUnread: string;
    /** The button that loads older notifications (`onLoadMore`). */
    loadMore: string;
    /** The button that marks every notification as read. */
    markAllRead: string;
    /** Accessible name of the button that marks a notification as read. */
    markRead: string;
    /** Accessible name of the button that marks a notification as unread. */
    markUnread: string;
    /** Loads the notifications again after `error`. */
    retry: string;
    /** Heading of the panel and name of the bell without unread ones. */
    title: string;
    /** Read before the title of an unread notification. */
    unread: string;
    /** Announced once new unread notifications arrive - the unread count. */
    unreadCount: PluralMessage;
    /** Accessible name of the bell with unread notifications. */
    unreadLabel: PluralMessage;
  };
  numberInput: {
    /** Accessible name of the button that lowers the value by a step. */
    decrement: string;
    /** Accessible name of the button that raises the value by a step. */
    increment: string;
    /** Validity message of an incomplete number, such as a lone minus sign. */
    invalidNumber: string;
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
    /** Button of the jump to a page (`showJumpTo`). */
    go: string;
    /** Label of the number field of the jump to a page (`showJumpTo`). */
    goTo: string;
    label: string;
    last: string;
    next: string;
    /** Accessible name of a numbered page button - `{page}` is its number. */
    page: string;
    /** Label of the page size select (`pageSizeOptions`). */
    pageSize: string;
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
  /** `PromptDialog` and the prompts of `usePrompt()`. */
  promptDialog: {
    /** Shown under the field of a `required` prompt left empty. */
    required: string;
    /** Shown under a value longer than `maxLength` - `{count}` is the limit. */
    tooLong: PluralMessage;
  };
  rating: {
    /** The value of a `Rating` nothing was picked in. */
    none: string;
    /**
     * The value of a `Rating` - `{value}` of `{count}`, the highest rating:
     * "3.5 of 5 stars".
     */
    value: PluralMessage;
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
    codeBlock: string;
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
    /** The image tool, and the name of its form. */
    image: string;
    /** The field of the image form for the text read in place of the image. */
    imageAlt: string;
    /** Shown under the editor when an upload of `uploadImage` failed. */
    imageUploadError: string;
    /** Told to screen readers while an image uploads. */
    imageUploading: string;
    /** The URL field of the image form. */
    imageUrl: string;
    /** Under the URL field of the image form, for an address it refuses. */
    imageUrlInvalid: string;
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
    /** Under the field of the link form, for a link it refuses. */
    linkInvalid: string;
    linkPrompt: string;
    numberedList: string;
    outdent: string;
    paragraph: string;
    redo: string;
    /** The button of the image form that removes the image it edits. */
    removeImage: string;
    /** The button of the link form that removes the link at the selection. */
    removeLink: string;
    /** The number field of the table form. */
    rows: string;
    strikethrough: string;
    /** The table tool, and the name of the tools of the table at the caret. */
    table: string;
    underline: string;
    undo: string;
    /** The button of the image form that picks files to upload. */
    uploadImage: string;
    /** The validation message of the editor while an image uploads. */
    waitForUpload: string;
  };
  select: {
    /** Accessible name of the blank option `hasEmpty` adds. */
    emptyOption: string;
  };
  /** The warning of `SessionTimeout` before the session ends. */
  sessionTimeout: {
    /** The button that keeps the user signed in. */
    extend: string;
    /** Shown when `onExtend` failed. */
    extendError: string;
    /** The message of a session that ends at `expiresAt`. */
    expiresMessage: string;
    /** The message of a session that ends for inactivity. */
    idleMessage: string;
    /** The button that signs the user out at once. */
    logout: string;
    /** Announced as the time runs out - whole minutes left. */
    remainingMinutes: PluralMessage;
    /** Announced as the time runs out - seconds left. */
    remainingSeconds: PluralMessage;
    /** Accessible name of the countdown. */
    timeLeft: string;
    /** Heading of the warning. */
    title: string;
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
  sparkline: {
    /** Accessible name of a sparkline with a `label` - `{label}: {summary}`. */
    label: string;
    /**
     * What a sparkline shows, for screen readers - its `{first}` and
     * `{last}` value, the lowest (`{min}`) and the highest (`{max}`).
     */
    summary: string;
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
    /** Under the title of a step marked `optional`. */
    optional: string;
  };
  /** `SystemBanner` - the message bar of `AppShell`. */
  systemBanner: {
    /** Accessible name of the close button of a `dismissible` banner. */
    dismiss: string;
  };
  tabs: {
    /** Title of the × of a closable tab (`onClose`). */
    close: string;
    /** The button of the menu of the tabs with no room (`overflow="menu"`). */
    more: string;
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
  toolbar: {
    /** Accessible name of the button of the menu of the items with no room. */
    more: string;
  };
  /** `TreeSelect` - its field, the chips of a multiple one and the popup. */
  treeSelect: {
    /** Accessible name of the button that clears the value. */
    clear: string;
    /** The chip standing for the chips beyond `maxChips`, e.g. "+3 more". */
    more: PluralMessage;
    /** Between the labels of the path of `showPath`, e.g. " / ". */
    pathSeparator: string;
    /** Accessible name of the search field of the popup. */
    search: string;
    /** Placeholder of the search field of the popup. */
    searchPlaceholder: string;
  };
  treeView: {
    /** Read after the name of an item being moved. */
    beingMoved: string;
    /** Announced when Ctrl / ⌘ + X picks up an item that cannot move - `{item}` is its label. */
    cannotMove: string;
    /** A place to move to, announced - after the item `{item}`, at the top level. */
    dropAfter: string;
    /** A place to move to - after `{item}`, among the children of `{parent}`. */
    dropAfterIn: string;
    /** A place to move to - before the item `{item}`. */
    dropBefore: string;
    /** A place to move to - into the item `{item}`, as its last child. */
    dropInside: string;
    /** The badge beside the pointer dragging several items. */
    itemCount: PluralMessage;
    /** Shown in place of the children `loadChildren` failed to load. */
    loadError: string;
    /** Announced when a move is cancelled. */
    moveCancelled: string;
    /** Announced after a drop of one item - `{item}` is its label. */
    moved: string;
    /** Announced after a drop of several items. */
    movedMany: PluralMessage;
    /** Announced as a move starts, after `moving` / `movingMany` - the keys. */
    moveInstructions: string;
    /** Announced as one item is picked up - `{item}` is its label. */
    moving: string;
    /** Announced as several items are picked up. */
    movingMany: PluralMessage;
    /** Shown instead of a tree without items. */
    noItems: string;
    /** Shown instead of a tree when `filter` matches no item. */
    noMatches: string;
    /** Loads the children again after `loadError`. */
    retry: string;
  };
  /** `VirtualList` - the rows at its end while more items load. */
  virtualList: {
    /** The row at the end while `onEndReached` loads more items. */
    loading: string;
    /** The row at the end when loading more items failed. */
    loadError: string;
    /** The button of `loadError` that loads them again. */
    retry: string;
  };
  /** `FilterBuilder`, and `describeFilter` writing its value. */
  filterBuilder: {
    /** The button that adds a condition to a group. */
    addCondition: string;
    /** The button that adds a group of conditions to a group. */
    addGroup: string;
    /** The choice joining the conditions of a group - all must match. */
    and: string;
    /** Accessible name of the choice between `and` and `or`. */
    combinator: string;
    /** Accessible name of a condition - `{index}` is its place, e.g. "2.1". */
    condition: string;
    /** Shown in a group without conditions. */
    empty: string;
    /** Accessible name of the field select of a condition. */
    field: string;
    /** Accessible name of the first field of a range ("between"). */
    from: string;
    /** Accessible name of a nested group - `{index}` is its place. */
    group: string;
    /** Accessible name of a `FilterBuilder` without a `label`. */
    label: string;
    /** Accessible name of the operator select of a condition. */
    operator: string;
    /** The names of the operators - in the select and in `describeFilter`. */
    operators: {
      after: string;
      before: string;
      between: string;
      contains: string;
      endsWith: string;
      equals: string;
      greaterThan: string;
      greaterThanOrEqual: string;
      hasAll: string;
      hasAny: string;
      hasNone: string;
      in: string;
      isEmpty: string;
      isNotEmpty: string;
      lessThan: string;
      lessThanOrEqual: string;
      notContains: string;
      notEquals: string;
      notIn: string;
      on: string;
      onOrAfter: string;
      onOrBefore: string;
      startsWith: string;
    };
    /** The choice joining the conditions of a group - any may match. */
    or: string;
    /** `describeFilter`: a text value - `{value}` in the quotes of the language. */
    quoted: string;
    /** `describeFilter`: the two ends of a range, e.g. "100 and 200". */
    range: string;
    /** Accessible name of the button removing a condition - `{index}` is its place. */
    removeCondition: string;
    /** Accessible name of the button removing a group - `{index}` is its place. */
    removeGroup: string;
    /** Accessible name of the second field of a range ("between"). */
    to: string;
    /** Accessible name of the value field of a condition. */
    value: string;
    /** `describeFilter`: the word joining the conditions of an `and` group. */
    wordAnd: string;
    /** `describeFilter`: the word joining the conditions of an `or` group. */
    wordOr: string;
  };
  /** `ChangeHistory` - the audit trail of a record. */
  changeHistory: {
    /** The labels of the built-in actions. */
    actions: {
      created: string;
      deleted: string;
      updated: string;
    };
    /**
     * Read before the words a text gained, in the comparison of a long
     * text.
     */
    added: string;
    /** The filter of the authors - the option of all of them. */
    allAuthors: string;
    /** The filter of the fields - the option of all of them. */
    allFields: string;
    /** Accessible name of the filter of the authors. */
    author: string;
    /** Read before the comment of an entry. */
    comment: string;
    /** Shown without entries. */
    empty: string;
    /** Read in place of the "—" of an empty value. */
    emptyValue: string;
    /** Header of the column of the fields - also the filter of the fields. */
    field: string;
    /** Header of the column of the values before the change. */
    from: string;
    /** The button that loads older entries (`onLoadMore`). */
    loadMore: string;
    /** Shown when loading older entries failed. */
    loadError: string;
    /** Announced once older entries are loaded. */
    loaded: PluralMessage;
    /** Shown when the filters leave no entry. */
    noMatches: string;
    /** Read before the words a text lost, in the comparison of a long text. */
    removed: string;
    /** The button of `loadError` that loads them again. */
    retry: string;
    /** Collapses a long text shown whole. */
    showLess: string;
    /** Shows a long text whole. */
    showMore: string;
    /** The author of a change no person made. */
    system: string;
    /** Header of the column of the values after the change. */
    to: string;
    /** The day heading of today. */
    today: string;
    /** The day heading of yesterday. */
    yesterday: string;
  };
  /**
   * The question of `useUnsavedChanges` before the page with a form with
   * unsaved changes is left.
   */
  unsavedChanges: {
    /** The button that leaves the page - the changes are lost. */
    leave: string;
    message: string;
    /** The button that stays on the page with the form. */
    stay: string;
    title: string;
  };
  /** `MentionInput` - its list of suggestions. */
  mentionInput: {
    /** Announced once a mention is inserted - `{label}` is its name. */
    inserted: string;
    /** Shown in the list when `loadSuggestions` failed. */
    loadError: string;
    /** Shown in the list when nothing matches the typed text. */
    noResults: string;
    /** Announced to screen readers - the number of suggestions listed. */
    resultCount: PluralMessage;
    /** Accessible name of the list of a trigger without a `label`. */
    suggestions: string;
  };
  /** `CommentThread` - its comments, their actions and the fields. */
  commentThread: {
    /** Accessible name of the list of the comments. */
    comments: string;
    /** Accessible name of the field of a new comment. */
    composerLabel: string;
    /** Placeholder of the field of a new comment. */
    composerPlaceholder: string;
    /** The button that deletes a comment. */
    delete: string;
    /** Shown in the dialog when `onDelete` failed without a message. */
    deleteError: string;
    /** Message of the dialog confirming a deletion. */
    deleteMessage: string;
    /** Title of the dialog confirming a deletion. */
    deleteTitle: string;
    /** Announced once a comment is deleted. */
    deleted: string;
    /** The button that edits a comment. */
    edit: string;
    /** Shown under the field when `onEdit` failed without a message. */
    editError: string;
    /** Accessible name of the field editing a comment. */
    editLabel: string;
    /** After the time of an edited comment. */
    edited: string;
    /** Tooltip of `edited` - `{time}` is the date and time of the edit. */
    editedAt: string;
    /** Shown instead of the list when there are no comments. */
    empty: string;
    /** The button above the comments that loads older ones. */
    loadOlder: string;
    /** Shown when `onLoadMore` failed. */
    loadOlderError: string;
    /** Announced when a comment is added - `{author}` is its author. */
    newComment: string;
    /** Announced when several comments are added at once. */
    newComments: PluralMessage;
    /** Accessible name of the list of the replies to the comment of `{author}`. */
    replies: string;
    /** The button that opens the field of a reply. */
    reply: string;
    /** Accessible name of the field of a reply to the comment of `{author}`. */
    replyLabel: string;
    /** Placeholder of the field of a reply. */
    replyPlaceholder: string;
    /** The button that saves an edited comment. */
    save: string;
    /** The button that sends a comment or a reply. */
    submit: string;
    /** Shown under the field when `onSubmit` failed without a message. */
    submitError: string;
    /**
     * Next to the send button - `{shortcut}` is where the keys of
     * Ctrl / ⌘ + Enter are shown.
     */
    submitHint: string;
  };
  /** `KanbanBoard` - its columns and the moving of the cards. */
  kanbanBoard: {
    /** The button `onAddCard` adds to the columns. */
    addCard: string;
    /** Accessible name of `addCard` - `{column}` is the title of the column. */
    addCardTo: string;
    /** Read after the name of a card being moved. */
    beingMoved: string;
    /** `aria-roledescription` of a card that can be moved. */
    card: string;
    /** The number of cards of a column, for screen readers. */
    cardCount: PluralMessage;
    /** Accessible name of the button collapsing the column `{column}`. */
    collapse: string;
    /** Shown in a column without cards. */
    empty: string;
    /** Accessible name of the button expanding the column `{column}`. */
    expand: string;
    /**
     * Read with a card that can be moved - how to move it with the keys.
     */
    instructions: string;
    /** The cards of a column and its limit, shown - `{count}` / `{limit}`. */
    limit: string;
    /** For screen readers - `{cards}` is `cardCount`, `{limit}` the limit. */
    limitLabel: string;
    /**
     * Announced after a drop - the card `{card}` in the column `{column}`,
     * at `{position}` of its `{count}` cards.
     */
    moved: string;
    /** Announced when a move is cancelled - `{card}` is its label. */
    moveCancelled: string;
    /** Shown and announced when `onMoveCard` failed - `{card}` is its label. */
    moveError: string;
    /** For screen readers - a column over its limit, like `limitLabel`. */
    overLimit: string;
    /**
     * Announced when a card is picked up with the keys - `{card}`, and its
     * place: `{column}`, `{position}` of `{count}`.
     */
    pickedUp: string;
    /** Announced as a picked up card moves - `{column}`, `{position}` of `{count}`. */
    position: string;
    /** Announced when a card is dropped where it was - `{card}` is its label. */
    unchanged: string;
  };
}

/** Application texts at the root, with library texts under `ui`. */
export type Messages = AppMessages & { ui: UIMessages };

/**
 * Everything language- and region-specific in one object: the texts, the
 * date formats and the first day of the week. Pass it to `UIProvider`.
 */
export interface Locale {
  /**
   * BCP 47 language tag used for `Intl` formatting, e.g. `"cs-CZ"`.
   * Calendars and date pickers keep Gregorian dates in every language.
   */
  code: string;
  /** Display patterns of the date and time pickers. */
  formats: DateFormats;
  /** Texts of the components and the application. */
  messages: Messages;
  /** First day of the week in the calendar and the pickers. */
  weekStartsOn: WeekDay;
}
