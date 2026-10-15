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
        "server errors formdata react-hook-form description help text Field custom control layout sections columns labels beside read-only detail edit unsaved changes leave page useUnsavedChanges beforeunload blocker confirmLeave hasUnsavedChanges",
      ),
      page(
        "/guides/app-layout",
        "App layout",
        () => import("./pages/guides/app-layout"),
        "appshell drawer navbar sidebar",
      ),
      page(
        "/guides/printing",
        "Printing",
        () => import("./pages/guides/printing"),
        "print media paper pdf print:hidden print:block page break dark mode beforeprint window.print",
      ),
      page(
        "/guides/utilities",
        "Hooks & utilities",
        () => import("./pages/guides/utilities"),
        "helpers hooks cn class names useIdle idle inactivity useIsMobile useMediaQuery responsive media query useDisclosure open state useHotkeys keyboard shortcuts hotkeys useLocalStorage persist remember useFormatDate useFormatRelativeTime relative time ago useToday inTimeZone useDebouncedValue useDebouncedCallback debounce useClipboard copy clipboard removeDiacritics accents isActivePath useRouter normalizeLoadOptionsResult DEFAULT_PAGE_SIZE uploadWithProgress progress DrawerProvider storageKey",
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
        "icon loading full width disabled reason disabledReason why unavailable permission aria-disabled",
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
        "split dropdown button menu more options save disabledReason",
      ),
      component(
        "toolbar",
        "Toolbar",
        () => import("./pages/components/toolbar"),
        "actions bar overflow more menu priority responsive resize toggle pressed roving tabindex arrow keys",
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
        "icon button tooltip link size disabledReason disabled reason",
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
        "menu submenu checkbox radio shortcut separator typeahead placement align position controlled disabledReason disabled reason permission",
      ),
      component(
        "menubar",
        "Menubar",
        () => import("./pages/components/menubar"),
        "application menu commands navigation",
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
        "text field password prefix suffix adornment icon clearable clear mask masked format pattern phone postal code psč ičo iban card unmask applyMask password strength meter getPasswordStrength readonly validate validation dič rodné číslo birth number bank account czech CZ_MASKS useCzValidators isValidIco parseBirthNumber",
      ),
      component(
        "phone-input",
        "PhoneInput",
        () => import("./pages/components/phone-input"),
        "international telephone country calling code E164",
      ),
      component(
        "textarea",
        "Textarea",
        () => import("./pages/components/textarea"),
        "multiline autosize character counter maxlength readonly",
      ),
      component(
        "mention-input",
        "MentionInput",
        () => import("./pages/components/mention-input"),
        "mention mentions at sign @ hashtag # tag people users colleagues tickets suggestions autocomplete textarea comment parseMentions mentionsToText MentionText renderMentions",
      ),
      component(
        "number-input",
        "NumberInput",
        () => import("./pages/components/number-input"),
        "number numeric spinbutton stepper currency percent decimal amount quantity clearable clear readonly string mode exact money bigint precision",
      ),
      component(
        "duration-input",
        "DurationInput",
        () => import("./pages/components/duration-input"),
        "duration time span hours minutes timesheet work report worklog SLA ISO 8601 PT1H30M spinbutton clearable readonly",
      ),
      component(
        "select",
        "Select",
        () => import("./pages/components/select"),
        "optgroup option groups dropdown readonly read-only rtl right-to-left",
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
        "checkboxes multiple choice fieldset select all cards tiles read-only",
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
        "radio cards tiles plan picker read-only",
      ),
      component(
        "segmented-control",
        "SegmentedControl",
        () => import("./pages/components/segmented-control"),
        "segmented buttons toggle group view switcher period radio vertical",
      ),
      component(
        "autocomplete",
        "Autocomplete",
        () => import("./pages/components/autocomplete"),
        "combobox select search async multiple groups creatable free text custom value virtualized filter highlight select all",
      ),
      component(
        "tags-input",
        "TagsInput",
        () => import("./pages/components/tags-input"),
        "tags chips keywords e-mail recipients multiple values",
      ),
      component(
        "tree-select",
        "TreeSelect",
        () => import("./pages/components/tree-select"),
        "tree select dropdown hierarchy nested categories folders departments cascader combobox checkbox multiple chips lazy load search",
      ),
      component(
        "transfer-list",
        "TransferList",
        () => import("./pages/components/transfer-list"),
        "dual list assignment transfer select members searchable",
      ),
      component(
        "filter-builder",
        "FilterBuilder",
        () => import("./pages/components/filter-builder"),
        "advanced search query builder filter conditions and or groups nested rules operators matchesFilter describeFilter compactFilter json saved filter",
      ),
      component(
        "pin-input",
        "PinInput",
        () => import("./pages/components/pin-input"),
        "otp one-time code verification pin groups separator",
      ),
      component(
        "slider",
        "Slider",
        () => import("./pages/components/slider"),
        "range slider price filter",
      ),
      component(
        "rating",
        "Rating",
        () => import("./pages/components/rating"),
        "stars star rating review score feedback hearts half",
      ),
      component(
        "color-input",
        "ColorInput",
        () => import("./pages/components/color-input"),
        "color picker colour hex rgb hsl alpha opacity swatches palette eyedropper eye dropper",
      ),
      component(
        "datetime-picker",
        "DateTimePicker",
        () => import("./pages/components/datetime-picker"),
        "date time calendar picker month week quarter year fiscal čtvrtletí today disabled days holidays weekends presets",
      ),
      component(
        "date-range-picker",
        "DateRangePicker",
        () => import("./pages/components/date-range-picker"),
        "date range period from to interval presets report filter calendar time zone timezone disable past future",
      ),
      component(
        "date-calendar",
        "DateCalendar",
        () => import("./pages/components/date-calendar"),
        "inline calendar date day picker always visible multiple dates booking appointment disabled days",
      ),
      component(
        "range-calendar",
        "RangeCalendar",
        () => import("./pages/components/range-calendar"),
        "inline calendar date range period from to booking stay nights check-in check-out disabled days",
      ),
      component(
        "file-upload",
        "FileUpload",
        () => import("./pages/components/file-upload"),
        "upload attachment preview thumbnail image dropzone drag drop paste screenshot clipboard folder directory progress retry parallel file input formdata",
      ),
      component(
        "rich-text-editor",
        "RichTextEditor",
        () => import("./pages/components/rich-text-editor"),
        "wysiwyg html toolbar heading list table quote undo sanitize image upload markdown code block character count maxlength read-only",
      ),
      component(
        "repeatable-field",
        "RepeatableField",
        () => import("./pages/components/repeatable-field"),
        "repeat fields groups add remove reorder array contacts",
      ),
      component(
        "field",
        "Field",
        () => import("./pages/components/field"),
        "label description help text custom control third-party FormDescription required asterisk star RequiredMark optional",
      ),
      component(
        "form-error",
        "FormError",
        () => import("./pages/components/form-error"),
        "validation message",
      ),
      component(
        "form-section",
        "FormSection",
        () => import("./pages/components/form-section"),
        "fieldset group section heading legend title columns layout read-only readonly detail edit labels beside disabled",
      ),
      component(
        "form-grid",
        "FormGrid",
        () => import("./pages/components/form-grid"),
        "grid columns layout responsive span FormGridItem labels beside left horizontal label position width read-only readonly",
      ),
      component(
        "form-actions",
        "FormActions",
        () => import("./pages/components/form-actions"),
        "buttons save cancel submit sticky footer bar toolbar unsaved changes status dirty",
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
        "grid table pagination sorting filters resize columns pin density csv export excel virtualization virtual scrolling inline editing summary totals multi sort range filter multiselect row selection row link row click column groups grouped rows group by column state saved views presets filter chips active filters boolean yes no context menu right click copy clipboard tsv print load error retry cell class tree data treegrid hierarchy sub rows subrows nested rows lazy loading chart of accounts bill of materials bom org structure",
      ),
      component(
        "calendar",
        "Calendar",
        () => import("./pages/components/calendar"),
        "events scheduler agenda list resources rooms booking recurring repeat rrule expandRecurringEvents timeline resource timeline gantt drag drop move keyboard slot duration business hours working hours work week hidden days weekend now indicator current time renderEvent custom event",
      ),
      component(
        "description-list",
        "DescriptionList",
        () => import("./pages/components/description-list"),
        "detail key value columns bordered",
      ),
      component(
        "list",
        "List",
        () => import("./pages/components/list"),
        "list item row menu navigation chevron icon avatar link button divided framed",
      ),
      component(
        "virtual-list",
        "VirtualList",
        () => import("./pages/components/virtual-list"),
        "virtual scrolling windowing infinite scroll load more large list thousands chat feed useVirtualList scrollToIndex",
      ),
      component(
        "table",
        "Table",
        () => import("./pages/components/table"),
        "static table caption striped zebra hover bordered density sticky header TableHead TableBody TableFoot TableRow TableCell",
      ),
      component(
        "tree-view",
        "TreeView",
        () => import("./pages/components/tree-view"),
        "tree hierarchy nested categories folders files permissions checkbox tri-state indeterminate independent lazy load expand collapse filter navigation drag drop move reorder sortable virtualized virtual large",
      ),
      component(
        "kanban-board",
        "KanbanBoard",
        () => import("./pages/components/kanban-board"),
        "kanban board columns cards pipeline deals crm sales stages tickets support workflow drag drop move reorder sortable wip limit swimlanes trello",
      ),
      component(
        "stat",
        "Stat",
        () => import("./pages/components/stat"),
        "kpi metric statistic dashboard number trend sparkline",
      ),
      component(
        "sparkline",
        "Sparkline",
        () => import("./pages/components/sparkline"),
        "chart mini chart trend line area series",
      ),
      component(
        "chart",
        "Chart",
        () => import("./pages/components/chart"),
        "line area bar chart axes legend tooltip series data table graph",
      ),
      component(
        "chip",
        "Chip",
        () => import("./pages/components/chip"),
        "badge tag filter toggle removable",
      ),
      component(
        "badge",
        "Badge",
        () => import("./pages/components/badge"),
        "count counter notification dot unread indicator bell",
      ),
      component(
        "avatar",
        "Avatar",
        () => import("./pages/components/avatar"),
        "AvatarGroup status presence online facepile square color initials",
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
        "wizard steps vertical progress optional",
      ),
      component(
        "timeline",
        "Timeline",
        () => import("./pages/components/timeline"),
        "activity audit log history feed events changes",
      ),
      component(
        "change-history",
        "ChangeHistory",
        () => import("./pages/components/change-history"),
        "audit trail history log changes diff versions who changed what timeline activity",
      ),
      component(
        "comment-thread",
        "CommentThread",
        () => import("./pages/components/comment-thread"),
        "comments discussion conversation thread replies notes mentions chat activity feed edit delete relative time",
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
      component(
        "alert",
        "Alert",
        () => import("./pages/components/alert"),
        "banner message dismissible close actions",
      ),
      component(
        "system-banner",
        "SystemBanner",
        () => import("./pages/components/system-banner"),
        "banner announcement outage maintenance test environment impersonation signed in as global message dismissible app shell",
      ),
      component(
        "loading-overlay",
        "LoadingOverlay",
        () => import("./pages/components/loading-overlay"),
        "loading overlay spinner busy blocking inert reload",
      ),
      component(
        "toast",
        "Toast & Snackbar",
        () => import("./pages/components/toast"),
        "notification snackbar undo action promise closeSnackbar updateSnackbar position bottom swipe",
      ),
      component(
        "dialog",
        "Dialog",
        () => import("./pages/components/dialog"),
        "modal full screen mobile backdrop escape",
      ),
      component(
        "form-dialog",
        "FormDialog",
        () => import("./pages/components/form-dialog"),
        "form modal edit dialog unsaved changes discard dirty save cancel onBeforeClose",
      ),
      component(
        "image-viewer",
        "ImageViewer",
        () => import("./pages/components/image-viewer"),
        "lightbox gallery photo image zoom thumbnails modal",
      ),
      component(
        "sheet",
        "Sheet",
        () => import("./pages/components/sheet"),
        "side panel drawer slide over offcanvas detail edit form bottom sheet swipe",
      ),
      component(
        "confirm-dialog",
        "ConfirmDialog",
        () => import("./pages/components/confirm-dialog"),
        "confirmation modal useConfirm ConfirmProvider promise alert useAlert type to confirm prompt usePrompt PromptDialog input text reason name validate",
      ),
      component(
        "session-timeout",
        "SessionTimeout & useIdle",
        () => import("./pages/components/session-timeout"),
        "session timeout idle inactivity auto logout sign out expire expiry token refresh stay signed in countdown warning useIdle away presence broadcastchannel tabs sleep",
      ),
      component(
        "tooltip",
        "Tooltip",
        () => import("./pages/components/tooltip"),
        "hint delay group controlled",
      ),
      component(
        "popover",
        "Popover",
        () => import("./pages/components/popover"),
        "floating panel arrow anchor selection toolbar placement align offset",
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
        "card",
        "Card",
        () => import("./pages/components/card"),
        "card clickable link header footer actions media tile stretched link",
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
        "collapsible AccordionGroup expand faq disabled keepMounted",
      ),
      component(
        "header",
        "Header",
        () => import("./pages/components/header"),
        "page title breadcrumbs path details",
      ),
      component(
        "tabs",
        "Tabs",
        () => import("./pages/components/tabs"),
        "tablist vertical tabpanel panels closable overflow more menu",
      ),
      component(
        "breadcrumbs",
        "Breadcrumbs",
        () => import("./pages/components/breadcrumbs"),
        "path collapse separator",
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
        "pages page numbers page size jump",
      ),
      component(
        "app-shell",
        "AppShell, Drawer & Navbar",
        () => import("./pages/components/app-shell"),
        "sidebar layout overlay banner print",
      ),
      component(
        "notification-center",
        "NotificationCenter",
        () => import("./pages/components/notification-center"),
        "notifications bell inbox unread badge mark as read mark all infinite load more realtime activity feed alerts",
      ),
      component(
        "keyboard-shortcuts-dialog",
        "KeyboardShortcutsDialog",
        () => import("./pages/components/keyboard-shortcuts-dialog"),
        "keyboard shortcuts help hotkeys cheat sheet question mark ? useHotkeys description group",
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
