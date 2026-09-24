import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";
import RequestLog from "../../components/request-log";

const layout = `// Once in the app layout - ⌘K / Ctrl+K opens it on every page
export default function Layout({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <AppShell
      drawer={<Drawer items={navigation} />}
      navbar={
        <Navbar
          actions={
            <Button onClick={() => setSearchOpen(true)} variant="ghost">
              Search… <Kbd className="ml-2" shortcut="mod+k" size="sm" />
            </Button>
          }
        />
      }
    >
      {children}
      <CommandPalette
        items={commands}
        loadItems={searchRecords}
        onOpenChange={setSearchOpen}
        open={searchOpen}
      />
    </AppShell>
  );
}`;

export default function CommandPalettePage() {
  return (
    <DocPage
      imports={["CommandPalette", "type CommandPaletteItem"]}
      title="CommandPalette"
    >
      <Example
        description={
          <p>
            Open it with the button or with ⌘K / Ctrl+K and type a part of a
            label - "inv" finds "New invoice" - or a keyword: "client" finds
            "New customer". Items with <code>href</code> open their page through
            the router adapter of <code>UIProvider</code> (see{" "}
            <Link to="/routing">Routing</Link>), items with{" "}
            <code>onSelect</code> run it. The <code>shortcut</code> of an item
            is only shown - register it with <code>useHotkeys</code>, as the
            example does for N and C.
          </p>
        }
        name="command-palette/basic"
        title="Commands and pages"
      />

      <Section title="Searching and the keyboard">
        <Prose>
          <ul>
            <li>
              The search ignores case and diacritics and needs every typed word
              in the label, the <code>description</code> or the{" "}
              <code>keywords</code>. Within a group, labels starting with the
              search come first, then labels with a word starting with it, and
              the group with the best match comes before the others; the matches
              are highlighted.
            </li>
            <li>
              The arrow keys, Home and End move the highlight (past disabled
              items), Enter runs the highlighted item and closes the palette,
              Escape closes it. The first match is always highlighted, so Enter
              picks the best one.
            </li>
            <li>
              The search is a combobox pointing at a listbox of options in named
              groups, so screen readers read the highlighted option and the
              number of results once typing pauses. The focus goes back where it
              was when the palette closes.
            </li>
            <li>
              The opening <code>shortcut</code> (<code>"mod+k"</code> by
              default, <code>null</code> for none) works also in text fields,
              since it has a modifier - a single key like <code>"/"</code> does
              not type into them. It is registered with{" "}
              <Link to="/guides/utilities">useHotkeys</Link>, so it does not
              open the palette over another dialog. See the shortcut syntax on
              the <Link to="/components/kbd">Kbd</Link> page.
            </li>
            <li>
              On phones the palette fills the screen, and the keyboard hints at
              its bottom are left out.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Results from an API">
        <Prose>
          <p>
            <code>loadItems(query, {"{ signal }"})</code> adds items for the
            search - called when the palette opens (with <code>""</code>) and
            again once typing pauses. It shows a loading row meanwhile, and an
            error when it rejects. A newer search aborts the request of an older
            one through <code>signal</code>. Its items are listed after the
            matching <code>items</code>, as they come. An <code>href</code> is
            opened only when it is a link - a relative one, or{" "}
            <code>http:</code>, <code>https:</code>, <code>mailto:</code> or{" "}
            <code>tel:</code>: a <code>javascript:</code> URL in the data of a
            search result would run in the page.
          </p>
        </Prose>
        <Example name="command-palette/async" title="Searching people" />
        <RequestLog filter="/api/people?q=" />
      </Section>

      <Section title="In the app layout">
        <Prose>
          <p>
            Render one palette in the layout of the app, next to the pages, with
            the commands of the whole app and a search of its records.
          </p>
        </Prose>
        <CodeBlock code={layout} />
      </Section>

      <Section title="Props">
        <PropsTable of="CommandPalette" />
        <PropsTable of="CommandPaletteItem" />
      </Section>
    </DocPage>
  );
}
