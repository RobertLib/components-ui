import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE_OPTIONS } from "components-ui";
import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const classNames = `import { cn, joinTokens } from "components-ui";

cn("px-2", isActive && "bg-primary-500", { "opacity-50": isDisabled });
// active and enabled: "px-2 bg-primary-500" - falsy values are skipped

cn("rounded-md px-3 py-1", className); // className "p-0 rounded-full":
// "p-0 rounded-full" - the later of two conflicting classes stays

cn(undefined, false); // undefined - className={cn(…)} renders no attribute

joinTokens(errorId, descriptionId); // "email-error email-hint" - ids, kept as they are`;

const isMobile = `import { useIsMobile, useMediaQuery } from "components-ui";

function Filters() {
  const isMobile = useIsMobile(); // below Tailwind's md breakpoint (768px)
  return isMobile ? <FilterDialog /> : <FilterSidebar />;
}

// A server-rendered page for phones first: phones do not switch after hydration
const isDesktop = useMediaQuery("(min-width: 1024px)", { serverValue: false });`;

const checkedLocalStorage = `// Only a list of column ids counts - anything else is the default
const [columns, setColumns] = useLocalStorage<string[]>("orders-columns", [], {
  deserialize: (text) => {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value) || !value.every((id) => typeof id === "string")) {
      throw new Error("No list of column ids");
    }
    return value;
  },
});`;

const hotkeysSyntax = `useHotkeys([
  ["mod+k", openSearch, { allowInFields: true }], // ⌘K / Ctrl+K, also while typing
  ["?", showHelp],                                // not while typing into a field
  ["escape", closePanel],                         // after an open menu or popover
], { enabled: !saving });`;

const ariaShortcuts = `import { formatShortcut, toAriaKeyShortcuts, useIsApplePlatform } from "components-ui";

// The shortcut of a button, also for screen readers - "Meta+S" on a Mac. The
// hook says no on the server and while the page hydrates, so both write the
// same, then the browser corrects it.
const isApple = useIsApplePlatform();
<Button aria-keyshortcuts={toAriaKeyShortcuts("mod+s", isApple)} onClick={save}>
  Save <Kbd shortcut="mod+s" />
</Button>
<Tooltip title={\`Save (\${formatShortcut("mod+s", isApple)})\`}>…</Tooltip>`;

const hydrated = `import { useIsHydrated } from "components-ui";

// A relative time only in the browser - the server's clock and time zone differ
const isHydrated = useIsHydrated();
<span>{isHydrated ? formatRelative(date) : formatDate(date)}</span>`;

const activeLink = `import { findActiveLink, useRouter } from "components-ui";

// The item of a navigation of your own that is the current page - the most
// specific: "/users/new" over "/users" on /users/new
const { pathname, search } = useRouter();
const active = findActiveLink(items, (item) => item.href, pathname, search);`;

const diacritics = `import { removeDiacritics } from "components-ui";

removeDiacritics("Žluťoučký kůň"); // "Zlutoucky kun"

// Matching the way Autocomplete and DataTable search do
const normalize = (text: string) => removeDiacritics(text).toLowerCase();
const matches = cities.filter((city) => normalize(city).includes(normalize(term)));`;

const router = `import { isActivePath, useRouter } from "components-ui";

// A link of your own that follows the router adapter, like the library's do
function NavLink({ href, label }: { href: string; label: string }) {
  const { Link, pathname } = useRouter();
  const active = isActivePath(pathname, href);

  return (
    <Link aria-current={active ? "page" : undefined} href={href}>
      {label}
    </Link>
  );
}

isActivePath("/users/42", "/users");               // true - a sub-page
isActivePath("/users-archive", "/users");          // false
isActivePath("/users", "/");                       // false - "/" matches only itself
isActivePath("/nastaven%C3%AD/", "/nastavení");    // true - encoding, a trailing slash
isActivePath("/projects/42/settings", "settings"); // true - a relative path`;

