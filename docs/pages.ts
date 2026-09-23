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
        "colors dark mode tokens",
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
        "server errors formdata react-hook-form",
      ),
      page(
        "/guides/app-layout",
        "App layout",
        () => import("./pages/guides/app-layout"),
        "appshell drawer navbar sidebar",
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
      component("button", "Button", () => import("./pages/components/button")),
      component(
        "icon-button",
        "IconButton",
        () => import("./pages/components/icon-button"),
      ),
      component(
        "dropdown",
        "Dropdown",
        () => import("./pages/components/dropdown"),
        "menu",
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
        "text field password",
      ),
      component(
        "textarea",
        "Textarea",
        () => import("./pages/components/textarea"),
      ),
      component("select", "Select", () => import("./pages/components/select")),
      component(
        "checkbox",
        "Checkbox",
        () => import("./pages/components/checkbox"),
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
        "autocomplete",
        "Autocomplete",
        () => import("./pages/components/autocomplete"),
        "combobox select search async multiple",
      ),
      component(
        "datetime-picker",
        "DateTimePicker",
        () => import("./pages/components/datetime-picker"),
        "date time calendar picker month week",
      ),
      component(
        "file-upload",
        "FileUpload",
        () => import("./pages/components/file-upload"),
        "upload attachment",
      ),
      component(
        "rich-text-editor",
        "RichTextEditor",
        () => import("./pages/components/rich-text-editor"),
        "wysiwyg html",
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
        "grid table pagination sorting filters",
      ),
      component(
        "calendar",
        "Calendar",
        () => import("./pages/components/calendar"),
        "events scheduler",
      ),
      component(
        "description-list",
        "DescriptionList",
        () => import("./pages/components/description-list"),
        "detail key value",
      ),
      component(
        "chip",
        "Chip",
        () => import("./pages/components/chip"),
        "badge tag",
      ),
      component("avatar", "Avatar", () => import("./pages/components/avatar")),
      component(
        "progress",
        "Progress",
        () => import("./pages/components/progress"),
      ),
      component(
        "stepper",
        "Stepper",
        () => import("./pages/components/stepper"),
        "wizard steps",
      ),
      component(
        "spinner",
        "Spinner & Skeleton",
        () => import("./pages/components/spinner"),
        "loading placeholder",
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
        "notification snackbar",
      ),
      component(
        "dialog",
        "Dialog",
        () => import("./pages/components/dialog"),
        "modal",
      ),
      component(
        "confirm-dialog",
        "ConfirmDialog",
        () => import("./pages/components/confirm-dialog"),
        "confirmation modal",
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
        "accordion",
        "Accordion",
        () => import("./pages/components/accordion"),
        "collapsible",
      ),
      component(
        "header",
        "Header",
        () => import("./pages/components/header"),
        "page title",
      ),
      component("tabs", "Tabs", () => import("./pages/components/tabs")),
      component(
        "breadcrumbs",
        "Breadcrumbs",
        () => import("./pages/components/breadcrumbs"),
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
    ],
  },
];

export const allPages = groups.flatMap((group) => group.pages);
