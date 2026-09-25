// Public API of the library - everything a project imports comes from here.

// Components
export {
  default as Accordion,
  type AccordionProps,
} from "./components/accordion";
export {
  default as AccordionGroup,
  type AccordionGroupProps,
} from "./components/accordion-group";
export { default as Alert, type AlertProps } from "./components/alert";
export {
  default as AppShell,
  type AppShellProps,
} from "./components/app-shell";
export {
  default as Autocomplete,
  type AsyncAutocompleteProps,
  type AutocompleteItem,
  type AutocompleteOption,
  type AutocompleteProps,
  type AutocompleteValue,
  type LoadOptionsPage,
  type LoadOptionsParams,
  type LoadOptionsResult,
  type RelayConnection,
  type StaticAutocompleteProps,
} from "./components/autocomplete";
export { normalizeLoadOptionsResult } from "./components/autocomplete/load-options";
export {
  default as Avatar,
  type AvatarProps,
  type AvatarSize,
} from "./components/avatar";
export {
  default as AvatarGroup,
  type AvatarGroupProps,
} from "./components/avatar-group";
export {
  default as Breadcrumbs,
  type BreadcrumbItem,
  type BreadcrumbsProps,
} from "./components/breadcrumbs";
export { default as Button, type ButtonProps } from "./components/button";
export {
  default as ButtonGroup,
  type ButtonGroupProps,
} from "./components/button-group";
export {
  default as Calendar,
  type CalendarAgendaPeriod,
  type CalendarEvent,
  type CalendarEventColor,
  type CalendarProps,
  type CalendarRecurrence,
  type CalendarResource,
  type CalendarView,
  type EventTimeChange,
  type NewEventTimeRange,
} from "./components/calendar";
export {
  getVisibleRange as getCalendarVisibleRange,
  type VisibleRangeOptions as CalendarVisibleRangeOptions,
} from "./components/calendar/date-utils";
export { expandRecurringEvents } from "./components/calendar/recurrence";
export { default as Checkbox, type CheckboxProps } from "./components/checkbox";
export {
  default as CheckboxGroup,
  type CheckboxGroupProps,
  type CheckboxOption,
} from "./components/checkbox-group";
export {
  default as Chip,
  type ChipColor,
  type ChipProps,
  type ChipSize,
  type ChipVariant,
} from "./components/chip";
export {
  default as CollapsibleContent,
  type CollapsibleContentProps,
} from "./components/collapsible-content";
export {
  default as ColorSchemeScript,
  type ColorSchemeScriptProps,
} from "./components/color-scheme-script";
export {
  default as ColorSchemeToggle,
  type ColorSchemeToggleProps,
} from "./components/color-scheme-toggle";
export {
  default as CommandPalette,
  type CommandPaletteItem,
  type CommandPaletteLoadParams,
  type CommandPaletteProps,
} from "./components/command-palette";
export {
  default as ConfirmDialog,
  type ConfirmDialogProps,
} from "./components/confirm-dialog";
export {
  default as ContextMenu,
  type ContextMenuProps,
} from "./components/context-menu";
export {
  default as CopyButton,
  type CopyButtonProps,
} from "./components/copy-button";
export {
  default as DataTable,
  type CellEditorProps,
  type Column,
  type ColumnEditor,
  type ColumnFilter,
  type ColumnPin,
  type ColumnSummary,
  type DataTableDensity,
  type DataTableProps,
  type FilteredSelectionConfig,
  type GroupAction,
  type GroupActionSelection,
  type RowId,
} from "./components/data-table";
export {
  createCsv,
  downloadCsv,
  getCsvSeparator,
  type CsvOptions,
} from "./components/data-table/csv";
export {
  applyDataTableQuery,
  createDataTableQuery,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZE_OPTIONS,
  readQueryFromSearch,
  resetPagination,
  setFilter,
  toggleSort,
  toOffsetParams,
  toRelayVariables,
  writeQueryToSearch,
  type ApplyDataTableQueryOptions,
  type DataTableQuery,
  type DataTableUrlOptions,
  type SortOrder,
} from "./components/data-table/query";
export {
  default as useDataTableQuery,
  type SetDataTableQuery,
  type UseDataTableQueryOptions,
} from "./components/data-table/use-data-table-query";
export {
  default as DateRangePicker,
  type DateRange,
  type DateRangePickerProps,
  type DateRangePreset,
  type DateRangePresetKey,
} from "./components/date-range-picker";
export {
  default as DateTimePicker,
  type DateTimePickerChangeEvent,
  type DateTimePickerChangeTarget,
  type DateTimePickerProps,
  type DateTimePickerType,
} from "./components/datetime-picker";
export {
  default as DescriptionList,
  type DescriptionListItem,
  type DescriptionListProps,
} from "./components/description-list";
export {
  default as Dialog,
  DialogFooter,
  type DialogProps,
  type DialogSize,
} from "./components/dialog";
export {
  default as Drawer,
  type DrawerEntry,
  type DrawerItem,
  type DrawerProps,
} from "./components/drawer";
export {
  default as Dropdown,
  type DropdownEntry,
  type DropdownGroup,
  type DropdownItem,
  type DropdownProps,
  type DropdownRadioGroup,
  type DropdownRadioOption,
  type DropdownSeparator,
} from "./components/dropdown";
export {
  default as EmptyState,
  type EmptyStateProps,
} from "./components/empty-state";
export {
  default as ErrorBoundary,
  type ErrorBoundaryProps,
} from "./components/error-boundary";
export {
  default as Field,
  type FieldControlProps,
  type FieldProps,
} from "./components/field";
export {
  default as FileUpload,
  type FileUploadProps,
  type UploadedFile,
} from "./components/file-upload";
export {
  default as FormDescription,
  type FormDescriptionProps,
} from "./components/form-description";
export {
  default as FormError,
  type FormErrorProps,
} from "./components/form-error";
export { default as Header, type HeaderProps } from "./components/header";
export {
  default as IconButton,
  type IconButtonProps,
} from "./components/icon-button";
export { default as Input, type InputProps } from "./components/input";
export { default as Kbd, type KbdProps } from "./components/kbd";
export { default as Link, type LinkProps } from "./components/link";
export {
  default as Navbar,
  type NavbarProps,
  type NavbarUser,
} from "./components/navbar";
export {
  default as NumberInput,
  type NumberInputProps,
} from "./components/number-input";
export { default as Overlay, type OverlayProps } from "./components/overlay";
export {
  default as Pagination,
  type PageInfo,
  type PaginationDirection,
  type PaginationProps,
} from "./components/pagination";
export { default as Panel, type PanelProps } from "./components/panel";
export {
  default as PinInput,
  type PinInputProps,
} from "./components/pin-input";
export {
  default as Popover,
  type PopoverPopupRole,
  type PopoverProps,
} from "./components/popover";
export {
  default as Progress,
  CircularProgress,
  type CircularProgressProps,
  type ProgressProps,
} from "./components/progress";
export {
  default as RadioGroup,
  type RadioGroupProps,
  type RadioOption,
} from "./components/radio-group";
export {
  default as RichTextEditor,
  type RichTextEditorProps,
  type RichTextTool,
  type RichTextToolbarItem,
} from "./components/rich-text-editor";
export { DEFAULT_RICH_TEXT_TOOLBAR } from "./components/rich-text/tools";
export {
  default as SegmentedControl,
  type SegmentedControlOption,
  type SegmentedControlProps,
} from "./components/segmented-control";
export {
  default as Select,
  type SelectOption,
  type SelectOptionGroup,
  type SelectProps,
} from "./components/select";
export {
  default as Separator,
  type SeparatorProps,
} from "./components/separator";
export {
  default as Sheet,
  type SheetProps,
  type SheetSide,
  type SheetSize,
} from "./components/sheet";
export { default as Skeleton, type SkeletonProps } from "./components/skeleton";
export {
  default as Slider,
  type SliderMark,
  type SliderProps,
  type SliderValue,
} from "./components/slider";
export {
  default as Spinner,
  type SpinnerProps,
  type SpinnerSize,
} from "./components/spinner";
export {
  default as SplitButton,
  type SplitButtonProps,
} from "./components/split-button";
export { default as Splitter, type SplitterProps } from "./components/splitter";
export { default as Stat, type StatProps } from "./components/stat";
export {
  default as Stepper,
  type StepperProps,
  type StepperStep,
} from "./components/stepper";
export { default as Switch, type SwitchProps } from "./components/switch";
export {
  default as Tabs,
  type LinkTabItem,
  type TabItem,
  type TabsProps,
  type ValueTabItem,
} from "./components/tabs";
export {
  default as TagsInput,
  type TagsInputProps,
} from "./components/tags-input";
export { default as Textarea, type TextareaProps } from "./components/textarea";
export {
  default as Timeline,
  type TimelineColor,
  type TimelineItem,
  type TimelineProps,
} from "./components/timeline";
export {
  default as Toast,
  type ToastAction,
  type ToastProps,
  type ToastVariant,
} from "./components/toast";
export { default as Tooltip, type TooltipProps } from "./components/tooltip";
export {
  default as TreeView,
  type TreeItem,
  type TreeItemId,
  type TreeItemState,
  type TreeViewProps,
} from "./components/tree-view";
export {
  default as VisuallyHidden,
  type VisuallyHiddenProps,
} from "./components/visually-hidden";

