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
 * (e.g. Czech `one` / `few` / `other`). `{count}` is replaced by the number.
 */
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string;
};

/** Day of the week as returned by `Date#getDay()`: 0 = Sunday … 6 = Saturday. */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

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
    /** Accessible name of the option list, `{label}` is the field label. */
    listLabel: string;
    /** Shown in the list when loading the options failed. */
    loadError: string;
    loading: string;
    loadingSelected: string;
    noResults: string;
  };
  breadcrumbs: {
    home: string;
    label: string;
  };
  calendar: {
    allDay: string;
    day: string;
    goToDate: string;
    month: string;
    /** Opens the events a crowded day of the month view has no room for. */
    more: PluralMessage;
    next: string;
    previous: string;
    week: string;
  };
  dataTable: {
    actions: string;
    clearFilters: string;
    closeSearch: string;
    collapseRow: string;
    columns: string;
    dragColumn: string;
    expandRow: string;
    filterColumn: string;
    /** The handle in the column settings that moves a column by the arrow keys. */
    moveColumn: string;
    noData: string;
    openSearch: string;
    pinLeft: string;
    pinRight: string;
    region: string;
    resetColumns: string;
    rowsPerPage: string;
    search: string;
    searchColumn: string;
    selectAllRows: string;
    selectRow: string;
    selectedCount: PluralMessage;
    /** Texts of the "select all rows matching the filter" bar. */
    selection: {
      all: PluralMessage;
      clear: string;
      page: PluralMessage;
      selectAll: PluralMessage;
    };
    sortBy: string;
    toggleFullScreen: string;
  };
  dateTimePicker: {
    clear: string;
    hours: string;
    minutes: string;
    /** The month select of the date popup. */
    month: string;
    nextMonth: string;
    nextYear: string;
    openCalendar: string;
    previousMonth: string;
    previousYear: string;
    selectDate: string;
    selectMonth: string;
    selectTime: string;
    selectWeek: string;
    week: string;
    /** The year select of the date popup. */
    year: string;
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
    remove: string;
    upload: string;
    uploadFailed: string;
    uploading: string;
  };
  header: {
    back: string;
  };
  input: {
    hidePassword: string;
    showPassword: string;
  };
  navbar: {
    toggleMenu: string;
    toggleSidebar: string;
  };
  pagination: {
    first: string;
    label: string;
    last: string;
    next: string;
    previous: string;
    range: string;
  };
  richTextEditor: {
    bold: string;
    italic: string;
    link: string;
    linkPrompt: string;
    paragraph: string;
  };
  toast: {
    close: string;
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
