import { Monitor, Moon, Sun } from "lucide-react";
import { Suspense, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  AppShell,
  Autocomplete,
  Drawer,
  IconButton,
  Navbar,
  Spinner,
  Tabs,
  Tooltip,
  type DrawerItem,
} from "components-ui";
import { allPages, groups } from "../pages";
import TableOfContents from "./table-of-contents";
import { useDocsSettings, type Theme } from "../lib/settings-context";

const drawerItems: DrawerItem[] = groups.map((group) => ({
  children: group.pages.map((page) => ({ href: page.path, label: page.title })),
  defaultExpanded: true,
  icon: <group.icon size={18} />,
  label: group.title,
}));

const searchOptions = allPages.map((page) => ({
  label: page.title,
  value: page.path,
}));

const themes: { icon: typeof Sun; label: string; value: Theme }[] = [
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" },
  { icon: Monitor, label: "System", value: "system" },
];

function Logo() {
  return (
    <Link className="flex items-center gap-2" to="/">
      <img alt="" className="h-7 w-7" src="./favicon.svg" />
      <span className="text-lg font-semibold tracking-tight">
        components-ui
      </span>
    </Link>
  );
}

function Settings() {
  const { localeName, setLocaleName, setTheme, theme } = useDocsSettings();
  const nextTheme =
    themes[(themes.findIndex((t) => t.value === theme) + 1) % 3];
  const current = themes.find((t) => t.value === theme) ?? themes[2];

  return (
    <div className="flex items-center gap-3">
      <Tooltip
        position="bottom"
        title="Language of the components in the examples"
      >
        <Tabs
          aria-label="Component language"
          items={[
            { label: "EN", value: "en" },
            { label: "CS", value: "cs" },
          ]}
          onChange={(value) => setLocaleName(value as "en" | "cs")}
          size="sm"
          value={localeName}
        />
      </Tooltip>
      <IconButton
        aria-label={`Theme: ${current.label} - switch to ${nextTheme.label}`}
        onClick={() => setTheme(nextTheme.value)}
        title={`Theme: ${current.label}`}
      >
        <current.icon size={18} />
      </IconButton>
    </div>
  );
}

function PageSearch() {
  const navigate = useNavigate();

  return (
    <Autocomplete
      aria-label="Search the docs"
      className="w-40 sm:w-64"
      onChange={(value) => {
        if (typeof value === "string") navigate(value);
      }}
      options={searchOptions}
      placeholder="Search the docs…"
      value={null}
    />
  );
}

/** The docs themselves are built with the library's AppShell, Drawer and Navbar. */
export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <AppShell
      drawer={<Drawer header={<Logo />} items={drawerItems} />}
      navbar={
        <Navbar actions={<Settings />}>
          <PageSearch />
        </Navbar>
      }
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-8 xl:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="min-w-0" id="docs-content">
          <Suspense
            fallback={<Spinner className="mt-24 text-neutral-400" size="lg" />}
          >
            <Outlet />
          </Suspense>
        </div>
        <TableOfContents pathname={pathname} />
      </div>
    </AppShell>
  );
}
