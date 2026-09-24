import { Monitor, Moon, Sun } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  AppShell,
  Autocomplete,
  Button,
  Drawer,
  ErrorBoundary,
  IconButton,
  Navbar,
  removeDiacritics,
  Spinner,
  Tabs,
  Tooltip,
  useColorScheme,
  type ColorScheme,
  type DrawerItem,
  type LoadOptionsParams,
} from "components-ui";
import { allPages, groups } from "../pages";
import TableOfContents from "./table-of-contents";
import { useDocsSettings } from "../lib/settings-context";

const drawerItems: DrawerItem[] = groups.map((group) => ({
  children: group.pages.map((page) => ({ href: page.path, label: page.title })),
  defaultExpanded: true,
  icon: <group.icon size={18} />,
  label: group.title,
}));

const normalize = (text: string) => removeDiacritics(text).toLowerCase();

const searchIndex = allPages.map((page) => ({
  keywords: normalize(page.keywords ?? ""),
  page,
  title: normalize(page.title),
}));

/**
 * The pages whose title or keywords contain every typed word - "modal"
 * finds Dialog by its keywords. Matches in the title come first.
 */
async function searchPages({ search }: LoadOptionsParams) {
  const words = normalize(search).split(/\s+/).filter(Boolean);
  const matches = searchIndex.filter((entry) =>
    words.every(
      (word) => entry.title.includes(word) || entry.keywords.includes(word),
    ),
  );
  const inTitle = (entry: (typeof matches)[number]) =>
    words.every((word) => entry.title.includes(word));

  return [
    ...matches.filter(inTitle),
    ...matches.filter((entry) => !inTitle(entry)),
  ].map((entry) => entry.page);
}

const themes: { icon: typeof Sun; label: string; value: ColorScheme }[] = [
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
  const { localeName, setLocaleName } = useDocsSettings();
  // The library's color scheme - the navbar is always mounted, so the docs
  // follow the system while it is "system"
  const { colorScheme, setColorScheme } = useColorScheme();
  const nextTheme =
    themes[(themes.findIndex((t) => t.value === colorScheme) + 1) % 3];
  const current = themes.find((t) => t.value === colorScheme) ?? themes[2];

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
        onClick={() => setColorScheme(nextTheme.value)}
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
      getOptionLabel={(page) => page.title}
      getOptionValue={(page) => page.path}
      loadOptions={searchPages}
      onChange={(value) => {
        if (typeof value === "string") navigate(value);
      }}
      placeholder="Search the docs…"
      value={null}
    />
  );
}

/**
 * Shown instead of a page that failed - usually its code after a new
 * version of the docs was deployed, whose files have new names.
 */
function PageError({ error, reset }: { error: Error; reset: () => void }) {
  const { pathname } = useLocation();
  const [failedPathname] = useState(pathname);

  // Another page may load fine - try again after navigating
  useEffect(() => {
    if (pathname !== failedPathname) reset();
  }, [failedPathname, pathname, reset]);

  return (
    <div className="py-20 text-center" role="alert">
      <h1 className="mb-2 text-3xl font-bold">This page failed to load</h1>
      <p className="mx-auto mb-6 max-w-md text-neutral-500 dark:text-neutral-400">
        The docs may have been updated since you opened them - reloading brings
        the latest version.
      </p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
      <p className="mt-6 font-mono text-xs wrap-break-word text-neutral-400">
        {error.message}
      </p>
    </div>
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
          <ErrorBoundary
            fallback={(error, reset) => (
              <PageError error={error} reset={reset} />
            )}
          >
            <Suspense
              fallback={
                <Spinner className="mt-24 text-neutral-400" size="lg" />
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
        <TableOfContents pathname={pathname} />
      </div>
    </AppShell>
  );
}
