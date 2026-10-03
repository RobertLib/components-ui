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
    /** Shown when CSV export fails. */
    exportFailed: string;
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
     * The time popup and its time lists in the date-time popup - also the
     * name of a time field without a label.
     */
    selectTime: string;
    /** The week popup - also the name of a week field without a label. */
    selectWeek: string;
    /** The button of the date popup that picks today. */
    today: string;
    /**
     * Validity message of a value `isDateDisabled` disables - a day, or a
     * month or week with no day left - `{value}` is the value as the field
     * shows it. The form cannot be submitted with it.
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
  errorBoundary: {
    retry: string;
    title: string;
  };
  fileUpload: {
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
  tabs: {
    /** Title of the × of a closable tab (`onClose`). */
    close: string;
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
}

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
  /** Texts of the components. */
  messages: Messages;
  /** First day of the week in the calendar and the pickers. */
  weekStartsOn: WeekDay;
}