const loadOptions = `import { normalizeLoadOptionsResult } from "components-ui";

// The shapes loadOptions may return, as Autocomplete reads them
normalizeLoadOptionsResult([a, b]);
// { items: [a, b], hasMore: false, nextCursor: null }
normalizeLoadOptionsResult({ items: [a, b], total: 5 }, 2);
// { items: [a, b], hasMore: true, nextCursor: null } - 2 before + 2 of 5
normalizeLoadOptionsResult({ nodes: [a], pageInfo: { endCursor: "c1", hasNextPage: true } });
// { items: [a], hasMore: true, nextCursor: "c1" }`;

const pageSizes = `import { DEFAULT_PAGE_SIZE_OPTIONS, useDataTableQuery } from "components-ui";

// Offer larger pages - the URL may then ask for them too
const pageSizeOptions = [...DEFAULT_PAGE_SIZE_OPTIONS, 500];
const [query, setQuery] = useDataTableQuery({
  defaults: { pageSize: 50 },
  pageSizeOptions,
  syncWithUrl: true,
});
// <DataTable pageSizeOptions={pageSizeOptions} query={query} … />`;

const upload = `import { uploadWithProgress } from "components-ui";

// Resolves with the response body, rejects on an error status or an abort
const responseText = await uploadWithProgress("/api/files", formData, {
  method: "POST",
  onProgress: (percent) => setProgress(percent),
  signal: controller.signal,
});`;

const drawer = `// A layout of your own - the navbar and main follow the drawer as siblings
<DrawerProvider storageKey="admin-drawer">
  <Drawer items={items} />
  <Navbar />
  <main>{children}</main>
</DrawerProvider>`;

