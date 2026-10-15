import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";

const darkVariant = `/* Dark mode by a class - on screen only: a page in the dark scheme
   prints light, as paper is */
@custom-variant dark {
  @media screen {
    &:where(.dark, .dark *) {
      @slot;
    }
  }
}

/* Or by the system setting - on screen only */
@custom-variant dark (@media screen and (prefers-color-scheme: dark));`;

const utilities = `{/* Not on paper - your own commands, a filter panel */}
<div className="flex gap-2 print:hidden">…</div>

{/* Only on paper - the logo and address of the company in the letterhead */}
<div className="hidden print:block">Novák Stavby s.r.o., Brno</div>

{/* Each record on a page of its own */}
<section className="break-before-page">…</section>

{/* Keep a Toolbar on paper - the library's rule hides it */}
<Toolbar className="print:flex!" items={items} />`;

const pageRule = `/* Your stylesheet - the margins of the paper and color printing */
@page {
  margin: 15mm;
}

@media print {
  /* Backgrounds (striped rows, badges) as on screen - browsers leave them
     out unless the user asks for them */
  body {
    print-color-adjust: exact;
  }
}`;

const expandAll = `// Closed sections are not in the page - open them all before printing
const [expanded, setExpanded] = useState<string[]>([]);

useEffect(() => {
  // flushSync - the page is printed right after the event, not later
  const openAll = () => flushSync(() => setExpanded(sectionIds));
  window.addEventListener("beforeprint", openAll);
  return () => window.removeEventListener("beforeprint", openAll);
}, []);`;

export default function Printing() {
  return (
    <DocPage
      description="Pages of the app print their content: the frame, the popups and the buttons stay on screen, tables are printed whole."
      title="Printing"
    >
      <Section title="What the components do">
        <Prose>
          <ul>
            <li>
              The frame of the app - the <code>Drawer</code>, the{" "}
              <code>SystemBanner</code>s and the <code>Navbar</code> of{" "}
              <Link to="/components/app-shell">AppShell</Link> - is left out,
              and the content takes the whole width of the paper.
            </li>
            <li>
              Toasts, tooltips, open menus and popovers, the backdrops of the
              overlays, every <code>Toolbar</code> and the buttons of{" "}
              <Link to="/components/form-actions">FormActions</Link> are left
              out, so are the back arrow and the actions of a{" "}
              <code>Header</code> - its path and its title stay.
            </li>
            <li>
              A <Link to="/components/data-table">DataTable</Link> prints its
              rows without its toolbar, filters, filter chips, pagination,
              selection checkboxes and row actions. A virtualized one renders
              all the rows it has for the print, and a table shown on the whole
              screen is printed alone.
            </li>
            <li>
              A <Link to="/components/table">Table</Link> does not scroll on
              paper: all its rows are printed, also those under a{" "}
              <code>maxHeight</code>; the header rows repeat on every page, a
              row is not split between two pages, and the footer (the totals) is
              printed once, at the end. A sticky header is a plain one.
            </li>
            <li>
              With a modal <code>Dialog</code> or <code>Sheet</code> open, it is
              printed alone - in the flow of the page, as long as its content,
              without the page behind it, its close button and its{" "}
              <code>DialogFooter</code>. A "Print" button in the dialog prints
              the dialog.
            </li>
            <li>
              <Link to="/components/tabs">Tabs</Link> print the active tab with
              its panel - the bar shows that tab alone, not scrolled.
            </li>
            <li>
              An <code>Accordion</code> and <code>CollapsibleContent</code> are
              printed as they are shown: closed sections are not in the page (or
              are hidden with <code>keepMounted</code>), so only their headers
              are printed. Open them before printing when all of the content
              matters - see below.
            </li>
          </ul>
        </Prose>
        <Example
          description={
            <p>
              Open the invoice and press Print - the preview shows the dialog
              alone, with every item of its table.
            </p>
          }
          name="printing/dialog"
          title="Printing a dialog"
        />
      </Section>

      <Section title="Dark mode">
        <Prose>
          <p>
            Paper is white: a page in the dark scheme should print light, or its
            light text is lost. The stylesheet sets the{" "}
            <code>color-scheme</code> of the page to light for printing - the
            parts the browser draws itself. The <code>dark:</code> classes of
            the components and of your app follow the <code>dark</code> variant
            of your Tailwind build: define it for the screen only.
          </p>
        </Prose>
        <CodeBlock code={darkVariant} />
        <Callout>
          <p>
            The variant is yours to define - the library's stylesheet does not
            change it. See <Link to="/theming">Theming</Link> for the dark mode
            and <code>useColorScheme</code>.
          </p>
        </Callout>
      </Section>

      <Section title="Your own print styles">
        <Prose>
          <p>
            Tailwind's <code>print:</code> variant styles the printed page:{" "}
            <code>print:hidden</code> leaves an element out,{" "}
            <code>hidden print:block</code> shows one only on paper, and{" "}
            <code>break-before-page</code> / <code>break-inside-avoid</code>{" "}
            decide where the pages break. The rules of the library are not in a
            layer, so a class of yours overrides one of them with the important
            modifier (<code>print:flex!</code>).
          </p>
        </Prose>
        <CodeBlock code={utilities} />
        <Prose>
          <p>
            Browsers leave the backgrounds out by default (stripes, the fills of
            badges and chips) - set <code>print-color-adjust: exact</code> to
            keep them, and the margins of the paper with <code>@page</code>:
          </p>
        </Prose>
        <CodeBlock code={pageRule} />
        <Prose>
          <p>
            Content that is not in the page is not printed - the closed sections
            of an <code>AccordionGroup</code>, the rows of another page of a
            list. Open what should be printed in the <code>beforeprint</code>{" "}
            event of the window, or before calling <code>window.print()</code>{" "}
            from a button of your own:
          </p>
        </Prose>
        <CodeBlock code={expandAll} />
        <Callout>
          <p>
            Check a page without printing it: the Rendering panel of Chrome's
            DevTools emulates the <code>print</code> media type.
          </p>
        </Callout>
      </Section>
    </DocPage>
  );
}
