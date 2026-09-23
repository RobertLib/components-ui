// Public API of the library - everything a project imports comes from here.

// Components
export {
  default as Accordion,
  type AccordionProps,
} from "./components/accordion";
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
export { default as Avatar, type AvatarProps } from "./components/avatar";
export {
  default as Breadcrumbs,
  type BreadcrumbItem,
  type BreadcrumbsProps,
} from "./components/breadcrumbs";
export { default as Button, type ButtonProps } from "./components/button";
export {
  default as Calendar,
  type CalendarEvent,
  type CalendarEventColor,
  type CalendarProps,
  type CalendarView,
  type EventTimeChange,
  type NewEventTimeRange,
} from "./components/calendar";
export { getVisibleRange as getCalendarVisibleRange } from "./components/calendar/date-utils";
export { default as Checkbox, type CheckboxProps } from "./components/checkbox";
export {
  default as Chip,
  type ChipColor,
  type ChipProps,
  type ChipVariant,
} from "./components/chip";
export {
  default as CollapsibleContent,
  type CollapsibleContentProps,
} from "./components/collapsible-content";
export {
  default as ConfirmDialog,
  type ConfirmDialogProps,
} from "./components/confirm-dialog";
export {
  default as DataTable,
  type Column,
  type ColumnFilter,
  type DataTableProps,
  type FilteredSelectionConfig,
  type GroupAction,
  type GroupActionSelection,
  type RowId,
} from "./components/data-table";
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
  default as DateTimePicker,
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
  type DropdownItem,
  type DropdownProps,
} from "./components/dropdown";
export {
  default as ErrorBoundary,
  type ErrorBoundaryProps,
} from "./components/error-boundary";
export {
  default as FileUpload,
  type FileUploadProps,
  type UploadedFile,
} from "./components/file-upload";
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
export {
  default as Navbar,
  type NavbarProps,
  type NavbarUser,
} from "./components/navbar";
export { default as Overlay, type OverlayProps } from "./components/overlay";
export {
  default as Pagination,
  type PageInfo,
  type PaginationDirection,
  type PaginationProps,
} from "./components/pagination";
export { default as Panel, type PanelProps } from "./components/panel";
export { default as Popover, type PopoverProps } from "./components/popover";
export { default as Progress, type ProgressProps } from "./components/progress";
export {
  default as RadioGroup,
  type RadioGroupProps,
  type RadioOption,
} from "./components/radio-group";
export {
  default as RichTextEditor,
  type RichTextEditorProps,
} from "./components/rich-text-editor";
export {
  default as Select,
  type SelectOption,
  type SelectProps,
} from "./components/select";
export { default as Skeleton, type SkeletonProps } from "./components/skeleton";
export {
  default as Spinner,
  type SpinnerProps,
  type SpinnerSize,
} from "./components/spinner";
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
export { default as Textarea, type TextareaProps } from "./components/textarea";
export {
  default as Toast,
  type ToastProps,
  type ToastVariant,
} from "./components/toast";
export { default as Tooltip, type TooltipProps } from "./components/tooltip";

// Configuration
export {
  default as UIProvider,
  type UIProviderProps,
} from "./providers/ui-provider";
export { useLocale, useMessages, useRouter } from "./providers/ui-context";
export {
  isActivePath,
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
export { default as SnackbarProvider } from "./providers/snackbar-provider";
export {
  useSnackbar,
  type SnackbarApi,
  type SnackbarOptions,
} from "./providers/snackbar-context";

// Localization
export { cs } from "./i18n/cs";
export { en } from "./i18n/en";
export { createLocale, formatMessage, formatPlural } from "./i18n/format";
export type {
  DateFormats,
  DeepPartial,
  Locale,
  Messages,
  PluralMessage,
  WeekDay,
} from "./i18n/types";

// Hooks & utilities
export { default as useIsMobile } from "./hooks/use-is-mobile";
export { default as cn } from "./utils/cn";
export { default as removeDiacritics } from "./utils/remove-diacritics";
export {
  default as uploadWithProgress,
  type UploadWithProgressOptions,
} from "./utils/upload-with-progress";
export {
  getBaseError,
  getFieldError,
  getNestedErrors,
} from "./utils/server-errors";