export default function UtilitiesGuide() {
  return (
    <DocPage
      description="The helpers the components are built with are exported too - for your own components that should behave the same way."
      title="Hooks & utilities"
    >
      <Section title="Class names">
        <Prose>
          <p>
            <code>cn(...values)</code> joins class names: strings, numbers,
            arrays and objects whose keys are included when their value is
            truthy. Of two Tailwind classes that set the same property - under
            the same variants - the later one stays, so a <code>className</code>{" "}
            passed last overrides the defaults before it. It merges only classes
            it is sure about: a custom class, a plugin's class or a value it
            does not know is always kept (see <Link to="/theming">Theming</Link>
            ). For lists that are not classes - the ids of{" "}
            <code>aria-describedby</code>, the values of <code>rel</code> - use{" "}
            <code>joinTokens</code>, which keeps every one.
          </p>
        </Prose>
        <CodeBlock code={classNames} />
      </Section>

      <Section title="Media queries">
        <Prose>
          <p>
            <code>useMediaQuery(query)</code> tells whether a CSS media query
            matches and follows its changes; <code>useIsMobile()</code> is the
            query for a viewport narrower than Tailwind's <code>md</code>{" "}
            breakpoint. Both read the query on the first render in the browser,
            so a phone never flashes the desktop layout. The server cannot know
            the screen - it renders <code>serverValue</code> (<code>false</code>{" "}
            by default), and the page switches to the real value right after it
            hydrates.
          </p>
        </Prose>
        <Example name="utilities/media-query" />
        <CodeBlock code={isMobile} />
        <PropsTable of="UseMediaQueryOptions" />
        <Prose>
          <p>
            <code>useIsHydrated()</code> is <code>false</code> on the server and
            while a server-rendered page hydrates, <code>true</code> right after
            - and from the first render of a page rendered in the browser only.
            It lets a component render what only the browser knows without a
            hydration mismatch.
          </p>
        </Prose>
        <CodeBlock code={hydrated} />
      </Section>

      <Section title="Open state">
        <Prose>
          <p>
            <code>useDisclosure(initialOpen)</code> holds whether a dialog, a
            popover or a panel is open, with helpers named after the props they
            fit: <code>open</code>, <code>onClose</code> for a{" "}
            <code>Dialog</code>, <code>onOpenChange</code> for a{" "}
            <code>Popover</code>, <code>onOpen</code> and <code>onToggle</code>{" "}
            for the buttons.
          </p>
        </Prose>
        <Example name="utilities/disclosure" />
        <PropsTable of="UseDisclosureResult" title="useDisclosure result" />
      </Section>

      <Section title="Keyboard shortcuts">
        <Prose>
          <p>
            <code>useHotkeys(hotkeys, options)</code> registers shortcuts while
            the component is mounted, written in the shortcut syntax of the{" "}
            <Link to="/components/kbd">Kbd</Link> page - <code>mod</code> is ⌘
            on a Mac and Ctrl elsewhere. Show them with <code>Kbd</code>.
          </p>
          <ul>
            <li>
              Keys typed into a text field, a select or a{" "}
              <code>contentEditable</code> element do not count - unless the
              shortcut has <code>allowInFields</code>, which suits shortcuts
              with Ctrl / ⌘.
            </li>
            <li>
              The default action of the browser is prevented (⌘S would save the
              page) - <code>preventDefault: false</code> keeps it. A key press
              the page has already prevented does not count, and one press runs
              one shortcut, the first that matches.
            </li>
            <li>
              The shortcuts of the page do not work while a modal dialog is open
              - those of a component inside the dialog do.
            </li>
            <li>
              An <code>escape</code> shortcut waits while a popover, a menu or a
              tooltip it is not inside is open: that Escape closes the overlay,
              the next one runs the shortcut - one Escape does one thing.
            </li>
          </ul>
        </Prose>
        <Example name="utilities/hotkeys" />
        <CodeBlock code={hotkeysSyntax} />
        <Prose>
          <p>
            <code>toAriaKeyShortcuts(shortcut, isApple)</code> writes a shortcut
            as the value of <code>aria-keyshortcuts</code>, which tells screen
            readers the shortcut of a button, and{" "}
            <code>formatShortcut(shortcut, isApple)</code> as text.{" "}
            <code>useIsApplePlatform()</code> gives them the platform - the same
            on the server and while the page hydrates.
          </p>
        </Prose>
        <CodeBlock code={ariaShortcuts} />
        <PropsTable of="HotkeyOptions" title="Options of a shortcut" />
        <PropsTable of="UseHotkeysOptions" title="useHotkeys options" />
      </Section>

      <Section title="Remembered values">
        <Prose>
          <p>
            <code>useLocalStorage(key, defaultValue, options)</code> is{" "}
            <code>useState</code> remembered in <code>localStorage</code>:{" "}
            <code>[value, setValue, remove]</code>. The value is stored as JSON
            (or with your <code>serialize</code> / <code>deserialize</code>),
            and the hooks with the same key share it - also across the browser
            tabs of the app. <code>defaultValue</code> stands in while nothing
            is stored, and also for a stored text that cannot be read (data of
            an older version of the app). Readable JSON of another shape -{" "}
            <code>null</code>, an object where the app wants a list - comes back
            as it is; to be sure of the shape, check it in a{" "}
            <code>deserialize</code> that throws when it does not fit.
          </p>
        </Prose>
        <CodeBlock code={checkedLocalStorage} />
        <Example name="utilities/local-storage" />
        <Callout>
          <p>
            The server has no <code>localStorage</code>: it renders{" "}
            <code>defaultValue</code>, and so does the browser while the page
            hydrates - then it switches to the stored value. Where the storage
            is blocked or full (private mode), the value still changes until the
            page is reloaded.
          </p>
        </Callout>
        <PropsTable
          of="UseLocalStorageOptions"
          title="useLocalStorage options"
        />
      </Section>

      <Section title="Debouncing">
        <Prose>
          <p>
            <code>useDebouncedValue(value, delay)</code> returns{" "}
            <code>value</code> once it has not changed for <code>delay</code>{" "}
            milliseconds (300 by default) - load results for a search once the
            user pauses typing.
          </p>
        </Prose>
        <Example name="utilities/debounced-value" />
        <Prose>
          <p>
            <code>useDebouncedCallback(callback, delay, options)</code> returns
            a function that calls <code>callback</code> with the arguments of
            its last call once the calls stop - the same function on every
            render, calling the <code>callback</code> of the latest render. Its{" "}
            <code>flush()</code> makes the pending call right away,{" "}
            <code>cancel()</code> drops it. A call pending on unmount is
            dropped, or made with <code>flushOnUnmount</code>.
          </p>
        </Prose>
        <Example name="utilities/debounced-callback" />
      </Section>

      <Section title="Copying to the clipboard">
        <Prose>
          <p>
            <code>useClipboard(options)</code> returns <code>copy(text)</code>,
            and <code>copied</code> that is <code>true</code> for{" "}
            <code>timeout</code> milliseconds after a copy - or the{" "}
            <code>error</code> of a failed one. <code>copy</code> resolves with
            whether it worked and never rejects; call it right in a click or key
            handler, browsers allow writing to the clipboard only then. On plain{" "}
            <code>http://</code> pages it copies the old way.{" "}
            <Link to="/components/copy-button">CopyButton</Link> is built with
            it.
          </p>
        </Prose>
        <Example name="utilities/clipboard" />
        <PropsTable of="UseClipboardResult" title="useClipboard result" />
      </Section>

      <Section title="Search without diacritics">
        <Prose>
          <p>
            <code>removeDiacritics(text)</code> strips accents, so "cilovy"
            finds "Cílový" - the static <code>Autocomplete</code> and the{" "}
            <code>DataTable</code> search match this way.
          </p>
        </Prose>
        <CodeBlock code={diacritics} />
      </Section>

      <Section title="Links and the current page">
        <Prose>
          <p>
            <code>useRouter()</code> returns the router adapter of the nearest{" "}
            <code>UIProvider</code> with the defaults filled in (see{" "}
            <Link to="/routing">Routing</Link>).{" "}
            <code>isActivePath(pathname, href)</code> is the rule{" "}
            <code>Drawer</code>, <code>Tabs</code> and <code>TreeView</code>{" "}
            mark the active item by: the page itself or one of its sub-pages,
            ignoring the query and the hash of <code>href</code>. A relative
            path is resolved against <code>pathname</code> as the browser
            resolves it, percent-encoding and a trailing slash make no
            difference, and a link of just a query or an anchor, or an address
            with a scheme or a host (<code>https://…</code>,{" "}
            <code>mailto:</code>), is never active. It uses no React, so a
            server component can call it too.
          </p>
          <p>
            <code>findActiveLink(items, getHref, pathname, search)</code> picks
            the item of the current page of several, as those components do: the
            one with the longest path, then the one whose query parameters the
            page has - the most of them.
          </p>
        </Prose>
        <CodeBlock code={router} />
        <CodeBlock className="mt-4" code={activeLink} />
      </Section>

      <Section title="Results of loadOptions">
        <Prose>
          <p>
            <code>normalizeLoadOptionsResult(result, offset)</code> brings any
            result of <code>loadOptions</code> - an array, a page or a Relay
            connection - to <code>{"{ items, hasMore, nextCursor }"}</code>,
            exactly as <code>Autocomplete</code> reads it. <code>offset</code>{" "}
            is the number of items loaded before the page; with{" "}
            <code>total</code> it decides whether more follow. Handy for testing
            a <code>loadOptions</code> function or reusing it elsewhere (see{" "}
            <Link to="/guides/data-fetching">REST &amp; GraphQL</Link>).
          </p>
        </Prose>
        <CodeBlock code={loadOptions} />
      </Section>

      <Section title="Page sizes of DataTable">
        <Prose>
          <p>
            <code>DEFAULT_PAGE_SIZE</code> ({DEFAULT_PAGE_SIZE}) is the page
            size of a new query and <code>DEFAULT_PAGE_SIZE_OPTIONS</code> (
            {DEFAULT_PAGE_SIZE_OPTIONS.join(", ")}) the choices of the "rows per
            page" select - and the page sizes a URL may ask for with{" "}
            <code>syncWithUrl</code>. Extend them rather than repeat them:
          </p>
        </Prose>
        <CodeBlock code={pageSizes} />
      </Section>

      <Section title="Uploads with progress">
        <Prose>
          <p>
            <code>uploadWithProgress(url, body, options)</code> sends a file (or{" "}
            <code>FormData</code>) with <code>XMLHttpRequest</code>, which -
            unlike <code>fetch</code> - reports the upload progress. It fits the{" "}
            <code>upload</code> function of{" "}
            <Link to="/components/file-upload">FileUpload</Link>, which shows
            both a presigned-URL and a form upload.
          </p>
        </Prose>
        <CodeBlock code={upload} />
        <PropsTable
          of="UploadWithProgressOptions"
          title="uploadWithProgress options"
        />
      </Section>

      <Section title="Drawer state">
        <Prose>
          <p>
            <code>DrawerProvider</code> holds the open / collapsed state that{" "}
            <code>Drawer</code> and <code>Navbar</code> share, and remembers the
            collapsed state in <code>localStorage</code> under{" "}
            <code>storageKey</code> - give each drawer of an app its own key, or{" "}
            <code>null</code> to remember nothing. <code>AppShell</code> renders
            one itself and passes its <code>drawerStorageKey</code> on. Read and
            toggle the state with <code>useDrawer()</code> - see{" "}
            <Link to="/components/app-shell">AppShell</Link>.
          </p>
        </Prose>
        <CodeBlock code={drawer} />
        <PropsTable of="DrawerProvider" />
      </Section>

      <Section title="Documented elsewhere">
        <Prose>
          <ul>
            <li>
              <code>formatMessage</code>, <code>formatPlural</code>,{" "}
              <code>createLocale</code>, <code>useLocale</code> and{" "}
              <code>useMessages</code> -{" "}
              <Link to="/localization">Localization</Link>
            </li>
            <li>
              <code>getFieldError</code>, <code>getBaseError</code> and{" "}
              <code>getNestedErrors</code> -{" "}
              <Link to="/guides/forms">Forms &amp; validation</Link>
            </li>
            <li>
              <code>useDataTableQuery</code>, <code>toOffsetParams</code>,{" "}
              <code>toRelayVariables</code> and the other query helpers,{" "}
              <code>createCsv</code>, <code>downloadCsv</code> and{" "}
              <code>getCsvSeparator</code> -{" "}
              <Link to="/components/data-table">DataTable</Link>
            </li>
            <li>
              <code>getCalendarVisibleRange</code> and{" "}
              <code>expandRecurringEvents</code> -{" "}
              <Link to="/components/calendar">Calendar</Link>
            </li>
            <li>
              <code>sanitizeRichText</code> and <code>isSafeHref</code> -{" "}
              <Link to="/components/rich-text-editor">RichTextEditor</Link>
            </li>
            <li>
              <code>useSnackbar</code> -{" "}
              <Link to="/components/toast">Toast &amp; Snackbar</Link>
            </li>
            <li>
              <code>useConfirm</code> and <code>ConfirmProvider</code> -{" "}
              <Link to="/components/confirm-dialog">ConfirmDialog</Link>
            </li>
            <li>
              <code>useColorScheme</code> and <code>getColorSchemeScript</code>{" "}
              - <Link to="/theming">Theming</Link>
            </li>
            <li>
              <code>formatShortcut</code>, <code>matchesShortcut</code> and{" "}
              <code>parseShortcut</code> - <Link to="/components/kbd">Kbd</Link>
            </li>
          </ul>
        </Prose>
      </Section>
    </DocPage>
  );
}