// Configuration
export {
  default as UIProvider,
  type UIProviderProps,
} from "./providers/ui-provider";
export { useLocale, useMessages, useRouter } from "./providers/ui-context";
export { findActiveLink, isActivePath } from "./providers/active-path";
export {
  type LinkComponent,
  type LinkComponentProps,
  type NavigateOptions,
  type RouterAdapter,
} from "./providers/router";
export {
  default as DrawerProvider,
  type DrawerProviderProps,
} from "./providers/drawer-provider";
export { useDrawer, type DrawerState } from "./providers/drawer-context";
export {
  default as SnackbarProvider,
  type SnackbarProviderProps,
} from "./providers/snackbar-provider";
export {
  useSnackbar,
  type SnackbarApi,
  type SnackbarId,
  type SnackbarOptions,
  type SnackbarPromiseMessages,
} from "./providers/snackbar-context";
export {
  default as ConfirmProvider,
  type ConfirmProviderProps,
} from "./providers/confirm-provider";
export {
  useConfirm,
  type ConfirmFunction,
  type ConfirmOptions,
} from "./providers/confirm-context";

// Localization
export { cs } from "./i18n/cs";
export { en } from "./i18n/en";
export { createLocale, formatMessage, formatPlural } from "./i18n/format";
export type {
  DateFormats,
  DatePatternToken,
  DeepPartial,
  Locale,
  Messages,
  PluralMessage,
  WeekDay,
} from "./i18n/types";

