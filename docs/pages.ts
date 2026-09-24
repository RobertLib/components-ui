import {
  BookOpen,
  Compass,
  LayoutDashboard,
  MessageSquare,
  MousePointerClick,
  Table,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";
import { lazy } from "react";

/**
 * Every page of the docs - the navigation, the search and the routes are
 * built from this list. Add a page here after creating it in docs/pages.
 */

export interface DocsPage {
  component: React.LazyExoticComponent<React.ComponentType>;
  /** Extra words the page search matches. */
  keywords?: string;
  path: string;
  title: string;
}

export interface DocsGroup {
  icon: LucideIcon;
  pages: DocsPage[];
  title: string;
}

const page = (
  path: string,
  title: string,
  load: () => Promise<{ default: React.ComponentType }>,
  keywords?: string,
): DocsPage => ({ component: lazy(load), keywords, path, title });

const component = (
  slug: string,
  title: string,
  load: () => Promise<{ default: React.ComponentType }>,
  keywords?: string,
) => page(`/components/${slug}`, title, load, keywords);

export const groups: DocsGroup[] = [
  {
    icon: BookOpen,
    title: "Getting started",
    pages: [
      page("/", "Introduction", () => import("./pages/introduction")),
      page(
        "/installation",
        "Installation",
        () => import("./pages/installation"),
        "setup tailwind provider",
      ),
      page(
        "/theming",
        "Theming",
        () => import("./pages/theming"),
        "colors dark mode tokens color scheme light system useColorScheme ColorSchemeToggle ColorSchemeScript getColorSchemeScript",
      ),
      page(
        "/localization",
        "Localization",
        () => import("./pages/localization"),
        "i18n language translations czech date format",
      ),
      page(
        "/routing",
        "Routing",
        () => import("./pages/routing"),
        "react router next.js link navigate adapter",
      ),
    ],
  },
  {
    icon: Compass,
    title: "Guides",
    pages: [
      page(
        "/guides/data-fetching",
        "REST & GraphQL",
        () => import("./pages/guides/data-fetching"),
        "api fetch apollo pagination cursor relay",
      ),
      page(
        "/guides/forms",
        "Forms & validation",
        () => import("./pages/guides/forms"),
        "server errors formdata react-hook-form description help text Field custom control",
      ),
      page(
        "/guides/app-layout",
        "App layout",
        () => import("./pages/guides/app-layout"),
        "appshell drawer navbar sidebar",
      ),
      page(
        "/guides/utilities",
        "Hooks & utilities",
        () => import("./pages/guides/utilities"),
        "helpers hooks cn class names useIsMobile useMediaQuery responsive media query useDisclosure open state useHotkeys keyboard shortcuts hotkeys useLocalStorage persist remember useDebouncedValue useDebouncedCallback debounce useClipboard copy clipboard removeDiacritics accents isActivePath useRouter normalizeLoadOptionsResult DEFAULT_PAGE_SIZE uploadWithProgress progress DrawerProvider storageKey",
      ),
      page(
        "/guides/contributing",
        "Developing the library",
        () => import("./pages/guides/contributing"),
        "contributing add component build release tests",
      ),
    ],
  },
  {
    icon: MousePointerClick,
    title: "Actions",
    pages: [
      component(
        "button",
        "Button",
        () => import("./pages/components/button"),
        "icon loading full width",
      ),
      component(
        "button-group",
        "ButtonGroup",
        () => import("./pages/components/button-group"),
        "attached joined toolbar toggle buttons",
      ),
      component(
        "split-button",
        "SplitButton",
        () => import("./pages/components/split-button"),
        "split dropdown button menu more options save",
      ),
      component(
        "link",
        "Link",
        () => import("./pages/components/link"),
        "anchor href external new tab underline",
      ),
      component(
        "icon-button",
        "IconButton",
        () => import("./pages/components/icon-button"),
      ),
      component(
        "copy-button",
        "CopyButton",
        () => import("./pages/components/copy-button"),
        "clipboard copy to clipboard useClipboard",
      ),
      component(
        "dropdown",
        "Dropdown",
        () => import("./pages/components/dropdown"),
        "menu submenu checkbox radio shortcut separator typeahead",
      ),
      component(
        "context-menu",
        "ContextMenu",
        () => import("./pages/components/context-menu"),
        "right click long press shift f10 menu",
      ),
    ],
  },
  {
    icon: TextCursorInput,
    title: "Form fields",
    pages: [
      component(
        "input",
        "Input",
        () => import("./pages/components/input"),
        "text field password prefix suffix adornment icon clearable clear",
      ),
      component(
        "textarea",
        "Textarea",
        () => import("./pages/components/textarea"),
        "multiline autosize character counter maxlength",
      ),
      component(
        "number-input",
        "NumberInput",
        () => import("./pages/components/number-input"),
        "number numeric spinbutton stepper currency percent decimal amount quantity",
      ),
      component(
        "select",
        "Select",
        () => import("./pages/components/select"),
        "optgroup option groups dropdown",
      ),
      component(
        "checkbox",
        "Checkbox",
        () => import("./pages/components/checkbox"),
      ),
      component(
        "checkbox-group",
        "CheckboxGroup",
        () => import("./pages/components/checkbox-group"),
        "checkboxes multiple choice fieldset select all",
      ),
      component(
        "switch",
        "Switch",
        () => import("./pages/components/switch"),
        "toggle",
      ),
      component(
        "radio-group",
        "RadioGroup",
        () => import("./pages/components/radio-group"),
        "radio",
      ),
      component(
        "segmented-control",
        "SegmentedControl",
        () => import("./pages/components/segmented-control"),
        "segmented buttons toggle group view switcher period radio",
      ),
      component(
        "autocomplete",
        "Autocomplete",
        () => import("./pages/components/autocomplete"),
        "combobox select search async multiple",
      ),
      component(
        "tags-input",
        "TagsInput",
        () => import("./pages/components/tags-input"),
        "tags chips keywords e-mail recipients multiple values",
      ),
      component(
        "pin-input",
        "PinInput",
        () => import("./pages/components/pin-input"),
        "otp one-time code verification pin",
      ),
      component(
        "slider",
        "Slider",
        () => import("./pages/components/slider"),
        "range slider price filter",
      ),
      component(
        "datetime-picker",
        "DateTimePicker",
        () => import("./pages/components/datetime-picker"),
        "date time calendar picker month week",
      ),
      component(
        "date-range-picker",
        "DateRangePicker",
        () => import("./pages/components/date-range-picker"),
        "date range period from to interval presets report filter calendar",
      ),
      component(
        "file-upload",
        "FileUpload",
        () => import("./pages/components/file-upload"),
        "upload attachment preview thumbnail image",
      ),
      component(
        "rich-text-editor",
        "RichTextEditor",
        () => import("./pages/components/rich-text-editor"),
        "wysiwyg html toolbar heading list table quote undo sanitize",
      ),
      component(
        "field",
        "Field",
        () => import("./pages/components/field"),
        "label description help text custom control third-party FormDescription",
      ),
      component(
        "form-error",
        "FormError",
        () => import("./pages/components/form-error"),
        "validation message",
      ),
    ],
  },
  {
    icon: Table,
    title: "Data display",
    pages: [
      component(
        "data-table",
        "DataTable",
        () => import("./pages/components/data-table"),
        "grid table pagination sorting filters resize columns pin density csv export excel virtualization virtual scrolling inline editing summary totals",
      ),
      component(
        "calendar",
        "Calendar",
        () => import("./pages/components/calendar"),
        "events scheduler agenda list resources rooms booking recurring repeat rrule expandRecurringEvents",
      ),
      component(
        "description-list",
        "DescriptionList",
        () => import("./pages/components/description-list"),
        "detail key value",
      ),
      component(
        "tree-view",
        "TreeView",
        () => import("./pages/components/tree-view"),
        "tree hierarchy nested categories folders files permissions checkbox tri-state indeterminate lazy load expand collapse filter navigation",
      ),
      component(
        "stat",
        "Stat",
        () => import("./pages/components/stat"),
        "kpi metric statistic dashboard number trend",
      ),
      component(
        "chip",
        "Chip",
        () => import("./pages/components/chip"),
        "badge tag filter toggle removable",
      ),
      component(
        "avatar",
        "Avatar",
        () => import("./pages/components/avatar"),
        "AvatarGroup status presence online facepile",
      ),
      component(
        "kbd",
        "Kbd",
        () => import("./pages/components/kbd"),
        "keyboard key shortcut hotkey formatShortcut matchesShortcut",
      ),
      component(
        "progress",
        "Progress",
        () => import("./pages/components/progress"),
        "CircularProgress circular ring indeterminate",
      ),
      component(
        "stepper",
        "Stepper",
        () => import("./pages/components/stepper"),
        "wizard steps vertical progress",
      ),
      component(
        "timeline",
        "Timeline",
        () => import("./pages/components/timeline"),
        "activity audit log history feed events changes",
      ),
      component(
        "spinner",
        "Spinner & Skeleton",
        () => import("./pages/components/spinner"),
        "loading placeholder",
      ),
      component(
        "empty-state",
        "EmptyState",
        () => import("./pages/components/empty-state"),
        "empty no data no results blank slate first run",
      ),
    ],
  },
  {
    icon: MessageSquare,
    title: "Feedback & overlays",
    pages: [
      component("alert", "Alert", () => import("./pages/components/alert")),
      component(
        "toast",
        "Toast & Snackbar",
        () => import("./pages/components/toast"),
        "notification snackbar undo action promise closeSnackbar",
      ),
      component(
        "dialog",
        "Dialog",
        () => import("./pages/components/dialog"),
        "modal",
      ),
      component(
        "sheet",
        "Sheet",
        () => import("./pages/components/sheet"),
        "side panel drawer slide over offcanvas detail edit form",
      ),
      component(
        "confirm-dialog",
        "ConfirmDialog",
        () => import("./pages/components/confirm-dialog"),
        "confirmation modal useConfirm ConfirmProvider promise",
      ),
      component(
        "tooltip",
        "Tooltip",
        () => import("./pages/components/tooltip"),
      ),
      component(
        "popover",
        "Popover",
        () => import("./pages/components/popover"),
      ),
      component(
        "error-boundary",
        "ErrorBoundary",
        () => import("./pages/components/error-boundary"),
        "crash fallback",
      ),
    ],
  },
  {
    icon: LayoutDashboard,
    title: "Layout & navigation",
    pages: [
      component(
        "panel",
        "Panel",
        () => import("./pages/components/panel"),
        "card",
      ),
      component(
        "separator",
        "Separator",
        () => import("./pages/components/separator"),
        "divider hr line rule",
      ),
      component(
        "accordion",
        "Accordion",
        () => import("./pages/components/accordion"),
        "collapsible AccordionGroup expand faq",
      ),
      component(
        "header",
        "Header",
        () => import("./pages/components/header"),
        "page title",
      ),
      component(
        "tabs",
        "Tabs",
        () => import("./pages/components/tabs"),
        "tablist vertical segmented",
      ),
      component(
        "breadcrumbs",
        "Breadcrumbs",
        () => import("./pages/components/breadcrumbs"),
      ),
      component(
        "splitter",
        "Splitter",
        () => import("./pages/components/splitter"),
        "resizable panes split view panels master detail divider resize",
      ),
      component(
        "pagination",
        "Pagination",
        () => import("./pages/components/pagination"),
      ),
      component(
        "app-shell",
        "AppShell, Drawer & Navbar",
        () => import("./pages/components/app-shell"),
        "sidebar layout overlay",
      ),
      component(
        "command-palette",
        "CommandPalette",
        () => import("./pages/components/command-palette"),
        "command menu cmd+k ctrl+k search spotlight quick actions launcher",
      ),
      component(
        "visually-hidden",
        "VisuallyHidden",
        () => import("./pages/components/visually-hidden"),
        "sr-only screen reader skip link accessibility",
      ),
    ],
  },
];

export const allPages = groups.flatMap((group) => group.pages);