// Hooks & utilities
export {
  default as useClipboard,
  type UseClipboardOptions,
  type UseClipboardResult,
} from "./hooks/use-clipboard";
export {
  default as useColorScheme,
  type ColorScheme,
  type ResolvedColorScheme,
  type UseColorSchemeOptions,
  type UseColorSchemeResult,
} from "./hooks/use-color-scheme";
export { getColorSchemeScript } from "./utils/color-scheme";
export {
  default as useDebouncedCallback,
  type DebouncedCallback,
  type UseDebouncedCallbackOptions,
} from "./hooks/use-debounced-callback";
export { default as useDebouncedValue } from "./hooks/use-debounced-value";
export {
  default as useDisclosure,
  type UseDisclosureResult,
} from "./hooks/use-disclosure";
export {
  default as useHotkeys,
  type Hotkey,
  type HotkeyOptions,
  type UseHotkeysOptions,
} from "./hooks/use-hotkeys";
export { default as useIsApplePlatform } from "./hooks/use-is-apple-platform";
export { default as useIsHydrated } from "./hooks/use-is-hydrated";
export { default as useIsMobile } from "./hooks/use-is-mobile";
export {
  default as useLocalStorage,
  type SetLocalStorageValue,
  type UseLocalStorageOptions,
  type UseLocalStorageResult,
} from "./hooks/use-local-storage";
export {
  default as useMediaQuery,
  type UseMediaQueryOptions,
} from "./hooks/use-media-query";
export {
  OverlayScope,
  useOverlay,
  type UseOverlayOptions,
  type UseOverlayResult,
} from "./components/overlay-stack";
export { default as cn, joinTokens } from "./utils/cn";
export { default as removeDiacritics } from "./utils/remove-diacritics";
export {
  default as sanitizeRichText,
  isSafeHref,
  type RichTextFormat,
  type SanitizeRichTextOptions,
} from "./utils/sanitize-rich-text";
export {
  default as uploadWithProgress,
  UploadError,
  type UploadWithProgressOptions,
} from "./utils/upload-with-progress";
export {
  getBaseError,
  getFieldError,
  getNestedErrors,
} from "./utils/server-errors";
export {
  formatShortcut,
  matchesShortcut,
  parseShortcut,
  toAriaKeyShortcuts,
  type Shortcut,
  type ShortcutEvent,
} from "./utils/shortcut";
